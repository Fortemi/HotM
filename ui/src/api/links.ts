/**
 * Links & Graph API client
 * Handles semantic links and graph exploration
 */

import type { ApiClient } from './client';
import type {
  NoteLinksResponse,
  GraphExploreResponse,
} from './types-extended';

export function createLinksApi(client: ApiClient) {
  return {
    /**
     * Get all bidirectional links for a note
     * Returns both outgoing and incoming links
     */
    async getLinks(noteId: string): Promise<NoteLinksResponse> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      return client.get<NoteLinksResponse>(`/api/v1/notes/${noteId}/links`);
    },

    /**
     * Get only incoming links (backlinks) for a note
     */
    async getBacklinks(noteId: string): Promise<NoteLinksResponse['incoming']> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<{ backlinks: NoteLinksResponse['incoming'] }>(
        `/api/v1/notes/${noteId}/backlinks`
      );

      return response.backlinks;
    },

    /**
     * Explore graph starting from a note
     * Traverses semantic links using recursive CTEs
     */
    async exploreGraph(
      noteId: string,
      options: {
        depth?: number;
        max_nodes?: number;
        min_score?: number;
      } = {}
    ): Promise<GraphExploreResponse> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const params: Record<string, string> = {};

      if (options.depth !== undefined) {
        params.depth = String(options.depth);
      }

      if (options.max_nodes !== undefined) {
        params.max_nodes = String(options.max_nodes);
      }

      if (options.min_score !== undefined) {
        params.min_score = String(options.min_score);
      }

      return client.get<GraphExploreResponse>(
        `/api/v1/graph/${noteId}`,
        params
      );
    },
  };
}

export type LinksApi = ReturnType<typeof createLinksApi>;
