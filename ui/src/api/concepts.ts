/**
 * SKOS Concepts API client
 * Handles controlled vocabularies, taxonomies, and semantic tagging
 */

import type { ApiClient } from './client';
import type {
  ConceptScheme,
  CreateConceptSchemeRequest,
  Concept,
  CreateConceptRequest,
  ConceptFull,
  SkosCollection,
  SkosCollectionMember,
  CreateSkosCollectionRequest,
  SkosCollectionWithMembers,
  SetCollectionMembersRequest,
  ConceptGovernanceStats,
  ConceptListResponse,
  ConceptAutocompleteResponse,
} from './types-extended';
import {
  asArray,
  asRecord,
  booleanField,
  ContractDecodeError,
  finiteNumber,
  optionalString,
  requiredString,
  stringArray,
} from './contract-codecs';

const MAX_SKOS_ITEMS = 500;
const MAX_GRAPH_ITEMS = 1000;
const MAX_SUMMARY_STRINGS = 100;
const MAX_LABEL_CHARS = 512;

export type SkosRelationKind = 'broader' | 'narrower' | 'related';

export interface SkosRelationEdge {
  id: string;
  subject_id: string;
  object_id: string;
  relation_type: SkosRelationKind;
  inference_score: number | null;
  is_inferred: boolean;
  is_validated: boolean;
  created_at: string;
}

export interface KnowledgeMutationResult {
  success: true;
}

export interface SkosCollectionCreatedResult {
  id: string;
}

export interface GraphExploreSummary {
  node_count: number;
  edge_count: number;
  truncated_nodes: number;
  truncated_edges: number;
  effective_depth: number;
}

export interface GraphTopologySummary {
  total_notes: number;
  total_links: number;
  isolated_nodes: number;
  connected_components: number;
  avg_degree: number;
  max_degree: number;
  linking_strategy: string;
  effective_k: number;
}

export interface GraphDiagnosticsSummary {
  computed_at: string;
  note_count: number;
  embedding_count: number;
  edge_count: number;
  similarity_mean: number;
  anisotropy_score: number;
  degree_cv: number;
}

export interface GraphSnapshotSummary {
  id: string;
  label: string;
  captured_at: string;
}

export interface GraphComparisonSummary {
  before: GraphSnapshotSummary;
  after: GraphSnapshotSummary;
  similarity_mean_delta: number | null;
  degree_cv_delta: number | null;
  summary: string[];
}

export interface SnnControlResult {
  status: 'completed' | 'dry_run' | 'skipped_sparse' | 'safety_aborted';
  total_edges: number;
  retained: number;
  updated: number;
  pruned: number;
  retention_ratio: number;
  node_count: number;
  retained_mean_degree: number;
  k_used: number;
  threshold_used: number;
  dry_run: boolean;
  snn_score_distribution: number[];
  minimum_retention_ratio: number;
  minimum_retained_mean_degree: number;
  aggressive_pruning_override: boolean;
  safety_reasons: string[];
  remediation: string | null;
}

export interface PfnetControlResult {
  total_edges: number;
  retained: number;
  pruned: number;
  retention_ratio: number;
  q_used: number;
  dry_run: boolean;
}

export interface CommunityControlResult {
  note_count: number;
  edge_count: number;
  community_count: number;
  modularity_q: number;
  largest_community_ratio: number;
}

export interface GraphMaintenanceResult {
  id: string | null;
  status: 'queued' | 'already_pending';
  steps: string[];
}

export interface GraphColdSpotSummary {
  total_notes: number;
  isolated_count: number;
  cold_access_count: number;
  overlap_count: number;
  recommendation_count: number;
}

function boundedString(value: unknown, operationId: string, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractDecodeError(operationId, `expected ${field} to be a non-empty string`);
  }
  if (value.length > MAX_LABEL_CHARS) {
    throw new ContractDecodeError(operationId, `${field} exceeds ${MAX_LABEL_CHARS} characters`);
  }
  return value;
}

function boundedArray(value: unknown, operationId: string, field: string, max = MAX_SKOS_ITEMS): unknown[] {
  const entries = asArray(value, operationId, field);
  if (entries.length > max) throw new ContractDecodeError(operationId, `${field} exceeds ${max} entries`);
  return entries;
}

function decodeRelationEdges(payload: unknown, operationId: string, expected: SkosRelationKind): SkosRelationEdge[] {
  return boundedArray(payload, operationId, 'relations').map((entry) => {
    const raw = asRecord(entry, operationId);
    const relationType = requiredString(raw, 'relation_type', operationId);
    if (relationType !== expected) throw new ContractDecodeError(operationId, `expected ${expected} relation`);
    return {
      id: requiredString(raw, 'id', operationId),
      subject_id: requiredString(raw, 'subject_id', operationId),
      object_id: requiredString(raw, 'object_id', operationId),
      relation_type: expected,
      inference_score: typeof raw.inference_score === 'number' && Number.isFinite(raw.inference_score) ? raw.inference_score : null,
      is_inferred: booleanField(raw, 'is_inferred', operationId),
      is_validated: booleanField(raw, 'is_validated', operationId),
      created_at: requiredString(raw, 'created_at', operationId),
    };
  });
}

function decodeSuccess(payload: unknown, operationId: string): KnowledgeMutationResult {
  const raw = asRecord(payload, operationId);
  if (raw.success !== true) throw new ContractDecodeError(operationId, 'expected success=true');
  return { success: true };
}

