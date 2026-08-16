import type { NextFunction, Request, RequestHandler, Response } from 'express';
import releasePolicy from './fixtures/fortemi-auth-release-policy-v1.json';
import { FortemiAuthError, verifyFortemiBearer, type FortemiAuthConfig } from './verify.js';
import {
  CompatibilityAdmissionError,
  requireCompatibleFortemi,
  type CompatibleFortemiMetadata,
} from '../compatibility.js';
import {
  runWithFortemiRequestContext,
  type FortemiRequestContext,
} from '../request-context.js';

const MEMORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const AUTH_RELEASE = releasePolicy.current_release;

export interface AuthenticatedAgentRequest extends Request {
  fortemiContext?: FortemiRequestContext;
}

interface AuthMiddlewareOptions {
  apiBaseUrl?: string;
  compatibility?: (apiBaseUrl: string) => Promise<CompatibleFortemiMetadata>;
  verify?: typeof verifyFortemiBearer;
  authConfig?: () => FortemiAuthConfig;
}

class AuthConfigurationError extends Error {}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AuthConfigurationError(`${name} is required`);
  return value;
}

function assertReleasedAuthIdentity(): void {
  const configuredRelease = requiredEnvironment('FORTEMI_AUTH_RELEASE');
  const configuredContract = process.env.FORTEMI_AUTH_CONTRACT_VERSION?.trim()
    ?? AUTH_RELEASE.contract_version;
  const configuredProfile = process.env.FORTEMI_AUTH_PROFILE?.trim() ?? AUTH_RELEASE.profile;
  if (
    configuredRelease !== AUTH_RELEASE.version
    || configuredContract !== AUTH_RELEASE.contract_version
    || configuredProfile !== AUTH_RELEASE.profile
  ) {
    throw new AuthConfigurationError('unsupported Fortemi auth release identity');
  }
}

function isSecureJwksUrl(value: URL): boolean {
  return value.protocol === 'https:'
    || (value.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(value.hostname));
}

export function authConfigFromEnvironment(): FortemiAuthConfig {
  assertReleasedAuthIdentity();
  const jwksUrl = new URL(requiredEnvironment('FORTEMI_AUTH_JWKS_URL'));
  if (!isSecureJwksUrl(jwksUrl)) {
    throw new AuthConfigurationError('FORTEMI_AUTH_JWKS_URL must use HTTPS outside localhost');
  }
  const clockSkewSeconds = Number(process.env.FORTEMI_AUTH_CLOCK_SKEW_SECONDS ?? '60');
  if (!Number.isSafeInteger(clockSkewSeconds) || clockSkewSeconds < 0 || clockSkewSeconds > 300) {
    throw new AuthConfigurationError('FORTEMI_AUTH_CLOCK_SKEW_SECONDS is invalid');
  }
  return {
    issuer: requiredEnvironment('FORTEMI_AUTH_ISSUER'),
    audience: requiredEnvironment('FORTEMI_AUTH_AUDIENCE'),
    tenantClaimName: process.env.FORTEMI_AUTH_TENANT_CLAIM?.trim() || 'fortemi:tenant_id',
    clockSkewSeconds,
    jwksUrl,
  };
}

function requestMemory(req: Request): string | null {
  const value = req.header('X-Fortemi-Memory')?.trim();
  if (!value || value === 'public') return null;
  if (!MEMORY_PATTERN.test(value)) throw new AuthConfigurationError('invalid memory context');
  return value;
}

function bearerToken(req: Request): { token: string; authorization: string } {
  const value = req.header('Authorization')?.trim();
  const match = /^Bearer ([^\s]+)$/i.exec(value ?? '');
  if (!match) throw new FortemiAuthError('malformed_token');
  return { token: match[1], authorization: `Bearer ${match[1]}` };
}

function sendAuthError(res: Response, error: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  if (error instanceof FortemiAuthError) {
    res.status(error.httpStatus).json({ error: error.code });
    return;
  }
  if (error instanceof CompatibilityAdmissionError) {
    res.status(503).json({ error: error.code });
    return;
  }
  res.status(503).json({ error: 'auth_configuration_error' });
}

export function createAgentAuthMiddleware(options: AuthMiddlewareOptions = {}): RequestHandler {
  const apiBaseUrl = options.apiBaseUrl
    ?? process.env.FORTEMI_API_URL
    ?? 'http://localhost:3000/api/v1';
  const compatibility = options.compatibility ?? requireCompatibleFortemi;
  const verify = options.verify ?? verifyFortemiBearer;
  const readAuthConfig = options.authConfig ?? authConfigFromEnvironment;

  return async (rawReq: Request, res: Response, next: NextFunction) => {
    const req = rawReq as AuthenticatedAgentRequest;
    try {
      const admitted = await compatibility(apiBaseUrl);
      const memory = requestMemory(req);
      let context: FortemiRequestContext;
      if (!admitted.auth.required) {
        context = { auth: null, authorization: null, memory, mode: 'anonymous_local' };
      } else {
        const { token, authorization } = bearerToken(req);
        const auth = await verify(token, readAuthConfig(), process.env.FORTEMI_AGENT_REQUIRED_SCOPE);
        const requestedTenant = req.header('X-Fortemi-Tenant')?.trim();
        if (requestedTenant && requestedTenant !== auth.tenantId) {
          throw new FortemiAuthError('unknown_tenant');
        }
        context = { auth, authorization, memory, mode: 'authenticated' };
      }
      req.fortemiContext = context;
      runWithFortemiRequestContext(context, next);
    } catch (error) {
      sendAuthError(res, error);
    }
  };
}

export function requireAgentRequestContext(req: Request): FortemiRequestContext {
  const context = (req as AuthenticatedAgentRequest).fortemiContext;
  if (!context) throw new AuthConfigurationError('agent request context is unavailable');
  return context;
}
