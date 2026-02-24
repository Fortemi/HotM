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

      expect(mockClient.get).toHaveBeenCalledWith('/tags', undefined);
      expect(result).toEqual(mockResponse.tags);
    });

    it('supports sorting by name', async () => {
      const mockResponse = { tags: [] };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await tagsApi.list({ sortBy: 'name' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/tags',
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
        '/tags',
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
        '/tags',
        expect.objectContaining({
          min_count: '5'
        })
      );
    });

    it('sorts by count client-side when requested', async () => {
      vi.mocked(mockClient.get).mockResolvedValueOnce([
        { name: 'beta', note_count: 1 },
        { name: 'alpha', note_count: 3 },
        { name: 'gamma', note_count: 3 }
      ]);

      const result = await tagsApi.list({ sortBy: 'count' });

      expect(result).toEqual([
        { name: 'alpha', count: 3 },
        { name: 'gamma', count: 3 },
        { name: 'beta', count: 1 }
      ]);
    });

    it('sorts by name client-side when requested', async () => {
      vi.mocked(mockClient.get).mockResolvedValueOnce([
        { name: 'gamma', note_count: 3 },
        { name: 'beta', note_count: 1 },
        { name: 'alpha', note_count: 2 }
      ]);

      const result = await tagsApi.list({ sortBy: 'name' });

      expect(result).toEqual([
        { name: 'alpha', count: 2 },
        { name: 'beta', count: 1 },
        { name: 'gamma', count: 3 }
      ]);
    });

    it('applies minCount filter client-side', async () => {
      vi.mocked(mockClient.get).mockResolvedValueOnce([
        { name: 'one', note_count: 1 },
        { name: 'two', note_count: 2 },
        { name: 'three', note_count: 3 }
      ]);

      const result = await tagsApi.list({ minCount: 2 });

      expect(result).toEqual([
        { name: 'two', count: 2 },
        { name: 'three', count: 3 }
      ]);
    });
  });

  describe('create', () => {
    it('creates a new tag', async () => {
      const mockResponse = { name: 'newtag' };
      vi.mocked(mockClient.post).mockResolvedValueOnce(mockResponse);

      const result = await tagsApi.create('newtag');

      expect(mockClient.post).toHaveBeenCalledWith('/tags', {
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

      expect(mockClient.post).toHaveBeenCalledWith('/tags', {
        name: 'trimmed'
      });
    });
  });

  describe('rename', () => {
    it('renames an existing tag', async () => {
      const mockResponse = { name: 'renamed' };
      vi.mocked(mockClient.patch).mockResolvedValueOnce(mockResponse);

      const result = await tagsApi.rename('oldname', 'renamed');

      expect(mockClient.patch).toHaveBeenCalledWith('/tags/oldname', {
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

      expect(mockClient.delete).toHaveBeenCalledWith('/tags/obsolete');
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

      expect(mockClient.get).toHaveBeenCalledWith('/tags/stats');
      expect(result).toEqual({
        ...mockResponse,
        stats_available: true
      });
    });

    it('marks average as unavailable when stats endpoint is missing', async () => {
      vi.mocked(mockClient.get)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({
          tags: [
            { name: 'work', count: 5 },
            { name: 'personal', count: 3 }
          ]
        });

      const result = await tagsApi.getStats();

      expect(mockClient.get).toHaveBeenNthCalledWith(1, '/tags/stats');
      expect(mockClient.get).toHaveBeenNthCalledWith(2, '/tags');
      expect(result).toEqual({
        total_tags: 2,
        total_tagged_notes: 8,
        avg_tags_per_note: null,
        most_used: [
          { name: 'work', count: 5 },
          { name: 'personal', count: 3 }
        ],
        stats_available: false,
        unavailable_reason: 'tags_stats_endpoint_unavailable'
      });
    });

    it('uses note_count when count is absent in fallback stats', async () => {
      vi.mocked(mockClient.get)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce([
          { name: 'fortemi/api-reference', note_count: 3 },
          { name: 'fortemi/ui', note_count: 2 }
        ]);

      const result = await tagsApi.getStats();

      expect(result.total_tags).toBe(2);
      expect(result.total_tagged_notes).toBe(5);
      expect(result.most_used[0]).toEqual({ name: 'fortemi/api-reference', count: 3 });
    });
  });
});
