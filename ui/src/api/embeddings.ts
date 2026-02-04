/**
 * Embedding Sets API client
 * Handles isolated embedding spaces for multi-tenant or specialized use cases
 */

import type { ApiClient } from './client';
import type {
  EmbeddingSet,
  CreateEmbeddingSetRequest,
  EmbeddingConfig,
  AddEmbeddingSetMembersRequest,
} from './types-extended';
import type { NoteSummary } from './types';

export function createEmbeddingsApi(client: ApiClient) {
  return {
    // ===========================
    // Embedding Sets
    // ===========================

    /**
     * List all embedding sets
     */
    async listSets(): Promise<EmbeddingSet[]> {
      const response = await client.get<{ embedding_sets: EmbeddingSet[] }>(
        '/api/v1/embedding-sets'
      );
      return response.embedding_sets;
    },

    /**
     * Create a new embedding set
     */
    async createSet(
      request: CreateEmbeddingSetRequest
    ): Promise<EmbeddingSet> {
      if (!request.slug || request.slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      if (!request.name || request.name.trim() === '') {
        throw new Error('Embedding set name is required');
      }

      if (!request.embedding_config_id || request.embedding_config_id.trim() === '') {
        throw new Error('Embedding config ID is required');
      }

      return client.post<EmbeddingSet>('/api/v1/embedding-sets', request);
    },

    /**
     * Get a specific embedding set
     */
    async getSet(slug: string): Promise<EmbeddingSet> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      return client.get<EmbeddingSet>(`/api/v1/embedding-sets/${slug}`);
    },

    /**
     * Update an embedding set
     */
    async updateSet(
      slug: string,
      updates: Partial<CreateEmbeddingSetRequest>
    ): Promise<EmbeddingSet> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      return client.patch<EmbeddingSet>(
        `/api/v1/embedding-sets/${slug}`,
        updates
      );
    },

    /**
     * Delete an embedding set
     */
    async deleteSet(slug: string): Promise<void> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      await client.delete(`/api/v1/embedding-sets/${slug}`);
    },

    /**
     * List all notes in an embedding set
     */
    async listSetMembers(slug: string): Promise<NoteSummary[]> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      const response = await client.get<{ notes: NoteSummary[] }>(
        `/api/v1/embedding-sets/${slug}/members`
      );

      return response.notes;
    },

    /**
     * Add notes to an embedding set
     */
    async addSetMembers(
      slug: string,
      request: AddEmbeddingSetMembersRequest
    ): Promise<void> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      if (!request.note_ids || request.note_ids.length === 0) {
        throw new Error('At least one note ID is required');
      }

      await client.post(`/api/v1/embedding-sets/${slug}/members`, request);
    },

    /**
     * Remove a note from an embedding set
     */
    async removeSetMember(slug: string, noteId: string): Promise<void> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      await client.delete(`/api/v1/embedding-sets/${slug}/members/${noteId}`);
    },

    /**
     * Refresh embeddings for all notes in a set
     * Regenerates embeddings with current model
     */
    async refreshSet(slug: string): Promise<void> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      await client.post(`/api/v1/embedding-sets/${slug}/refresh`);
    },

    // ===========================
    // Embedding Configs
    // ===========================

    /**
     * List available embedding model configurations
     */
    async listConfigs(): Promise<EmbeddingConfig[]> {
      const response = await client.get<{ configs: EmbeddingConfig[] }>(
        '/api/v1/embedding-configs'
      );
      return response.configs;
    },

    /**
     * Get the default embedding configuration
     */
    async getDefaultConfig(): Promise<EmbeddingConfig> {
      return client.get<EmbeddingConfig>('/api/v1/embedding-configs/default');
    },
  };
}

export type EmbeddingsApi = ReturnType<typeof createEmbeddingsApi>;
