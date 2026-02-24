/**
 * Embedding Sets API client
 * Handles isolated embedding spaces for multi-tenant or specialized use cases
 */

import type { ApiClient } from './client';
import type {
  EmbeddingSet,
  CreateEmbeddingSetRequest,
  UpdateEmbeddingSetRequest,
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
    '/embedding-configs',
    '/inference/embedding-configs',
    '/inference/embeddings',
  ];

  const defaultConfigPaths = [
    '/embedding-configs/default',
    '/inference/embedding-configs/default',
    '/inference/embeddings/default',
  ];

  return {
    // ===========================
    // Embedding Sets
    // ===========================

    /**
     * List all embedding sets
     */
    async listSets(): Promise<EmbeddingSet[]> {
      const response = await client.get<unknown>('/embedding-sets');
      const raw = Array.isArray(response)
        ? response
        : (response as Record<string, unknown>)?.embedding_sets ?? [];
      if (!Array.isArray(raw)) return [];
      return raw.map((item: Record<string, unknown>) => ({
        slug: (item.slug ?? item.id ?? '') as string,
        name: (item.name ?? item.slug ?? '') as string,
        embedding_config_id: (item.embedding_config_id ?? item.model ?? '') as string,
        created_at: (item.created_at ?? '') as string,
        updated_at: (item.updated_at ?? '') as string,
        note_count: (item.note_count ?? item.document_count ?? undefined) as number | undefined,
        mode: (item.mode ?? (item.set_type === 'filter' ? 'auto' : undefined)) as EmbeddingSet['mode'],
        criteria: item.criteria as EmbeddingSet['criteria'],
        description: (item.description ?? undefined) as string | undefined,
        purpose: (item.purpose ?? undefined) as string | undefined,
        keywords: item.keywords as string[] | undefined,
      }));
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

      return client.post<EmbeddingSet>('/embedding-sets', request);
    },

    /**
     * Get a specific embedding set
     */
    async getSet(slug: string): Promise<EmbeddingSet> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      return client.get<EmbeddingSet>(`/embedding-sets/${slug}`);
    },

    /**
     * Update an embedding set
     */
    async updateSet(
      slug: string,
      updates: UpdateEmbeddingSetRequest
    ): Promise<EmbeddingSet> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      return client.patch<EmbeddingSet>(
        `/embedding-sets/${slug}`,
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

      await client.delete(`/embedding-sets/${slug}`);
    },

    /**
     * List all notes in an embedding set
     */
    async listSetMembers(slug: string): Promise<NoteSummary[]> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      const response = await client.get<{ notes: NoteSummary[] }>(
        `/embedding-sets/${slug}/members`
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

      await client.post(`/embedding-sets/${slug}/members`, request);
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

      await client.delete(`/embedding-sets/${slug}/members/${noteId}`);
    },

    /**
     * Refresh embeddings for all notes in a set
     * Regenerates embeddings with current model
     */
    async refreshSet(slug: string): Promise<void> {
      if (!slug || slug.trim() === '') {
        throw new Error('Embedding set slug is required');
      }

      await client.post(`/embedding-sets/${slug}/refresh`);
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
