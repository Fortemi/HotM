/**
 * Knowledge Health API client
 * Handles knowledge base health monitoring and quality metrics
 */

import type { ApiClient } from './client';
import type {
  KnowledgeHealth,
  OrphanTag,
  StaleNote,
  TagCooccurrenceResponse,
} from './types-extended';
import type { NoteSummary } from './types';

export function createHealthApi(client: ApiClient) {
  return {
    /**
     * Get overall knowledge base health metrics
     */
    async getKnowledgeHealth(): Promise<KnowledgeHealth> {
      return client.get<KnowledgeHealth>('/api/v1/health/knowledge');
    },

    /**
     * Get orphan tags (defined but unused)
     */
    async getOrphanTags(): Promise<OrphanTag[]> {
      const response = await client.get<{ orphan_tags: OrphanTag[] }>(
        '/api/v1/health/orphan-tags'
      );
      return response.orphan_tags;
    },

    /**
     * Get stale notes (not updated in N days)
     */
    async getStaleNotes(days: number = 180): Promise<StaleNote[]> {
      if (days < 1) {
        throw new Error('Days must be greater than 0');
      }

      const params: Record<string, string> = {
        days: String(days),
      };

      const response = await client.get<{ stale_notes: StaleNote[] }>(
        '/api/v1/health/stale-notes',
        params
      );

      return response.stale_notes;
    },

    /**
     * Get unlinked notes (no semantic links)
     */
    async getUnlinkedNotes(): Promise<NoteSummary[]> {
      const response = await client.get<{ notes: NoteSummary[] }>(
        '/api/v1/health/unlinked-notes'
      );

      return response.notes;
    },

    /**
     * Get tag co-occurrence statistics
     * Useful for discovering tag relationships
     */
    async getTagCooccurrence(minCount: number = 5): Promise<TagCooccurrenceResponse> {
      if (minCount < 1) {
        throw new Error('Minimum count must be greater than 0');
      }

      const params: Record<string, string> = {
        min_count: String(minCount),
      };

      return client.get<TagCooccurrenceResponse>(
        '/api/v1/health/tag-cooccurrence',
        params
      );
    },
  };
}

export type HealthApi = ReturnType<typeof createHealthApi>;
