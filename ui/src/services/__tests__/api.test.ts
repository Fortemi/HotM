/**
 * Legacy API Service Tests
 * Tests the compatibility layer that wraps the new API client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Legacy API Service (Compatibility Layer)', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('returns health response on success', async () => {
      const mockHealthResponse = {
        ok: true,
        database: true,
        vector: true,
        ollama: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealthResponse),
      });

      const result = await api.checkHealth();

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual({
        ok: true,
        db: true,
        vector: true,
        ollama: true,
      });
    });

    it(
      'handles errors gracefully',
      async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await api.checkHealth();

        expect(result).toEqual({
          ok: false,
          ollama: false,
          db: false,
          vector: false,
        });
      },
      10000
    );
  });

  describe('createNote', () => {
    it('creates a note with content string', async () => {
      const mockResponse = {
        note_id: '123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.createNote('Test content');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notes'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            content: 'Test content',
            format: 'markdown',
            source: 'user',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('searchNotes', () => {
    it('performs search with query', async () => {
      const mockSearchResponse = {
        results: [
          {
            note_id: '1',
            score: 0.95,
            snippet: 'Test result',
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      });

      const result = await api.searchNotes('test query', 'hybrid');

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual([
        {
          note_id: '1',
          score: 0.95,
          snippet: 'Test result',
        },
      ]);
    });

    it('returns empty array for empty query', async () => {
      const result = await api.searchNotes('', 'hybrid');

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], total: 0 }),
      });

      const result = await api.searchNotes('test', 'hybrid');

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws error on HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(api.createNote('Test')).rejects.toThrow();
    }, 10000);

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failed'));

      await expect(api.createNote('Test')).rejects.toThrow();
    }, 10000);
  });

  describe('Type exports', () => {
    it('should export all required types', () => {
      // This test ensures types are available for import
      // If this compiles, the types are properly exported
      const _typeCheck: {
        noteFull: import('../api').NoteFull;
        searchHit: import('../api').SearchHit;
        job: import('../api').Job;
      } = {} as any;

      expect(_typeCheck).toBeDefined();
    });
  });
});
