import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createConceptsApi } from '../concepts';
import type { ApiClient } from '../client';

describe('Concepts API', () => {
  let mockClient: ApiClient;
  let conceptsApi: ReturnType<typeof createConceptsApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as unknown as ApiClient;

    conceptsApi = createConceptsApi(mockClient);
  });

  it('normalizes scheme list when API returns array payload', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce([
      {
        id: 'scheme-1',
        title: 'Default Concept Scheme',
        description: 'system',
      },
    ]);

    const schemes = await conceptsApi.listSchemes();

    expect(schemes).toHaveLength(1);
    expect(schemes[0].id).toBe('scheme-1');
    expect(schemes[0].title).toBe('Default Concept Scheme');
  });

  it('normalizes top concepts when API returns array payload', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce([
      {
        id: 'concept-1',
        primary_scheme_id: 'scheme-1',
        pref_label: 'API',
        notation: 'api',
      },
    ]);

    const concepts = await conceptsApi.getTopConcepts('scheme-1');

    expect(concepts).toHaveLength(1);
    expect(concepts[0].id).toBe('concept-1');
    expect(concepts[0].scheme_id).toBe('scheme-1');
    expect(concepts[0].pref_label).toBe('API');
  });

  it('deduplicates concepts by id in list responses', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce([
      {
        id: 'concept-1',
        primary_scheme_id: 'scheme-1',
        pref_label: 'API',
      },
      {
        id: 'concept-1',
        primary_scheme_id: 'scheme-1',
        pref_label: 'API',
      },
      {
        id: 'concept-2',
        primary_scheme_id: 'scheme-1',
        pref_label: 'SDK',
      },
    ]);

    const concepts = await conceptsApi.listConcepts({ schemeId: 'scheme-1' });

    expect(concepts).toHaveLength(2);
    expect(concepts.map((c) => c.id)).toEqual(['concept-1', 'concept-2']);
  });

  it('normalizes concept full labels/notes payload', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      id: 'concept-1',
      primary_scheme_id: 'scheme-1',
      notation: 'api',
      note_count: 7,
      labels: [
        { label_type: 'pref_label', value: 'API' },
        { label_type: 'alt_label', value: 'application programming interface' },
      ],
      notes: [{ note_type: 'definition', value: 'A programming interface.' }],
      broader: [],
      narrower: [],
      related: [],
    });

    const concept = await conceptsApi.getConceptFull('concept-1');

    expect(concept.pref_label).toBe('API');
    expect(concept.alt_labels).toEqual(['application programming interface']);
    expect(concept.definition).toBe('A programming interface.');
    expect(concept.usage_count).toBe(7);
  });

  it('decodes a retention safety abort returned as an accepted 409 result', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({
      status: 'safety_aborted',
      total_edges: 11449,
      retained: 132,
      updated: 0,
      pruned: 11317,
      retention_ratio: 132 / 11449,
      node_count: 1583,
      retained_mean_degree: (2 * 132) / 1583,
      k_used: 10,
      threshold_used: 0.1,
      dry_run: false,
      snn_score_distribution: [100, 200, 300, 400, 500, 600, 700, 800, 900, 6949],
      minimum_retention_ratio: 0.05,
      minimum_retained_mean_degree: 1,
      aggressive_pruning_override: false,
      safety_reasons: ['retention ratio is below policy'],
      remediation: 'Inspect a dry run or explicitly allow aggressive pruning.',
    });

    const result = await conceptsApi.recomputeKnowledgeGraphSnn({ dry_run: false });

    expect(mockClient.post).toHaveBeenCalledWith(
      '/graph/snn/recompute',
      { dry_run: false },
      undefined,
      undefined,
      [409],
    );
    expect(result.status).toBe('safety_aborted');
    expect(result.retained).toBe(132);
    expect(result.safety_reasons).toEqual(['retention ratio is below policy']);
  });
});
