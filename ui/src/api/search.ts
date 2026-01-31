/**
 * Search API client
 * Handles hybrid, FTS, and semantic search operations
 */

import type { ApiClient } from './client';
import type {
  SearchResult,
  SearchResponse,
  SearchOptions,
  SimilarNotesOptions,
} from './types';

export function createSearchApi(client: ApiClient) {
  return {
    /**
     * Search notes with hybrid, FTS, or semantic mode
     */
    async search(
      query: string,
      options: SearchOptions = {}
    ): Promise<SearchResult[]> {
      if (!query || query.trim() === '') {
        throw new Error('Search query is required');
      }

      const {
        mode = 'hybrid',
        tags,
        starred,
        archived,
        limit,
        offset,
      } = options;

      const params: Record<string, string> = {
        q: query,
        mode,
      };

      if (tags && tags.length > 0) {
        params.tags = tags.join(',');
      }

      if (starred !== undefined) {
        params.starred = String(starred);
      }

      if (archived !== undefined) {
        params.archived = String(archived);
      }

      if (limit !== undefined) {
        params.limit = String(limit);
      }

      if (offset !== undefined) {
        params.offset = String(offset);
      }

      const response = await client.get<SearchResponse>(
        '/api/v1/search',
        params
      );

      return response.results;
    },

    /**
     * Find similar notes by note ID (semantic similarity)
     */
    async findSimilar(
      noteId: string,
      options: SimilarNotesOptions = {}
    ): Promise<SearchResult[]> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const { limit = 10, threshold } = options;

      const params: Record<string, string> = {
        limit: String(limit),
      };

      if (threshold !== undefined) {
        params.threshold = String(threshold);
      }

      const response = await client.get<SearchResponse>(
        `/api/v1/notes/${noteId}/similar`,
        params
      );

      return response.results;
    },

    /**
     * Search notes by tags only
     */
    async searchByTags(tags: string[]): Promise<SearchResult[]> {
      if (!tags || tags.length === 0) {
        throw new Error('At least one tag is required');
      }

      const params: Record<string, string> = {
        q: '',
        mode: 'hybrid',
        tags: tags.join(','),
      };

      const response = await client.get<SearchResponse>(
        '/api/v1/search',
        params
      );

      return response.results;
    },
  };
}

export type SearchApi = ReturnType<typeof createSearchApi>;
