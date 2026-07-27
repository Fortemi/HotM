import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import manifest from './fixtures/fortemi-auth-v1.json';
import { FortemiAuthError, verifyFortemiBearer } from './verify.js';

const MANIFEST_SHA256 = 'dbd7fff6370d8a0c55d2c7e4ad311d3ddd1796815e2caff6dc05501cdf417a38';

describe('fortemi-auth rust-node-jwt-v1 conformance', () => {
  it('vendors the exact authority manifest bytes', async () => {
    const fixtureUrl = import.meta.url.includes('/dist/')
      ? new URL('../../src/auth/fixtures/fortemi-auth-v1.json', import.meta.url)
      : new URL('./fixtures/fortemi-auth-v1.json', import.meta.url);
    const bytes = await readFile(fixtureUrl);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(MANIFEST_SHA256);
  });

  for (const testCase of manifest.cases) {
    it(testCase.id, async () => {
      const verification = verifyFortemiBearer(
        testCase.token,
        {
          issuer: manifest.config.issuer,
          audience: manifest.config.audience,
          tenantClaimName: manifest.config.tenant_claim_name,
          clockSkewSeconds: manifest.config.clock_skew_seconds,
          jwks: manifest.jwks,
          isTenantActive: (tenantId) => tenantId === '00000000-0000-4000-8000-000000000001',
        },
        testCase.required_scope,
      );

      if (testCase.expected.outcome === 'rejected') {
        const error = await verification.catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(FortemiAuthError);
        expect((error as FortemiAuthError).code).toBe(testCase.expected.error);
        return;
      }

      const context = await verification;
      expect(context.tenantId).toBe(testCase.expected.tenant_id);
      expect(context.principalId).toBe(testCase.expected.principal_id);
      expect(context.scopes).toEqual(testCase.expected.scopes);
      expect(context.credential.keyId).toBe(testCase.expected.key_id);
    });
  }
});
