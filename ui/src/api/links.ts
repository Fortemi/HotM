/**
 * Links & Graph API client
 * Handles semantic links and graph exploration
 */

import type { ApiClient } from './client';
import { decodeSnnResult, type SnnControlResult } from './concepts';
import { ContractDecodeError } from './errors';
import type {
  NoteLinksResponse,
  GraphExploreResponse,
} from './types-extended';

export type LinkKind = 'related' | 'mention' | 'reference' | 'task' | 'semantic' | 'keyword' | 'explicit';
export type ManualNoteLinkKind = 'explicit';

export interface CreateNoteLinkRequest {
  to_note_id: string;
  kind: ManualNoteLinkKind;
  score?: number | null;
}

export interface CreateNoteLinkResponse {
  id: string;
  from_note_id: string;
  to_note_id: string;
  kind: ManualNoteLinkKind;
  score: number;
  created_at_utc: string;
  created: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANUAL_LINK_FIELDS = new Set(['to_note_id', 'kind', 'score']);

function validateManualLinkRequest(sourceNoteId: string, request: CreateNoteLinkRequest): void {
  if (!UUID_PATTERN.test(sourceNoteId) || !UUID_PATTERN.test(request.to_note_id)) {
    throw new Error('Manual note-link identifiers must be UUIDs.');
  }
  if (sourceNoteId.toLowerCase() === request.to_note_id.toLowerCase()) {
    throw new Error('A note cannot link to itself.');
  }
  if (request.kind !== 'explicit') {
    throw new Error('Unsupported manual note-link kind.');
  }
  if (
    request.score != null
    && (!Number.isFinite(request.score) || request.score < 0 || request.score > 1)
  ) {
    throw new Error('Manual note-link score must be between 0.0 and 1.0.');
  }
  if (Object.keys(request).some((field) => !MANUAL_LINK_FIELDS.has(field))) {
    throw new Error('Unsupported manual note-link request field.');
  }
}

function decodeManualLinkResponse(value: unknown): CreateNoteLinkResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractDecodeError('create_note_link', 'response must be an object');
  }
  const response = value as Record<string, unknown>;
  if (
    !UUID_PATTERN.test(String(response.id ?? ''))
    || !UUID_PATTERN.test(String(response.from_note_id ?? ''))
    || !UUID_PATTERN.test(String(response.to_note_id ?? ''))
    || response.kind !== 'explicit'
    || typeof response.score !== 'number'
    || !Number.isFinite(response.score)
    || response.score < 0
    || response.score > 1
    || typeof response.created_at_utc !== 'string'
    || !Number.isFinite(Date.parse(response.created_at_utc))
    || typeof response.created !== 'boolean'
  ) {
    throw new ContractDecodeError('create_note_link', 'response does not match manual-note-link-v1');
  }
  return response as unknown as CreateNoteLinkResponse;
}

export interface GraphTopologyStats {
  total_notes: number;
  total_links: number;
  isolated_nodes: number;
  connected_components: number;
  avg_degree: number;
  max_degree: number;
  min_degree_linked?: number;
  median_degree?: number;
  linking_strategy?: string;
  effective_k?: number;
  [key: string]: unknown;
}

export interface GraphDiagnostics {
  [key: string]: unknown;
}

export interface GraphDiagnosticsSnapshot {
  id: string;
  label?: string;
  created_at?: string;
  diagnostics?: GraphDiagnostics;
  [key: string]: unknown;
}

