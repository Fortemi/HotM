import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
  type JWTVerifyGetKey,
  type RemoteJWKSetOptions,
} from 'jose';

export type SharedAuthErrorCode =
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
  | 'tenant_store_unavailable'
  | 'insufficient_scope'
  | 'api_key_not_allowed'
  | 'invalid_api_key'
  | 'api_key_revoked'
  | 'api_key_expired'
  | 'api_key_tenant_mismatch'
  | 'jwks_unreachable'
  | 'jwks_cache_failure'
  | 'config_error'
  | 'internal_error';

export type AuthErrorCode = SharedAuthErrorCode;
export type AuthHttpStatus = 401 | 403 | 500 | 503;

export const AUTH_ERROR_HTTP_STATUS: Readonly<Record<AuthErrorCode, AuthHttpStatus>> = Object.freeze({
  invalid_signature: 401,
  key_not_found: 401,
  malformed_token: 401,
  wrong_audience: 401,
  wrong_issuer: 401,
  unsupported_algorithm: 401,
  expired_token: 401,
  not_yet_valid: 401,
  missing_tenant_claim: 403,
  invalid_tenant_claim: 403,
  unknown_tenant: 403,
  tenant_store_unavailable: 503,
  insufficient_scope: 403,
  api_key_not_allowed: 403,
  invalid_api_key: 401,
  api_key_revoked: 401,
  api_key_expired: 401,
  api_key_tenant_mismatch: 403,
  jwks_unreachable: 503,
  jwks_cache_failure: 503,
  config_error: 500,
  internal_error: 500,
});

export class FortemiAuthError extends Error {
  readonly code: AuthErrorCode;
  readonly httpStatus: AuthHttpStatus;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = 'FortemiAuthError';
    this.code = code;
    this.httpStatus = AUTH_ERROR_HTTP_STATUS[code];
  }
}

export type TenantStatus = 'active' | 'suspended' | 'soft_deleted';

export interface TenantRecord {
  readonly tenantId: string;
  readonly status: TenantStatus;
}

/** Public CE seam. Internal distributions provide the backing implementation. */
export interface TenantStore {
  lookup(tenantId: string): Promise<TenantRecord | null>;
}

export interface RemoteJwksConfig {
  readonly timeoutDuration: number;
  readonly cooldownDuration: number;
  readonly cacheMaxAge: number;
}

export interface FortemiAuthConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly tenantClaimName: string;
  readonly clockSkewSeconds: number;
  readonly jwks?: JSONWebKeySet;
  readonly jwksUrl?: string | URL;
  readonly remoteJwks?: RemoteJwksConfig;
  readonly tenantStore?: TenantStore;
  /** Compatibility adapter for the pinned conformance corpus. */
  readonly isTenantActive?: (tenantId: string) => boolean | Promise<boolean>;
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

export type FortemiBearerVerifier = (
  token: string,
  requiredScope?: string,
) => Promise<FortemiAuthContext>;

interface VerifierRuntime {
  readonly issuer: string;
  readonly audience: string;
  readonly tenantClaimName: string;
  readonly clockSkewSeconds: number;
  readonly resolveKey: JWTVerifyGetKey;
  readonly tenantStore: TenantStore;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function authError(code: AuthErrorCode): FortemiAuthError {
  return new FortemiAuthError(code);
}

function mapRemoteJwksError(error: unknown): FortemiAuthError {
  if (error instanceof FortemiAuthError) return error;
  if (error instanceof errors.JWKSNoMatchingKey) return authError('key_not_found');
  if (
    error instanceof errors.JWKSInvalid
    || error instanceof errors.JWKInvalid
    || error instanceof errors.JWKSMultipleMatchingKeys
  ) {
    return authError('jwks_cache_failure');
  }
  if (
    error instanceof errors.JWKSTimeout
    || error instanceof errors.JOSEError
    || error instanceof TypeError
  ) {
    return authError('jwks_unreachable');
  }
  return authError('jwks_unreachable');
}

function mapJoseError(error: unknown): FortemiAuthError {
  if (error instanceof FortemiAuthError) return error;
  if (error instanceof errors.JWTExpired) return authError('expired_token');
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.claim === 'nbf') return authError('not_yet_valid');
    if (error.claim === 'iss') return authError('wrong_issuer');
    if (error.claim === 'aud') return authError('wrong_audience');
  }
  if (error instanceof errors.JWSSignatureVerificationFailed) {
    return authError('invalid_signature');
  }
  if (error instanceof errors.JWKSNoMatchingKey) return authError('key_not_found');
  if (error instanceof errors.JOSEAlgNotAllowed) return authError('unsupported_algorithm');
  if (error instanceof errors.JWKSInvalid || error instanceof errors.JWKInvalid) {
    return authError('jwks_cache_failure');
  }
  return authError('malformed_token');
}

