import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../index';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(body: unknown) {
  const text = JSON.stringify(body);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
  };
}

function notFoundJson() {
  const text = JSON.stringify({ error: 'not found' });
  return {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    text: () => Promise.resolve(text),
  };
}

describe('api.healthCheck', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('normalizes legacy /health payload shape', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        ok: true,
        db: true,
        ollama: false,
      })
    );

    const api = createApi('http://localhost:3000');
    const result = await api.healthCheck();

    expect(result).toEqual(expect.objectContaining({
      status: 'healthy',
      version: 'unknown',
      database: 'connected',
      ollama: 'unavailable',
    }));
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/health');
  });

  it('falls back to alternate health endpoint when first is unavailable', async () => {
    mockFetch
      .mockResolvedValueOnce(notFoundJson())
      .mockResolvedValueOnce(
        okJson({
          status: 'healthy',
          version: '1.2.3',
          database: 'connected',
        })
      );

    const api = createApi('http://localhost:3000');
    const result = await api.healthCheck();

    expect(result).toEqual(expect.objectContaining({
      status: 'healthy',
      version: '1.2.3',
      database: 'connected',
      ollama: undefined,
    }));
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/health'
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/health/live'
    );
  });

  it('preserves Fortemi capability metadata from health payloads', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        status: 'healthy',
        version: '2026.5.25',
        database: true,
        capabilities: {
          chat: { available: false, configured: true },
          webhooks: true,
        },
        sse: { active_connections: 1, events_delivered: 42 },
      })
    );

    const api = createApi('http://localhost:3000');
    const result = await api.healthCheck();

    expect(result).toEqual(expect.objectContaining({
      status: 'healthy',
      version: '2026.5.25',
      database: 'connected',
      capabilities: {
        chat: { available: false, configured: true },
        webhooks: true,
      },
      sse: { active_connections: 1, events_delivered: 42 },
    }));
  });

  it('throws when all health endpoints fail', async () => {
    mockFetch
      .mockResolvedValueOnce(notFoundJson())
      .mockResolvedValueOnce(notFoundJson())
      .mockResolvedValueOnce(notFoundJson())
      .mockResolvedValueOnce(notFoundJson());

    const api = createApi('http://localhost:3000');
    await expect(api.healthCheck()).rejects.toThrow();
  });

  it('handles plain text health responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('healthy\n'),
    });

    const api = createApi('http://localhost:3000');
    const result = await api.healthCheck();

    expect(result).toEqual(expect.objectContaining({
      status: 'healthy',
      version: 'unknown',
      database: 'unknown',
      ollama: undefined,
    }));
  });
});

describe('api.systemCompatibility', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('HUX-REQ-001 HUX-REQ-002 HUX-REQ-003 fetches and normalizes the Fortemi compatibility contract', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        schema_version: 1,
        contract_revision: '2026-07-06',
        api: {
          name: 'fortemi',
          version: '2026.7.19',
          minimum_hotm_enterprise_client: '0.0.0-checkpoint',
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
          realtime_activity: { state: 'degraded', reason_code: 'streaming_health_degraded' },
          future_surface: { state: 'experimental' },
          malformed_surface: true,
        },
        links: {
          openapi: '/api/v1/operator/openapi.yaml',
          asyncapi: '/api/v1/operator/asyncapi.yaml',
          health: '/health',
          streaming_health: '/api/v1/health/streaming',
        },
      })
    );

    const api = createApi('http://localhost:3000/api/v1');
    const result = await api.systemCompatibility.get();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/system/compatibility',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.capabilities.core_notes).toEqual({ state: 'available' });
    expect(result.capabilities.realtime_activity).toEqual({
      state: 'degraded',
      reason_code: 'streaming_health_degraded',
    });
    expect(result.capabilities.future_surface).toEqual({ state: 'unknown' });
    expect(result.capabilities.malformed_surface).toEqual({ state: 'unknown' });
  });

  it('fetches advertised OpenAPI and AsyncAPI contracts from the Fortemi server root', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('openapi: 3.1.0\ninfo:\n  title: Fortemi\n'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('asyncapi: 3.0.0\ninfo:\n  title: Fortemi Events\n'),
      });

    const api = createApi('http://localhost:3000/api/v1');

    await expect(api.systemCompatibility.getOpenApi()).resolves.toContain('openapi: 3.1.0');
    await expect(api.systemCompatibility.getAsyncApi()).resolves.toContain('asyncapi: 3.0.0');

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/operator/openapi.yaml',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: expect.stringContaining('application/yaml') }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/operator/asyncapi.yaml',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: expect.stringContaining('application/yaml') }),
      }),
    );
  });
});