function normalizeConcept(raw: unknown): Concept | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const id =
    (typeof data.id === 'string' ? data.id : null) ??
    (typeof data.concept_id === 'string' ? data.concept_id : null) ??
    '';
  if (!id) {
    return null;
  }

  const labels = Array.isArray(data.labels)
    ? (data.labels as Array<Record<string, unknown>>)
    : [];
  const prefLabelFromLabels = labels.find((entry) => entry.label_type === 'pref_label');
  const prefLabel =
    (typeof data.pref_label === 'string' ? data.pref_label : null) ??
    (typeof prefLabelFromLabels?.value === 'string'
      ? prefLabelFromLabels.value
      : null) ??
    (typeof data.notation === 'string' ? data.notation : null) ??
    'Untitled Concept';

  const altLabelsFromLabels = labels
    .filter((entry) => entry.label_type === 'alt_label')
    .map((entry) => (typeof entry.value === 'string' ? entry.value : ''))
    .filter(Boolean);
  const altLabels = Array.isArray(data.alt_labels)
    ? (data.alt_labels as string[])
    : altLabelsFromLabels.length > 0
      ? altLabelsFromLabels
      : undefined;

  const definitionFromField =
    typeof data.definition === 'string' ? data.definition : undefined;
  const notes = Array.isArray(data.notes) ? (data.notes as Array<Record<string, unknown>>) : [];
  const definitionFromNotes = notes.find((entry) => entry.note_type === 'definition');
  const definition =
    definitionFromField ??
    (typeof definitionFromNotes?.value === 'string'
      ? definitionFromNotes.value
      : undefined);

  return {
    id,
    concept_id:
      (typeof data.concept_id === 'string' ? data.concept_id : null) ??
      id,
    scheme_id:
      (typeof data.scheme_id === 'string' ? data.scheme_id : null) ??
      (typeof data.primary_scheme_id === 'string' ? data.primary_scheme_id : null) ??
      '',
    pref_label: prefLabel,
    alt_labels: altLabels,
    definition,
    notation: typeof data.notation === 'string' ? data.notation : undefined,
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    relevance_score:
      typeof data.relevance_score === 'number' ? data.relevance_score : undefined,
    is_primary: typeof data.is_primary === 'boolean' ? data.is_primary : undefined,
    source: typeof data.source === 'string' ? data.source : undefined,
    created_at: typeof data.created_at === 'string' ? data.created_at : '',
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : '',
  };
}

function normalizeConceptListResponse(payload: unknown): Concept[] {
  const rawList = Array.isArray(payload)
    ? payload
    : ((payload as { concepts?: unknown[] } | null)?.concepts ?? []);

  if (!Array.isArray(rawList)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: Concept[] = [];

  for (const item of rawList) {
    const concept = normalizeConcept(item);
    if (!concept) {
      continue;
    }
    if (seen.has(concept.id)) {
      continue;
    }
    seen.add(concept.id);
    normalized.push(concept);
  }

  return normalized;
}

function normalizeConceptScheme(raw: unknown): ConceptScheme | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id : '';
  const title = typeof data.title === 'string' ? data.title : '';
  if (!id || !title) {
    return null;
  }

  return {
    id,
    notation: typeof data.notation === 'string' ? data.notation : undefined,
    title,
    description: typeof data.description === 'string' ? data.description : undefined,
    namespace: typeof data.namespace === 'string' ? data.namespace : undefined,
    uri: typeof data.uri === 'string' ? data.uri : undefined,
    creator: typeof data.creator === 'string' ? data.creator : undefined,
    publisher: typeof data.publisher === 'string' ? data.publisher : undefined,
    rights: typeof data.rights === 'string' ? data.rights : undefined,
    version: typeof data.version === 'string' ? data.version : undefined,
    is_active: typeof data.is_active === 'boolean' ? data.is_active : undefined,
    created_at: typeof data.created_at === 'string' ? data.created_at : '',
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : '',
  };
}

function decodeSkosCollection(raw: unknown, operationId: string): SkosCollectionWithMembers {
  const data = asRecord(raw, operationId);
  const membersRaw = data.members == null ? [] : boundedArray(data.members, operationId, 'members');
  const members: SkosCollectionMember[] = membersRaw.map((entry) => {
    const member = asRecord(entry, operationId);
    return {
      concept_id: requiredString(member, 'concept_id', operationId),
      pref_label: optionalString(member, 'pref_label') ?? null,
      position: typeof member.position === 'number' && Number.isInteger(member.position) ? member.position : null,
      added_at: requiredString(member, 'added_at', operationId),
    };
  });
  const prefLabel = boundedString(data.pref_label, operationId, 'pref_label');
  return {
    id: requiredString(data, 'id', operationId),
    scheme_id: typeof data.scheme_id === 'string' ? data.scheme_id : null,
    label: prefLabel,
    pref_label: prefLabel,
    description: typeof data.definition === 'string' ? data.definition : typeof data.description === 'string' ? data.description : undefined,
    definition: typeof data.definition === 'string' ? data.definition : undefined,
    is_ordered: typeof data.is_ordered === 'boolean' ? data.is_ordered : false,
    created_at: typeof data.created_at === 'string' ? data.created_at : '',
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : '',
    members,
  };
}

function normalizeSchemeListResponse(payload: unknown): ConceptScheme[] {
  const rawList = Array.isArray(payload)
    ? payload
    : ((payload as { schemes?: unknown[] } | null)?.schemes ?? []);

  if (!Array.isArray(rawList)) {
    return [];
  }

  return rawList
    .map((item) => normalizeConceptScheme(item))
    .filter((item): item is ConceptScheme => item !== null);
}

