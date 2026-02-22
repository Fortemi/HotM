/**
 * Extended API client
 * Provides additional backend-specific methods not in core API
 * Used by components that need job queue, labels, and other advanced features
 */

import type { ApiClient } from './client';
import type { NoteFull, SearchResult } from './types';

/**
 * Job Queue Types
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'ai_revision' | 'embedding' | 'linking' | 'context_update' | 'title_generation';

export interface Job {
  id: string;
  note_id?: string;
  job_type: JobType;
  status: JobStatus;
  progress_percent?: number;
  error_message?: string;
  estimated_duration_ms?: number;
  actual_duration_ms?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface JobQueueStatus {
  id: string;
  note_id?: string;
  note_title?: string;
  job_type: JobType;
  status: JobStatus;
  progress_percent?: number;
  estimated_duration_ms?: number;
  remaining_ms?: number;
  queue_wait_ms?: number;
}

export interface QueueJobResponse {
  job_id: string;
  estimated_duration_ms: number;
  queue_position: number;
}

/**
 * Related Notes Response
 */
export interface RelatedNotesResponse {
  related: SearchResult[];
  context_summary?: string;
}

/**
 * User Metadata Label
 */
export interface UserMetadataLabel {
  id: string;
  note_id: string;
  label: string;
  color?: string;
  created_at: string;
}

/**
 * Note Summary for list operations
 */
export interface NoteSummary {
  id: string;
  title: string;
  snippet: string;
  created_at_utc: string;
  updated_at_utc: string;
  starred: boolean;
  archived: boolean;
  tags: string[];
  has_revision: boolean;
  metadata: any;
}

export interface ListNotesResponse {
  notes: NoteSummary[];
  total: number;
}

function normalizeJobType(value?: string): JobType {
  switch (value) {
    case 'ai_revision':
    case 'embedding':
    case 'linking':
    case 'context_update':
    case 'title_generation':
      return value;
    default:
      return 'context_update';
  }
}

function normalizeJobStatus(value?: string): JobStatus {
  switch (value) {
    case 'pending':
    case 'running':
    case 'completed':
    case 'failed':
    case 'cancelled':
      return value;
    default:
      return 'pending';
  }
}

function normalizeJob(raw: Record<string, unknown>): Job {
  return {
    id: String(raw.id ?? raw.job_id ?? ''),
    note_id: raw.note_id ? String(raw.note_id) : undefined,
    job_type: normalizeJobType(raw.job_type as string | undefined),
    status: normalizeJobStatus(raw.status as string | undefined),
    progress_percent:
      typeof raw.progress_percent === 'number'
        ? raw.progress_percent
        : typeof raw.progress === 'number'
          ? raw.progress
          : undefined,
    error_message:
      typeof raw.error_message === 'string'
        ? raw.error_message
        : typeof raw.error === 'string'
          ? raw.error
          : undefined,
    estimated_duration_ms:
      typeof raw.estimated_duration_ms === 'number'
        ? raw.estimated_duration_ms
        : undefined,
    actual_duration_ms:
      typeof raw.actual_duration_ms === 'number'
        ? raw.actual_duration_ms
        : undefined,
    created_at:
      (raw.created_at as string | undefined) ||
      (raw.queued_at as string | undefined) ||
      new Date(0).toISOString(),
    started_at: raw.started_at as string | undefined,
    completed_at: raw.completed_at as string | undefined,
  };
}

function normalizeSearchResults(payload: unknown): SearchResult[] {
  if (!payload) {
    return [];
  }

  const resultsRaw = Array.isArray(payload)
    ? payload
    : ((payload as { results?: unknown[] }).results ?? []);

  if (!Array.isArray(resultsRaw)) {
    return [];
  }

  return resultsRaw
    .map((item): SearchResult | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const raw = item as Record<string, unknown>;
      const noteId = raw.note_id ?? raw.id;
      if (!noteId) {
        return null;
      }
      return {
        note_id: String(noteId),
        score: typeof raw.score === 'number' ? raw.score : 0.5,
        snippet: typeof raw.snippet === 'string' ? raw.snippet : '',
        title: typeof raw.title === 'string' ? raw.title : undefined,
        tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : undefined,
        source: typeof raw.source === 'string' ? raw.source : undefined,
      };
    })
    .filter((v): v is SearchResult => v !== null);
}

