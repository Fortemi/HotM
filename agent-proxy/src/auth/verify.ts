import {
  createLocalJWKSet,
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from 'jose';

export type AuthErrorCode =
  | 'invalid_signature'
  | 'key_not_found'
  | 'malformed_token'
  | 'wrong_audience'
  | 'wrong_issuer'
  | 'unsupported_algorithm'
  | 'expired_token'
  | 'not_yet_valid'
  | 'missing_tenant_claim'
  | 'invalid_tenant_claim'
  | 'unknown_tenant'
  | 'insufficient_scope';

export class FortemiAuthError extends Error {
  readonly code: AuthErrorCode;
  readonly httpStatus: 401 | 403;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = 'FortemiAuthError';
    this.code = code;
    this.httpStatus = [
      'missing_tenant_claim',
      'invalid_tenant_claim',
      'unknown_tenant',
      'insufficient_scope',
    ].includes(code)
      ? 403
      : 401;
  }
}

export interface FortemiAuthConfig {
  issuer: string;
  audience: string;
  tenantClaimName: string;
  clockSkewSeconds: number;
  jwks: JSONWebKeySet;
  isTenantActive?: (tenantId: string) => boolean | Promise<boolean>;
}

export interface FortemiAuthContext {
  tenantId: string;
  principalId: string;
  issuedAt: number;
  expiresAt: number;
  scopes: string[];
  sessionId?: string;
  credential: {
    kind: 'bearer';
    algorithm: 'RS256';
    keyId: string;
    tokenId?: string;
  };
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function authError(code: AuthErrorCode): FortemiAuthError {
  return new FortemiAuthError(code);
}

function mapJoseError(error: unknown): FortemiAuthError {
  if (error instanceof errors.JWTExpired) {
    return authError('expired_token');
  }
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.claim === 'nbf') return authError('not_yet_valid');
    if (error.claim === 'iss') return authError('wrong_issuer');
    if (error.claim === 'aud') return authError('wrong_audience');
  }
  if (error instanceof errors.JWSSignatureVerificationFailed) {
    return authError('invalid_signature');
  }
  if (error instanceof errors.JWKSNoMatchingKey) {
    return authError('key_not_found');
  }
  if (error instanceof errors.JOSEAlgNotAllowed) {
    return authError('unsupported_algorithm');
  }
  return authError('malformed_token');
}

function numericClaim(payload: JWTPayload, name: 'iat' | 'exp'): number {
  const value = payload[name];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw authError('malformed_token');
  }
  return value;
}

export async function verifyFortemiBearer(
  token: string,
  config: FortemiAuthConfig,
  requiredScope?: string,
): Promise<FortemiAuthContext> {
  let header: ReturnType<typeof decodeProtectedHeader>;
  try {
    header = decodeProtectedHeader(token);
  } catch {
    throw authError('malformed_token');
  }

  if (header.alg !== 'RS256') {
    throw authError('unsupported_algorithm');
  }
  if (typeof header.kid !== 'string' || header.kid.length === 0) {
    throw authError('key_not_found');
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, createLocalJWKSet(config.jwks), {
      algorithms: ['RS256'],
      issuer: config.issuer,
      audience: config.audience,
      clockTolerance: config.clockSkewSeconds,
    }));
  } catch (error) {
    throw mapJoseError(error);
  }

  const issuedAt = numericClaim(payload, 'iat');
  const expiresAt = numericClaim(payload, 'exp');
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + config.clockSkewSeconds) {
    throw authError('not_yet_valid');
  }

  const rawTenant = payload[config.tenantClaimName];
  if (rawTenant === undefined) {
    throw authError('missing_tenant_claim');
  }
  if (typeof rawTenant !== 'string' || !UUID_V4.test(rawTenant)) {
    throw authError('invalid_tenant_claim');
  }
  if (config.isTenantActive && !(await config.isTenantActive(rawTenant))) {
    throw authError('unknown_tenant');
  }

  const principalId = payload.sub;
  if (typeof principalId !== 'string' || principalId.length === 0) {
    throw authError('malformed_token');
  }
  if (payload.scope !== undefined && typeof payload.scope !== 'string') {
    throw authError('malformed_token');
  }
  const scopes = (payload.scope ?? '').split(/\s+/).filter(Boolean);
  if (requiredScope && !scopes.includes(requiredScope)) {
    throw authError('insufficient_scope');
  }

  return {
    tenantId: rawTenant,
    principalId,
    issuedAt,
    expiresAt,
    scopes,
    sessionId: typeof payload.sid === 'string' ? payload.sid : undefined,
    credential: {
      kind: 'bearer',
      algorithm: 'RS256',
      keyId: header.kid,
      tokenId: typeof payload.jti === 'string' ? payload.jti : undefined,
    },
  };
}