function normalizeConceptFull(raw: unknown): ConceptFull {
  const concept = normalizeConcept(raw) ?? {
    id: '',
    scheme_id: '',
    pref_label: 'Untitled Concept',
    created_at: '',
    updated_at: '',
  };
  const data = (raw ?? {}) as Record<string, unknown>;

  return {
    ...concept,
    broader: normalizeConceptListResponse(data.broader),
    narrower: normalizeConceptListResponse(data.narrower),
    related: normalizeConceptListResponse(data.related),
    usage_count:
      (typeof data.usage_count === 'number' ? data.usage_count : null) ??
      (typeof data.note_count === 'number' ? data.note_count : undefined),
  };
}

function decodeGraphExplore(payload: unknown): GraphExploreSummary {
  const raw = asRecord(payload, 'explore_graph');
  const nodes = boundedArray(raw.nodes, 'explore_graph', 'nodes', MAX_GRAPH_ITEMS);
  const edges = boundedArray(raw.edges, 'explore_graph', 'edges', MAX_GRAPH_ITEMS);
  nodes.forEach((entry) => requiredString(asRecord(entry, 'explore_graph'), 'id', 'explore_graph'));
  edges.forEach((entry) => {
    const edge = asRecord(entry, 'explore_graph');
    requiredString(edge, 'source', 'explore_graph');
    requiredString(edge, 'target', 'explore_graph');
  });
  const meta = raw.meta == null ? {} : asRecord(raw.meta, 'explore_graph');
  return {
    node_count: nodes.length,
    edge_count: edges.length,
    truncated_nodes: finiteNumber(meta, 'truncated_nodes', 'explore_graph', 0),
    truncated_edges: finiteNumber(meta, 'truncated_edges', 'explore_graph', 0),
    effective_depth: finiteNumber(meta, 'effective_depth', 'explore_graph', 0),
  };
}

function decodeGraphTopology(payload: unknown): GraphTopologySummary {
  const raw = asRecord(payload, 'graph_topology_stats');
  return {
    total_notes: finiteNumber(raw, 'total_notes', 'graph_topology_stats'),
    total_links: finiteNumber(raw, 'total_links', 'graph_topology_stats'),
    isolated_nodes: finiteNumber(raw, 'isolated_nodes', 'graph_topology_stats'),
    connected_components: finiteNumber(raw, 'connected_components', 'graph_topology_stats'),
    avg_degree: finiteNumber(raw, 'avg_degree', 'graph_topology_stats'),
    max_degree: finiteNumber(raw, 'max_degree', 'graph_topology_stats'),
    linking_strategy: boundedString(raw.linking_strategy, 'graph_topology_stats', 'linking_strategy'),
    effective_k: finiteNumber(raw, 'effective_k', 'graph_topology_stats'),
  };
}

function decodeGraphDiagnostics(payload: unknown): GraphDiagnosticsSummary {
  const raw = asRecord(payload, 'graph_diagnostics');
  const embedding = asRecord(raw.embedding_space, 'graph_diagnostics');
  const topology = asRecord(raw.topology, 'graph_diagnostics');
  return {
    computed_at: requiredString(raw, 'computed_at', 'graph_diagnostics'),
    note_count: finiteNumber(raw, 'note_count', 'graph_diagnostics'),
    embedding_count: finiteNumber(raw, 'embedding_count', 'graph_diagnostics'),
    edge_count: finiteNumber(raw, 'edge_count', 'graph_diagnostics'),
    similarity_mean: finiteNumber(embedding, 'similarity_mean', 'graph_diagnostics'),
    anisotropy_score: finiteNumber(embedding, 'anisotropy_score', 'graph_diagnostics'),
    degree_cv: finiteNumber(topology, 'degree_cv', 'graph_diagnostics'),
  };
}

function decodeGraphSnapshot(payload: unknown, operationId: string): GraphSnapshotSummary {
  const raw = asRecord(payload, operationId);
  return {
    id: requiredString(raw, 'id', operationId),
    label: boundedString(raw.label, operationId, 'label'),
    captured_at: requiredString(raw, 'captured_at', operationId),
  };
}

function nullableNumber(record: Record<string, unknown>, field: string, operationId: string): number | null {
  const value = record[field];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContractDecodeError(operationId, `expected ${field} to be a finite number or null`);
  }
  return value;
}

function decodeGraphComparison(payload: unknown): GraphComparisonSummary {
  const raw = asRecord(payload, 'compare_diagnostics_snapshots');
  const delta = asRecord(raw.delta, 'compare_diagnostics_snapshots');
  const summary = stringArray(delta.summary);
  if (summary.length > MAX_SUMMARY_STRINGS || summary.some((entry) => entry.length > MAX_LABEL_CHARS)) {
    throw new ContractDecodeError('compare_diagnostics_snapshots', 'delta summary exceeds bounded limits');
  }
  return {
    before: decodeGraphSnapshot(raw.before, 'compare_diagnostics_snapshots'),
    after: decodeGraphSnapshot(raw.after, 'compare_diagnostics_snapshots'),
    similarity_mean_delta: nullableNumber(delta, 'similarity_mean_delta', 'compare_diagnostics_snapshots'),
    degree_cv_delta: nullableNumber(delta, 'degree_cv_delta', 'compare_diagnostics_snapshots'),
    summary,
  };
}