export interface GraphDiagnosticsComparison {
  before?: GraphDiagnosticsSnapshot | GraphDiagnostics;
  after?: GraphDiagnosticsSnapshot | GraphDiagnostics;
  delta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CaptureGraphDiagnosticsSnapshotRequest {
  label: string;
  sample_size?: number;
}

export interface GraphControlRequest {
  dry_run?: boolean;
  [key: string]: unknown;
}

export interface RecomputeSnnRequest extends GraphControlRequest {
  k?: number;
  threshold?: number;
  allow_aggressive_pruning?: boolean;
}

export interface PfnetSparsifyRequest extends GraphControlRequest {
  q?: number;
}

export interface CoarseCommunityRequest {
  coarse_dim?: number;
  similarity_threshold?: number;
  resolution?: number;
}

export interface GraphControlResult {
  [key: string]: unknown;
}

export interface GraphMaintenanceRequest {
  steps?: Array<'normalize' | 'snn' | 'pfnet' | 'snapshot' | string>;
  allow_aggressive_pruning?: boolean;
}

export interface GraphMaintenanceResponse {
  id: string | null;
  status: 'queued' | 'already_pending' | string;
  steps?: string[];
}

export interface ColdSpotNote {
  id: string;
  title?: string | null;
  access_count: number;
  last_accessed_at?: string | null;
  created_at: string;
  days_since_access: number;
}

export interface ColdSpotBucket {
  count: number;
  topic_summary: string[];
  sample: ColdSpotNote[];
}

export interface GraphColdSpotsResponse {
  summary: {
    total_notes: number;
    isolated_count: number;
    isolated_pct: number;
    cold_access_count: number;
    cold_access_pct: number;
    overlap_count: number;
    parameters: {
      cold_days: number;
      max_accesses: number;
      limit: number;
    };
  };
  isolated_notes: ColdSpotBucket;
  cold_access_notes: ColdSpotBucket;
  overlap: {
    description: string;
    count: number;
    note_ids: string[];
  };
  recommendations: string[];
}

export function createLinksApi(client: ApiClient) {
  return {
    /**
     * Create or replay a producer-authorized explicit note-to-note link.
     * Compatibility admission, bearer context, and memory routing are applied
     * by the shared ApiClient before this mutation is dispatched.
     */
    async createManualLink(
      sourceNoteId: string,
      request: CreateNoteLinkRequest,
    ): Promise<CreateNoteLinkResponse> {
      validateManualLinkRequest(sourceNoteId, request);
      const body: CreateNoteLinkRequest = {
        to_note_id: request.to_note_id,
        kind: 'explicit',
        ...(request.score === undefined ? {} : { score: request.score }),
      };
      const response = await client.post<unknown>(
        `/notes/${encodeURIComponent(sourceNoteId)}/links`,
        body,
      );
      return decodeManualLinkResponse(response);
    },

    /**
     * Get all bidirectional links for a note
     * Returns both outgoing and incoming links
     */
    async getLinks(noteId: string): Promise<NoteLinksResponse> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      return client.get<NoteLinksResponse>(`/notes/${noteId}/links`);
    },

    /**
     * Get only incoming links (backlinks) for a note
     */
    async getBacklinks(noteId: string): Promise<NoteLinksResponse['incoming']> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<{ backlinks: NoteLinksResponse['incoming'] }>(
        `/notes/${noteId}/backlinks`
      );

      return response.backlinks;
    },

    /**
     * Explore graph starting from a note
     * Traverses semantic links using recursive CTEs
     */
    async exploreGraph(
      noteId: string,
      options: {
        depth?: number;
        max_nodes?: number;
        min_score?: number;
        max_edges_per_node?: number;
        // v2 guardrail parameters
        min_edge_weight?: number;
        max_depth?: number;
        algorithms?: string[];
        include_bridges_only?: boolean;
      } = {}
    ): Promise<GraphExploreResponse> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const params: Record<string, string> = {};

      if (options.depth !== undefined) {
        params.depth = String(options.depth);
      }

      if (options.max_nodes !== undefined) {
        params.max_nodes = String(options.max_nodes);
      }

      if (options.min_score !== undefined) {
        params.min_score = String(options.min_score);
      }

      if (options.max_edges_per_node !== undefined) {
        params.max_edges_per_node = String(options.max_edges_per_node);
      }

