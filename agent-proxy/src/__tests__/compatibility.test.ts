import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertCompatibleFortemi,
  CompatibilityAdmissionError,
  requireCompatibleFortemiMutation,
  resetCompatibilityAdmissionForTests,
} from '../compatibility.js';

const mockFetch = vi.fn<typeof globalThis.fetch>();

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    contract_revision: '2026-07-06',
    api: {
      name: 'fortemi',
      version: '2026.7.19',
      minimum_hotm_enterprise_client: '0.0.0-checkpoint',
    },
    auth: {
      required: false,
      mode: 'anonymous_local',
    },
    ...overrides,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  resetCompatibilityAdmissionForTests();
});

describe('agent-proxy compatibility admission', () => {
  it('accepts and caches the pinned local profile', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(fixture()), { status: 200 }));

    await requireCompatibleFortemiMutation('http://fortemi/api/v1');
    await requireCompatibleFortemiMutation('http://fortemi/api/v1');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(String(mockFetch.mock.calls[0][0])).toContain('/system/compatibility');
  });

  it.each([
    [{ contract_revision: '2026-07-07' }, 'unsupported_revision'],
    [{ api: { ...fixture().api, version: '2026.6.9' } }, 'server_api_too_old'],
    [{ api: { ...fixture().api, version: '2027.0.0' } }, 'server_api_too_new'],
    [{ api: { ...fixture().api, version: 'latest' } }, 'invalid_api_version'],
    [{ auth: { required: true, mode: 'oauth_bearer' } }, 'unsupported_auth_contract'],
  ] as const)('rejects incompatible metadata with %s', (overrides, code) => {
    expect(() => assertCompatibleFortemi(fixture(overrides))).toThrowError(
      expect.objectContaining<Partial<CompatibilityAdmissionError>>({ code }),
    );
  });

  it('caches an unavailable decision', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 503 }));

    await expect(requireCompatibleFortemiMutation('http://fortemi/api/v1')).rejects.toMatchObject({
      code: 'compatibility_unavailable',
    });
    await expect(requireCompatibleFortemiMutation('http://fortemi/api/v1')).rejects.toMatchObject({
      code: 'compatibility_unavailable',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
