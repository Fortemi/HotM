/**
 * Links & Graph API client
 * Handles semantic links and graph exploration
 */

import type { ApiClient } from './client';
import type {
  NoteLinksResponse,
  GraphExploreResponse,
} from './types-extended';

export type LinkKind = 'related' | 'mention' | 'reference' | 'task' | 'semantic' | 'keyword';

export interface CreateLinkRequest {
  to_note_id?: string;
  to_url?: string;
  kind?: LinkKind;
  score?: number;
}

export interface CreateLinkResponse {
  status: string;
  link_id: string;
  from_note_id: string;
  to_note_id?: string;
  rows_affected: number;
}

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

      return client.get<NoteLinksResponse>(`/notes/${noteId}/links`);
    },

    /**
     * Create a link from one note to another note or external URL
     */
    async createLink(
      noteId: string,
      request: CreateLinkRequest
    ): Promise<CreateLinkResponse> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!request.to_note_id && !request.to_url) {
        throw new Error('Either to_note_id or to_url is required');
      }

      return client.post<CreateLinkResponse>(
        `/notes/${noteId}/links`,
        request
      );
    },

    /**
     * Delete a link from a note
     */
    async deleteLink(noteId: string, linkId: string): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!linkId || linkId.trim() === '') {
        throw new Error('Link ID is required');
      }

      await client.delete(`/notes/${noteId}/links/${linkId}`);
    },

    /**
     * Get only incoming links (backlinks) for a note
     */
    async getBacklinks(noteId: string): Promise<NoteLinksResponse['incoming']> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<{ backlinks: NoteLinksResponse['incoming'] }>(
        `/notes/${noteId}/backlinks`
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
        max_edges_per_node?: number;
        // v2 guardrail parameters
        min_edge_weight?: number;
        max_depth?: number;
        algorithms?: string[];
        include_bridges_only?: boolean;
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

      if (options.max_edges_per_node !== undefined) {
        params.max_edges_per_node = String(options.max_edges_per_node);
      }

      // v2 guardrail parameters
      if (options.min_edge_weight !== undefined) {
        params.min_edge_weight = String(options.min_edge_weight);
      }

      if (options.max_depth !== undefined) {
        params.max_depth = String(options.max_depth);
      }

      if (options.algorithms !== undefined && options.algorithms.length > 0) {
        params.algorithms = options.algorithms.join(',');
      }

      if (options.include_bridges_only !== undefined) {
        params.include_bridges_only = String(options.include_bridges_only);
      }

      return client.get<GraphExploreResponse>(
        `/graph/${noteId}`,
        params
      );
    },
  };
}

export type LinksApi = ReturnType<typeof createLinksApi>;
