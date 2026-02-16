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
        '/api/v1/notes',
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

      return client.get<NoteFull>(`/api/v1/notes/${noteId}`);
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
      };

      return client.post<CreateNoteResponse>('/api/v1/notes', payload);
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

      return client.patch(`/api/v1/notes/${noteId}`, request);
    },

    /**
     * Delete a note (soft delete)
     */
    async delete(noteId: string): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      await client.delete(`/api/v1/notes/${noteId}`);
    },

    /**
     * Get tags for a note
     */
    async getTags(noteId: string): Promise<string[]> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<{ tags?: string[] } | string[]>(
        `/api/v1/notes/${noteId}/tags`
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
          `/api/v1/notes/${noteId}/tags`,
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
          `/api/v1/notes/${noteId}/tags`,
          { tags: updatedTags }
        );

        if (!response) {
          return updatedTags;
        }
        return Array.isArray(response) ? response : (response?.tags ?? updatedTags);
      }
    },
  };
}

export type NotesApi = ReturnType<typeof createNotesApi>;
