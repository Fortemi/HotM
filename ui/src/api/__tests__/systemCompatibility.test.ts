import { describe, expect, it, vi } from 'vitest';
import {
  createCompatibilityAdmissionGate,
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

  it('uses SemVer numeric prerelease precedence and ignores build metadata', () => {
    const fixture = compatibilityFixture({
      api: {
        ...compatibilityFixture().api,
        minimum_hotm_enterprise_client: '2026.6.0-beta.2',
        version: '2026.7.19+build.42',
      },
    });
    expect(normalizeSystemCompatibility(fixture, '2026.6.0-beta.10+client.1')).toBeTruthy();
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

  it.each([
    ['2026.6.99', 'server_api_too_old'],
    ['2027.0.0', 'server_api_too_new'],
    ['latest', 'invalid_api_version'],
  ] as const)('fails closed on server API version %s', (version, code) => {
    expectContractError(
      () => normalizeSystemCompatibility(
        compatibilityFixture({ api: { ...compatibilityFixture().api, version } }),
        '2026.7.1',
      ),
      code,
    );
  });

  it('fails closed when authenticated mode omits or changes the claim contract', () => {
    const authenticated = {
      ...compatibilityFixture().auth,
      required: true,
      mode: 'oauth_bearer',
      oauth_issuer_configured: true,
    };
    expectContractError(
      () => normalizeSystemCompatibility(
        compatibilityFixture({ auth: authenticated }),
        '2026.7.1',
      ),
      'unsupported_auth_contract',
    );
    expectContractError(
      () => normalizeSystemCompatibility(
        compatibilityFixture({ auth: { ...authenticated, claim_contract_version: '2' } }),
        '2026.7.1',
      ),
      'unsupported_auth_contract',
    );
  });

  it('accepts only the exact hosted auth authority tuple', () => {
    const hostedAuth = {
      ...compatibilityFixture().auth,
      required: true,
      mode: 'hosted_oauth',
      oauth_issuer_configured: true,
      tenant_context_available: true,
      claim_contract_version: '1.0.0',
      claim_contract_profile: 'rust-node-jwt-v1',
      authority_release: 'v2026.7.0',
    };

    expect(normalizeSystemCompatibility(
      compatibilityFixture({ auth: hostedAuth }),
      '2026.7.1',
    ).auth).toEqual(hostedAuth);

    for (const auth of [
      { ...hostedAuth, claim_contract_profile: 'unknown-profile' },
      { ...hostedAuth, authority_release: 'v2026.8.0' },
    ]) {
      expectContractError(
        () => normalizeSystemCompatibility(compatibilityFixture({ auth }), '2026.7.1'),
        'unsupported_auth_contract',
      );
    }
  });
});

describe('compatibility admission gate', () => {
  it('caches a compatible preflight', async () => {
    const get = vi.fn().mockResolvedValue(compatibilityFixture());
    const gate = createCompatibilityAdmissionGate({ get } as never);

    await gate.requireRemoteMutation();
    await gate.requireRemoteMutation();

    expect(get).toHaveBeenCalledOnce();
    expect(gate.getSnapshot().state).toBe('compatible');
  });

  it('preserves a typed block reason and does not retry a blocked mutation', async () => {
    const error = new SystemCompatibilityContractError('unsupported_revision', 'unsupported');
    const get = vi.fn().mockRejectedValue(error);
    const gate = createCompatibilityAdmissionGate({ get } as never);

    await expect(gate.requireRemoteMutation()).rejects.toBe(error);
    await expect(gate.requireRemoteMutation()).rejects.toBe(error);

    expect(get).toHaveBeenCalledOnce();
    expect(gate.getSnapshot()).toMatchObject({ state: 'blocked', error });
  });
});
