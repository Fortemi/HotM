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
      return client.put(`/api/v1/notes/${noteId}/revised`, {
        content,
        rationale,
      });
    },

    /**
     * Update original note content
     */
    async updateOriginalContent(noteId: string, content: string): Promise<unknown> {
      return client.put(`/api/v1/notes/${noteId}/original`, {
        content,
      });
    },

    /**
     * Trigger AI regeneration for a note
     */
    async regenerateAI(noteId: string): Promise<unknown> {
      return client.post(`/api/v1/notes/${noteId}/regenerate-ai`);
    },

    /**
     * Get notes with sorting and filtering
     */
    async getNotes(
      sortBy: 'created_at' | 'updated_at' | 'accessed_at' = 'created_at',
      filter: 'all' | 'starred' | 'archived' | 'recent' = 'all',
      limit: number = 50
    ): Promise<NoteSummary[]> {
      const params: Record<string, string> = {
        sort_by: sortBy,
        sort_order: 'desc',
        limit: limit.toString(),
      };

      // Map filter to Fortemi API params (no 'filter' query param)
      if (filter === 'starred') {
        params.starred = 'true';
      } else if (filter === 'archived') {
        params.archived = 'true';
      }

      const response = await client.get<ListNotesResponse>(
        '/api/v1/notes',
        params
      );

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
      return client.put(`/api/v1/notes/${noteId}/status`, {
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
     * Get related notes for a specific note
     */
    async getRelatedNotes(noteId: string): Promise<RelatedNotesResponse> {
      return client.get<RelatedNotesResponse>(`/api/v1/notes/${noteId}/related`);
    },

    /**
     * Generate search context using LLM
     */
    async generateSearchContext(
      query: string,
      hits: SearchResult[]
    ): Promise<{ context: string }> {
      return client.post<{ context: string }>('/api/v1/search/context', {
        query,
        hits,
      });
    },

    // ============================================================
    // Metadata Labels
    // ============================================================

    /**
     * Get all unique labels in the system
     */
    async getAllLabels(): Promise<string[]> {
      return client.get<string[]>('/api/v1/labels');
    },

    /**
     * Get metadata labels for a note
     */
    async getMetadataLabels(noteId: string): Promise<UserMetadataLabel[]> {
      return client.get<UserMetadataLabel[]>(`/api/v1/notes/${noteId}/labels`);
    },

    /**
     * Add metadata label to a note
     */
    async addMetadataLabel(
      noteId: string,
      label: string,
      color?: string
    ): Promise<UserMetadataLabel> {
      return client.post<UserMetadataLabel>(`/api/v1/notes/${noteId}/labels`, {
        label,
        color,
      });
    },

    /**
     * Remove metadata label from a note
     */
    async removeMetadataLabel(noteId: string, labelId: string): Promise<void> {
      await client.delete(`/api/v1/notes/${noteId}/labels/${labelId}`);
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
      return client.post<QueueJobResponse>('/api/v1/jobs', {
        note_id: noteId,
        job_type: jobType,
        priority: priority || 5,
      });
    },

    /**
     * Get job queue status
     */
    async getJobQueueStatus(): Promise<JobQueueStatus[]> {
      return client.get<JobQueueStatus[]>('/api/v1/jobs/queue');
    },

    /**
     * Get specific job status
     */
    async getJobStatus(jobId: string): Promise<Job> {
      return client.get<Job>(`/api/v1/jobs/${jobId}`);
    },

    /**
     * Cancel a job
     */
    async cancelJob(jobId: string): Promise<void> {
      await client.post(`/api/v1/jobs/${jobId}/cancel`);
    },

    /**
     * Get jobs for a specific note
     */
    async getNoteJobs(noteId: string): Promise<Job[]> {
      return client.get<Job[]>(`/api/v1/notes/${noteId}/jobs`);
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
