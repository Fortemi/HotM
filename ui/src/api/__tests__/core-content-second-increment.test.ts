import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../client';
import { createCollectionsApi } from '../collections';
import { createTemplatesApi } from '../templates';
import { createDocumentsApi } from '../documents';
import { createJobsApi } from '../jobs';
import { createConceptsApi } from '../concepts';
import { CORE_CONTENT_OPERATIONS } from '../core-content-operations';
import operationLedger from '../contracts/fortemi-operation-dispositions.json';

type ClientMethod = 'get' | 'getText' | 'post' | 'patch' | 'put' | 'delete';

interface EvidenceCase {
  operationId: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  contractPath: string;
  clientMethod: ClientMethod;
  expectedArgs: unknown[];
  invoke: () => Promise<unknown>;
}

const documentType = {
  name: 'markdown', display_name: 'Markdown', category: 'text', chunking_strategy: 'heading',
  is_system: false, is_active: true, created_at: '2026-08-01T00:00:00Z',
};
const job = {
  id: 'job-1', job_type: 'Embedding', status: 'running', note_id: null, priority: 5,
  progress_percent: 25, progress_message: 'Working', error_message: null, retry_count: 0,
  max_retries: 3, created_at: '2026-08-01T00:00:00Z', started_at: null,
  completed_at: null, cost_tier: 1, payload: { memory: 'notes', secret: 'discard' }, result: null,
};
const skosCollection = {
  id: 'skos-1', pref_label: 'Core', definition: null, is_ordered: false, scheme_id: null,
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', members: [],
};
const relation = {
  id: 'rel-1', subject_id: 'concept-1', object_id: 'concept-2', relation_type: 'broader',
  inference_score: null, is_inferred: false, is_validated: true, created_at: '2026-08-01T00:00:00Z',
};
const snapshot = { id: 'snap-1', label: 'Before', metrics: {}, captured_at: '2026-08-01T00:00:00Z' };

