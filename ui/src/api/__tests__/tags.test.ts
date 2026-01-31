import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTagsApi } from '../tags';
import type { ApiClient } from '../client';

describe('Tags API', () => {
  let mockClient: ApiClient;
  let tagsApi: ReturnType<typeof createTagsApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn()
    } as unknown as ApiClient;

    tagsApi = createTagsApi(mockClient);
  });

  describe('list', () => {
    it('fetches all tags with usage counts', async () => {
      const mockResponse = {
        tags: [
          { name: 'work', count: 15 },
          { name: 'personal', count: 8 },
          { name: 'archive', count: 3 }
        ]
      };

      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      const result = await tagsApi.list();

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/tags', undefined);
      expect(result).toEqual(mockResponse.tags);
    });

    it('supports sorting by name', async () => {
      const mockResponse = { tags: [] };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await tagsApi.list({ sortBy: 'name' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/tags',
        expect.objectContaining({
          sort_by: 'name'
        })
      );
    });

    it('supports sorting by count', async () => {
      const mockResponse = { tags: [] };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await tagsApi.list({ sortBy: 'count' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/tags',
        expect.objectContaining({
          sort_by: 'count'
        })
      );
    });

    it('supports minimum count filter', async () => {
      const mockResponse = { tags: [] };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await tagsApi.list({ minCount: 5 });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/tags',
        expect.objectContaining({
          min_count: '5'
        })
      );
    });
  });

  describe('create', () => {
    it('creates a new tag', async () => {
      const mockResponse = { name: 'newtag' };
      vi.mocked(mockClient.post).mockResolvedValueOnce(mockResponse);

      const result = await tagsApi.create('newtag');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/tags', {
        name: 'newtag'
      });
      expect(result).toEqual(mockResponse);
    });

    it('throws error for empty tag name', async () => {
      await expect(tagsApi.create('')).rejects.toThrow('Tag name is required');
    });

    it('throws error for whitespace-only tag name', async () => {
      await expect(tagsApi.create('   ')).rejects.toThrow(
        'Tag name is required'
      );
    });

    it('trims whitespace from tag name', async () => {
      const mockResponse = { name: 'trimmed' };
      vi.mocked(mockClient.post).mockResolvedValueOnce(mockResponse);

      await tagsApi.create('  trimmed  ');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/tags', {
        name: 'trimmed'
      });
    });
  });

  describe('rename', () => {
    it('renames an existing tag', async () => {
      const mockResponse = { name: 'renamed' };
      vi.mocked(mockClient.patch).mockResolvedValueOnce(mockResponse);

      const result = await tagsApi.rename('oldname', 'renamed');

      expect(mockClient.patch).toHaveBeenCalledWith('/api/v1/tags/oldname', {
        new_name: 'renamed'
      });
      expect(result).toEqual(mockResponse);
    });

    it('throws error for empty old name', async () => {
      await expect(tagsApi.rename('', 'newname')).rejects.toThrow(
        'Tag name is required'
      );
    });

    it('throws error for empty new name', async () => {
      await expect(tagsApi.rename('oldname', '')).rejects.toThrow(
        'New tag name is required'
      );
    });
  });

  describe('delete', () => {
    it('deletes a tag', async () => {
      vi.mocked(mockClient.delete).mockResolvedValueOnce(null);

      await tagsApi.delete('obsolete');

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/tags/obsolete');
    });

    it('throws error for empty tag name', async () => {
      await expect(tagsApi.delete('')).rejects.toThrow('Tag name is required');
    });
  });

  describe('getStats', () => {
    it('fetches tag statistics', async () => {
      const mockResponse = {
        total_tags: 25,
        total_tagged_notes: 150,
        avg_tags_per_note: 2.5,
        most_used: [
          { name: 'work', count: 50 },
          { name: 'personal', count: 30 }
        ]
      };

      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      const result = await tagsApi.getStats();

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/tags/stats');
      expect(result).toEqual(mockResponse);
    });
  });
});