export function decodeSnnResult(payload: unknown): SnnControlResult {
  const raw = asRecord(payload, 'recompute_snn_scores');
  const status = requiredString(raw, 'status', 'recompute_snn_scores');
  if (!['completed', 'dry_run', 'skipped_sparse', 'safety_aborted'].includes(status)) {
    throw new ContractDecodeError('recompute_snn_scores', 'unexpected SNN status');
  }
  const scoreDistribution = boundedArray(
    raw.snn_score_distribution,
    'recompute_snn_scores',
    'snn_score_distribution',
    10,
  ).map((entry) => {
    if (!Number.isSafeInteger(entry) || (entry as number) < 0) {
      throw new ContractDecodeError('recompute_snn_scores', 'SNN score distribution must contain non-negative integers');
    }
    return entry as number;
  });
  const safetyReasons = boundedArray(
    raw.safety_reasons,
    'recompute_snn_scores',
    'safety_reasons',
    MAX_SUMMARY_STRINGS,
  ).map((entry) => boundedString(entry, 'recompute_snn_scores', 'safety reason'));
  const remediation = raw.remediation;
  if (remediation != null && (typeof remediation !== 'string' || remediation.length > MAX_LABEL_CHARS)) {
    throw new ContractDecodeError('recompute_snn_scores', 'remediation must be null or a bounded string');
  }
  return {
    status: status as SnnControlResult['status'],
    total_edges: finiteNumber(raw, 'total_edges', 'recompute_snn_scores'),
    retained: finiteNumber(raw, 'retained', 'recompute_snn_scores'),
    updated: finiteNumber(raw, 'updated', 'recompute_snn_scores'),
    pruned: finiteNumber(raw, 'pruned', 'recompute_snn_scores'),
    retention_ratio: finiteNumber(raw, 'retention_ratio', 'recompute_snn_scores'),
    node_count: finiteNumber(raw, 'node_count', 'recompute_snn_scores'),
    retained_mean_degree: finiteNumber(raw, 'retained_mean_degree', 'recompute_snn_scores'),
    k_used: finiteNumber(raw, 'k_used', 'recompute_snn_scores'),
    threshold_used: finiteNumber(raw, 'threshold_used', 'recompute_snn_scores'),
    dry_run: booleanField(raw, 'dry_run', 'recompute_snn_scores'),
    snn_score_distribution: scoreDistribution,
    minimum_retention_ratio: finiteNumber(raw, 'minimum_retention_ratio', 'recompute_snn_scores'),
    minimum_retained_mean_degree: finiteNumber(raw, 'minimum_retained_mean_degree', 'recompute_snn_scores'),
    aggressive_pruning_override: booleanField(raw, 'aggressive_pruning_override', 'recompute_snn_scores'),
    safety_reasons: safetyReasons,
    remediation: remediation ?? null,
  };
}

function decodePfnetResult(payload: unknown): PfnetControlResult {
  const raw = asRecord(payload, 'pfnet_sparsify');
  return {
    total_edges: finiteNumber(raw, 'total_edges', 'pfnet_sparsify'),
    retained: finiteNumber(raw, 'retained', 'pfnet_sparsify'),
    pruned: finiteNumber(raw, 'pruned', 'pfnet_sparsify'),
    retention_ratio: finiteNumber(raw, 'retention_ratio', 'pfnet_sparsify'),
    q_used: finiteNumber(raw, 'q_used', 'pfnet_sparsify'),
    dry_run: booleanField(raw, 'dry_run', 'pfnet_sparsify'),
  };
}

function decodeCommunityResult(payload: unknown): CommunityControlResult {
  const raw = asRecord(payload, 'coarse_community_detection');
  boundedArray(raw.communities, 'coarse_community_detection', 'communities', MAX_GRAPH_ITEMS);
  return {
    note_count: finiteNumber(raw, 'note_count', 'coarse_community_detection'),
    edge_count: finiteNumber(raw, 'edge_count', 'coarse_community_detection'),
    community_count: finiteNumber(raw, 'community_count', 'coarse_community_detection'),
    modularity_q: finiteNumber(raw, 'modularity_q', 'coarse_community_detection'),
    largest_community_ratio: finiteNumber(raw, 'largest_community_ratio', 'coarse_community_detection'),
  };
}

function decodeGraphMaintenance(payload: unknown): GraphMaintenanceResult {
  const raw = asRecord(payload, 'trigger_graph_maintenance');
  const status = requiredString(raw, 'status', 'trigger_graph_maintenance');
  if (status !== 'queued' && status !== 'already_pending') {
    throw new ContractDecodeError('trigger_graph_maintenance', 'unexpected maintenance status');
  }
  const steps = raw.steps == null ? [] : stringArray(raw.steps);
  if (steps.length > 10) throw new ContractDecodeError('trigger_graph_maintenance', 'steps exceeds 10 entries');
  return {
    id: typeof raw.id === 'string' ? raw.id : null,
    status,
    steps,
  };
}

