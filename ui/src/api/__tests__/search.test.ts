import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSearchApi } from '../search';
import type { ApiClient } from '../client';

describe('Search API', () => {
  let mockClient: ApiClient;
  let searchApi: ReturnType<typeof createSearchApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn()
    } as unknown as ApiClient;

    searchApi = createSearchApi(mockClient);
  });

  describe('search', () => {
    it('performs hybrid search by default', async () => {
      const mockResponse = {
        results: [
          {
            note_id: '123',
            score: 0.95,
            snippet: 'Test snippet with <mark>query</mark> highlighted'
          }
        ],
        total: 1
      };

      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      const result = await searchApi.search('test query');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          q: 'test query',
          mode: 'hybrid'
        })
      );
      expect(result).toEqual(mockResponse.results);
    });

    it('supports FTS search mode', async () => {
      const mockResponse = { results: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await searchApi.search('keywords', { mode: 'fts' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          q: 'keywords',
          mode: 'fts'
        })
      );
    });

    it('supports semantic search mode', async () => {
      const mockResponse = { results: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await searchApi.search('meaning of life', { mode: 'semantic' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          q: 'meaning of life',
          mode: 'semantic'
        })
      );
    });

    it('supports tag filters', async () => {
      const mockResponse = { results: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await searchApi.search('test', {
        tags: ['work', 'important']
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          tags: 'work,important'
        })
      );
    });

    it('supports starred and archived filters', async () => {
      const mockResponse = { results: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await searchApi.search('test', {
        starred: true,
        archived: false
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          starred: 'true',
          archived: 'false'
        })
      );
    });

    it('supports pagination', async () => {
      const mockResponse = { results: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await searchApi.search('test', {
        limit: 20,
        offset: 10
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          limit: '20',
          offset: '10'
        })
      );
    });

    it('throws error for empty query', async () => {
      await expect(searchApi.search('')).rejects.toThrow(
        'Search query is required'
      );
    });

    it('throws error for whitespace-only query', async () => {
      await expect(searchApi.search('   ')).rejects.toThrow(
        'Search query is required'
      );
    });
  });

  describe('findSimilar', () => {
    it('finds similar notes by note ID', async () => {
      const mockResponse = {
        results: [
          {
            note_id: '456',
            score: 0.85,
            snippet: 'Similar content'
          }
        ],
        total: 1
      };

      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      const result = await searchApi.findSimilar('123');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/notes/123/similar',
        expect.objectContaining({
          limit: '10'
        })
      );
      expect(result).toEqual(mockResponse.results);
    });

    it('supports custom limit', async () => {
      const mockResponse = { results: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await searchApi.findSimilar('123', { limit: 5 });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/notes/123/similar',
        expect.objectContaining({
          limit: '5'
        })
      );
    });

    it('supports threshold parameter', async () => {
      const mockResponse = { results: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await searchApi.findSimilar('123', { threshold: 0.7 });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/notes/123/similar',
        expect.objectContaining({
          threshold: '0.7'
        })
      );
    });

    it('throws error for invalid note ID', async () => {
      await expect(searchApi.findSimilar('')).rejects.toThrow(
        'Note ID is required'
      );
    });
  });

  describe('searchByTags', () => {
    it('searches notes by single tag', async () => {
      const mockResponse = {
        results: [
          {
            note_id: '123',
            score: 1.0,
            snippet: ''
          }
        ],
        total: 1
      };

      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      const result = await searchApi.searchByTags(['work']);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          q: '',
          mode: 'hybrid',
          tags: 'work'
        })
      );
      expect(result).toEqual(mockResponse.results);
    });

    it('searches notes by multiple tags', async () => {
      const mockResponse = { results: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await searchApi.searchByTags(['work', 'important', 'urgent']);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/search',
        expect.objectContaining({
          tags: 'work,important,urgent'
        })
      );
    });

    it('throws error for empty tags array', async () => {
      await expect(searchApi.searchByTags([])).rejects.toThrow(
        'At least one tag is required'
      );
    });
  });
});
