/**
 * Compatibility layer for legacy API client
 * Provides old API interface using new API infrastructure
 * This bridges ui/src/services/api.ts with ui/src/api/
 */

import { createApiClient, getServerRoot } from './client';
import { getCachedConfig, getTauriFetch } from '@/lib/tauri';
import { createNotesApi } from './notes';
import { createSearchApi } from './search';
import { createTagsApi } from './tags';
import { createExtendedApi } from './extended';
import type { NoteFull, CreateNoteResponse, SearchResult } from './types';
import type {
  Job,
  JobQueueStatus,
  QueueJobResponse,
  JobType,
  RelatedNotesResponse,
  UserMetadataLabel,
  NoteSummary,
  ListNotesResponse,
} from './extended';

// Re-export types for backward compatibility
export type { NoteFull, SearchResult, UserMetadataLabel, NoteSummary };
export type {
  Job,
  JobQueueStatus,
  QueueJobResponse,
  JobType,
  JobStatus,
  RelatedNotesResponse,
} from './extended';

/**
 * Search hit format (legacy compatibility)
 */
export interface SearchHit {
  note_id: string;
  score: number;
  snippet?: string;
}

/**
 * Health response (legacy compatibility)
 */
export interface HealthResponse {
  ok: boolean;
  ollama: boolean;
  db: boolean;
  vector: boolean;
}

/**
 * Get API base URL - checks Tauri config, env var, then default port
 */
function getApiBaseUrl(): string {
  // Tauri desktop config (loaded at startup, cached synchronously)
  const tauriConfig = getCachedConfig();
  if (tauriConfig?.api_base_url) {
    return tauriConfig.api_base_url;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }
  // Fortemi API default with API version prefix
  return 'http://localhost:3000/api/v1';
}

/**
 * Compatibility API Client
 * Wraps new API client with old interface for gradual migration
 */
class CompatApiClient {
  private baseUrl: string;
  private client: ReturnType<typeof createApiClient>;
  private notes: ReturnType<typeof createNotesApi>;
  private search: ReturnType<typeof createSearchApi>;
  private tags: ReturnType<typeof createTagsApi>;
  private extended: ReturnType<typeof createExtendedApi>;

  private serverRoot: string;

  constructor() {
    const baseUrl = getApiBaseUrl();
    this.baseUrl = baseUrl;
    this.serverRoot = getServerRoot(baseUrl);
    this.client = createApiClient(baseUrl);
    this.notes = createNotesApi(this.client);
    this.search = createSearchApi(this.client);
    this.tags = createTagsApi(this.client);
    this.extended = createExtendedApi(this.client);
  }

  // ============================================================
  // Health Check
  // ============================================================

  private normalizeHealthResponse(raw: Record<string, unknown>): HealthResponse {
    const ok =
      Boolean(raw.ok) ||
      raw.status === 'ok' ||
      raw.status === 'healthy';

    const db = Boolean(raw.db ?? raw.database ?? raw.postgres);
    const ollama = Boolean(raw.ollama);
    const vector = Boolean(raw.vector ?? raw.pgvector);

    return { ok, db, ollama, vector };
  }

  private async fetchHealth(url: string): Promise<Record<string, unknown>> {
    const response = await getTauriFetch()(url);
    if (!response.ok) {
      throw new Error(`Health endpoint ${url} returned ${response.status}`);
    }
    return response.json() as Promise<Record<string, unknown>>;
  }

  async checkHealth(): Promise<HealthResponse> {
    let lastError: unknown;
    const normalizedBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    // Root-level probes use server root; API-level probe uses API base URL.
    const probeUrls = [
      `${this.serverRoot}/health/live`,
      `${this.serverRoot}/health`,
      `${normalizedBase}/health`,
    ];

    for (const url of probeUrls) {
      try {
        const response = await this.fetchHealth(url);
        return this.normalizeHealthResponse(response);
      } catch (error) {
        lastError = error;
      }
    }

    try {
      // Legacy final fallback
      const response = await this.fetchHealth(`${this.serverRoot}/healthz`);
      return this.normalizeHealthResponse(response);
    } catch (error) {
      console.error('Health check failed:', lastError || error);
      return {
        ok: false,
        ollama: false,
        db: false,
        vector: false,
      };
    }
  }

  // ============================================================
  // Note Operations
  // ============================================================

  async createNote(
    content: string,
    options?: { document_type?: string; revision_mode?: string },
  ): Promise<CreateNoteResponse> {
    return this.notes.create({
      content,
      ...(options?.document_type && { document_type: options.document_type }),
      ...(options?.revision_mode && { revision_mode: options.revision_mode as any }),
    });
  }

  async getNote(id: string): Promise<NoteFull> {
    return this.notes.get(id);
  }

  async updateRevision(
    id: string,
    content: string,
    rationale?: string
  ): Promise<any> {
    return this.extended.updateRevision(id, content, rationale);
  }

  async updateOriginalContent(id: string, content: string): Promise<any> {
    return this.extended.updateOriginalContent(id, content);
  }