/**
 * Create extended API client with additional backend methods
 */
export function createExtendedApi(client: ApiClient) {
  return {
    // ============================================================
    // Note Operations (extended beyond core API)
    // ============================================================

    /**
     * Update note revision (AI-enhanced content)
     */
    async updateRevision(
      noteId: string,
      content: string,
      rationale?: string
    ): Promise<unknown> {
      return client.patch(`/api/v1/notes/${noteId}`, {
        content,
        ...(rationale ? { rationale } : {}),
      });
    },

    /**
     * Update original note content
     */
    async updateOriginalContent(noteId: string, content: string): Promise<unknown> {
      return client.patch(`/api/v1/notes/${noteId}`, {
        content,
      });
    },

    /**
     * Trigger AI regeneration for a note
     */
    async regenerateAI(noteId: string, options?: { revision_mode?: string; model?: string }): Promise<unknown> {
      const body: Record<string, string> = {};
      if (options?.revision_mode) body.revision_mode = options.revision_mode;
      if (options?.model) body.model = options.model;
      return client.post(
        `/api/v1/notes/${noteId}/reprocess`,
        Object.keys(body).length > 0 ? body : undefined
      );
    },

    async getNotesPage(
      sortBy: 'created_at' | 'updated_at' | 'accessed_at' = 'created_at',
      filter: 'all' | 'starred' | 'archived' | 'recent' = 'all',
      limit: number = 50,
      offset: number = 0
    ): Promise<ListNotesResponse> {
      const params: Record<string, string> = {
        sort_by: sortBy,
        sort_order: 'desc',
        limit: limit.toString(),
        offset: offset.toString(),
      };

      // Map filter to Fortemi API params (no 'filter' query param)
      if (filter === 'starred') {
        params.starred = 'true';
      } else if (filter === 'archived') {
        params.archived = 'true';
      }

      return client.get<ListNotesResponse>('/api/v1/notes', params);
    },

    /**
     * Get notes with sorting and filtering
     */
    async getNotes(
      sortBy: 'created_at' | 'updated_at' | 'accessed_at' = 'created_at',
      filter: 'all' | 'starred' | 'archived' | 'recent' = 'all',
      limit: number = 50,
      offset: number = 0
    ): Promise<NoteSummary[]> {
      const response = await this.getNotesPage(sortBy, filter, limit, offset);
      return response.notes;
    },

    /**
     * Get recent notes
     */
    async getRecentNotes(limit: number = 20): Promise<NoteFull[]> {
      const summaries = await this.getNotes('created_at', 'all', limit);

      // Fetch full notes for each summary
      const notes: NoteFull[] = [];
      for (const summary of summaries) {
        try {
          const note = await client.get<NoteFull>(`/api/v1/notes/${summary.id}`);
          notes.push(note);
        } catch (e) {
          console.error(`Failed to load note ${summary.id}:`, e);
        }
      }

      return notes;
    },

    /**
     * Update note status (star/archive)
     */
    async updateNoteStatus(
      noteId: string,
      starred?: boolean,
      archived?: boolean
    ): Promise<unknown> {
      return client.patch(`/api/v1/notes/${noteId}/status`, {
        starred,
        archived,
      });
    },

    /**
     * Toggle star status
     */
    async toggleStar(noteId: string, starred: boolean): Promise<unknown> {
      return this.updateNoteStatus(noteId, starred, undefined);
    },

    // ============================================================
    // Related Notes & Context
    // ============================================================

    /**
     * Get related notes for a specific note.
     * Tries endpoints in order: /related (LLM context) -> /similar (vector) -> /links+/backlinks
     */
    async getRelatedNotes(noteId: string): Promise<RelatedNotesResponse> {
      // 1. Try the full /related endpoint (includes LLM context_summary)
      try {
        const raw = await client.get<unknown>(`/api/v1/notes/${noteId}/related`);
        const obj = raw as { related?: unknown[]; context_summary?: string } | null;
        const related = normalizeSearchResults(obj?.related ?? obj);
        if (related.length > 0) {
          return {
            related,
            context_summary: typeof obj?.context_summary === 'string'
              ? obj.context_summary
              : `Found ${related.length} related notes.`,
          };
        }
      } catch {
        // /related not available, try next
      }

      // 2. Try /similar (semantic vector search, includes snippets)
      try {
        const similar = await client.get<unknown>(`/api/v1/notes/${noteId}/similar`);
        const related = normalizeSearchResults(similar);
        if (related.length > 0) {
          return {
            related,
            context_summary: `Found ${related.length} similar notes by semantic search.`,
          };
        }
      } catch {
        // /similar not available, try next
      }

      // 3. Fall back to graph links (single endpoint returns outgoing + incoming)
      const linksRaw = await client.get<unknown>(`/api/v1/notes/${noteId}/links`).catch(() => null);

      type LinkEdge = { to_note_id?: string; from_note_id?: string; score?: number; snippet?: string; kind?: string };
      const linksObj = (linksRaw ?? {}) as { outgoing?: LinkEdge[]; incoming?: LinkEdge[] };

      const relatedMap = new Map<string, SearchResult>();
      for (const edge of linksObj.outgoing ?? []) {
        if (!edge.to_note_id) continue;
        relatedMap.set(edge.to_note_id, {
          note_id: edge.to_note_id,
          score: edge.score ?? 0.5,
          snippet: edge.snippet ?? '',
        });
      }
      for (const edge of linksObj.incoming ?? []) {
        if (!edge.from_note_id) continue;
        if (!relatedMap.has(edge.from_note_id)) {
          relatedMap.set(edge.from_note_id, {
            note_id: edge.from_note_id,
            score: edge.score ?? 0.5,
            snippet: edge.snippet ?? '',
          });
        }
      }

      const related = Array.from(relatedMap.values()).sort((a, b) => b.score - a.score);
      return {
        related,
        context_summary: related.length
          ? `Connected to ${related.length} notes by graph links.`
          : 'No related notes found.',
      };
    },

    /**
     * Generate search context using LLM
     */
    async generateSearchContext(
      query: string,
      hits: SearchResult[]
    ): Promise<{ context: string }> {
      try {
        return await client.post<{ context: string }>('/api/v1/search/context', {
          query,
          hits,
        });
      } catch {
        const top = hits.slice(0, 3);
        const snippets = top
          .map((hit) => hit.snippet)
          .filter(Boolean)
          .slice(0, 2);
        const context = snippets.length
          ? `Found ${hits.length} results for "${query}". Top themes: ${snippets.join(' | ')}`
          : `Found ${hits.length} results for "${query}".`;
        return { context };
      }
    },

    // ============================================================
    // Metadata Labels
    // ============================================================

    /**
     * Get all unique labels in the system
     */
    async getAllLabels(): Promise<string[]> {
      const response = await client.get<unknown>('/api/v1/tags');
      const tags = Array.isArray(response)
        ? response
        : ((response as { tags?: unknown[] })?.tags ?? []);
      return tags
        .map((t) => (t as { name?: string }).name)
        .filter((name): name is string => Boolean(name));
    },

    /**
     * Get metadata labels for a note
     */
    async getMetadataLabels(noteId: string): Promise<UserMetadataLabel[]> {
      const response = await client.get<unknown>(`/api/v1/notes/${noteId}/tags`);
      const tags = Array.isArray(response)
        ? response
        : ((response as { tags?: string[] })?.tags ?? []);

      return tags.map((tag) => ({
        id: tag,
        note_id: noteId,
        label: tag,
        created_at: new Date().toISOString(),
      }));
    },

    /**
     * Add metadata label to a note
     */
    async addMetadataLabel(
      noteId: string,
      label: string,
      color?: string
    ): Promise<UserMetadataLabel> {
      const existing = await this.getMetadataLabels(noteId);
      const tags = new Set(existing.map((item) => item.label));
      tags.add(label);

      await client.put(`/api/v1/notes/${noteId}/tags`, {
        tags: Array.from(tags),
      });

      return {
        id: label,
        note_id: noteId,
        label,
        color,
        created_at: new Date().toISOString(),
      };
    },

    /**
     * Remove metadata label from a note
     */
    async removeMetadataLabel(noteId: string, labelId: string): Promise<void> {
      const existing = await this.getMetadataLabels(noteId);
      const tags = existing
        .map((item) => item.label)
        .filter((tag) => tag !== labelId);

      await client.put(`/api/v1/notes/${noteId}/tags`, {
        tags,
      });
    },

    // ============================================================
    // Job Queue Operations
    // ============================================================

    /**
     * Queue a new job
     */
    async queueJob(
      noteId: string | undefined,
      jobType: JobType,
      priority?: number
    ): Promise<QueueJobResponse> {
      const response = await client.post<Record<string, unknown>>('/api/v1/jobs', {
        note_id: noteId,
        job_type: jobType,
        priority: priority || 5,
      });

      return {
        job_id: String(response.job_id ?? response.id ?? ''),
        estimated_duration_ms:
          typeof response.estimated_duration_ms === 'number'
            ? response.estimated_duration_ms
            : 0,
        queue_position:
          typeof response.queue_position === 'number'
            ? response.queue_position
            : 0,
      };
    },

    /**
     * Get job queue status
     */
    async getJobQueueStatus(): Promise<JobQueueStatus[]> {
      const response = await client.get<unknown>('/api/v1/jobs/pending');
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const pending = (response as { pending?: number }).pending;
        if (typeof pending === 'number') {
          return pending > 0
            ? [{
                id: 'pending-summary',
                job_type: 'context_update',
                status: 'pending',
                progress_percent: 0,
                queue_wait_ms: undefined,
              }]
            : [];
        }
      }
      const jobs = Array.isArray(response)
        ? response
        : ((response as { jobs?: unknown[] })?.jobs ?? []);

      return jobs
        .filter((job): job is Record<string, unknown> => Boolean(job) && typeof job === 'object')
        .map((job) => {
          const normalized = normalizeJob(job);
          return {
            id: normalized.id,
            note_id: normalized.note_id,
            note_title: undefined,
            job_type: normalized.job_type,
            status: normalized.status,
            progress_percent: normalized.progress_percent,
            estimated_duration_ms: normalized.estimated_duration_ms,
            remaining_ms: undefined,
            queue_wait_ms: undefined,
          };
        });
    },

    /**
     * Get specific job status
     */
    async getJobStatus(jobId: string): Promise<Job> {
      const response = await client.get<Record<string, unknown>>(`/api/v1/jobs/${jobId}`);
      return normalizeJob(response);
    },

    /**
     * Cancel a job
     */
    async cancelJob(jobId: string): Promise<void> {
      try {
        await client.post(`/api/v1/jobs/${jobId}/cancel`);
      } catch {
        await client.delete(`/api/v1/jobs/${jobId}`);
      }
    },

    /**
     * Get jobs for a specific note
     */
    async getNoteJobs(noteId: string): Promise<Job[]> {
      const response = await client.get<unknown>('/api/v1/jobs');
      const jobs = Array.isArray(response)
        ? response
        : ((response as { jobs?: unknown[] })?.jobs ?? []);
      return jobs
        .filter((job): job is Record<string, unknown> => Boolean(job) && typeof job === 'object')
        .map(normalizeJob)
        .filter((job) => job.note_id === noteId);
    },

    /**
     * Poll job status with callback
     */
    async pollJobStatus(
      jobId: string,
      onProgress: (job: Job) => void,
      intervalMs: number = 1000
    ): Promise<Job> {
      return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const job = await this.getJobStatus(jobId);
            onProgress(job);

            if (
              job.status === 'completed' ||
              job.status === 'failed' ||
              job.status === 'cancelled'
            ) {
              clearInterval(interval);
              if (job.status === 'completed') {
                resolve(job);
              } else {
                reject(new Error(job.error_message || `Job ${job.status}`));
              }
            }
          } catch (error) {
            clearInterval(interval);
            reject(error);
          }
        }, intervalMs);
      });
    },
  };
}

export type ExtendedApi = ReturnType<typeof createExtendedApi>;
