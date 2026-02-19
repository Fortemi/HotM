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
  const name =
    (typeof item.name === 'string' && item.name) ||
    (typeof item.slug === 'string' && item.slug) ||
    (typeof item.title === 'string' && item.title) ||
    null;
  const model =
    (typeof item.model === 'string' && item.model) ||
    (typeof item.model_name === 'string' && item.model_name) ||
    (typeof item.model_id === 'string' && item.model_id) ||
    null;
  const createdAt =
    (typeof item.created_at === 'string' && item.created_at) ||
    (typeof item.updated_at === 'string' && item.updated_at) ||
    new Date(0).toISOString();
  const dimensionsRaw =
    item.dimensions ??
    item.embedding_dimensions ??
    item.vector_dimensions ??
    item.dimension_count;
  const dimensions =
    typeof dimensionsRaw === 'number'
      ? dimensionsRaw
      : typeof dimensionsRaw === 'string'
        ? Number(dimensionsRaw)
        : NaN;
  const isDefault =
    item.is_default === true ||
    item.default === true ||
    item.active === true;

  if (!id || !name || !model || !Number.isFinite(dimensions)) {
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
  const listConfigPaths = [
    '/api/v1/embedding-configs',
    '/api/v1/inference/embedding-configs',
    '/api/v1/inference/embeddings',
  ];

  const defaultConfigPaths = [
    '/api/v1/embedding-configs/default',
    '/api/v1/inference/embedding-configs/default',
    '/api/v1/inference/embeddings/default',
  ];

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
      for (const path of listConfigPaths) {
        try {
          const response = await client.get<unknown>(path);
          const parsed = parseEmbeddingConfigList(response);
          if (parsed.length > 0) {
            return parsed;
          }
        } catch {
          // try next path
        }
      }
      return [];
    },

    /**
     * Get the default embedding configuration
     */
    async getDefaultConfig(): Promise<EmbeddingConfig> {
      for (const path of defaultConfigPaths) {
        try {
          const response = await client.get<unknown>(path);
          const parsed = parseDefaultEmbeddingConfig(response);
          if (parsed) {
            return parsed;
          }
        } catch {
          // try next path
        }
      }

      const configs = await this.listConfigs();
      const fallback = configs.find((cfg) => cfg.is_default) || configs[0];
      if (fallback) {
        return fallback;
      }

      throw new Error('Invalid default embedding config response');
    },
  };
}

export type EmbeddingsApi = ReturnType<typeof createEmbeddingsApi>;