describe('core content second increment evidence', () => {
  let client: ApiClient;
  let collections: ReturnType<typeof createCollectionsApi>;
  let templates: ReturnType<typeof createTemplatesApi>;
  let documents: ReturnType<typeof createDocumentsApi>;
  let jobs: ReturnType<typeof createJobsApi>;
  let concepts: ReturnType<typeof createConceptsApi>;

  const response = (path: string, method: ClientMethod): unknown => {
    if (path === '/collections/collection-1/notes') return { notes: [], collection_id: 'collection-1' };
    if (path === '/collections/collection-1/export') return '# collection';
    if (path === '/templates/template-1') return { id: 'template-1', name: 'Daily', content: '# {{title}}', default_tags: [], variables: ['title'], created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' };
    if (path === '/templates/template-1/instantiate') return { id: 'note-1' };
    if (path === '/document-types/detect') return { document_type: documentType, confidence: 0.9, detection_method: 'extension' };
    if (path === '/document-types/markdown') return { ...documentType, display_name: 'Updated' };
    if (path === '/jobs' && method === 'post') return { id: 'job-created', status: 'queued', message: 'Queued' };
    if (path === '/jobs/job-1') return job;
    if (path === '/jobs/pending') return { pending: 2 };
    if (path === '/jobs/stats') return { pending: 2, processing: 1, completed_last_hour: 3, failed_last_hour: 0, total: 6, delayed: 0, dead: 0, incompatible: 0 };
    if (path === '/jobs/status') return { global: 'running', archives: { notes: 'paused' }, queue: { pending: 2, running: 1 } };
    if (path === '/jobs/pause') return { status: 'paused', scope: 'global' };
    if (path === '/jobs/resume') return { status: 'resumed', scope: 'global' };
    if (path === '/jobs/pause/notes') return { status: 'paused', scope: 'archive', archive: 'notes' };
    if (path === '/jobs/resume/notes') return { status: 'resumed', scope: 'archive', archive: 'notes' };
    if (path === '/extraction/stats') return { total_jobs: 4, completed_jobs: 3, failed_jobs: 0, pending_jobs: 1, avg_duration_secs: 2.5, strategy_breakdown: { text: 4 } };
    if (/\/concepts\/concept-1\/(broader|narrower|related)$/.test(path) && method === 'get') {
      const parts = path.split('/');
      const kind = parts[parts.length - 1];
      return [{ ...relation, relation_type: kind }];
    }
    if (/\/concepts\/concept-1\/(broader|narrower|related)$/.test(path) && method === 'post') return { success: true };
    if (path === '/concepts/collections' && method === 'get') return [skosCollection];
    if (path === '/concepts/collections' && method === 'post') return { id: 'skos-1' };
    if (path === '/concepts/collections/skos-1') return skosCollection;
    if (path === '/graph/note-1') return { nodes: [{ id: 'note-1' }], edges: [], meta: { truncated_nodes: 0, truncated_edges: 0, effective_depth: 2 } };
    if (path === '/graph/topology/stats') return { total_notes: 1, total_links: 0, isolated_nodes: 1, connected_components: 1, avg_degree: 0, max_degree: 0, min_degree_linked: 0, median_degree: 0, linking_strategy: 'adaptive_knn', effective_k: 5 };
    if (path === '/graph/diagnostics') return { computed_at: '2026-08-01T00:00:00Z', note_count: 1, embedding_count: 1, edge_count: 0, embedding_space: { similarity_mean: 0.2, anisotropy_score: 0.1 }, topology: { degree_cv: 0 }, normalized_edges: {} };
    if (path === '/graph/diagnostics/snapshot') return snapshot;
    if (path === '/graph/diagnostics/history') return [snapshot];
    if (path === '/graph/diagnostics/compare') return { before: snapshot, after: { ...snapshot, id: 'snap-2', label: 'After' }, delta: { similarity_mean_delta: 0.1, degree_cv_delta: -0.1, summary: ['Improved'] } };
    if (path === '/graph/snn/recompute') return { status: 'dry_run', total_edges: 10, retained: 8, updated: 8, pruned: 2, retention_ratio: 0.8, node_count: 5, retained_mean_degree: 3.2, k_used: 5, threshold_used: 0.1, dry_run: true, snn_score_distribution: [0, 1, 2, 3, 4, 0, 0, 0, 0, 0], minimum_retention_ratio: 0.05, minimum_retained_mean_degree: 1, aggressive_pruning_override: false, safety_reasons: [], remediation: null };
    if (path === '/graph/pfnet/sparsify') return { total_edges: 10, retained: 6, pruned: 4, retention_ratio: 0.6, q_used: 2, dry_run: true };
    if (path === '/graph/community/coarse') return { note_count: 10, edge_count: 12, coarse_dim: 64, similarity_threshold: 0.3, community_count: 2, modularity_q: 0.4, largest_community_ratio: 0.6, communities: [] };
    if (path === '/graph/maintenance') return { id: 'job-graph', status: 'queued', steps: ['normalize', 'snn', 'pfnet', 'snapshot'] };
    if (path === '/graph/cold-spots') return { summary: { total_notes: 10, isolated_count: 2, cold_access_count: 3, overlap_count: 1 }, recommendations: ['Review'], isolated_notes: {}, cold_access_notes: {}, overlap: {} };
    return undefined;
  };

  beforeEach(() => {
    client = {
      get: vi.fn(async (path: string) => response(path, 'get')),
      getText: vi.fn(async (path: string) => response(path, 'getText')),
      post: vi.fn(async (path: string) => response(path, 'post')),
      patch: vi.fn(async (path: string) => response(path, 'patch')),
      put: vi.fn(async (path: string) => response(path, 'put')),
      delete: vi.fn(async (path: string) => response(path, 'delete')),
    } as unknown as ApiClient;
    collections = createCollectionsApi(client);
    templates = createTemplatesApi(client);
    documents = createDocumentsApi(client);
    jobs = createJobsApi(client);
    concepts = createConceptsApi(client);
  });

  function cases(): EvidenceCase[] {
    return [
      { operationId: 'export_collection', method: 'GET', contractPath: '/api/v1/collections/{id}/export', clientMethod: 'getText', expectedArgs: ['/collections/collection-1/export', { include_frontmatter: 'true' }], invoke: () => collections.exportMarkdown('collection-1', { includeFrontmatter: true }) },
      { operationId: 'get_collection_notes', method: 'GET', contractPath: '/api/v1/collections/{id}/notes', clientMethod: 'get', expectedArgs: ['/collections/collection-1/notes', { limit: '100' }], invoke: () => collections.getNotes('collection-1', { limit: 100 }) },
      { operationId: 'move_note_to_collection', method: 'POST', contractPath: '/api/v1/notes/{id}/move', clientMethod: 'post', expectedArgs: ['/notes/note-1/move', { collection_id: 'collection-1' }], invoke: () => collections.moveNote('note-1', { collection_id: 'collection-1' }) },
      { operationId: 'get_template', method: 'GET', contractPath: '/api/v1/templates/{id}', clientMethod: 'get', expectedArgs: ['/templates/template-1'], invoke: () => templates.get('template-1') },
      { operationId: 'instantiate_template', method: 'POST', contractPath: '/api/v1/templates/{id}/instantiate', clientMethod: 'post', expectedArgs: ['/templates/template-1/instantiate', { variables: { title: 'Today' }, tags: null, collection_id: null, revision_mode: null }], invoke: () => templates.instantiate('template-1', { variables: { title: 'Today' } }) },
      { operationId: 'detect_document_type', method: 'POST', contractPath: '/api/v1/document-types/detect', clientMethod: 'post', expectedArgs: ['/document-types/detect', { filename: 'x.md' }], invoke: () => documents.detect({ filename: 'x.md' }) },
      { operationId: 'update_document_type', method: 'PATCH', contractPath: '/api/v1/document-types/{name}', clientMethod: 'patch', expectedArgs: ['/document-types/markdown', { display_name: 'Updated' }], invoke: () => documents.update('markdown', { display_name: 'Updated' }) },
      { operationId: 'get_job', method: 'GET', contractPath: '/api/v1/jobs/{id}', clientMethod: 'get', expectedArgs: ['/jobs/job-1'], invoke: () => jobs.get('job-1') },
      { operationId: 'pending_jobs_count', method: 'GET', contractPath: '/api/v1/jobs/pending', clientMethod: 'get', expectedArgs: ['/jobs/pending'], invoke: () => jobs.getPendingCount() },
      { operationId: 'queue_stats', method: 'GET', contractPath: '/api/v1/jobs/stats', clientMethod: 'get', expectedArgs: ['/jobs/stats'], invoke: () => jobs.getQueueStats() },
      { operationId: 'get_job_pause_status', method: 'GET', contractPath: '/api/v1/jobs/status', clientMethod: 'get', expectedArgs: ['/jobs/status'], invoke: () => jobs.getPauseStatus() },
      { operationId: 'pause_jobs_global', method: 'POST', contractPath: '/api/v1/jobs/pause', clientMethod: 'post', expectedArgs: ['/jobs/pause'], invoke: () => jobs.pauseGlobal() },
      { operationId: 'resume_jobs_global', method: 'POST', contractPath: '/api/v1/jobs/resume', clientMethod: 'post', expectedArgs: ['/jobs/resume'], invoke: () => jobs.resumeGlobal() },
      { operationId: 'pause_jobs_archive', method: 'POST', contractPath: '/api/v1/jobs/pause/{archive}', clientMethod: 'post', expectedArgs: ['/jobs/pause/notes'], invoke: () => jobs.pauseArchive('notes') },
      { operationId: 'resume_jobs_archive', method: 'POST', contractPath: '/api/v1/jobs/resume/{archive}', clientMethod: 'post', expectedArgs: ['/jobs/resume/notes'], invoke: () => jobs.resumeArchive('notes') },
      { operationId: 'extraction_stats', method: 'GET', contractPath: '/api/v1/extraction/stats', clientMethod: 'get', expectedArgs: ['/extraction/stats'], invoke: () => jobs.getExtractionStats() },
      { operationId: 'get_broader', method: 'GET', contractPath: '/api/v1/concepts/{id}/broader', clientMethod: 'get', expectedArgs: ['/concepts/concept-1/broader'], invoke: () => concepts.getBroaderRelations('concept-1') },
      { operationId: 'add_broader', method: 'POST', contractPath: '/api/v1/concepts/{id}/broader', clientMethod: 'post', expectedArgs: ['/concepts/concept-1/broader', { target_id: 'concept-2' }], invoke: () => concepts.addBroader('concept-1', 'concept-2') },
      { operationId: 'remove_broader', method: 'DELETE', contractPath: '/api/v1/concepts/{id}/broader/{target_id}', clientMethod: 'delete', expectedArgs: ['/concepts/concept-1/broader/concept-2'], invoke: () => concepts.removeBroader('concept-1', 'concept-2') },
      { operationId: 'get_narrower', method: 'GET', contractPath: '/api/v1/concepts/{id}/narrower', clientMethod: 'get', expectedArgs: ['/concepts/concept-1/narrower'], invoke: () => concepts.getNarrowerRelations('concept-1') },
      { operationId: 'add_narrower', method: 'POST', contractPath: '/api/v1/concepts/{id}/narrower', clientMethod: 'post', expectedArgs: ['/concepts/concept-1/narrower', { target_id: 'concept-2' }], invoke: () => concepts.addNarrower('concept-1', 'concept-2') },
      { operationId: 'remove_narrower', method: 'DELETE', contractPath: '/api/v1/concepts/{id}/narrower/{target_id}', clientMethod: 'delete', expectedArgs: ['/concepts/concept-1/narrower/concept-2'], invoke: () => concepts.removeNarrower('concept-1', 'concept-2') },
      { operationId: 'get_related', method: 'GET', contractPath: '/api/v1/concepts/{id}/related', clientMethod: 'get', expectedArgs: ['/concepts/concept-1/related'], invoke: () => concepts.getRelatedRelations('concept-1') },
      { operationId: 'add_related', method: 'POST', contractPath: '/api/v1/concepts/{id}/related', clientMethod: 'post', expectedArgs: ['/concepts/concept-1/related', { target_id: 'concept-2' }], invoke: () => concepts.addRelated('concept-1', 'concept-2') },
      { operationId: 'remove_related', method: 'DELETE', contractPath: '/api/v1/concepts/{id}/related/{target_id}', clientMethod: 'delete', expectedArgs: ['/concepts/concept-1/related/concept-2'], invoke: () => concepts.removeRelated('concept-1', 'concept-2') },
      { operationId: 'list_skos_collections', method: 'GET', contractPath: '/api/v1/concepts/collections', clientMethod: 'get', expectedArgs: ['/concepts/collections', {}], invoke: () => concepts.listCollections() },
      { operationId: 'create_skos_collection', method: 'POST', contractPath: '/api/v1/concepts/collections', clientMethod: 'post', expectedArgs: ['/concepts/collections', { pref_label: 'Core', definition: null, is_ordered: false, scheme_id: null, concept_ids: null }], invoke: () => concepts.createCollection({ pref_label: 'Core', is_ordered: false }) },
      { operationId: 'get_skos_collection', method: 'GET', contractPath: '/api/v1/concepts/collections/{id}', clientMethod: 'get', expectedArgs: ['/concepts/collections/skos-1'], invoke: () => concepts.getCollection('skos-1') },
      { operationId: 'update_skos_collection', method: 'PATCH', contractPath: '/api/v1/concepts/collections/{id}', clientMethod: 'patch', expectedArgs: ['/concepts/collections/skos-1', { pref_label: 'Core' }], invoke: () => concepts.updateCollection('skos-1', { pref_label: 'Core' }) },
      { operationId: 'delete_skos_collection', method: 'DELETE', contractPath: '/api/v1/concepts/collections/{id}', clientMethod: 'delete', expectedArgs: ['/concepts/collections/skos-1'], invoke: () => concepts.deleteCollection('skos-1') },
      { operationId: 'replace_skos_collection_members', method: 'PUT', contractPath: '/api/v1/concepts/collections/{id}/members', clientMethod: 'put', expectedArgs: ['/concepts/collections/skos-1/members', { concept_ids: ['concept-1'] }], invoke: () => concepts.setCollectionMembers('skos-1', { concept_ids: ['concept-1'] }) },
      { operationId: 'add_skos_collection_member', method: 'POST', contractPath: '/api/v1/concepts/collections/{id}/members/{concept_id}', clientMethod: 'post', expectedArgs: ['/concepts/collections/skos-1/members/concept-1'], invoke: () => concepts.addCollectionMember('skos-1', 'concept-1') },
      { operationId: 'remove_skos_collection_member', method: 'DELETE', contractPath: '/api/v1/concepts/collections/{id}/members/{concept_id}', clientMethod: 'delete', expectedArgs: ['/concepts/collections/skos-1/members/concept-1'], invoke: () => concepts.removeCollectionMember('skos-1', 'concept-1') },
      { operationId: 'explore_graph', method: 'GET', contractPath: '/api/v1/graph/{id}', clientMethod: 'get', expectedArgs: ['/graph/note-1', { depth: '2', max_nodes: '100', min_score: '0' }], invoke: () => concepts.exploreKnowledgeGraph('note-1') },
      { operationId: 'graph_topology_stats', method: 'GET', contractPath: '/api/v1/graph/topology/stats', clientMethod: 'get', expectedArgs: ['/graph/topology/stats'], invoke: () => concepts.getKnowledgeGraphTopology() },
      { operationId: 'graph_diagnostics', method: 'GET', contractPath: '/api/v1/graph/diagnostics', clientMethod: 'get', expectedArgs: ['/graph/diagnostics', { sample_size: '1000' }], invoke: () => concepts.getKnowledgeGraphDiagnostics() },
      { operationId: 'capture_diagnostics_snapshot', method: 'POST', contractPath: '/api/v1/graph/diagnostics/snapshot', clientMethod: 'post', expectedArgs: ['/graph/diagnostics/snapshot', { label: 'Before', sample_size: 1000 }], invoke: () => concepts.captureKnowledgeGraphSnapshot('Before') },
      { operationId: 'list_diagnostics_snapshots', method: 'GET', contractPath: '/api/v1/graph/diagnostics/history', clientMethod: 'get', expectedArgs: ['/graph/diagnostics/history', { limit: '20' }], invoke: () => concepts.listKnowledgeGraphSnapshots() },
      { operationId: 'compare_diagnostics_snapshots', method: 'GET', contractPath: '/api/v1/graph/diagnostics/compare', clientMethod: 'get', expectedArgs: ['/graph/diagnostics/compare', { before: 'snap-1', after: 'snap-2' }], invoke: () => concepts.compareKnowledgeGraphSnapshots('snap-1', 'snap-2') },
      { operationId: 'recompute_snn_scores', method: 'POST', contractPath: '/api/v1/graph/snn/recompute', clientMethod: 'post', expectedArgs: ['/graph/snn/recompute', { dry_run: true }, undefined, undefined, [409]], invoke: () => concepts.recomputeKnowledgeGraphSnn({ dry_run: true }) },
      { operationId: 'pfnet_sparsify', method: 'POST', contractPath: '/api/v1/graph/pfnet/sparsify', clientMethod: 'post', expectedArgs: ['/graph/pfnet/sparsify', { dry_run: true }], invoke: () => concepts.sparsifyKnowledgeGraphPfnet({ dry_run: true }) },
      { operationId: 'coarse_community_detection', method: 'POST', contractPath: '/api/v1/graph/community/coarse', clientMethod: 'post', expectedArgs: ['/graph/community/coarse', {}], invoke: () => concepts.detectKnowledgeGraphCommunities() },
      { operationId: 'trigger_graph_maintenance', method: 'POST', contractPath: '/api/v1/graph/maintenance', clientMethod: 'post', expectedArgs: ['/graph/maintenance', { steps: ['normalize', 'snn', 'pfnet', 'snapshot'] }], invoke: () => concepts.triggerKnowledgeGraphMaintenance() },
      { operationId: 'get_cold_spots', method: 'GET', contractPath: '/api/v1/graph/cold-spots', clientMethod: 'get', expectedArgs: ['/graph/cold-spots', { limit: '20', cold_days: '30', max_accesses: '2' }], invoke: () => concepts.getKnowledgeGraphColdSpots() },
    ];
  }

  it('promotes exactly the executable second-increment ledger rows', () => {
    const evidence = cases();
    expect(evidence).toHaveLength(44);
    const promoted = CORE_CONTENT_OPERATIONS.filter((entry) => evidence.some((candidate) => candidate.operationId === entry.operationId));
    expect(promoted).toHaveLength(evidence.length);
    for (const entry of evidence) {
      expect(promoted).toContainEqual(expect.objectContaining({ method: entry.method, path: entry.contractPath, operationId: entry.operationId }));
      expect(operationLedger.operations).toContainEqual(expect.objectContaining({ method: entry.method, path: entry.contractPath, operation_id: entry.operationId }));
    }
  });

  it.each(Array.from({ length: 44 }, (_, index) => index))('dispatch row %i uses its exact serializer and decoder', async (index) => {
    const entry = cases()[index];
    expect(entry.clientMethod === 'getText' ? 'GET' : entry.clientMethod.toUpperCase()).toBe(entry.method);
    await entry.invoke();
    expect(vi.mocked(client[entry.clientMethod])).toHaveBeenCalledWith(...entry.expectedArgs);
  });

  it('does not retain arbitrary job payload, result, or server error text', async () => {
    const result = await jobs.get('job-1');
    expect(result.payload).toEqual({ memory: 'notes' });
    expect(result.has_result).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('dispatches create_job with its exact bounded serializer and decoder', async () => {
    const result = await jobs.create({ job_type: ' ai_revision ', note_id: 'note-1' });

    expect(client.post).toHaveBeenCalledWith('/jobs', {
      job_type: 'ai_revision',
      note_id: 'note-1',
      priority: null,
      payload: null,
      deduplicate: true,
    });
    expect(result).toEqual({ id: 'job-created', status: 'queued', message: 'Queued' });
  });
});
