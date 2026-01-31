/**
 * Compatibility layer for legacy API client
 * Provides old API interface using new API infrastructure
 * This bridges ui/src/services/api.ts with ui/src/api/
 */

import { createApiClient } from './client';
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
 * Get API base URL - uses HotM's default port
 */
function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }
  // HotM server runs on port 53211
  return 'http://localhost:53211';
}

/**
 * Compatibility API Client
 * Wraps new API client with old interface for gradual migration
 */
class CompatApiClient {
  private client: ReturnType<typeof createApiClient>;
  private notes: ReturnType<typeof createNotesApi>;
  private search: ReturnType<typeof createSearchApi>;
  private tags: ReturnType<typeof createTagsApi>;
  private extended: ReturnType<typeof createExtendedApi>;

  constructor() {
    const baseUrl = getApiBaseUrl();
    this.client = createApiClient(baseUrl);
    this.notes = createNotesApi(this.client);
    this.search = createSearchApi(this.client);
    this.tags = createTagsApi(this.client);
    this.extended = createExtendedApi(this.client);
  }

  // ============================================================
  // Health Check
  // ============================================================

  async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await this.client.get<{
        ok: boolean;
        database: boolean;
        ollama?: boolean;
        vector?: boolean;
      }>('/api/v1/health');

      return {
        ok: response.ok,
        ollama: response.ollama || false,
        db: response.database,
        vector: response.vector || false,
      };
    } catch (error) {
      console.error('Health check failed:', error);
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

  async createNote(content: string): Promise<CreateNoteResponse> {
    return this.notes.create({ content });
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

  async regenerateAI(id: string): Promise<any> {
    return this.extended.regenerateAI(id);
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
    limit: number = 50
  ): Promise<NoteSummary[]> {
    return this.extended.getNotes(sortBy, filter, limit);
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
 * Singleton instance for global use
 */
export const api = new CompatApiClient();
