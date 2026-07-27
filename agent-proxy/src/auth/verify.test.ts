import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import releasePolicy from './fixtures/fortemi-auth-release-policy-v1.json';
import manifest from './fixtures/fortemi-auth-v1.json';
import { FortemiAuthError, verifyFortemiBearer } from './verify.js';

const MANIFEST_SHA256 = 'dbd7fff6370d8a0c55d2c7e4ad311d3ddd1796815e2caff6dc05501cdf417a38';
const RELEASE_POLICY_SHA256 = 'c8c6e2fd9237ddf238f74376aad841c53fce86885f95c982befdcbcd24880e5b';

interface ReleaseIdentity {
  version: string;
  contract_version: string;
  profile: string;
  manifest_sha256: string;
}

function evaluateRelease(current: ReleaseIdentity, candidate: ReleaseIdentity): string | null {
  if (candidate.version !== current.version) return 'unsupported_release';
  if (
    candidate.contract_version !== current.contract_version
    || candidate.profile !== current.profile
  ) {
    return 'contract_mismatch';
  }
  if (candidate.manifest_sha256 !== current.manifest_sha256) return 'artifact_mismatch';
  return null;
}

describe('fortemi-auth rust-node-jwt-v1 conformance', () => {
  it('vendors the exact authority manifest bytes', async () => {
    const fixtureUrl = import.meta.url.includes('/dist/')
      ? new URL('../../src/auth/fixtures/fortemi-auth-v1.json', import.meta.url)
      : new URL('./fixtures/fortemi-auth-v1.json', import.meta.url);
    const bytes = await readFile(fixtureUrl);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(MANIFEST_SHA256);
    expect(manifest.contract_id).toBe('fortemi-auth-conformance');
    expect(manifest.contract_version).toBe('1.0.0');
    expect(manifest.profile).toBe('rust-node-jwt-v1');
  });

  it('vendors and enforces the exact CalVer release policy', async () => {
    const fixtureUrl = import.meta.url.includes('/dist/')
      ? new URL('../../src/auth/fixtures/fortemi-auth-release-policy-v1.json', import.meta.url)
      : new URL('./fixtures/fortemi-auth-release-policy-v1.json', import.meta.url);
    const bytes = await readFile(fixtureUrl);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(RELEASE_POLICY_SHA256);
    expect(releasePolicy.policy_id).toBe('fortemi-auth-release-compatibility');
    expect(releasePolicy.policy_version).toBe('1.0.0');
    expect(releasePolicy.release_scheme).toBe('calver-yyyy-m-patch');
    expect(releasePolicy.current_release.version).toBe('2026.7.0');
    expect(releasePolicy.current_release.tag).toBe('v2026.7.0');
    expect(releasePolicy.current_release.version).toMatch(/^\d{4}\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);

    for (const testCase of releasePolicy.compatibility_cases) {
      const result = evaluateRelease(releasePolicy.current_release, testCase.candidate);
      expect(result, testCase.id).toBe(
        testCase.expected.outcome === 'accepted' ? null : testCase.expected.error,
      );
    }
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
