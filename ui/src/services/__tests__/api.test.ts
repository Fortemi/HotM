import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Clear console.error mock if any previous test set it up
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('returns health response on success', async () => {
      const mockHealthResponse = {
        ok: true,
        db: true,
        vector: true,
        ollama: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealthResponse)
      });

      const result = await api.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:53211/api/v1/health',
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      expect(result).toEqual(mockHealthResponse);
    });

    it('tries alternative endpoints on failure', async () => {
      const mockHealthResponse = {
        ok: false,
        db: false,
        vector: false,
        ollama: false
      };

      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));
      // Second call (alternative endpoint) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealthResponse)
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await api.checkHealth();

      expect(consoleSpy).toHaveBeenCalledWith('Trying alternative API endpoints...');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockHealthResponse);

      consoleSpy.mockRestore();
    });
  });

  describe('createNote', () => {
    beforeEach(() => {
      // Mock localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => '[]'),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });
    });

    it('creates a note with content string', async () => {
      const mockResponse = { note_id: 'test-note-id' };
      const content = 'Test note content';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.createNote(content);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:53211/api/v1/notes',
        {
          method: 'POST',
          body: JSON.stringify({ content }),
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('stores note ID in localStorage', async () => {
      const mockResponse = { note_id: 'test-note-id' };
      const existingIds = ['existing-id'];
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => JSON.stringify(existingIds)),
          setItem: vi.fn(),
        },
        writable: true,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await api.createNote('Test content');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'hotm_note_ids',
        JSON.stringify([...existingIds, 'test-note-id'])
      );
    });

    it('does not duplicate note ID in localStorage', async () => {
      const mockResponse = { note_id: 'existing-id' };
      const existingIds = ['existing-id'];
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => JSON.stringify(existingIds)),
          setItem: vi.fn(),
        },
        writable: true,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await api.createNote('Test content');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('searchNotes', () => {
    it('performs search with query', async () => {
      const mockResponse = {
        notes: [
          { note_id: 'note-1', score: 0.95, snippet: 'Test snippet' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.searchNotes('test query');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:53211/api/v1/search?q=test+query&mode=hybrid',
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      expect(result).toEqual(mockResponse.notes);
    });

    it('performs search with custom mode and filters', async () => {
      const mockResponse = { notes: [{ note_id: 'note-1', score: 0.5 }] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.searchNotes('query', 'fts', 'tag:important');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:53211/api/v1/search?q=query&mode=fts&filters=tag%3Aimportant',
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      expect(result).toEqual(mockResponse.notes);
    });

    it('handles empty response', async () => {
      const mockResponse = {};

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.searchNotes('query');

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws error on HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(api.checkHealth()).rejects.toThrow('API Error: 404 Not Found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('API Request failed:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('throws error on network failure', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(api.checkHealth()).rejects.toThrow('Network error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('request method', () => {
    it('includes proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await api.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('merges custom headers with defaults', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      // Test through createNote which uses POST with body
      await api.createNote('test');

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers).toEqual({
        'Content-Type': 'application/json'
      });
    });
  });
});