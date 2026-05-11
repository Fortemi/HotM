/**
 * Notes API client
 * Handles note CRUD operations via matric-memory API
 */

import type { ApiClient } from './client';
import type {
  NoteFull,
  NoteSummary,
  CreateNoteRequest,
  CreateNoteResponse,
  UpdateNoteRequest,
  NoteListOptions,
  TagUpdateRequest,
} from './types';

export function createNotesApi(client: ApiClient) {
  return {
    /**
     * List notes with optional filtering and sorting
     */
    async list(options: NoteListOptions = {}): Promise<NoteSummary[]> {
      const {
        sortBy = 'created_at',
        sortOrder = 'desc',
        limit = 50,
        offset,
        tags,
        starred,
        archived,
      } = options;

      const params: Record<string, string> = {
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: String(limit),
      };

      if (offset !== undefined) {
        params.offset = String(offset);
      }

      if (tags && tags.length > 0) {
        params.tags = tags.join(',');
      }

      if (starred !== undefined) {
        params.starred = String(starred);
      }

      if (archived !== undefined) {
        params.archived = String(archived);
      }

      const response = await client.get<{ notes: NoteSummary[]; total: number }>(
        '/notes',
        params
      );

      return response.notes;
    },

    /**
     * Get a single note by ID
     */
    async get(noteId: string): Promise<NoteFull> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      return client.get<NoteFull>(`/notes/${noteId}`);
    },

    /**
     * Create a new note
     */
    async create(
      request: CreateNoteRequest
    ): Promise<CreateNoteResponse> {
      if (!request.content || request.content.trim() === '') {
        throw new Error('Content is required');
      }

      const payload: CreateNoteRequest = {
        content: request.content,
        format: request.format || 'markdown',
        source: request.source || 'manual',
        ...(request.title && { title: request.title }),
        ...(request.revision_mode && { revision_mode: request.revision_mode }),
        ...(request.document_type && { document_type: request.document_type }),
        ...(request.context_filter && { context_filter: request.context_filter }),
        ...(request.processing && { processing: request.processing }),
      };

      // Fortemi returns { id } but callers expect { note_id }
      const raw = await client.post<{ id?: string; note_id?: string; status?: string }>(
        '/notes',
        payload,
      );
      return {
        note_id: raw.note_id || raw.id || '',
        status: raw.status,
      };
    },

    /**
     * Update a note (creates revision for content changes)
     */
    async update(
      noteId: string,
      request: UpdateNoteRequest
    ): Promise<unknown> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      return client.patch(`/notes/${noteId}`, request);
    },

    /**
     * Delete a note (soft delete)
     */
    async delete(noteId: string): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      await client.delete(`/notes/${noteId}`);
    },

    /**
     * Get tags for a note
     */
    async getTags(noteId: string): Promise<string[]> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<{ tags?: string[] } | string[]>(
        `/notes/${noteId}/tags`
      );

      return Array.isArray(response) ? response : (response?.tags ?? []);
    },

    /**
     * Update tags for a note (add/remove)
     */
    async updateTags(
      noteId: string,
      request: TagUpdateRequest
    ): Promise<string[]> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!request.add && !request.remove) {
        throw new Error('Must provide tags to add or remove');
      }

      const payload: TagUpdateRequest = {};
      if (request.add) {
        payload.add = request.add;
      }
      if (request.remove) {
        payload.remove = request.remove;
      }

      // Prefer legacy add/remove endpoint when available.
      try {
        const response = await client.patch<{ tags?: string[] } | string[]>(
          `/notes/${noteId}/tags`,
          payload
        );
        return Array.isArray(response) ? response : (response?.tags ?? []);
      } catch {
        // Fallback for Fortemi API which expects full tag set via PUT.
        const currentTags = await this.getTags(noteId);
        const nextTags = new Set(currentTags);
        for (const tag of request.add ?? []) {
          nextTags.add(tag);
        }
        for (const tag of request.remove ?? []) {
          nextTags.delete(tag);
        }

        const updatedTags = Array.from(nextTags);
        const response = await client.put<{ tags?: string[] } | string[] | null>(
          `/notes/${noteId}/tags`,
          { tags: updatedTags }
        );

        if (!response) {
          return updatedTags;
        }
        return Array.isArray(response) ? response : (response?.tags ?? updatedTags);
      }
    },

    /**
     * Bulk reprocess notes through the NLP pipeline.
     *
     * Triggers AI revision, re-embedding, link detection, and metadata
     * extraction for either a subset of notes (when `noteIds` is set) or
     * all non-deleted notes in the active archive.
     *
     * Backend: POST /api/v1/notes/reprocess (Fortemi
     * `crates/matric-api/src/main.rs:1844`). Default backend limit is 500
     * notes per call; max 5000. The active archive is selected via the
     * memory-routing header configured on the API client.
     *
     * @param options.revisionMode - "none" | "light" | "standard" (default) | "contextual" | "full"
     * @param options.noteIds - Specific note IDs to reprocess. If omitted, all non-deleted notes.
     * @param options.steps - Pipeline steps to run. Omit for all steps.
     * @param options.limit - Safety cap (default 500, max 5000).
     * @param options.model - Optional model slug override.
     */
    async reprocessAll(options?: {
      revisionMode?: 'none' | 'light' | 'standard' | 'contextual' | 'full';
      noteIds?: string[];
      steps?: string[];
      limit?: number;
      model?: string;
    }): Promise<{ jobs_queued?: number; message?: string }> {
      const body: Record<string, unknown> = {};
      if (options?.revisionMode) body.revision_mode = options.revisionMode;
      if (options?.noteIds?.length) body.note_ids = options.noteIds;
      if (options?.steps?.length) body.steps = options.steps;
      if (typeof options?.limit === 'number') body.limit = options.limit;
      if (options?.model) body.model = options.model;

      // Pass an empty body explicitly rather than undefined; the endpoint
      // accepts `Option<Json<BulkReprocessBody>>` but some HTTP clients
      // drop the request body for empty objects on POST, which the server
      // treats as default params (all notes, all steps, limit=500).
      const payload = Object.keys(body).length > 0 ? body : {};
      return client.post<{ jobs_queued?: number; message?: string }>(
        '/notes/reprocess',
        payload,
      );
    },
  };
}

export type NotesApi = ReturnType<typeof createNotesApi>;
