/**
 * Knowledge Health API client
 * Handles knowledge base health monitoring and quality metrics
 */

import type { ApiClient } from './client';
import { getMemoryRoutingHeaderName } from './memory-context';
import type {
  KnowledgeHealth,
  OrphanTag,
  StaleNote,
  TagCooccurrenceResponse,
} from './types-extended';
import type { NoteSummary } from './types';

export function createHealthApi(client: ApiClient) {
  const asNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

  return {
    /**
     * Get overall knowledge base health metrics
     */
    async getKnowledgeHealth(archive?: string): Promise<KnowledgeHealth> {
      const headers =
        archive && archive.trim().length > 0
          ? { [getMemoryRoutingHeaderName()]: archive, 'Cache-Control': 'no-cache' }
          : undefined;
      const response = await client.get<Record<string, unknown>>('/api/v1/health/knowledge', undefined, headers);
      const metrics =
        response.metrics && typeof response.metrics === 'object'
          ? (response.metrics as Record<string, unknown>)
          : undefined;

      const totalNotes =
        asNumber(response.total_notes) ??
        asNumber(response.note_count) ??
        0;
      const staleNotes = asNumber(response.stale_notes) ?? 0;
      const unlinkedNotes = asNumber(response.unlinked_notes) ?? 0;
      const orphanNotes =
        asNumber(response.orphan_notes) ??
        // Legacy fallback: previously mapped from orphan_tags.
        asNumber(response.orphan_tags) ??
        0;

      const explicitAvgLinks =
        asNumber(response.avg_links_per_note) ??
        asNumber(response.link_density) ??
        asNumber(metrics?.avg_links_per_note) ??
        asNumber(metrics?.link_density) ??
        asNumber(metrics?.link_coverage);
      const derivedAvgLinks = (() => {
        const totalLinks = asNumber(response.total_links);
        if (totalLinks === undefined || totalNotes <= 0) {
          return undefined;
        }
        return totalLinks / totalNotes;
      })();

      const tagCoverage =
        asNumber(response.tag_coverage) ??
        asNumber(metrics?.tag_coverage) ??
        (() => {
          const notesWithoutTags = asNumber(response.notes_without_tags);
          if (notesWithoutTags === undefined || totalNotes <= 0) {
            return undefined;
          }
          return 1 - notesWithoutTags / totalNotes;
        })() ??
        0;

      return {
        total_notes: totalNotes,
        orphan_notes: orphanNotes,
        stale_notes: staleNotes,
        unlinked_notes: unlinkedNotes,
        avg_links_per_note: explicitAvgLinks ?? derivedAvgLinks ?? 0,
        tag_coverage: Math.max(0, Math.min(1, tagCoverage)),
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
