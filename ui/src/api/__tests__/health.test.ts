import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHealthApi } from '../health';
import type { ApiClient } from '../client';

describe('Health API', () => {
  let mockClient: ApiClient;
  let healthApi: ReturnType<typeof createHealthApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as unknown as ApiClient;

    healthApi = createHealthApi(mockClient);
  });

  it('normalizes nested metrics response from Fortemi', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      total_notes: 243,
      stale_notes: 0,
      unlinked_notes: 100,
      orphan_tags: 0,
      metrics: {
        link_coverage: 0.588477366255144,
        tag_coverage: 1.0,
      },
    });

    const result = await healthApi.getKnowledgeHealth();

    expect(result.total_notes).toBe(243);
    expect(result.unlinked_notes).toBe(100);
    expect(result.avg_links_per_note).toBeCloseTo(0.588477366255144);
    expect(result.tag_coverage).toBe(1);
  });

  it('falls back to legacy top-level fields', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      total_notes: 10,
      orphan_notes: 1,
      stale_notes: 2,
      unlinked_notes: 3,
      avg_links_per_note: 1.5,
      tag_coverage: 0.4,
      last_activity: '2026-02-16T00:00:00Z',
    });

    const result = await healthApi.getKnowledgeHealth();

    expect(result).toEqual({
      total_notes: 10,
      orphan_notes: 1,
      stale_notes: 2,
      unlinked_notes: 3,
      avg_links_per_note: 1.5,
      tag_coverage: 0.4,
      last_activity: '2026-02-16T00:00:00Z',
    });
  });

  it('normalizes streaming health metric blocks', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 'healthy',
      chat: {
        chat_stream_started_total: { type: 'counter', value: 5 },
        chat_stream_dropped_tokens_total: { type: 'counter', value: 1 },
      },
      ingest: {
        ingest_stream_buffer_pressure: { type: 'gauge', value: 17 },
        ingest_stream_throttled_total: { type: 'counter', value: 2 },
      },
      sse: {
        active_connections: 3,
        events_delivered: 42,
      },
      inbound: {
        connectors: 2,
        errors_total: 1,
        lag_max: 9,
      },
      rtp: {
        active_sessions: 1,
      },
    });

    const result = await healthApi.getStreamingHealth();

    expect(mockClient.get).toHaveBeenCalledWith('/health/streaming');
    expect(result.status).toBe('healthy');
    expect(result.chat.state).toBe('reported');
    expect(result.chat.metrics.chat_stream_started_total).toEqual({ type: 'counter', value: 5 });
    expect(result.ingest.metrics.ingest_stream_buffer_pressure).toEqual({ type: 'gauge', value: 17 });
    expect(result.sse.metrics.active_connections).toEqual({ type: 'unknown', value: 3 });
    expect(result.inbound.metrics.lag_max).toEqual({ type: 'unknown', value: 9 });
  });

  it('marks missing and malformed streaming health blocks without treating them as reported', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 'healthy',
      chat: 'not-a-block',
      ingest: null,
      sse: {},
    });

    const result = await healthApi.getStreamingHealth();

    expect(result.chat.state).toBe('malformed');
    expect(result.ingest.state).toBe('missing');
    expect(result.sse.state).toBe('reported');
    expect(result.rtp.state).toBe('missing');
    expect(result.inbound.state).toBe('missing');
  });
});