      // v2 guardrail parameters
      if (options.min_edge_weight !== undefined) {
        params.min_edge_weight = String(options.min_edge_weight);
      }

      if (options.max_depth !== undefined) {
        params.max_depth = String(options.max_depth);
      }

      if (options.algorithms !== undefined && options.algorithms.length > 0) {
        params.algorithms = options.algorithms.join(',');
      }

      if (options.include_bridges_only !== undefined) {
        params.include_bridges_only = String(options.include_bridges_only);
      }

      return client.get<GraphExploreResponse>(
        `/graph/${noteId}`,
        params
      );
    },

    /**
     * Fetch graph topology statistics for diagnostics and route coverage.
     */
    async getGraphTopologyStats(): Promise<GraphTopologyStats> {
      return client.get<GraphTopologyStats>('/graph/topology/stats');
    },

    /**
     * Fetch graph quality diagnostics.
     */
    async getGraphDiagnostics(sampleSize?: number): Promise<GraphDiagnostics> {
      const params: Record<string, string> = {};
      if (sampleSize !== undefined) {
        params.sample_size = String(sampleSize);
      }
      return client.get<GraphDiagnostics>('/graph/diagnostics', params);
    },

    async captureGraphDiagnosticsSnapshot(
      request: CaptureGraphDiagnosticsSnapshotRequest,
    ): Promise<GraphDiagnosticsSnapshot> {
      if (!request.label || request.label.trim() === '') {
        throw new Error('Snapshot label is required');
      }
      return client.post<GraphDiagnosticsSnapshot>('/graph/diagnostics/snapshot', request);
    },

    async listGraphDiagnosticsSnapshots(limit?: number): Promise<GraphDiagnosticsSnapshot[]> {
      const params: Record<string, string> = {};
      if (limit !== undefined) {
        params.limit = String(limit);
      }
      return client.get<GraphDiagnosticsSnapshot[]>('/graph/diagnostics/history', params);
    },

    async compareGraphDiagnosticsSnapshots(
      before: string,
      after: string,
    ): Promise<GraphDiagnosticsComparison> {
      if (!before || before.trim() === '') {
        throw new Error('Before snapshot ID is required');
      }
      if (!after || after.trim() === '') {
        throw new Error('After snapshot ID is required');
      }
      return client.get<GraphDiagnosticsComparison>('/graph/diagnostics/compare', {
        before,
        after,
      });
    },

    async recomputeSnnScores(request: RecomputeSnnRequest = {}): Promise<SnnControlResult> {
      return decodeSnnResult(await client.post<unknown>(
        '/graph/snn/recompute',
        request,
        undefined,
        undefined,
        [409],
      ));
    },

    async sparsifyGraphWithPfnet(request: PfnetSparsifyRequest = {}): Promise<GraphControlResult> {
      return client.post<GraphControlResult>('/graph/pfnet/sparsify', request);
    },

    async detectCoarseGraphCommunities(request: CoarseCommunityRequest = {}): Promise<GraphControlResult> {
      return client.post<GraphControlResult>('/graph/community/coarse', request);
    },

    async triggerGraphMaintenance(
      request: GraphMaintenanceRequest = {},
    ): Promise<GraphMaintenanceResponse> {
      return client.post<GraphMaintenanceResponse>('/graph/maintenance', request);
    },

    async getGraphColdSpots(options: {
      limit?: number;
      cold_days?: number;
      max_accesses?: number;
    } = {}): Promise<GraphColdSpotsResponse> {
      const params: Record<string, string> = {};
      if (options.limit !== undefined) {
        params.limit = String(options.limit);
      }
      if (options.cold_days !== undefined) {
        params.cold_days = String(options.cold_days);
      }
      if (options.max_accesses !== undefined) {
        params.max_accesses = String(options.max_accesses);
      }
      return client.get<GraphColdSpotsResponse>('/graph/cold-spots', params);
    },
  };
}

export type LinksApi = ReturnType<typeof createLinksApi>;
