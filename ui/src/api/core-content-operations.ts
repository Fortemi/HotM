import operationLedger from './contracts/fortemi-operation-dispositions.json';

export type CoreContentFamily =
  | 'notes'
  | 'provenance'
  | 'collections'
  | 'templates'
  | 'document_types'
  | 'jobs'
  | 'concepts'
  | 'graph';

export interface CoreContentOperation {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  operationId: string;
  family: CoreContentFamily;
  destructive?: boolean;
}

const operation = (
  method: CoreContentOperation['method'],
  path: string,
  operationId: string,
  family: CoreContentFamily,
  destructive = false,
): CoreContentOperation => ({ method, path, operationId, family, ...(destructive ? { destructive } : {}) });

// Exact #295 promotion set from the pinned 251-operation ledger. A family name alone
// never grants support; every entry must also match the pinned method, path, and ID.
export const CORE_CONTENT_OPERATIONS: readonly CoreContentOperation[] = [
  operation('POST', '/api/v1/notes/bulk', 'bulk_create_notes', 'notes'),
  operation('POST', '/api/v1/notes/reprocess', 'bulk_reprocess_notes', 'notes'),
  operation('GET', '/api/v1/notes/activity', 'get_notes_activity', 'notes'),
  operation('GET', '/api/v1/notes/timeline', 'get_notes_timeline', 'notes'),
  operation('GET', '/api/v1/notes/{id}/export', 'export_note', 'notes'),
  operation('GET', '/api/v1/notes/{id}/full', 'get_full_document', 'notes'),
  operation('POST', '/api/v1/notes/{id}/purge', 'purge_note', 'notes', true),
  operation('POST', '/api/v1/notes/{id}/restore', 'restore_note', 'notes'),
  operation('PATCH', '/api/v1/notes/{id}/status', 'update_note_status', 'notes'),
  operation('DELETE', '/api/v1/notes/{id}/versions/{version}', 'delete_note_version', 'notes', true),
  operation('POST', '/api/v1/notes/{id}/versions/{version}/restore', 'restore_note_version', 'notes'),

  operation('POST', '/api/v1/provenance/devices', 'create_prov_device', 'provenance'),
  operation('POST', '/api/v1/provenance/files', 'create_file_provenance', 'provenance'),
  operation('POST', '/api/v1/provenance/locations', 'create_prov_location', 'provenance'),
  operation('POST', '/api/v1/provenance/named-locations', 'create_named_location', 'provenance'),
  operation('POST', '/api/v1/provenance/notes', 'create_note_provenance', 'provenance'),

  operation('GET', '/api/v1/collections/{id}/export', 'export_collection', 'collections'),
  operation('GET', '/api/v1/collections/{id}/notes', 'get_collection_notes', 'collections'),
  operation('POST', '/api/v1/notes/{id}/move', 'move_note_to_collection', 'collections'),

  operation('GET', '/api/v1/templates/{id}', 'get_template', 'templates'),
  operation('POST', '/api/v1/templates/{id}/instantiate', 'instantiate_template', 'templates'),

  operation('POST', '/api/v1/document-types/detect', 'detect_document_type', 'document_types'),
  operation('PATCH', '/api/v1/document-types/{name}', 'update_document_type', 'document_types'),

  operation('GET', '/api/v1/jobs/{id}', 'get_job', 'jobs'),
  operation('GET', '/api/v1/jobs/pending', 'pending_jobs_count', 'jobs'),
  operation('GET', '/api/v1/jobs/stats', 'queue_stats', 'jobs'),
  operation('GET', '/api/v1/jobs/status', 'get_job_pause_status', 'jobs'),
  operation('POST', '/api/v1/jobs/pause', 'pause_jobs_global', 'jobs'),
  operation('POST', '/api/v1/jobs/resume', 'resume_jobs_global', 'jobs'),
  operation('POST', '/api/v1/jobs/pause/{archive}', 'pause_jobs_archive', 'jobs'),
  operation('POST', '/api/v1/jobs/resume/{archive}', 'resume_jobs_archive', 'jobs'),
  operation('GET', '/api/v1/extraction/stats', 'extraction_stats', 'jobs'),

  operation('GET', '/api/v1/concepts/{id}/broader', 'get_broader', 'concepts'),
  operation('POST', '/api/v1/concepts/{id}/broader', 'add_broader', 'concepts'),
  operation('DELETE', '/api/v1/concepts/{id}/broader/{target_id}', 'remove_broader', 'concepts', true),
  operation('GET', '/api/v1/concepts/{id}/narrower', 'get_narrower', 'concepts'),
  operation('POST', '/api/v1/concepts/{id}/narrower', 'add_narrower', 'concepts'),
  operation('DELETE', '/api/v1/concepts/{id}/narrower/{target_id}', 'remove_narrower', 'concepts', true),
  operation('GET', '/api/v1/concepts/{id}/related', 'get_related', 'concepts'),
  operation('POST', '/api/v1/concepts/{id}/related', 'add_related', 'concepts'),
  operation('DELETE', '/api/v1/concepts/{id}/related/{target_id}', 'remove_related', 'concepts', true),
  operation('GET', '/api/v1/concepts/collections', 'list_skos_collections', 'concepts'),
  operation('POST', '/api/v1/concepts/collections', 'create_skos_collection', 'concepts'),
  operation('GET', '/api/v1/concepts/collections/{id}', 'get_skos_collection', 'concepts'),
  operation('PATCH', '/api/v1/concepts/collections/{id}', 'update_skos_collection', 'concepts'),
  operation('DELETE', '/api/v1/concepts/collections/{id}', 'delete_skos_collection', 'concepts', true),
  operation('PUT', '/api/v1/concepts/collections/{id}/members', 'replace_skos_collection_members', 'concepts', true),
  operation('POST', '/api/v1/concepts/collections/{id}/members/{concept_id}', 'add_skos_collection_member', 'concepts'),
  operation('DELETE', '/api/v1/concepts/collections/{id}/members/{concept_id}', 'remove_skos_collection_member', 'concepts', true),

  operation('GET', '/api/v1/graph/{id}', 'explore_graph', 'graph'),
  operation('GET', '/api/v1/graph/topology/stats', 'graph_topology_stats', 'graph'),
  operation('GET', '/api/v1/graph/diagnostics', 'graph_diagnostics', 'graph'),
  operation('POST', '/api/v1/graph/diagnostics/snapshot', 'capture_diagnostics_snapshot', 'graph'),
  operation('GET', '/api/v1/graph/diagnostics/history', 'list_diagnostics_snapshots', 'graph'),
  operation('GET', '/api/v1/graph/diagnostics/compare', 'compare_diagnostics_snapshots', 'graph'),
  operation('POST', '/api/v1/graph/snn/recompute', 'recompute_snn_scores', 'graph', true),
  operation('POST', '/api/v1/graph/pfnet/sparsify', 'pfnet_sparsify', 'graph', true),
  operation('POST', '/api/v1/graph/community/coarse', 'coarse_community_detection', 'graph', true),
  operation('POST', '/api/v1/graph/maintenance', 'trigger_graph_maintenance', 'graph', true),
  operation('GET', '/api/v1/graph/cold-spots', 'get_cold_spots', 'graph'),
] as const;

export interface PinnedOperationSupport {
  supported: boolean;
  reason: 'pinned_exact_match' | 'missing_from_pinned_contract' | 'contract_mismatch';
  operation: CoreContentOperation;
}

export function getPinnedOperationSupport(operationId: string): PinnedOperationSupport {
  const accepted = CORE_CONTENT_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (!accepted) {
    return {
      supported: false,
      reason: 'missing_from_pinned_contract',
      operation: { method: 'GET', path: '', operationId, family: 'notes' },
    };
  }
  const ledgerRow = operationLedger.operations.find((candidate) => candidate.operation_id === operationId);
  const supported = Boolean(
    ledgerRow
    && ledgerRow.method === accepted.method
    && ledgerRow.path === accepted.path,
  );
  return {
    supported,
    reason: supported ? 'pinned_exact_match' : ledgerRow ? 'contract_mismatch' : 'missing_from_pinned_contract',
    operation: accepted,
  };
}

export function getCoreContentOperations(family?: CoreContentFamily): readonly CoreContentOperation[] {
  return family ? CORE_CONTENT_OPERATIONS.filter((entry) => entry.family === family) : CORE_CONTENT_OPERATIONS;
}
