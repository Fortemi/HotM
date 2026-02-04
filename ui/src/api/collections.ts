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

      const response = await client.get<{ collections: Collection[] }>(
        '/api/v1/collections',
        params
      );

      return response.collections;
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

      return client.post<Collection>('/api/v1/collections', request);
    },

    /**
     * Get a specific collection
     */
    async get(collectionId: string): Promise<CollectionWithNotes> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      return client.get<CollectionWithNotes>(
        `/api/v1/collections/${collectionId}`
      );
    },

    /**
     * Update a collection
     */
    async update(
      collectionId: string,
      updates: Partial<CreateCollectionRequest>
    ): Promise<Collection> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      return client.patch<Collection>(
        `/api/v1/collections/${collectionId}`,
        updates
      );
    },

    /**
     * Delete a collection
     * Notes in collection are not deleted, only unlinked
     */
    async delete(collectionId: string): Promise<void> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      await client.delete(`/api/v1/collections/${collectionId}`);
    },

    /**
     * Get all notes in a collection
     */
    async getNotes(collectionId: string): Promise<NoteSummary[]> {
      if (!collectionId || collectionId.trim() === '') {
        throw new Error('Collection ID is required');
      }

      const response = await client.get<{ notes: NoteSummary[] }>(
        `/api/v1/collections/${collectionId}/notes`
      );

      return response.notes;
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

      await client.post(`/api/v1/notes/${noteId}/move`, request);
    },
  };
}

export type CollectionsApi = ReturnType<typeof createCollectionsApi>;