function assertUniqueProtectedHeaderKeys(token: string): void {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0]) throw authError('malformed_token');

  let source: string;
  try {
    source = Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch {
    throw authError('malformed_token');
  }

  const first = source.search(/\S/);
  if (first < 0 || source[first] !== '{') throw authError('malformed_token');

  const containers: string[] = [];
  const keys = new Set<string>();
  let expectingKey = false;
  for (let index = first; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{' || character === '[') {
      containers.push(character);
      if (containers.length === 1) expectingKey = true;
      continue;
    }
    if (character === '}' || character === ']') {
      containers.pop();
      continue;
    }
    if (character === ',' && containers.length === 1) {
      expectingKey = true;
      continue;
    }
    if (character !== '"') continue;

    let end = index + 1;
    let escaped = false;
    for (; end < source.length; end += 1) {
      const candidate = source[end];
      if (escaped) {
        escaped = false;
      } else if (candidate === '\\') {
        escaped = true;
      } else if (candidate === '"') {
        break;
      }
    }
    if (end >= source.length) throw authError('malformed_token');

    if (containers.length === 1 && expectingKey) {
      let key: string;
      try {
        key = JSON.parse(source.slice(index, end + 1)) as string;
      } catch {
        throw authError('malformed_token');
      }
      if (keys.has(key)) throw authError('malformed_token');
      keys.add(key);
      let colon = end + 1;
      while (/\s/.test(source[colon] ?? '')) colon += 1;
      if (source[colon] !== ':') throw authError('malformed_token');
      expectingKey = false;
    }
    index = end;
  }
}

function numericClaim(payload: JWTPayload, name: 'iat' | 'exp'): number {
  const value = payload[name];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw authError('malformed_token');
  }
  return value;
}

function tenantStoreFromConfig(config: FortemiAuthConfig): TenantStore {
  if (config.tenantStore) return config.tenantStore;
  if (config.isTenantActive) {
    const isTenantActive = config.isTenantActive;
    return Object.freeze({
      async lookup(tenantId: string): Promise<TenantRecord | null> {
        return await isTenantActive(tenantId) ? { tenantId, status: 'active' } : null;
      },
    });
  }
  return Object.freeze({
    async lookup(): Promise<never> {
      throw authError('tenant_store_unavailable');
    },
  });
}

function localKeyResolver(jwks: JSONWebKeySet): JWTVerifyGetKey {
  const immutableJwks = Object.freeze({
    keys: Object.freeze(jwks.keys.map((key) => Object.freeze({ ...key }))),
  }) as unknown as JSONWebKeySet;
  return createLocalJWKSet(immutableJwks);
}

function remoteKeyResolver(
  jwksUrl: string | URL,
  options: RemoteJwksConfig | undefined,
): JWTVerifyGetKey {
  const remoteOptions: RemoteJWKSetOptions | undefined = options
    ? {
      timeoutDuration: options.timeoutDuration,
      cooldownDuration: options.cooldownDuration,
      cacheMaxAge: options.cacheMaxAge,
    }
    : undefined;
  const resolveRemote = createRemoteJWKSet(new URL(jwksUrl), remoteOptions);
  return async (protectedHeader, token) => {
    try {
      return await resolveRemote(protectedHeader, token);
    } catch (error) {
      throw mapRemoteJwksError(error);
    }
  };
}