  async regenerateAI(id: string, revisionModeOrOptions?: string | { revision_mode?: string; model?: string }): Promise<any> {
    const options = typeof revisionModeOrOptions === 'string'
      ? { revision_mode: revisionModeOrOptions }
      : revisionModeOrOptions;
    return this.extended.regenerateAI(id, options);
  }

  async deleteNote(id: string): Promise<any> {
    return this.notes.delete(id);
  }

  async updateNoteStatus(
    id: string,
    starred?: boolean,
    archived?: boolean
  ): Promise<any> {
    return this.extended.updateNoteStatus(id, starred, archived);
  }

  async toggleStar(id: string, starred: boolean): Promise<any> {
    return this.extended.toggleStar(id, starred);
  }

  async getNotes(
    sortBy: 'created_at' | 'updated_at' | 'accessed_at' = 'created_at',
    filter: 'all' | 'starred' | 'archived' | 'recent' = 'all',
    limit: number = 50,
    offset: number = 0
  ): Promise<NoteSummary[]> {
    return this.extended.getNotes(sortBy, filter, limit, offset);
  }

  async getNotesPage(
    sortBy: 'created_at' | 'updated_at' | 'accessed_at' = 'created_at',
    filter: 'all' | 'starred' | 'archived' | 'recent' = 'all',
    limit: number = 50,
    offset: number = 0
  ): Promise<ListNotesResponse> {
    return this.extended.getNotesPage(sortBy, filter, limit, offset);
  }

  async getRecentNotes(limit: number = 20): Promise<NoteFull[]> {
    return this.extended.getRecentNotes(limit);
  }

  // ============================================================
  // Search Operations
  // ============================================================

  async searchNotes(
    query: string,
    mode: 'hybrid' | 'fts' | 'semantic' = 'hybrid',
    /* filters unused */ _filters?: string
  ): Promise<SearchHit[]> {
    if (!query.trim()) {
      return [];
    }

    const results = await this.search.search(query, { mode });

    // Convert SearchResult[] to SearchHit[]
    return results.map((r) => ({
      note_id: r.note_id,
      score: r.score,
      snippet: r.snippet,
    }));
  }

  async getRelatedNotes(id: string): Promise<RelatedNotesResponse> {
    return this.extended.getRelatedNotes(id);
  }

  async generateSearchContext(
    query: string,
    hits: SearchHit[]
  ): Promise<{ context: string }> {
    const searchResults = hits.map((h) => ({
      note_id: h.note_id,
      score: h.score,
      snippet: h.snippet || '',
    }));

    return this.extended.generateSearchContext(query, searchResults);
  }

  // ============================================================
  // Tag Operations
  // ============================================================

  async updateNoteTags(
    id: string,
    add?: string[],
    remove?: string[]
  ): Promise<{ tags: string[] }> {
    const tags = await this.notes.updateTags(id, { add, remove });
    return { tags };
  }

  async createTag(name: string): Promise<{ name: string }> {
    return this.tags.create(name);
  }

  // ============================================================
  // Label Operations
  // ============================================================

  async getAllLabels(): Promise<string[]> {
    return this.extended.getAllLabels();
  }

  async getMetadataLabels(id: string): Promise<UserMetadataLabel[]> {
    return this.extended.getMetadataLabels(id);
  }

  async addMetadataLabel(
    id: string,
    label: string,
    color?: string
  ): Promise<UserMetadataLabel> {
    return this.extended.addMetadataLabel(id, label, color);
  }

  async removeMetadataLabel(noteId: string, labelId: string): Promise<any> {
    return this.extended.removeMetadataLabel(noteId, labelId);
  }

  // ============================================================
  // Job Queue Operations
  // ============================================================

  async queueJob(
    noteId: string | undefined,
    jobType: JobType,
    priority?: number
  ): Promise<QueueJobResponse> {
    return this.extended.queueJob(noteId, jobType, priority);
  }

  async getJobQueueStatus(): Promise<JobQueueStatus[]> {
    return this.extended.getJobQueueStatus();
  }

  async getJobStatus(jobId: string): Promise<Job> {
    return this.extended.getJobStatus(jobId);
  }

  async cancelJob(jobId: string): Promise<void> {
    return this.extended.cancelJob(jobId);
  }

  async getNoteJobs(noteId: string): Promise<Job[]> {
    return this.extended.getNoteJobs(noteId);
  }

  async pollJobStatus(
    jobId: string,
    onProgress: (job: Job) => void,
    intervalMs: number = 1000
  ): Promise<Job> {
    return this.extended.pollJobStatus(jobId, onProgress, intervalMs);
  }

  // ============================================================
  // Deprecated methods (for backward compatibility)
  // ============================================================

  /**
   * @deprecated Use getNotes() instead
   */
  async getAllNoteIds(): Promise<string[]> {
    const notes = await this.getNotes('created_at', 'all', 1000);
    return notes.map((n) => n.id);
  }
}

/**
 * Singleton instance for global use.
 * Mutable so it can be recreated after Tauri config loads at startup.
 */
export let api = new CompatApiClient();

/**
 * Recreate the compat API instance (e.g. after loading Tauri runtime config).
 * Must be called after loadAppConfig() so getCachedConfig() returns the URL.
 */
export function reinitializeCompatApi() {
  api = new CompatApiClient();
}
