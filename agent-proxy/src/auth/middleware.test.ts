import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from './fixtures/fortemi-auth-v1.json';
import {
  authConfigFromEnvironment,
  createAgentAuthMiddleware,
  type AuthenticatedAgentRequest,
} from './middleware.js';
import { FortemiAuthError, type TenantStatus, type TenantStore } from './verify.js';

const localCompatibility = async () => ({
  auth: { required: false as const, mode: 'anonymous_local' },
});
const hostedCompatibility = async () => ({
  auth: {
    required: true as const,
    mode: 'hosted_oauth',
    claimContractVersion: '1.1.0',
    claimContractProfile: 'rust-node-jwt-v1',
    authorityRelease: 'v2026.8.1',
  },
});

const FIXTURE_TENANT_ID = '00000000-0000-4000-8000-000000000001';

function tenantStore(status: TenantStatus | 'missing' = 'active'): TenantStore {
  return {
    async lookup(tenantId) {
      return status === 'missing' ? null : { tenantId, status };
    },
  };
}

function fixtureConfig(store: TenantStore = tenantStore()) {
  return {
    issuer: manifest.config.issuer,
    audience: manifest.config.audience,
    tenantClaimName: manifest.config.tenant_claim_name,
    clockSkewSeconds: manifest.config.clock_skew_seconds,
    jwks: manifest.jwks,
    tenantStore: store,
  };
}

function tokenFor(id: string): string {
  const testCase = manifest.cases.find((candidate) => candidate.id === id);
  if (!testCase) throw new Error(`missing auth fixture ${id}`);
  return testCase.token;
}

