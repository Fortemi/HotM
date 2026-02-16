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
});
