import type { NextFunction, Request, RequestHandler, Response } from 'express';
import releasePolicy from './fixtures/fortemi-auth-release-policy-v1.json';
import {
  createFortemiAuthVerifier,
  FortemiAuthError,
  type FortemiAuthConfig,
  type TenantStore,
} from './verify.js';
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

export interface AuthMiddlewareOptions {
  apiBaseUrl?: string;
  compatibility?: (apiBaseUrl: string) => Promise<CompatibleFortemiMetadata>;
  authConfig?: () => FortemiAuthConfig;
  tenantStore?: TenantStore;
}

class AuthConfigurationError extends Error {}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new FortemiAuthError('config_error');
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
    throw new FortemiAuthError('config_error');
  }
}

function isSecureJwksUrl(value: URL): boolean {
  return value.protocol === 'https:'
    || (value.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(value.hostname));
}

export function authConfigFromEnvironment(): FortemiAuthConfig {
  assertReleasedAuthIdentity();
  let jwksUrl: URL;
  try {
    jwksUrl = new URL(requiredEnvironment('FORTEMI_AUTH_JWKS_URL'));
  } catch {
    throw new FortemiAuthError('config_error');
  }
  if (!isSecureJwksUrl(jwksUrl)) {
    throw new FortemiAuthError('config_error');
  }
  const clockSkewSeconds = Number(process.env.FORTEMI_AUTH_CLOCK_SKEW_SECONDS ?? '60');
  if (!Number.isSafeInteger(clockSkewSeconds) || clockSkewSeconds < 0 || clockSkewSeconds > 300) {
    throw new FortemiAuthError('config_error');
  }
  const remoteJwks = {
    timeoutDuration: boundedIntegerEnvironment('FORTEMI_AUTH_JWKS_TIMEOUT_MS', 5_000, 100, 30_000),
    cooldownDuration: boundedIntegerEnvironment('FORTEMI_AUTH_JWKS_COOLDOWN_MS', 30_000, 0, 300_000),
    cacheMaxAge: boundedIntegerEnvironment('FORTEMI_AUTH_JWKS_CACHE_MAX_AGE_MS', 600_000, 1_000, 3_600_000),
  };
  return {
    issuer: requiredEnvironment('FORTEMI_AUTH_ISSUER'),
    audience: requiredEnvironment('FORTEMI_AUTH_AUDIENCE'),
    tenantClaimName: process.env.FORTEMI_AUTH_TENANT_CLAIM?.trim() || 'fortemi:tenant_id',
    clockSkewSeconds,
    jwksUrl,
    remoteJwks,
  };
}

function boundedIntegerEnvironment(
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(process.env[name] ?? String(defaultValue));
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new FortemiAuthError('config_error');
  }
  return value;
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
  const readAuthConfig = options.authConfig ?? authConfigFromEnvironment;
  let verify: ReturnType<typeof createFortemiAuthVerifier> | undefined;

  const verifier = (): ReturnType<typeof createFortemiAuthVerifier> => {
    if (!verify) {
      const config = readAuthConfig();
      if (config.isTenantActive) throw new FortemiAuthError('config_error');
      verify = createFortemiAuthVerifier({
        ...config,
        tenantStore: options.tenantStore ?? config.tenantStore,
      });
    }
    return verify;
  };

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
        const auth = await verifier()(token, process.env.FORTEMI_AGENT_REQUIRED_SCOPE);
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
