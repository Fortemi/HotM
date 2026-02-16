/**
 * Tags API client
 * Handles tag management operations
 */

import type { ApiClient } from './client';
import type { Tag, TagListResponse, TagStats, TagListOptions } from './types';

export function createTagsApi(client: ApiClient) {
  async function listNotesByTag(tag: string): Promise<Array<{ id: string; tags?: string[] }>> {
    const response = await client.get<{
      notes?: Array<{ id: string; tags?: string[] }>;
      total?: number;
    }>(
      '/api/v1/notes',
      { tags: tag, limit: '1000', sort_by: 'updated_at', sort_order: 'desc' }
    );
    return response.notes ?? [];
  }

  return {
    /**
     * List all tags with usage counts
     */
    async list(options: TagListOptions = {}): Promise<Tag[]> {
      const { sortBy, minCount } = options;

      const params: Record<string, string> = {};

      if (sortBy) {
        params.sort_by = sortBy;
      }

      if (minCount !== undefined) {
        params.min_count = String(minCount);
      }

      const response = await client.get<Tag[] | TagListResponse>(
        '/api/v1/tags',
        Object.keys(params).length > 0 ? params : undefined
      );

      const tags = Array.isArray(response) ? response : (response?.tags ?? []);
      // Normalize: Fortemi API may return note_count instead of count
      return tags.map(t => ({
        name: t.name,
        count: t.count ?? (t as unknown as Record<string, number>)['note_count'] ?? 0,
      }));
    },

    /**
     * Create a new tag
     */
    async create(name: string): Promise<{ name: string }> {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error('Tag name is required');
      }

      try {
        return await client.post<{ name: string }>('/api/v1/tags', {
          name: trimmedName,
        });
      } catch {
        // Fortemi tag creation is note-driven via note tag sets.
        return { name: trimmedName };
      }
    },

    /**
     * Rename an existing tag
     */
    async rename(oldName: string, newName: string): Promise<{ name: string }> {
      const trimmedOldName = oldName.trim();
      const trimmedNewName = newName.trim();

      if (!trimmedOldName) {
        throw new Error('Tag name is required');
      }

      if (!trimmedNewName) {
        throw new Error('New tag name is required');
      }

      try {
        return await client.patch<{ name: string }>(`/api/v1/tags/${trimmedOldName}`, {
          new_name: trimmedNewName,
        });
      } catch {
        // Fallback: rewrite tag across all notes containing the old tag.
        const notes = await listNotesByTag(trimmedOldName);
        for (const note of notes) {
          const existing = new Set(note.tags ?? []);
          if (!existing.has(trimmedOldName)) {
            continue;
          }
          existing.delete(trimmedOldName);
          existing.add(trimmedNewName);
          await client.put(`/api/v1/notes/${note.id}/tags`, {
            tags: Array.from(existing),
          });
        }
        return { name: trimmedNewName };
      }
    },

    /**
     * Delete a tag
     */
    async delete(name: string): Promise<void> {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error('Tag name is required');
      }

      try {
        await client.delete(`/api/v1/tags/${trimmedName}`);
      } catch {
        // Fallback: remove tag from all notes.
        const notes = await listNotesByTag(trimmedName);
        for (const note of notes) {
          const nextTags = (note.tags ?? []).filter((tag) => tag !== trimmedName);
          await client.put(`/api/v1/notes/${note.id}/tags`, {
            tags: nextTags,
          });
        }
      }
    },

    /**
     * Get tag statistics
     */
    async getStats(): Promise<TagStats> {
      try {
        const stats = await client.get<TagStats>('/api/v1/tags/stats');
        return {
          ...stats,
          stats_available: true,
        };
      } catch {
        // Endpoint may not exist; return partial stats from tag list and
        // mark fields that cannot be computed from this payload.
        const response = await client.get<Tag[] | TagListResponse>(
          '/api/v1/tags'
        );
        const tags = Array.isArray(response) ? response : (response?.tags ?? []);
        const totalTaggedNotes = tags.reduce((sum, t) => sum + ((t.count ?? 0)), 0);
        return {
          total_tags: tags.length,
          total_tagged_notes: totalTaggedNotes,
          avg_tags_per_note: null,
          most_used: [...tags].sort((a, b) => ((b.count ?? 0) - (a.count ?? 0))).slice(0, 10),
          stats_available: false,
          unavailable_reason: 'tags_stats_endpoint_unavailable',
        };
      }
    },
  };
}

export type TagsApi = ReturnType<typeof createTagsApi>;
