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

function toEmbeddingConfig(input: unknown): EmbeddingConfig | null {
  if (!input || typeof input !== 'object') return null;
  const item = input as Record<string, unknown>;

  const id = typeof item.id === 'string' ? item.id : null;
  const name = typeof item.name === 'string' ? item.name : null;
  const model = typeof item.model === 'string' ? item.model : null;
  const createdAt = typeof item.created_at === 'string' ? item.created_at : null;
  const dimensionsRaw = item.dimensions;
  const dimensions =
    typeof dimensionsRaw === 'number'
      ? dimensionsRaw
      : typeof dimensionsRaw === 'string'
        ? Number(dimensionsRaw)
        : NaN;
  const isDefault = item.is_default === true;

  if (!id || !name || !model || !createdAt || !Number.isFinite(dimensions)) {
    return null;
  }

  return {
    id,
    name,
    model,
    dimensions,
    is_default: isDefault,
    created_at: createdAt,
  };
}

function parseEmbeddingConfigList(input: unknown): EmbeddingConfig[] {
  if (Array.isArray(input)) {
    return input.map(toEmbeddingConfig).filter((cfg): cfg is EmbeddingConfig => cfg !== null);
  }
  if (!input || typeof input !== 'object') return [];

  const payload = input as Record<string, unknown>;
  const candidates = [
    payload.configs,
    payload.embedding_configs,
    payload.items,
    payload.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map(toEmbeddingConfig)
        .filter((cfg): cfg is EmbeddingConfig => cfg !== null);
    }
  }

  return [];
}

function parseDefaultEmbeddingConfig(input: unknown): EmbeddingConfig | null {
  const direct = toEmbeddingConfig(input);
  if (direct) return direct;
  if (!input || typeof input !== 'object') return null;

  const payload = input as Record<string, unknown>;
  return (
    toEmbeddingConfig(payload.config) ||
    toEmbeddingConfig(payload.default_config) ||
    toEmbeddingConfig(payload.embedding_config)
  );
}

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
      const response = await client.get<unknown>('/api/v1/embedding-configs');
      return parseEmbeddingConfigList(response);
    },

    /**
     * Get the default embedding configuration
     */
    async getDefaultConfig(): Promise<EmbeddingConfig> {
      const response = await client.get<unknown>('/api/v1/embedding-configs/default');
      const parsed = parseDefaultEmbeddingConfig(response);
      if (!parsed) {
        throw new Error('Invalid default embedding config response');
      }
      return parsed;
    },
  };
}

export type EmbeddingsApi = ReturnType<typeof createEmbeddingsApi>;