function decodeColdSpots(payload: unknown): GraphColdSpotSummary {
  const raw = asRecord(payload, 'get_cold_spots');
  const summary = asRecord(raw.summary, 'get_cold_spots');
  const recommendations = stringArray(raw.recommendations);
  if (recommendations.length > MAX_SUMMARY_STRINGS) {
    throw new ContractDecodeError('get_cold_spots', `recommendations exceeds ${MAX_SUMMARY_STRINGS} entries`);
  }
  return {
    total_notes: finiteNumber(summary, 'total_notes', 'get_cold_spots'),
    isolated_count: finiteNumber(summary, 'isolated_count', 'get_cold_spots'),
    cold_access_count: finiteNumber(summary, 'cold_access_count', 'get_cold_spots'),
    overlap_count: finiteNumber(summary, 'overlap_count', 'get_cold_spots'),
    recommendation_count: recommendations.length,
  };
}

export function createConceptsApi(client: ApiClient) {
  return {
    // ===========================
    // Concept Schemes
    // ===========================

    /**
     * List all concept schemes
     */
    async listSchemes(): Promise<ConceptScheme[]> {
      const response = await client.get<{ schemes: ConceptScheme[] } | ConceptScheme[]>(
        '/concepts/schemes'
      );
      return normalizeSchemeListResponse(response);
    },

    /**
     * Create a new concept scheme
     */
    async createScheme(
      request: CreateConceptSchemeRequest
    ): Promise<ConceptScheme> {
      if (!request.title || request.title.trim() === '') {
        throw new Error('Scheme title is required');
      }
      if (!request.notation || request.notation.trim() === '') {
        throw new Error('Scheme notation is required');
      }
      const normalized = normalizeConceptScheme(await client.post<unknown>('/concepts/schemes', request));
      if (!normalized) throw new Error('Invalid concept scheme payload');
      return normalized;
    },

    /**
     * Get a specific concept scheme
     */
    async getScheme(schemeId: string): Promise<ConceptScheme> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      const normalized = normalizeConceptScheme(await client.get<unknown>(`/concepts/schemes/${encodeURIComponent(schemeId)}`));
      if (!normalized) throw new Error('Invalid concept scheme payload');
      return normalized;
    },

    /**
     * Update a concept scheme
     */
    async updateScheme(
      schemeId: string,
      updates: Partial<CreateConceptSchemeRequest>
    ): Promise<ConceptScheme> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      const { notation: _notation, namespace: _namespace, uri: _uri, ...payload } = updates;
      await client.patch(`/concepts/schemes/${encodeURIComponent(schemeId)}`, payload);
      return this.getScheme(schemeId);
    },

    async deleteScheme(schemeId: string): Promise<void> {
      if (!schemeId || schemeId.trim() === '') throw new Error('Scheme ID is required');
      await client.delete(`/concepts/schemes/${encodeURIComponent(schemeId)}`);
    },

    async exportAllSchemesTurtle(): Promise<string> {
      return client.getText('/concepts/schemes/export/turtle');
    },

    /**
     * Get top-level concepts in a scheme
     */
    async getTopConcepts(schemeId: string): Promise<Concept[]> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/schemes/${schemeId}/top-concepts`
      );

      return normalizeConceptListResponse(response);
    },

    // ===========================
    // Concepts
    // ===========================

    /**
     * List/search concepts
     */
    async listConcepts(options: {
      schemeId?: string;
      search?: string;
      limit?: number;
    } = {}): Promise<Concept[]> {
      const params: Record<string, string> = {};

      if (options.schemeId) {
        params.scheme_id = options.schemeId;
      }

      if (options.search) {
        params.search = options.search;
      }

      if (options.limit) {
        params.limit = String(options.limit);
      }

      const response = await client.get<ConceptListResponse>(
        '/concepts',
        params
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Autocomplete concepts for type-ahead
     */
    async autocompleteConcepts(
      query: string,
      schemeId?: string
    ): Promise<ConceptAutocompleteResponse> {
      if (!query || query.trim() === '') {
        throw new Error('Query is required');
      }

      const params: Record<string, string> = { q: query };

      if (schemeId) {
        params.scheme_id = schemeId;
      }

      return client.get<ConceptAutocompleteResponse>(
        '/concepts/autocomplete',
        params
      );
    },

    /**
     * Create a new concept
     */
    async createConcept(request: CreateConceptRequest): Promise<Concept> {
      if (!request.scheme_id || request.scheme_id.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      if (!request.pref_label || request.pref_label.trim() === '') {
        throw new Error('Preferred label is required');
      }

      const normalized = normalizeConcept(await client.post<unknown>('/concepts', {
        ...request,
        language: request.language ?? 'en',
      }));
      if (!normalized) throw new Error('Invalid concept payload');
      return normalized;
    },

    /**
     * Get a specific concept (basic info)
     */
    async getConcept(conceptId: string): Promise<Concept> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<Concept>(`/concepts/${conceptId}`);
      const normalized = normalizeConcept(response);
      if (!normalized) {
        throw new Error('Invalid concept payload');
      }
      return normalized;
    },

    /**
     * Get full concept with relationships
     */
    async getConceptFull(conceptId: string): Promise<ConceptFull> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptFull>(`/concepts/${conceptId}/full`);
      return normalizeConceptFull(response);
    },

    /**
     * Update a concept
     */
    async updateConcept(
      conceptId: string,
      updates: Partial<CreateConceptRequest>
    ): Promise<Concept> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const normalized = normalizeConcept(await client.patch<unknown>(`/concepts/${conceptId}`, updates));
      if (!normalized) throw new Error('Invalid concept payload');
      return normalized;
    },

    /**
     * Delete a concept
     * Fails if concept is in use by notes
     */
    async deleteConcept(conceptId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.delete(`/concepts/${conceptId}`);
    },

    // ===========================
    // Concept Relationships
    // ===========================

    /**
     * Get all ancestor concepts (recursive)
     */
    async getAncestors(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/${conceptId}/ancestors`
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Get all descendant concepts (recursive)
     */
    async getDescendants(
      conceptId: string,
      depth?: number
    ): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      const params: Record<string, string> = {};
      if (depth !== undefined) {
        params.depth = String(depth);
      }

      const response = await client.get<ConceptListResponse>(
        `/concepts/${conceptId}/descendants`,
        params
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Get broader concepts (immediate parents)
     */
    async getBroader(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') throw new Error('Concept ID is required');
      return normalizeConceptListResponse(await client.get<ConceptListResponse>(
        `/concepts/${encodeURIComponent(conceptId)}/broader`,
      ));
    },

    async getBroaderRelations(conceptId: string): Promise<SkosRelationEdge[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      return decodeRelationEdges(
        await client.get<unknown>(`/concepts/${encodeURIComponent(conceptId)}/broader`),
        'get_broader',
        'broader',
      );
    },

    /**
     * Add broader concept relationship
     */
    async addBroader(conceptId: string, broaderId: string): Promise<KnowledgeMutationResult> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!broaderId || broaderId.trim() === '') {
        throw new Error('Broader concept ID is required');
      }

      return decodeSuccess(await client.post<unknown>(`/concepts/${encodeURIComponent(conceptId)}/broader`, {
        target_id: broaderId,
      }), 'add_broader');
    },

    /**
     * Remove broader concept relationship
     */
    async removeBroader(conceptId: string, broaderId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!broaderId || broaderId.trim() === '') {
        throw new Error('Broader concept ID is required');
      }

      await client.delete(`/concepts/${encodeURIComponent(conceptId)}/broader/${encodeURIComponent(broaderId)}`);
    },

    /**
     * Get narrower concepts (immediate children)
     */
    async getNarrower(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') throw new Error('Concept ID is required');
      return normalizeConceptListResponse(await client.get<ConceptListResponse>(
        `/concepts/${encodeURIComponent(conceptId)}/narrower`,
      ));
    },

    async getNarrowerRelations(conceptId: string): Promise<SkosRelationEdge[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      return decodeRelationEdges(
        await client.get<unknown>(`/concepts/${encodeURIComponent(conceptId)}/narrower`),
        'get_narrower',
        'narrower',
      );
    },

    /**
     * Add narrower concept relationship
     */
    async addNarrower(conceptId: string, narrowerId: string): Promise<KnowledgeMutationResult> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!narrowerId || narrowerId.trim() === '') {
        throw new Error('Narrower concept ID is required');
      }

      return decodeSuccess(await client.post<unknown>(`/concepts/${encodeURIComponent(conceptId)}/narrower`, {
        target_id: narrowerId,
      }), 'add_narrower');
    },

    /**
     * Remove narrower concept relationship
     */
    async removeNarrower(
      conceptId: string,
      narrowerId: string
    ): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!narrowerId || narrowerId.trim() === '') {
        throw new Error('Narrower concept ID is required');
      }

      await client.delete(
        `/concepts/${encodeURIComponent(conceptId)}/narrower/${encodeURIComponent(narrowerId)}`
      );
    },

    /**
     * Get related concepts (associative, not hierarchical)
     */
    async getRelated(conceptId: string): Promise<Concept[]> {
      if (!conceptId || conceptId.trim() === '') throw new Error('Concept ID is required');
      return normalizeConceptListResponse(await client.get<ConceptListResponse>(
        `/concepts/${encodeURIComponent(conceptId)}/related`,
      ));
    },

    async getRelatedRelations(conceptId: string): Promise<SkosRelationEdge[]> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      return decodeRelationEdges(
        await client.get<unknown>(`/concepts/${encodeURIComponent(conceptId)}/related`),
        'get_related',
        'related',
      );
    },

    /**
     * Add related concept relationship
     */
    async addRelated(conceptId: string, relatedId: string): Promise<KnowledgeMutationResult> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!relatedId || relatedId.trim() === '') {
        throw new Error('Related concept ID is required');
      }

      return decodeSuccess(await client.post<unknown>(`/concepts/${encodeURIComponent(conceptId)}/related`, {
        target_id: relatedId,
      }), 'add_related');
    },

    /**
     * Remove related concept relationship
     */
    async removeRelated(conceptId: string, relatedId: string): Promise<void> {
      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      if (!relatedId || relatedId.trim() === '') {
        throw new Error('Related concept ID is required');
      }

      await client.delete(`/concepts/${encodeURIComponent(conceptId)}/related/${encodeURIComponent(relatedId)}`);
    },

    // ===========================
    // Note Tagging with Concepts
    // ===========================

    /**
     * Get all concepts applied to a note
     */
    async getNoteConcepts(noteId: string): Promise<Concept[]> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<ConceptListResponse>(
        `/notes/${noteId}/concepts`
      );

      return normalizeConceptListResponse(response);
    },

    /**
     * Tag a note with a concept
     */
    async tagNote(noteId: string, conceptId: string): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.post(`/notes/${noteId}/concepts`, {
        concept_id: conceptId,
      });
    },

    /**
     * Untag a note from a concept
     */
    async untagNote(noteId: string, conceptId: string): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.delete(`/notes/${noteId}/concepts/${conceptId}`);
    },

    // ===========================
    // Governance
    // ===========================

    /**
     * Get governance statistics for concepts
     */
    async getGovernanceStats(): Promise<ConceptGovernanceStats> {
      return client.get<ConceptGovernanceStats>('/concepts/governance');
    },

    /**
     * Export concept scheme as RDF Turtle
     */
    async exportTurtle(schemeId: string): Promise<string> {
      if (!schemeId || schemeId.trim() === '') {
        throw new Error('Scheme ID is required');
      }

      return client.getText(`/concepts/schemes/${encodeURIComponent(schemeId)}/export/turtle`);
    },

    // ===========================
    // SKOS Collections
    // ===========================

    /**
     * List SKOS collections
     */
    async listCollections(schemeId?: string): Promise<SkosCollection[]> {
      const params: Record<string, string> = {};

      if (schemeId) {
        params.scheme_id = schemeId;
      }

      const response = await client.get<{ collections: unknown[] } | unknown[]>(
        '/concepts/collections',
        params
      );

      const entries = Array.isArray(response) ? response : response.collections;
      return boundedArray(entries, 'list_skos_collections', 'collections')
        .map((entry) => decodeSkosCollection(entry, 'list_skos_collections'));
    },

    /**
     * Create a SKOS collection
     */
    async createCollection(
      request: CreateSkosCollectionRequest
    ): Promise<SkosCollectionCreatedResult> {
      if (!request.pref_label || request.pref_label.trim() === '') {
        throw new Error('Collection label is required');
      }
      if ((request.concept_ids?.length ?? 0) > MAX_SKOS_ITEMS) {
        throw new Error(`Collection concepts cannot exceed ${MAX_SKOS_ITEMS} entries`);
      }
      const raw = asRecord(await client.post<unknown>('/concepts/collections', {
        pref_label: request.pref_label.trim(),
        definition: request.definition ?? null,
        is_ordered: request.is_ordered,
        scheme_id: request.scheme_id ?? null,
        concept_ids: request.concept_ids ?? null,
      }), 'create_skos_collection');
      return { id: requiredString(raw, 'id', 'create_skos_collection') };
    },

    /**
     * Get a SKOS collection with members
     */
    async getCollection(collectionId: string): Promise<SkosCollectionWithMembers> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      return decodeSkosCollection(
        await client.get<unknown>(`/concepts/collections/${encodeURIComponent(collectionId)}`),
        'get_skos_collection',
      );
    },

    /**
     * Update a SKOS collection
     */
    async updateCollection(
      collectionId: string,
      updates: Partial<CreateSkosCollectionRequest>
    ): Promise<SkosCollection> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      const payload: Record<string, unknown> = {};
      if (updates.pref_label !== undefined) payload.pref_label = updates.pref_label;
      if (updates.definition !== undefined) payload.definition = updates.definition;
      if (updates.is_ordered !== undefined) payload.is_ordered = updates.is_ordered;
      await client.patch(`/concepts/collections/${encodeURIComponent(collectionId)}`, payload);
      return this.getCollection(collectionId);
    },

    /**
     * Delete a SKOS collection
     */
    async deleteCollection(collectionId: string): Promise<void> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      await client.delete(`/concepts/collections/${encodeURIComponent(collectionId)}`);
    },

    /**
     * Replace all members of a collection
     */
    async setCollectionMembers(
      collectionId: string,
      request: SetCollectionMembersRequest
    ): Promise<SkosCollectionWithMembers> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      if (request.concept_ids.length > MAX_SKOS_ITEMS) {
        throw new Error(`Collection members cannot exceed ${MAX_SKOS_ITEMS} entries`);
      }
      await client.put(`/concepts/collections/${encodeURIComponent(collectionId)}/members`, {
        concept_ids: request.concept_ids,
      });
      return this.getCollection(collectionId);
    },

    /**
     * Add a concept to a collection
     */
    async addCollectionMember(
      collectionId: string,
      conceptId: string
    ): Promise<void> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.post(`/concepts/collections/${encodeURIComponent(collectionId)}/members/${encodeURIComponent(conceptId)}`);
    },

    /**
     * Remove a concept from a collection
     */
    async removeCollectionMember(
      collectionId: string,
      conceptId: string
    ): Promise<void> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      if (!conceptId || conceptId.trim() === '') {
        throw new Error('Concept ID is required');
      }

      await client.delete(`/concepts/collections/${encodeURIComponent(collectionId)}/members/${encodeURIComponent(conceptId)}`);
    },

    // Bounded graph knowledge workflows live here so #295 does not depend on
    // the separately coordinated explicit-link surface.
    async exploreKnowledgeGraph(
      noteId: string,
      options: { depth?: number; maxNodes?: number; minScore?: number } = {},
    ): Promise<GraphExploreSummary> {
      if (!noteId.trim()) throw new Error('Note ID is required');
      const depth = options.depth ?? 2;
      const maxNodes = options.maxNodes ?? 100;
      const minScore = options.minScore ?? 0;
      if (!Number.isInteger(depth) || depth < 0 || depth > 10) throw new Error('Graph depth must be between 0 and 10');
      if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > MAX_GRAPH_ITEMS) throw new Error(`Graph nodes must be between 1 and ${MAX_GRAPH_ITEMS}`);
      if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) throw new Error('Minimum graph score must be between 0 and 1');
      return decodeGraphExplore(await client.get<unknown>(`/graph/${encodeURIComponent(noteId)}`, {
        depth: String(depth),
        max_nodes: String(maxNodes),
        min_score: String(minScore),
      }));
    },

    async getKnowledgeGraphTopology(): Promise<GraphTopologySummary> {
      return decodeGraphTopology(await client.get<unknown>('/graph/topology/stats'));
    },

    async getKnowledgeGraphDiagnostics(sampleSize = 1000): Promise<GraphDiagnosticsSummary> {
      if (!Number.isInteger(sampleSize) || sampleSize < 10 || sampleSize > 10000) {
        throw new Error('Graph diagnostic sample size must be between 10 and 10000');
      }
      return decodeGraphDiagnostics(await client.get<unknown>('/graph/diagnostics', { sample_size: String(sampleSize) }));
    },

    async captureKnowledgeGraphSnapshot(label: string, sampleSize = 1000): Promise<GraphSnapshotSummary> {
      const boundedLabel = boundedString(label, 'capture_diagnostics_snapshot', 'label');
      if (!Number.isInteger(sampleSize) || sampleSize < 10 || sampleSize > 10000) {
        throw new Error('Graph diagnostic sample size must be between 10 and 10000');
      }
      return decodeGraphSnapshot(
        await client.post<unknown>('/graph/diagnostics/snapshot', { label: boundedLabel, sample_size: sampleSize }),
        'capture_diagnostics_snapshot',
      );
    },

    async listKnowledgeGraphSnapshots(limit = 20): Promise<GraphSnapshotSummary[]> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Snapshot limit must be between 1 and 100');
      return boundedArray(
        await client.get<unknown>('/graph/diagnostics/history', { limit: String(limit) }),
        'list_diagnostics_snapshots',
        'snapshots',
        100,
      ).map((entry) => decodeGraphSnapshot(entry, 'list_diagnostics_snapshots'));
    },

    async compareKnowledgeGraphSnapshots(before: string, after: string): Promise<GraphComparisonSummary> {
      if (!before.trim() || !after.trim()) throw new Error('Both snapshot IDs are required');
      return decodeGraphComparison(await client.get<unknown>('/graph/diagnostics/compare', { before, after }));
    },

    async recomputeKnowledgeGraphSnn(
      request: {
        k?: number;
        threshold?: number;
        dry_run?: boolean;
        allow_aggressive_pruning?: boolean;
      } = {},
    ): Promise<SnnControlResult> {
      if (request.k !== undefined && (!Number.isInteger(request.k) || request.k < 1 || request.k > 1000)) throw new Error('SNN k must be between 1 and 1000');
      if (request.threshold !== undefined && (!Number.isFinite(request.threshold) || request.threshold < 0 || request.threshold > 1)) throw new Error('SNN threshold must be between 0 and 1');
      return decodeSnnResult(await client.post<unknown>(
        '/graph/snn/recompute',
        request,
        undefined,
        undefined,
        [409],
      ));
    },

    async sparsifyKnowledgeGraphPfnet(
      request: { q?: number; dry_run?: boolean } = {},
    ): Promise<PfnetControlResult> {
      if (request.q !== undefined && (!Number.isInteger(request.q) || request.q < 0 || request.q > 1000)) throw new Error('PFNET q must be between 0 and 1000');
      return decodePfnetResult(await client.post<unknown>('/graph/pfnet/sparsify', request));
    },

    async detectKnowledgeGraphCommunities(
      request: { coarse_dim?: number; similarity_threshold?: number; resolution?: number } = {},
    ): Promise<CommunityControlResult> {
      if (request.coarse_dim !== undefined && (!Number.isInteger(request.coarse_dim) || request.coarse_dim < 2 || request.coarse_dim > 768)) throw new Error('Coarse dimension must be between 2 and 768');
      if (request.similarity_threshold !== undefined && (!Number.isFinite(request.similarity_threshold) || request.similarity_threshold < 0 || request.similarity_threshold > 1)) throw new Error('Similarity threshold must be between 0 and 1');
      return decodeCommunityResult(await client.post<unknown>('/graph/community/coarse', request));
    },

    async triggerKnowledgeGraphMaintenance(
      steps: Array<'normalize' | 'snn' | 'pfnet' | 'snapshot'> = ['normalize', 'snn', 'pfnet', 'snapshot'],
      allowAggressivePruning?: boolean,
    ): Promise<GraphMaintenanceResult> {
      if (steps.length < 1 || steps.length > 4 || new Set(steps).size !== steps.length) {
        throw new Error('Graph maintenance steps must contain one to four unique steps');
      }
      return decodeGraphMaintenance(await client.post<unknown>('/graph/maintenance', {
        steps,
        ...(allowAggressivePruning === undefined
          ? {}
          : { allow_aggressive_pruning: allowAggressivePruning }),
      }));
    },

    async getKnowledgeGraphColdSpots(
      options: { limit?: number; coldDays?: number; maxAccesses?: number } = {},
    ): Promise<GraphColdSpotSummary> {
      const limit = options.limit ?? 20;
      const coldDays = options.coldDays ?? 30;
      const maxAccesses = options.maxAccesses ?? 2;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Cold spot limit must be between 1 and 100');
      if (!Number.isInteger(coldDays) || coldDays < 1) throw new Error('Cold days must be positive');
      if (!Number.isInteger(maxAccesses) || maxAccesses < 0) throw new Error('Maximum accesses cannot be negative');
      return decodeColdSpots(await client.get<unknown>('/graph/cold-spots', {
        limit: String(limit), cold_days: String(coldDays), max_accesses: String(maxAccesses),
      }));
    },
  };
}

export type ConceptsApi = ReturnType<typeof createConceptsApi>;
