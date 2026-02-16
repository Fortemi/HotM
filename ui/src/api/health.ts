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
      const response = await client.get<Record<string, unknown>>('/api/v1/health/knowledge');
      return {
        total_notes:
          typeof response.total_notes === 'number'
            ? response.total_notes
            : 0,
        orphan_notes:
          typeof response.orphan_notes === 'number'
            ? response.orphan_notes
            : typeof response.orphan_tags === 'number'
              ? response.orphan_tags
              : 0,
        stale_notes:
          typeof response.stale_notes === 'number'
            ? response.stale_notes
            : 0,
        unlinked_notes:
          typeof response.unlinked_notes === 'number'
            ? response.unlinked_notes
            : 0,
        avg_links_per_note:
          typeof response.avg_links_per_note === 'number'
            ? response.avg_links_per_note
            : 0,
        tag_coverage:
          typeof response.tag_coverage === 'number'
            ? response.tag_coverage
            : 0,
        last_activity:
          typeof response.last_activity === 'string'
            ? response.last_activity
            : new Date().toISOString(),
      };
    },

    /**
     * Get orphan tags (defined but unused)
     */
    async getOrphanTags(): Promise<OrphanTag[]> {
      const response = await client.get<{ orphan_tags?: OrphanTag[] } | OrphanTag[]>(
        '/api/v1/health/orphan-tags'
      );
      return Array.isArray(response) ? response : (response.orphan_tags ?? []);
    },

    /**
     * Get stale notes (not updated in N days)
     */
    async getStaleNotes(days: number = 180): Promise<StaleNote[]> {
      if (days < 1) {
        throw new Error('Days must be greater than 0');
      }

      const params: Record<string, string> = {
        stale_days: String(days),
      };

      const response = await client.get<{ stale_notes?: StaleNote[] } | StaleNote[]>(
        '/api/v1/health/stale-notes',
        params
      );

      return Array.isArray(response) ? response : (response.stale_notes ?? []);
    },

    /**
     * Get unlinked notes (no semantic links)
     */
    async getUnlinkedNotes(): Promise<NoteSummary[]> {
      const response = await client.get<{
        notes?: NoteSummary[];
        unlinked_notes?: NoteSummary[];
      }>(
        '/api/v1/health/unlinked-notes'
      );

      return response.unlinked_notes ?? response.notes ?? [];
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

      const response = await client.get<{
        pairs?: TagCooccurrenceResponse['pairs'];
        cooccurrence_pairs?: TagCooccurrenceResponse['pairs'];
      }>(
        '/api/v1/health/tag-cooccurrence',
        params
      );
      return {
        pairs: response.cooccurrence_pairs ?? response.pairs ?? [],
      };
    },
  };
}

export type HealthApi = ReturnType<typeof createHealthApi>;
