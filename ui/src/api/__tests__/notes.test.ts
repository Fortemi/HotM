import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotesApi } from '../notes';
import type { ApiClient } from '../client';

describe('Notes API', () => {
  let mockClient: ApiClient;
  let notesApi: ReturnType<typeof createNotesApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn()
    } as unknown as ApiClient;

    notesApi = createNotesApi(mockClient);
  });

  describe('list', () => {
    it('fetches list of notes with default params', async () => {
      const mockResponse = {
        notes: [
          {
            id: '1',
            title: 'Note 1',
            snippet: 'Content...',
            created_at_utc: '2026-01-30T12:00:00Z',
            updated_at_utc: '2026-01-30T12:00:00Z',
            starred: false,
            archived: false,
            tags: [],
            has_revision: false,
            metadata: {}
          }
        ],
        total: 1
      };

      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      const result = await notesApi.list();

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/notes',
        expect.objectContaining({
          sort_by: 'created_at',
          sort_order: 'desc',
          limit: '50'
        })
      );
      expect(result).toEqual(mockResponse.notes);
    });

    it('supports custom pagination and sorting', async () => {
      const mockResponse = { notes: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await notesApi.list({
        sortBy: 'updated_at',
        sortOrder: 'asc',
        limit: 100,
        offset: 20
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/notes',
        expect.objectContaining({
          sort_by: 'updated_at',
          sort_order: 'asc',
          limit: '100',
          offset: '20'
        })
      );
    });

    it('supports filtering by tags and status', async () => {
      const mockResponse = { notes: [], total: 0 };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

      await notesApi.list({
        tags: ['work', 'important'],
        starred: true,
        archived: false
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/notes',
        expect.objectContaining({
          tags: 'work,important',
          starred: 'true',
          archived: 'false'
        })
      );
    });
  });

  describe('get', () => {
    it('fetches a single note by ID', async () => {
      const mockNote = {
        note: {
          id: '123',
          collection_id: null,
          format: 'markdown',
          source: 'user',
          created_at_utc: '2026-01-30T12:00:00Z',
          updated_at_utc: '2026-01-30T12:00:00Z',
          starred: false,
          archived: false,
          last_accessed_at: null,
          title: 'Test Note'
        },
        original: {
          content: 'Original content',
          hash: 'abc123'
        },
        revised: {
          content: 'Revised content',
          last_revision_id: 'rev1',
          ai_metadata: {},
          model: 'gpt-oss:20b'
        },
        tags: ['test'],
        links: []
      };

      vi.mocked(mockClient.get).mockResolvedValueOnce(mockNote);

      const result = await notesApi.get('123');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/notes/123');
      expect(result).toEqual(mockNote);
    });

    it('throws error for invalid note ID', async () => {
      await expect(notesApi.get('')).rejects.toThrow('Note ID is required');
    });
  });

  describe('create', () => {
    it('creates a new note with content', async () => {
      const mockResponse = { note_id: 'new-123' };
      vi.mocked(mockClient.post).mockResolvedValueOnce(mockResponse);

      const result = await notesApi.create({
        content: 'Test content',
        format: 'markdown',
        source: 'user'
      });

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/notes', {
        content: 'Test content',
        format: 'markdown',
        source: 'user'
      });
      expect(result).toEqual(mockResponse);
    });

    it('uses default format and source when not provided', async () => {
      const mockResponse = { note_id: 'new-123' };
      vi.mocked(mockClient.post).mockResolvedValueOnce(mockResponse);

      await notesApi.create({ content: 'Test' });

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/notes', {
        content: 'Test',
        format: 'markdown',
        source: 'manual'
      });
    });

    it('throws error for empty content', async () => {
      await expect(notesApi.create({ content: '' })).rejects.toThrow(
        'Content is required'
      );
    });
  });

  describe('update', () => {
    it('updates note metadata', async () => {
      const mockResponse = {
        id: '123',
        starred: true,
        archived: false
      };
      vi.mocked(mockClient.patch).mockResolvedValueOnce(mockResponse);

      const result = await notesApi.update('123', {
        starred: true,
        archived: false
      });

      expect(mockClient.patch).toHaveBeenCalledWith('/api/v1/notes/123', {
        starred: true,
        archived: false
      });
      expect(result).toEqual(mockResponse);
    });

    it('creates a revision when content is updated', async () => {
      const mockResponse = { revision_id: 'rev-123' };
      vi.mocked(mockClient.patch).mockResolvedValueOnce(mockResponse);

      await notesApi.update('123', {
        content: 'Updated content'
      });

      expect(mockClient.patch).toHaveBeenCalledWith('/api/v1/notes/123', {
        content: 'Updated content'
      });
    });

    it('throws error for invalid note ID', async () => {
      await expect(notesApi.update('', {})).rejects.toThrow(
        'Note ID is required'
      );
    });
  });

  describe('delete', () => {
    it('soft deletes a note', async () => {
      vi.mocked(mockClient.delete).mockResolvedValueOnce(null);

      await notesApi.delete('123');

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/notes/123');
    });

    it('throws error for invalid note ID', async () => {
      await expect(notesApi.delete('')).rejects.toThrow('Note ID is required');
    });
  });

  describe('getTags', () => {
    it('fetches tags for a note', async () => {
      const mockTags = { tags: ['work', 'important'] };
      vi.mocked(mockClient.get).mockResolvedValueOnce(mockTags);

      const result = await notesApi.getTags('123');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/notes/123/tags');
      expect(result).toEqual(['work', 'important']);
    });
  });

  describe('updateTags', () => {
    it('adds and removes tags', async () => {
      const mockResponse = { tags: ['work', 'new'] };
      vi.mocked(mockClient.patch).mockResolvedValueOnce(mockResponse);

      const result = await notesApi.updateTags('123', {
        add: ['new'],
        remove: ['old']
      });

      expect(mockClient.patch).toHaveBeenCalledWith('/api/v1/notes/123/tags', {
        add: ['new'],
        remove: ['old']
      });
      expect(result).toEqual(['work', 'new']);
    });

    it('adds tags only', async () => {
      const mockResponse = { tags: ['existing', 'new'] };
      vi.mocked(mockClient.patch).mockResolvedValueOnce(mockResponse);

      await notesApi.updateTags('123', { add: ['new'] });

      expect(mockClient.patch).toHaveBeenCalledWith('/api/v1/notes/123/tags', {
        add: ['new']
      });
    });

    it('removes tags only', async () => {
      const mockResponse = { tags: ['remaining'] };
      vi.mocked(mockClient.patch).mockResolvedValueOnce(mockResponse);

      await notesApi.updateTags('123', { remove: ['old'] });

      expect(mockClient.patch).toHaveBeenCalledWith('/api/v1/notes/123/tags', {
        remove: ['old']
      });
    });

    it('throws error when neither add nor remove is provided', async () => {
      await expect(notesApi.updateTags('123', {})).rejects.toThrow(
        'Must provide tags to add or remove'
      );
    });
  });
});
