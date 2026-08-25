import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import releasePolicy from './fixtures/fortemi-auth-release-policy-v1.json';
import manifest from './fixtures/fortemi-auth-v1.json';
import {
  FortemiAuthError,
  verifyFortemiBearer,
  type TenantRecord,
  type TenantStore,
} from './verify.js';

const MANIFEST_SHA256 = '2df0a35edad67cc3e8869286183a4d098b1eb8fc2161432ed0b54ba69b17e242';
const RELEASE_POLICY_SHA256 = 'd70491c336a62508ef3c7937af709dd121a6ec4f421ceab66486af3f371de8db';
const FIXTURE_TENANT_ID = '00000000-0000-4000-8000-000000000001';

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
    expect(manifest.contract_version).toBe('1.1.0');
    expect(manifest.profile).toBe('rust-node-jwt-v1');
  });

  it('vendors and enforces the exact CalVer release policy', async () => {
    const fixtureUrl = import.meta.url.includes('/dist/')
      ? new URL('../../src/auth/fixtures/fortemi-auth-release-policy-v1.json', import.meta.url)
      : new URL('./fixtures/fortemi-auth-release-policy-v1.json', import.meta.url);
    const bytes = await readFile(fixtureUrl);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(RELEASE_POLICY_SHA256);
    expect(releasePolicy.policy_id).toBe('fortemi-auth-release-compatibility');
    expect(releasePolicy.policy_version).toBe('1.1.0');
    expect(releasePolicy.release_scheme).toBe('calver-yyyy-m-patch');
    expect(releasePolicy.current_release.version).toBe('2026.8.1');
    expect(releasePolicy.current_release.tag).toBe('v2026.8.1');
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
          isTenantActive: (tenantId) => tenantId === FIXTURE_TENANT_ID,
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

  for (const testCase of manifest.tenant_store_cases) {
    it(testCase.id, async () => {
      const tenantStore: TenantStore = {
        async lookup(tenantId): Promise<TenantRecord | null> {
          switch (testCase.store_result) {
            case 'unavailable':
            case 'timeout':
              throw new Error(testCase.store_result);
            case 'malformed_response':
              return { tenantId, status: 'invalid' } as unknown as TenantRecord;
            case 'inactive':
              return { tenantId, status: 'suspended' };
            case 'not_found':
              return null;
            default:
              throw new Error(`unsupported authority fixture: ${testCase.store_result}`);
          }
        },
      };
      const valid = manifest.cases.find((entry) => entry.id === 'valid')!;
      const verification = verifyFortemiBearer(valid.token, {
        issuer: manifest.config.issuer,
        audience: manifest.config.audience,
        tenantClaimName: manifest.config.tenant_claim_name,
        clockSkewSeconds: manifest.config.clock_skew_seconds,
        jwks: manifest.jwks,
        tenantStore,
      }, valid.required_scope);

      await expect(verification).rejects.toMatchObject({
        code: testCase.expected.error,
        httpStatus: testCase.expected.http_status,
      });
    });
  }
});
