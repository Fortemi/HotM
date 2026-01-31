/**
 * Tests for API compatibility layer
 * Ensures backward compatibility with legacy API client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../compat';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Compatibility Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
  });

  describe('Health Check', () => {
    it('should check health and return formatted response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          database: true,
          ollama: true,
          vector: true,
        }),
      });

      const health = await api.checkHealth();

      expect(health).toEqual({
        ok: true,
        db: true,
        ollama: true,
        vector: true,
      });
    });

    it(
      'should handle health check errors gracefully',
      async () => {
        // Mock all fetch attempts to fail (including retry attempts)
        (global.fetch as any).mockRejectedValue(new Error('Network error'));

        const health = await api.checkHealth();

        expect(health).toEqual({
          ok: false,
          ollama: false,
          db: false,
          vector: false,
        });
      },
      10000
    ); // Increase timeout for retry logic
  });

  describe('Note Operations', () => {
    it('should create a note', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          note_id: 'test-note-id',
        }),
      });

      const response = await api.createNote('Test content');

      expect(response).toEqual({
        note_id: 'test-note-id',
      });

      expect(global.fetch).toHaveBeenCalledWith(
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
    });

    it('should get a note by ID', async () => {
      const mockNote = {
        note: {
          id: 'test-id',
          format: 'markdown',
          source: 'user',
          created_at_utc: '2024-01-01T00:00:00Z',
          updated_at_utc: '2024-01-01T00:00:00Z',
        },
        original: {
          content: 'Test content',
          hash: 'hash123',
        },
        revised: {
          content: 'Revised content',
        },
        tags: ['test'],
        links: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNote,
      });

      const note = await api.getNote('test-id');

      expect(note).toEqual(mockNote);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notes/test-id'),
        expect.any(Object)
      );
    });
  });

  describe('Search Operations', () => {
    it('should search notes and convert to SearchHit format', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              note_id: 'note1',
              score: 0.95,
              snippet: 'Test snippet',
            },
          ],
          total: 1,
        }),
      });

      const hits = await api.searchNotes('test query', 'hybrid');

      expect(hits).toEqual([
        {
          note_id: 'note1',
          score: 0.95,
          snippet: 'Test snippet',
        },
      ]);
    });

    it('should return empty array for empty query', async () => {
      const hits = await api.searchNotes('', 'hybrid');

      expect(hits).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Tag Operations', () => {
    it('should update note tags', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tags: ['tag1', 'tag2', 'tag3'],
        }),
      });

      const result = await api.updateNoteTags('note-id', ['tag3'], ['tag0']);

      expect(result).toEqual({
        tags: ['tag1', 'tag2', 'tag3'],
      });
    });

    it('should create a tag', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'new-tag',
        }),
      });

      const result = await api.createTag('new-tag');

      expect(result).toEqual({
        name: 'new-tag',
      });
    });
  });

  describe('Type Compatibility', () => {
    it('should export all required types', () => {
      // This test ensures types are available for import
      // If this compiles, the types are properly exported
      const _typeCheck: {
        searchHit: import('../compat').SearchHit;
        noteFull: import('../compat').NoteFull;
        job: import('../compat').Job;
        userLabel: import('../compat').UserMetadataLabel;
      } = {} as any;

      expect(_typeCheck).toBeDefined();
    });
  });
});