function createVerifierRuntime(config: FortemiAuthConfig): VerifierRuntime {
  if ((config.jwks && config.jwksUrl) || (!config.jwks && !config.jwksUrl)) {
    throw authError('config_error');
  }
  const resolveKey = config.jwks
    ? localKeyResolver(config.jwks)
    : remoteKeyResolver(config.jwksUrl!, config.remoteJwks);
  return Object.freeze({
    issuer: config.issuer,
    audience: config.audience,
    tenantClaimName: config.tenantClaimName,
    clockSkewSeconds: config.clockSkewSeconds,
    resolveKey,
    tenantStore: tenantStoreFromConfig(config),
  });
}

async function requireActiveTenant(tenantId: string, store: TenantStore): Promise<void> {
  let tenant: TenantRecord | null;
  try {
    tenant = await store.lookup(tenantId);
  } catch (error) {
    if (
      error instanceof FortemiAuthError
      && (error.code === 'unknown_tenant' || error.code === 'tenant_store_unavailable')
    ) {
      throw error;
    }
    throw authError('tenant_store_unavailable');
  }
  if (!tenant) {
    throw authError('unknown_tenant');
  }
  if (
    typeof tenant !== 'object'
    || tenant.tenantId !== tenantId
    || !['active', 'suspended', 'soft_deleted'].includes(tenant.status)
  ) {
    throw authError('tenant_store_unavailable');
  }
  if (tenant.status !== 'active') throw authError('unknown_tenant');
}

async function verifyWithRuntime(
  token: string,
  runtime: VerifierRuntime,
  requiredScope?: string,
): Promise<FortemiAuthContext> {
  assertUniqueProtectedHeaderKeys(token);
  let header: ReturnType<typeof decodeProtectedHeader>;
  try {
    header = decodeProtectedHeader(token);
  } catch {
    throw authError('malformed_token');
  }

  if (typeof header.alg !== 'string' || header.alg.length === 0) {
    throw authError('malformed_token');
  }
  if (header.alg !== 'RS256') throw authError('unsupported_algorithm');
  if (typeof header.kid !== 'string' || header.kid.length === 0) {
    throw authError('key_not_found');
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, runtime.resolveKey, {
      algorithms: ['RS256'],
      issuer: runtime.issuer,
      audience: runtime.audience,
      clockTolerance: runtime.clockSkewSeconds,
    }));
  } catch (error) {
    throw mapJoseError(error);
  }

  const issuedAt = numericClaim(payload, 'iat');
  const expiresAt = numericClaim(payload, 'exp');
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + runtime.clockSkewSeconds) throw authError('not_yet_valid');

  const rawTenant = payload[runtime.tenantClaimName];
  if (rawTenant === undefined) throw authError('missing_tenant_claim');
  if (typeof rawTenant !== 'string' || !UUID_V4.test(rawTenant)) {
    throw authError('invalid_tenant_claim');
  }
  await requireActiveTenant(rawTenant, runtime.tenantStore);

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

/** Snapshot config and construct one reusable key resolver for this verifier. */
export function createFortemiAuthVerifier(config: FortemiAuthConfig): FortemiBearerVerifier {
  const runtime = createVerifierRuntime(config);
  return (token, requiredScope) => verifyWithRuntime(token, runtime, requiredScope);
}

/** One-shot compatibility entry point used by the pinned corpus tests. */
export async function verifyFortemiBearer(
  token: string,
  config: FortemiAuthConfig,
  requiredScope?: string,
): Promise<FortemiAuthContext> {
  return createFortemiAuthVerifier(config)(token, requiredScope);
}