async function request(
  middleware: express.RequestHandler,
  options: { headers?: Record<string, string>; body?: string } = {},
) {
  const app = express();
  app.use('/protected', middleware, express.json());
  app.post('/protected', (req, res) => {
    const context = (req as AuthenticatedAgentRequest).fortemiContext;
    res.json({
      mode: context?.mode,
      tenant: context?.auth?.tenantId ?? null,
      memory: context?.memory ?? null,
    });
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server address unavailable');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/protected`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body ?? '{}',
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  } finally {
    server.close();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('agent auth middleware', () => {
  it('admits only the exact released environment identity', () => {
    vi.stubEnv('FORTEMI_AUTH_RELEASE', '2026.8.1');
    vi.stubEnv('FORTEMI_AUTH_CONTRACT_VERSION', '1.1.0');
    vi.stubEnv('FORTEMI_AUTH_PROFILE', 'rust-node-jwt-v1');
    vi.stubEnv('FORTEMI_AUTH_ISSUER', 'https://issuer.example');
    vi.stubEnv('FORTEMI_AUTH_AUDIENCE', 'fortemi');
    vi.stubEnv('FORTEMI_AUTH_JWKS_URL', 'https://issuer.example/.well-known/jwks.json');

    expect(authConfigFromEnvironment()).toMatchObject({
      issuer: 'https://issuer.example',
      audience: 'fortemi',
      tenantClaimName: 'fortemi:tenant_id',
    });
    vi.stubEnv('FORTEMI_AUTH_RELEASE', '2026.7.0');
    expect(() => authConfigFromEnvironment()).toThrowError(new FortemiAuthError('config_error'));
  });

  it('admits unauthenticated requests only for the advertised local profile', async () => {
    const result = await request(createAgentAuthMiddleware({ compatibility: localCompatibility }), {
      headers: { 'X-Fortemi-Memory': 'research' },
    });
    expect(result).toEqual({
      status: 200,
      body: { mode: 'anonymous_local', tenant: null, memory: 'research' },
    });
  });

  it('rejects missing credentials before parsing request content', async () => {
    const result = await request(createAgentAuthMiddleware({ compatibility: hostedCompatibility }), {
      body: '{not-json',
    });
    expect(result).toEqual({ status: 401, body: { error: 'malformed_token' } });
  });

  it('installs the released verifier context for hosted requests', async () => {
    const token = tokenFor('valid');
    const result = await request(createAgentAuthMiddleware({
      compatibility: hostedCompatibility,
      authConfig: fixtureConfig,
    }), {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Fortemi-Memory': 'research',
      },
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      mode: 'authenticated',
      tenant: '00000000-0000-4000-8000-000000000001',
      memory: 'research',
    });
  });

  it.each([
    ['expired', 'expired_token'],
    ['wrong-audience', 'wrong_audience'],
  ])('maps %s without exposing the credential', async (fixtureId, errorCode) => {
    const token = tokenFor(fixtureId);
    const result = await request(createAgentAuthMiddleware({
      compatibility: hostedCompatibility,
      authConfig: fixtureConfig,
    }), { headers: { Authorization: `Bearer ${token}` } });
    expect(result).toEqual({ status: 401, body: { error: errorCode } });
    expect(JSON.stringify(result.body)).not.toContain(token);
  });

  it('rejects an asserted tenant that differs from the verified claim', async () => {
    const result = await request(createAgentAuthMiddleware({
      compatibility: hostedCompatibility,
      authConfig: fixtureConfig,
    }), {
      headers: {
        Authorization: `Bearer ${tokenFor('valid')}`,
        'X-Fortemi-Tenant': '00000000-0000-4000-8000-000000000002',
      },
    });
    expect(result).toEqual({ status: 403, body: { error: 'unknown_tenant' } });
  });

  it.each([
    ['missing', 'missing'],
    ['suspended', 'suspended'],
    ['soft-deleted', 'soft_deleted'],
  ] as const)('fails closed for a %s tenant', async (_label, status) => {
    const result = await request(createAgentAuthMiddleware({
      compatibility: hostedCompatibility,
      authConfig: () => fixtureConfig(tenantStore(status)),
    }), { headers: { Authorization: `Bearer ${tokenFor('valid')}` } });
    expect(result).toEqual({ status: 403, body: { error: 'unknown_tenant' } });
  });

  it('maps tenant-store failures to a redacted 503', async () => {
    const result = await request(createAgentAuthMiddleware({
      compatibility: hostedCompatibility,
      authConfig: () => fixtureConfig({
        async lookup() {
          throw new Error('database host and credentials must stay private');
        },
      }),
    }), { headers: { Authorization: `Bearer ${tokenFor('valid')}` } });
    expect(result).toEqual({ status: 503, body: { error: 'tenant_store_unavailable' } });
    expect(JSON.stringify(result.body)).not.toContain('database');
  });

  it.each(['jwks_unreachable', 'jwks_cache_failure'] as const)(
    'maps %s through the shared AuthError status table',
    async (code) => {
      const result = await request(createAgentAuthMiddleware({
        compatibility: hostedCompatibility,
        authConfig: () => { throw new FortemiAuthError(code); },
      }), { headers: { Authorization: `Bearer ${tokenFor('valid')}` } });
      expect(result).toEqual({ status: 503, body: { error: code } });
    },
  );

  it('rejects the conformance-only tenant callback on the production path', async () => {
    const result = await request(createAgentAuthMiddleware({
      compatibility: hostedCompatibility,
      authConfig: () => ({
        ...fixtureConfig(),
        tenantStore: undefined,
        isTenantActive: async () => true,
      }),
    }), { headers: { Authorization: `Bearer ${tokenFor('valid')}` } });
    expect(result).toEqual({ status: 500, body: { error: 'config_error' } });
  });

  it('performs an active-tenant lookup for each admitted hosted request', async () => {
    const lookup = vi.fn(async (tenantId: string) => ({ tenantId, status: 'active' as const }));
    const authConfig = vi.fn(() => fixtureConfig({ lookup }));
    const middleware = createAgentAuthMiddleware({
      compatibility: hostedCompatibility,
      authConfig,
    });
    const headers = { Authorization: `Bearer ${tokenFor('valid')}` };
    expect((await request(middleware, { headers })).status).toBe(200);
    expect((await request(middleware, { headers })).status).toBe(200);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenCalledWith(FIXTURE_TENANT_ID);
    expect(authConfig).toHaveBeenCalledTimes(1);
  });
});
