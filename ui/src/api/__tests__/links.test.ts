import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLinksApi } from '../links';
import type { ApiClient } from '../client';

describe('Links and graph API', () => {
  let mockClient: ApiClient;
  let linksApi: ReturnType<typeof createLinksApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
      baseUrl: 'http://localhost:3000/api/v1',
    } as unknown as ApiClient;

    linksApi = createLinksApi(mockClient);
  });

  it('explores graph by note ID with Fortemi query guardrails', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ nodes: [], edges: [] });

    await linksApi.exploreGraph('note-1', {
      depth: 3,
      max_nodes: 100,
      min_score: 0.25,
      max_edges_per_node: 20,
      min_edge_weight: 0.1,
      max_depth: 4,
      algorithms: ['snn', 'pfnet'],
      include_bridges_only: true,
    });

    expect(mockClient.get).toHaveBeenCalledWith('/graph/note-1', {
      depth: '3',
      max_nodes: '100',
      min_score: '0.25',
      max_edges_per_node: '20',
      min_edge_weight: '0.1',
      max_depth: '4',
      algorithms: 'snn,pfnet',
      include_bridges_only: 'true',
    });
  });

  it('fetches graph topology statistics', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      total_notes: 3,
      total_links: 2,
      isolated_nodes: 1,
      connected_components: 1,
      avg_degree: 1.33,
      max_degree: 2,
    });

    const result = await linksApi.getGraphTopologyStats();

    expect(mockClient.get).toHaveBeenCalledWith('/graph/topology/stats');
    expect(result.total_notes).toBe(3);
  });

  it('fetches graph diagnostics and snapshot history operations', async () => {
    vi.mocked(mockClient.get)
      .mockResolvedValueOnce({ sample_size: 500, orphan_ratio: 0.1 })
      .mockResolvedValueOnce([{ id: 'snapshot-1', label: 'before' }])
      .mockResolvedValueOnce({ delta: { isolated_nodes: -2 } });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ id: 'snapshot-2', label: 'after' });

    await expect(linksApi.getGraphDiagnostics(500)).resolves.toEqual({
      sample_size: 500,
      orphan_ratio: 0.1,
    });
    await expect(linksApi.captureGraphDiagnosticsSnapshot({
      label: 'after',
      sample_size: 750,
    })).resolves.toEqual({ id: 'snapshot-2', label: 'after' });
    await expect(linksApi.listGraphDiagnosticsSnapshots(10)).resolves.toEqual([
      { id: 'snapshot-1', label: 'before' },
    ]);
    await expect(linksApi.compareGraphDiagnosticsSnapshots('snapshot-1', 'snapshot-2')).resolves.toEqual({
      delta: { isolated_nodes: -2 },
    });

    expect(mockClient.get).toHaveBeenNthCalledWith(1, '/graph/diagnostics', {
      sample_size: '500',
    });
    expect(mockClient.post).toHaveBeenCalledWith('/graph/diagnostics/snapshot', {
      label: 'after',
      sample_size: 750,
    });
    expect(mockClient.get).toHaveBeenNthCalledWith(2, '/graph/diagnostics/history', {
      limit: '10',
    });
    expect(mockClient.get).toHaveBeenNthCalledWith(3, '/graph/diagnostics/compare', {
      before: 'snapshot-1',
      after: 'snapshot-2',
    });
  });

  it('posts graph control operations to SNN, PFNET, coarse community, and maintenance routes', async () => {
    vi.mocked(mockClient.post)
      .mockResolvedValueOnce({
        status: 'dry_run',
        total_edges: 10,
        retained: 7,
        updated: 7,
        pruned: 3,
        retention_ratio: 0.7,
        node_count: 5,
        retained_mean_degree: 2.8,
        k_used: 12,
        threshold_used: 0.2,
        dry_run: true,
        snn_score_distribution: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        minimum_retention_ratio: 0.05,
        minimum_retained_mean_degree: 1,
        aggressive_pruning_override: false,
        safety_reasons: [],
        remediation: null,
      })
      .mockResolvedValueOnce({ pruned_edges: 4 })
      .mockResolvedValueOnce({ communities: 2 })
      .mockResolvedValueOnce({ id: 'job-1', status: 'queued', steps: ['snn', 'snapshot'] });

    await linksApi.recomputeSnnScores({
      k: 12,
      threshold: 0.2,
      dry_run: true,
      allow_aggressive_pruning: false,
    });
    await linksApi.sparsifyGraphWithPfnet({ q: 3, dry_run: false });
    await linksApi.detectCoarseGraphCommunities({
      coarse_dim: 64,
      similarity_threshold: 0.3,
      resolution: 1.2,
    });
    const maintenance = await linksApi.triggerGraphMaintenance({
      steps: ['snn', 'snapshot'],
      allow_aggressive_pruning: false,
    });

    expect(mockClient.post).toHaveBeenNthCalledWith(1, '/graph/snn/recompute', {
      k: 12,
      threshold: 0.2,
      dry_run: true,
      allow_aggressive_pruning: false,
    }, undefined, undefined, [409]);
    expect(mockClient.post).toHaveBeenNthCalledWith(2, '/graph/pfnet/sparsify', {
      q: 3,
      dry_run: false,
    });
    expect(mockClient.post).toHaveBeenNthCalledWith(3, '/graph/community/coarse', {
      coarse_dim: 64,
      similarity_threshold: 0.3,
      resolution: 1.2,
    });
    expect(mockClient.post).toHaveBeenNthCalledWith(4, '/graph/maintenance', {
      steps: ['snn', 'snapshot'],
      allow_aggressive_pruning: false,
    });
    expect(maintenance.status).toBe('queued');
  });

  it('fetches graph cold spots with query parameters', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      summary: {
        total_notes: 10,
        isolated_count: 2,
        isolated_pct: 20,
        cold_access_count: 3,
        cold_access_pct: 30,
        overlap_count: 1,
        parameters: { cold_days: 45, max_accesses: 1, limit: 5 },
      },
      isolated_notes: { count: 2, topic_summary: [], sample: [] },
      cold_access_notes: { count: 3, topic_summary: [], sample: [] },
      overlap: { description: 'overlap', count: 1, note_ids: ['note-1'] },
      recommendations: ['Review isolated notes.'],
    });

    const result = await linksApi.getGraphColdSpots({
      limit: 5,
      cold_days: 45,
      max_accesses: 1,
    });

    expect(mockClient.get).toHaveBeenCalledWith('/graph/cold-spots', {
      limit: '5',
      cold_days: '45',
      max_accesses: '1',
    });
    expect(result.summary.overlap_count).toBe(1);
  });

  it('validates required graph route inputs before dispatch', async () => {
    await expect(linksApi.exploreGraph('')).rejects.toThrow('Note ID is required');
    await expect(linksApi.captureGraphDiagnosticsSnapshot({ label: '' })).rejects.toThrow(
      'Snapshot label is required',
    );
    await expect(linksApi.compareGraphDiagnosticsSnapshots('', 'after')).rejects.toThrow(
      'Before snapshot ID is required',
    );
    await expect(linksApi.compareGraphDiagnosticsSnapshots('before', '')).rejects.toThrow(
      'After snapshot ID is required',
    );
  });

  it('does not expose removed explicit-link mutation methods', () => {
    expect(linksApi).not.toHaveProperty('createLink');
    expect(linksApi).not.toHaveProperty('deleteLink');
    expect(mockClient.post).not.toHaveBeenCalled();
    expect(mockClient.delete).not.toHaveBeenCalled();
  });
});
