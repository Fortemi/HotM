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
import type { FederatedSearchHit, FederatedSearchResponse } from './types-extended';

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
        collection,
        before,
        after,
        filters,
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

      if (collection) {
        params.collection = collection;
      }

      if (before) {
        params.before = before;
      }

      if (after) {
        params.after = after;
      }

      if (filters) {
        params.filters = filters;
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

      try {
        const response = await client.get<SearchResponse>(
          `/api/v1/notes/${noteId}/similar`,
          params
        );
        return response.results;
      } catch {
        // /similar not available — fall back to graph links (single endpoint)
        const linksResp = await client.get<{
          outgoing?: Array<{ to_note_id: string; score?: number; snippet?: string }>;
          incoming?: Array<{ from_note_id: string; score?: number; snippet?: string }>;
        }>(`/api/v1/notes/${noteId}/links`);

        const results: SearchResult[] = [];
        for (const edge of linksResp.outgoing ?? []) {
          results.push({
            note_id: edge.to_note_id,
            score: edge.score ?? 0.5,
            snippet: edge.snippet ?? '',
          });
        }
        for (const edge of linksResp.incoming ?? []) {
          if (!results.some((item) => item.note_id === edge.from_note_id)) {
            results.push({
              note_id: edge.from_note_id,
              score: edge.score ?? 0.5,
              snippet: edge.snippet ?? '',
            });
          }
        }
        return results.slice(0, limit);
      }
    },

    /**
     * Semantic search by raw text (POST /semantic)
     * Unlike findSimilar which requires a note ID, this accepts arbitrary text
     */
    async semanticSearch(
      text: string,
      options: SimilarNotesOptions = {}
    ): Promise<SearchResult[]> {
      if (!text || text.trim() === '') {
        throw new Error('Search text is required');
      }

      const { limit = 10, threshold } = options;

      const body: Record<string, unknown> = {
        text,
        limit,
      };

      if (threshold !== undefined) {
        body.threshold = threshold;
      }

      try {
        const response = await client.post<{ similar: SearchResult[] }>(
          '/api/v1/semantic',
          body
        );
        return response.similar;
      } catch {
        const response = await client.get<SearchResponse>('/api/v1/search', {
          q: text,
          mode: 'semantic',
          limit: String(limit),
          ...(threshold !== undefined ? { threshold: String(threshold) } : {}),
        });
        return response.results;
      }
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

    /**
     * Federated full-text search across multiple memories/archives.
     * Pass ["all"] to search every memory.
     */
    async federatedSearch(
      query: string,
      memories: string[],
      limit: number = 10
    ): Promise<FederatedSearchHit[]> {
      if (!query || query.trim() === '') {
        throw new Error('Search query is required');
      }
      if (!memories || memories.length === 0) {
        throw new Error('At least one memory is required');
      }

      const response = await client.post<FederatedSearchResponse>(
        '/api/v1/search/federated',
        {
          q: query,
          memories,
          limit,
        }
      );
      return response.results;
    },
  };
}

export type SearchApi = ReturnType<typeof createSearchApi>;
