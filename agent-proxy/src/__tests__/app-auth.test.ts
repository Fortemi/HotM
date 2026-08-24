import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';

import { createAgentProxyApp } from '../app.js';
import manifest from '../auth/fixtures/fortemi-auth-v1.json';

const hostedCompatibility = async () => ({
  auth: {
    required: true as const,
    mode: 'hosted_oauth',
    claimContractVersion: '1.1.0',
    claimContractProfile: 'rust-node-jwt-v1',
    authorityRelease: 'v2026.8.0',
  },
});

function tokenFor(id: string): string {
  const testCase = manifest.cases.find((candidate) => candidate.id === id);
  if (!testCase) throw new Error(`missing auth fixture ${id}`);
  return testCase.token;
}

async function request(
  app: ReturnType<typeof createAgentProxyApp>,
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    return {
      status: response.status,
      body: await response.json() as Record<string, unknown>,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

describe('createAgentProxyApp auth boundary', () => {
  it('leaves the health probe public', async () => {
    const result = await request(createAgentProxyApp({ rateLimitRpm: 0 }), '/health');
    expect(result).toEqual({
      status: 200,
      body: { status: 'ok', service: 'agent-proxy' },
    });
  });

  it('protects /api/agent/chat before parsing request content', async () => {
    const app = createAgentProxyApp({
      rateLimitRpm: 0,
      auth: { compatibility: hostedCompatibility },
    });
    const result = await request(app, '/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    });
    expect(result).toEqual({ status: 401, body: { error: 'malformed_token' } });
  });

  it('fails closed in hosted mode when no tenant-store implementation is composed', async () => {
    const app = createAgentProxyApp({
      rateLimitRpm: 0,
      auth: {
        compatibility: hostedCompatibility,
        authConfig: () => ({
          issuer: manifest.config.issuer,
          audience: manifest.config.audience,
          tenantClaimName: manifest.config.tenant_claim_name,
          clockSkewSeconds: manifest.config.clock_skew_seconds,
          jwks: manifest.jwks,
        }),
      },
    });
    const result = await request(app, '/api/agent/chat', {
      headers: { Authorization: `Bearer ${tokenFor('valid')}` },
    });
    expect(result).toEqual({ status: 503, body: { error: 'tenant_store_unavailable' } });
  });

  it('admits the protected route only after verification and active-tenant lookup', async () => {
    const lookup = vi.fn(async (tenantId: string) => ({
      tenantId,
      status: 'active' as const,
    }));
    const app = createAgentProxyApp({
      rateLimitRpm: 0,
      auth: {
        compatibility: hostedCompatibility,
        authConfig: () => ({
          issuer: manifest.config.issuer,
          audience: manifest.config.audience,
          tenantClaimName: manifest.config.tenant_claim_name,
          clockSkewSeconds: manifest.config.clock_skew_seconds,
          jwks: manifest.jwks,
        }),
        tenantStore: { lookup },
      },
    });
    const result = await request(app, '/api/agent/chat', {
      headers: { Authorization: `Bearer ${tokenFor('valid')}` },
    });
    expect(result.status).toBe(200);
    expect(result.body.endpoint).toBe('/api/agent/chat');
    expect(lookup).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
  });
});
