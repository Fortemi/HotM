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
import {
  asArray,
  asRecord,
  booleanField,
  finiteNumber,
  optionalString,
  requiredString,
  stringArray,
} from './contract-codecs';

export type NoteRevisionMode = 'none' | 'light' | 'standard' | 'contextual' | 'full';

export interface BulkCreateNoteItem {
  content: string;
  title?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  revision_mode?: NoteRevisionMode | null;
  document_type_id?: string | null;
  document_type?: string | null;
  collection_id?: string | null;
  format?: string | null;
  source?: string | null;
  chunk_max_chars?: number | null;
  chunk_overlap?: number | null;
}

export interface BulkCreateNotesResult {
  ids: string[];
  count: number;
}

export interface BulkReprocessResult {
  message?: string;
  notes_count?: number;
  jobs_queued: number;
  revision_mode?: string;
}

export interface NoteActivityEntry {
  note_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  is_recently_created: boolean;
  is_recently_updated: boolean;
}

export interface NotesActivityResult {
  since: string;
  activity: NoteActivityEntry[];
  created_count: number;
  updated_count: number;
}

export interface NoteTimelineBucket {
  period_start: string;
  period_end: string;
  count: number;
  note_ids: string[];
}

export interface NotesTimelineResult {
  period: 'hour' | 'day' | 'week' | 'month' | string;
  since: string;
  total_notes: number;
  buckets: NoteTimelineBucket[];
}

export interface FullDocumentChunk {
  id: string;
  sequence: number;
  title: string;
  byte_range: [number, number];
}

