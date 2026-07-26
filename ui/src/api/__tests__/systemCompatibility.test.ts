import { describe, expect, it } from 'vitest';
import {
  SystemCompatibilityContractError,
  normalizeSystemCompatibility,
  type SystemCompatibilityResponse,
} from '../systemCompatibility';

function expectContractError(
  operation: () => unknown,
  code: SystemCompatibilityContractError['code'],
): void {
  try {
    operation();
    throw new Error(`Expected compatibility contract error ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(SystemCompatibilityContractError);
    expect((error as SystemCompatibilityContractError).code).toBe(code);
  }
}

function compatibilityFixture(
  overrides: Partial<SystemCompatibilityResponse> = {},
): SystemCompatibilityResponse {
  return {
    schema_version: 1,
    contract_revision: '2026-07-06',
    api: {
      name: 'fortemi',
      version: '2026.7.12',
      minimum_hotm_enterprise_client: '2026.5.0',
      git_sha_present: true,
      build_date_present: true,
    },
    deployment: {
      mode: 'local_sidecar',
      edition: 'community',
      hosted_multi_tenant_ready: false,
    },
    auth: {
      required: false,
      mode: 'anonymous_local',
      oauth_issuer_configured: false,
      tenant_context_available: false,
    },
    capabilities: {
      core_notes: { state: 'available' },
    },
    links: {
      openapi: '/api/v1/operator/openapi.yaml',
      asyncapi: '/api/v1/operator/asyncapi.yaml',
      health: '/health',
      streaming_health: '/api/v1/streaming/health',
    },
    ...overrides,
  };
}

describe('Fortemi compatibility boundary', () => {
  it('accepts the pinned revision when the running client is above the minimum', () => {
    expect(
      normalizeSystemCompatibility(compatibilityFixture(), '2026.6.0'),
    ).toMatchObject({
      schema_version: 1,
      contract_revision: '2026-07-06',
    });
  });

  it('accepts a client exactly equal to the declared minimum', () => {
    expect(
      normalizeSystemCompatibility(compatibilityFixture(), '2026.5.0'),
    ).toBeTruthy();
  });

  it('accepts the producer checkpoint minimum as older than a numbered client', () => {
    const fixture = compatibilityFixture({
      api: {
        ...compatibilityFixture().api,
        minimum_hotm_enterprise_client: '0.0.0-checkpoint',
      },
    });
    expect(normalizeSystemCompatibility(fixture, '2026.6.0')).toBeTruthy();
  });

  it('fails closed on a current-plus-one contract revision', () => {
    expectContractError(
      () => normalizeSystemCompatibility(
        compatibilityFixture({ contract_revision: '2026-07-07' }),
        '2026.6.0',
      ),
      'unsupported_revision',
    );
  });

  it('fails closed when the server requires a newer HotM client', () => {
    expectContractError(
      () => normalizeSystemCompatibility(
        compatibilityFixture({
          api: {
            ...compatibilityFixture().api,
            minimum_hotm_enterprise_client: '2026.6.1',
          },
        }),
        '2026.6.0',
      ),
      'minimum_client_not_met',
    );
  });

  it('fails closed on an unsupported schema and malformed minimum policy', () => {
    expectContractError(
      () => normalizeSystemCompatibility(
        compatibilityFixture({ schema_version: 2 }),
        '2026.6.0',
      ),
      'unsupported_schema',
    );

    expectContractError(
      () => normalizeSystemCompatibility(
        compatibilityFixture({
          api: {
            ...compatibilityFixture().api,
            minimum_hotm_enterprise_client: 'latest',
          },
        }),
        '2026.6.0',
      ),
      'invalid_minimum_client',
    );
  });
});
