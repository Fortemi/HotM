/**
 * Collections API client
 * Handles note organization into folders with hierarchy support
 */

import type { ApiClient } from './client';
import type {
  Collection,
  CreateCollectionRequest,
  CollectionWithNotes,
  MoveNoteRequest,
} from './types-extended';
import type { NoteSummary } from './types';
import { asArray, asRecord, booleanField, ContractDecodeError, optionalString, requiredString, stringArray } from './contract-codecs';

const MAX_COLLECTION_NOTES = 100;

function requireCollectionId(collectionId: string): void {
  if (!collectionId || collectionId.trim() === '') throw new Error('Collection ID is required');
}

function decodeCollection(payload: unknown, operationId: string): CollectionWithNotes {
  const raw = asRecord(payload, operationId);
  return {
    id: requiredString(raw, 'id', operationId),
    name: requiredString(raw, 'name', operationId),
    description: optionalString(raw, 'description'),
    parent_id: typeof raw.parent_id === 'string' ? raw.parent_id : null,
    created_at: optionalString(raw, 'created_at') ?? optionalString(raw, 'created_at_utc') ?? '',
    updated_at: optionalString(raw, 'updated_at') ?? optionalString(raw, 'created_at_utc') ?? '',
    note_count: typeof raw.note_count === 'number' && Number.isFinite(raw.note_count) ? raw.note_count : 0,
  };
}

function decodeCollectionNotes(payload: unknown): NoteSummary[] {
  const raw = Array.isArray(payload) ? payload : asRecord(payload, 'get_collection_notes').notes;
  const entries = asArray(raw, 'get_collection_notes', 'notes');
  if (entries.length > MAX_COLLECTION_NOTES) {
    throw new ContractDecodeError('get_collection_notes', `notes exceeds ${MAX_COLLECTION_NOTES} entries`);
  }
  return entries.map((entry) => {
    const note = asRecord(entry, 'get_collection_notes');
    return {
      id: requiredString(note, 'id', 'get_collection_notes'),
      title: optionalString(note, 'title') ?? '',
      snippet: optionalString(note, 'snippet') ?? '',
      created_at_utc: requiredString(note, 'created_at_utc', 'get_collection_notes'),
      updated_at_utc: requiredString(note, 'updated_at_utc', 'get_collection_notes'),
      starred: booleanField(note, 'starred', 'get_collection_notes', false),
      archived: booleanField(note, 'archived', 'get_collection_notes', false),
      tags: stringArray(note.tags).slice(0, 100),
      has_revision: booleanField(note, 'has_revision', 'get_collection_notes', false),
      metadata: {},
    };
  });
}

export function createCollectionsApi(client: ApiClient) {
  return {
    /**
     * List all collections
     * Optionally filter by parent collection
     */
    async list(parentId?: string | null): Promise<Collection[]> {
      const params: Record<string, string> = {};

      if (parentId !== undefined) {
        params.parent_id = parentId || '';
      }

      const response = await client.get<unknown[] | { collections: unknown[] }>(
        '/collections',
        params
      );

      const entries = Array.isArray(response) ? response : (response?.collections ?? []);
      return entries.map((entry) => decodeCollection(entry, 'list_collections'));
    },

    /**
     * Create a new collection
     */
    async create(
      request: CreateCollectionRequest
    ): Promise<Collection> {
      if (!request.name || request.name.trim() === '') {
        throw new Error('Collection name is required');
      }

      const payload = {
        name: request.name.trim(),
        description: request.description?.trim() || null,
        parent_id: request.parent_id ?? null,
      };
      return decodeCollection(await client.post<unknown>('/collections', payload), 'create_collection');
    },

    /**
     * Get a specific collection
     */
    async get(collectionId: string): Promise<CollectionWithNotes> {
      requireCollectionId(collectionId);

      return decodeCollection(
        await client.get<unknown>(`/collections/${encodeURIComponent(collectionId)}`),
        'get_collection',
      );
    },

    /**
     * Update a collection
     */
    async update(
      collectionId: string,
      updates: Partial<CreateCollectionRequest>
    ): Promise<Collection> {
      requireCollectionId(collectionId);
      const current = updates.name ? null : await this.get(collectionId);
      const name = updates.name?.trim() || current?.name;
      if (!name) throw new Error('Collection name is required');
      await client.patch(
        `/collections/${encodeURIComponent(collectionId)}`,
        { name, description: updates.description?.trim() || null },
      );
      return this.get(collectionId);
    },

    /**
     * Delete a collection
     * Notes in collection are not deleted, only unlinked
     */
    async delete(collectionId: string, force = false): Promise<void> {
      requireCollectionId(collectionId);
      await client.delete(
        `/collections/${encodeURIComponent(collectionId)}`,
        undefined,
        force ? { force: 'true' } : undefined,
      );
    },

    /**
     * Get all notes in a collection
     */
    async getNotes(
      collectionId: string,
      options: { limit?: number; offset?: number } = {},
    ): Promise<NoteSummary[]> {
      requireCollectionId(collectionId);
      const params: Record<string, string> = {};
      if (options.limit !== undefined) {
        if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_COLLECTION_NOTES) {
          throw new Error(`Collection note limit must be between 1 and ${MAX_COLLECTION_NOTES}`);
        }
        params.limit = String(options.limit);
      }
      if (options.offset !== undefined) params.offset = String(options.offset);

      const response = await client.get<NoteSummary[] | { notes: NoteSummary[] }>(
        `/collections/${encodeURIComponent(collectionId)}/notes`,
        params,
      );

      return decodeCollectionNotes(response);
    },

    /**
     * Move a note to a collection
     * Set collection_id to null to remove from collection
     */
    async moveNote(
      noteId: string,
      request: MoveNoteRequest
    ): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (request.collection_id !== null && (!request.collection_id || !request.collection_id.trim())) {
        throw new Error('Collection ID must be non-empty or null');
      }
      await client.post(`/notes/${encodeURIComponent(noteId)}/move`, {
        collection_id: request.collection_id,
      });
    },

    async exportMarkdown(
      collectionId: string,
      options: { includeFrontmatter?: boolean; content?: 'original' | 'revised' } = {},
    ): Promise<string> {
      requireCollectionId(collectionId);
      const params: Record<string, string> = {};
      if (options.includeFrontmatter !== undefined) params.include_frontmatter = String(options.includeFrontmatter);
      if (options.content) params.content = options.content;
      return client.getText(`/collections/${encodeURIComponent(collectionId)}/export`, params);
    },
  };
}

export type CollectionsApi = ReturnType<typeof createCollectionsApi>;
