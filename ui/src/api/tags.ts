/**
 * Tags API client
 * Handles tag management operations
 */

import type { ApiClient } from './client';
import type { Tag, TagListResponse, TagStats, TagListOptions } from './types';

export function createTagsApi(client: ApiClient) {
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

      const response = await client.get<TagListResponse>(
        '/api/v1/tags',
        Object.keys(params).length > 0 ? params : undefined
      );

      return response.tags;
    },

    /**
     * Create a new tag
     */
    async create(name: string): Promise<{ name: string }> {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error('Tag name is required');
      }

      return client.post<{ name: string }>('/api/v1/tags', {
        name: trimmedName,
      });
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

      return client.patch<{ name: string }>(`/api/v1/tags/${trimmedOldName}`, {
        new_name: trimmedNewName,
      });
    },

    /**
     * Delete a tag
     */
    async delete(name: string): Promise<void> {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error('Tag name is required');
      }

      await client.delete(`/api/v1/tags/${trimmedName}`);
    },

    /**
     * Get tag statistics
     */
    async getStats(): Promise<TagStats> {
      return client.get<TagStats>('/api/v1/tags/stats');
    },
  };
}

export type TagsApi = ReturnType<typeof createTagsApi>;