export interface FullDocumentResult {
  id: string;
  title: string;
  content: string;
  chunks: FullDocumentChunk[] | null;
  total_chunks: number | null;
  is_chunked: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PurgeNoteResult {
  status: string;
  job_id: string;
  note_id: string;
}

export interface RestoreNoteResult {
  restored: boolean;
  id: string;
}

export interface RestoreVersionResult {
  success: boolean;
  restored_from_version: number;
  new_version: number;
  restore_tags: boolean;
}

export interface DeleteVersionResult {
  success: boolean;
  deleted_version: number;
}

function requireNoteId(noteId: string): void {
  if (!noteId || noteId.trim() === '') throw new Error('Note ID is required');
}

function decodeFullDocument(payload: unknown): FullDocumentResult {
  const raw = asRecord(payload, 'get_full_document');
  const chunks = raw.chunks == null
    ? null
    : asArray(raw.chunks, 'get_full_document', 'chunks').map((entry) => {
      const chunk = asRecord(entry, 'get_full_document');
      const range = asArray(chunk.byte_range, 'get_full_document', 'byte_range');
      if (range.length !== 2 || range.some((value) => typeof value !== 'number')) {
        throw new Error('get_full_document: expected byte_range to contain two numbers');
      }
      return {
        id: requiredString(chunk, 'id', 'get_full_document'),
        sequence: finiteNumber(chunk, 'sequence', 'get_full_document'),
        title: requiredString(chunk, 'title', 'get_full_document'),
        byte_range: [range[0] as number, range[1] as number] as [number, number],
      };
    });
  return {
    id: requiredString(raw, 'id', 'get_full_document'),
    title: requiredString(raw, 'title', 'get_full_document'),
    content: typeof raw.content === 'string' ? raw.content : '',
    chunks,
    total_chunks: typeof raw.total_chunks === 'number' ? raw.total_chunks : null,
    is_chunked: booleanField(raw, 'is_chunked', 'get_full_document'),
    tags: stringArray(raw.tags),
    created_at: requiredString(raw, 'created_at', 'get_full_document'),
    updated_at: requiredString(raw, 'updated_at', 'get_full_document'),
  };
}

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
      requireNoteId(noteId);

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
      revisionMode?: NoteRevisionMode;
      noteIds?: string[];
      steps?: string[];
      limit?: number;
      model?: string;
      chunkMaxChars?: number;
      chunkOverlap?: number;
    }): Promise<BulkReprocessResult> {
      const body: Record<string, unknown> = {};
      if (options?.revisionMode) body.revision_mode = options.revisionMode;
      if (options?.noteIds?.length) body.note_ids = options.noteIds;
      if (options?.steps?.length) body.steps = options.steps;
      if (typeof options?.limit === 'number') body.limit = options.limit;
      if (options?.model) body.model = options.model;
      if (typeof options?.chunkMaxChars === 'number') body.chunk_max_chars = options.chunkMaxChars;
      if (typeof options?.chunkOverlap === 'number') body.chunk_overlap = options.chunkOverlap;

      // Pass an empty body explicitly rather than undefined; the endpoint
      // accepts `Option<Json<BulkReprocessBody>>` but some HTTP clients
      // drop the request body for empty objects on POST, which the server
      // treats as default params (all notes, all steps, limit=500).
      const payload = Object.keys(body).length > 0 ? body : {};
      const response = await client.post<unknown>(
        '/notes/reprocess',
        payload,
      );
      const raw = asRecord(response, 'bulk_reprocess_notes');
      return {
        message: optionalString(raw, 'message') ?? 'Bulk reprocessing queued',
        notes_count: finiteNumber(raw, 'notes_count', 'bulk_reprocess_notes', 0),
        jobs_queued: finiteNumber(raw, 'jobs_queued', 'bulk_reprocess_notes', 0),
        revision_mode: optionalString(raw, 'revision_mode'),
      };
    },

    async bulkCreate(notes: BulkCreateNoteItem[]): Promise<BulkCreateNotesResult> {
      if (notes.length === 0) throw new Error('At least one note is required');
      if (notes.length > 100) throw new Error('Maximum 100 notes per batch');
      notes.forEach((note, index) => {
        if (!note.content || note.content.trim() === '') throw new Error(`Content is required for note ${index + 1}`);
      });
      const raw = asRecord(await client.post<unknown>('/notes/bulk', { notes }), 'bulk_create_notes');
      const ids = stringArray(raw.ids);
      return { ids, count: finiteNumber(raw, 'count', 'bulk_create_notes', ids.length) };
    },

    async getActivity(options: {
      since?: string;
      limit?: number;
      eventTypes?: Array<'created' | 'updated'>;
    } = {}): Promise<NotesActivityResult> {
      const params: Record<string, string> = {};
      if (options.since) params.since = options.since;
      if (options.limit !== undefined) params.limit = String(options.limit);
      if (options.eventTypes?.length) params.event_types = options.eventTypes.join(',');
      const raw = asRecord(await client.get<unknown>('/notes/activity', params), 'get_notes_activity');
      const activity = asArray(raw.activity ?? [], 'get_notes_activity', 'activity').map((entry) => {
        const item = asRecord(entry, 'get_notes_activity');
        return {
          note_id: requiredString(item, 'note_id', 'get_notes_activity'),
          title: optionalString(item, 'title'),
          created_at: requiredString(item, 'created_at', 'get_notes_activity'),
          updated_at: requiredString(item, 'updated_at', 'get_notes_activity'),
          is_recently_created: booleanField(item, 'is_recently_created', 'get_notes_activity', false),
          is_recently_updated: booleanField(item, 'is_recently_updated', 'get_notes_activity', false),
        };
      });
      return {
        since: requiredString(raw, 'since', 'get_notes_activity'),
        activity,
        created_count: finiteNumber(raw, 'created_count', 'get_notes_activity', 0),
        updated_count: finiteNumber(raw, 'updated_count', 'get_notes_activity', 0),
      };
    },

    async getTimeline(options: {
      period?: 'hour' | 'day' | 'week' | 'month';
      periods?: number;
      since?: string;
    } = {}): Promise<NotesTimelineResult> {
      const params: Record<string, string> = {};
      if (options.period) params.period = options.period;
      if (options.periods !== undefined) params.periods = String(options.periods);
      if (options.since) params.since = options.since;
      const raw = asRecord(await client.get<unknown>('/notes/timeline', params), 'get_notes_timeline');
      const buckets = asArray(raw.buckets ?? [], 'get_notes_timeline', 'buckets').map((entry) => {
        const item = asRecord(entry, 'get_notes_timeline');
        return {
          period_start: requiredString(item, 'period_start', 'get_notes_timeline'),
          period_end: requiredString(item, 'period_end', 'get_notes_timeline'),
          count: finiteNumber(item, 'count', 'get_notes_timeline', 0),
          note_ids: stringArray(item.note_ids),
        };
      });
      return {
        period: requiredString(raw, 'period', 'get_notes_timeline'),
        since: requiredString(raw, 'since', 'get_notes_timeline'),
        total_notes: finiteNumber(raw, 'total_notes', 'get_notes_timeline', 0),
        buckets,
      };
    },

    async exportMarkdown(
      noteId: string,
      options: { includeFrontmatter?: boolean; content?: 'original' | 'revised' } = {},
    ): Promise<string> {
      requireNoteId(noteId);
      const params: Record<string, string> = {};
      if (options.includeFrontmatter !== undefined) params.include_frontmatter = String(options.includeFrontmatter);
      if (options.content) params.content = options.content;
      return client.getText(`/notes/${encodeURIComponent(noteId)}/export`, params);
    },

    async getFullDocument(noteId: string): Promise<FullDocumentResult> {
      requireNoteId(noteId);
      return decodeFullDocument(await client.get<unknown>(`/notes/${encodeURIComponent(noteId)}/full`));
    },

    async purge(noteId: string): Promise<PurgeNoteResult> {
      requireNoteId(noteId);
      const raw = asRecord(await client.post<unknown>(`/notes/${encodeURIComponent(noteId)}/purge`), 'purge_note');
      return {
        status: requiredString(raw, 'status', 'purge_note'),
        job_id: requiredString(raw, 'job_id', 'purge_note'),
        note_id: requiredString(raw, 'note_id', 'purge_note'),
      };
    },

    async restore(noteId: string, revisionMode?: NoteRevisionMode): Promise<RestoreNoteResult> {
      requireNoteId(noteId);
      const params = revisionMode ? { revision_mode: revisionMode } : undefined;
      const raw = asRecord(
        await client.post<unknown>(`/notes/${encodeURIComponent(noteId)}/restore`, undefined, undefined, params),
        'restore_note',
      );
      return {
        restored: booleanField(raw, 'restored', 'restore_note'),
        id: requiredString(raw, 'id', 'restore_note'),
      };
    },

    async updateStatus(noteId: string, status: { starred?: boolean; archived?: boolean }): Promise<void> {
      requireNoteId(noteId);
      if (status.starred === undefined && status.archived === undefined) {
        throw new Error('At least one note status field is required');
      }
      await client.patch(`/notes/${encodeURIComponent(noteId)}/status`, status);
    },

    async restoreVersion(noteId: string, version: number, restoreTags = false): Promise<RestoreVersionResult> {
      requireNoteId(noteId);
      if (!Number.isInteger(version) || version < 1) throw new Error('Version must be a positive integer');
      const raw = asRecord(
        await client.post<unknown>(`/notes/${encodeURIComponent(noteId)}/versions/${version}/restore`, { restore_tags: restoreTags }),
        'restore_note_version',
      );
      return {
        success: booleanField(raw, 'success', 'restore_note_version'),
        restored_from_version: finiteNumber(raw, 'restored_from_version', 'restore_note_version'),
        new_version: finiteNumber(raw, 'new_version', 'restore_note_version'),
        restore_tags: booleanField(raw, 'restore_tags', 'restore_note_version', false),
      };
    },

    async deleteVersion(noteId: string, version: number): Promise<DeleteVersionResult> {
      requireNoteId(noteId);
      if (!Number.isInteger(version) || version < 1) throw new Error('Version must be a positive integer');
      const raw = asRecord(
        await client.delete<unknown>(`/notes/${encodeURIComponent(noteId)}/versions/${version}`),
        'delete_note_version',
      );
      return {
        success: booleanField(raw, 'success', 'delete_note_version'),
        deleted_version: finiteNumber(raw, 'deleted_version', 'delete_note_version'),
      };
    },
  };
}

export type NotesApi = ReturnType<typeof createNotesApi>;
