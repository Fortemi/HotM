/**
 * Tags API client
 * Handles tag management operations
 */

import type { ApiClient } from './client';
import type { Tag, TagListResponse, TagStats, TagListOptions } from './types';

function normalizeTag(raw: unknown): Tag | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const tag = raw as Record<string, unknown>;
  const name = typeof tag.name === 'string' ? tag.name : '';
  if (!name) {
    return null;
  }

  const count =
    (typeof tag.count === 'number' ? tag.count : null) ??
    (typeof tag.note_count === 'number' ? tag.note_count : null) ??
    0;

  return { name, count };
}

function normalizeTagsResponse(response: Tag[] | TagListResponse): Tag[] {
  const rawTags = Array.isArray(response) ? response : (response?.tags ?? []);
  return rawTags
    .map((tag) => normalizeTag(tag))
    .filter((tag): tag is Tag => tag !== null);
}

export function createTagsApi(client: ApiClient) {
  async function listNotesByTag(tag: string): Promise<Array<{ id: string; tags?: string[] }>> {
    const response = await client.get<{
      notes?: Array<{ id: string; tags?: string[] }>;
      total?: number;
    }>(
      '/notes',
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
        '/tags',
        Object.keys(params).length > 0 ? params : undefined
      );

      const normalized = normalizeTagsResponse(response);

      const filtered =
        minCount !== undefined
          ? normalized.filter((tag) => tag.count >= minCount)
          : normalized;

      if (sortBy === 'count') {
        return [...filtered].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      }
      if (sortBy === 'name') {
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      }

      return filtered;
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
        return await client.post<{ name: string }>('/tags', {
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
        return await client.patch<{ name: string }>(`/tags/${trimmedOldName}`, {
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
          await client.put(`/notes/${note.id}/tags`, {
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
        await client.delete(`/tags/${trimmedName}`);
      } catch {
        // Fallback: remove tag from all notes.
        const notes = await listNotesByTag(trimmedName);
        for (const note of notes) {
          const nextTags = (note.tags ?? []).filter((tag) => tag !== trimmedName);
          await client.put(`/notes/${note.id}/tags`, {
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
        const stats = await client.get<TagStats>('/tags/stats');
        return {
          ...stats,
          stats_available: true,
        };
      } catch {
        // Endpoint may not exist; return partial stats from tag list and
        // mark fields that cannot be computed from this payload.
        const response = await client.get<Tag[] | TagListResponse>(
          '/tags'
        );
        const tags = normalizeTagsResponse(response);
        const totalTaggedNotes = tags.reduce((sum, t) => sum + t.count, 0);
        return {
          total_tags: tags.length,
          total_tagged_notes: totalTaggedNotes,
          avg_tags_per_note: null,
          most_used: [...tags].sort((a, b) => b.count - a.count).slice(0, 10),
          stats_available: false,
          unavailable_reason: 'tags_stats_endpoint_unavailable',
        };
      }
    },
  };
}

export type TagsApi = ReturnType<typeof createTagsApi>;
