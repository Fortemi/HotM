import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAttachmentsApi } from '../attachments';
import type { ApiClient } from '../client';

// Mock getTauriFetch to return global.fetch
vi.mock('@/lib/tauri', () => ({
  getTauriFetch: () => global.fetch,
}));

// Mock memory-context
vi.mock('../memory-context', () => ({
  getActiveMemory: () => null,
  getMemoryRoutingHeaderName: () => 'X-Memory-Route',
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Attachments API', () => {
  let mockClient: ApiClient;
  let attachmentsApi: ReturnType<typeof createAttachmentsApi>;

  beforeEach(() => {
    mockFetch.mockClear();
    mockClient = {
      baseUrl: 'http://localhost:3000',
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as unknown as ApiClient;

    attachmentsApi = createAttachmentsApi(mockClient);
  });

  describe('uploadAttachment', () => {
    const mockResponse = {
      id: 'att-1',
      note_id: 'note-123',
      filename: 'video.mp4',
      content_type: 'video/mp4',
      size_bytes: 1024000,
      status: 'uploaded',
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
    });

    it('uploads file without media_optimize by default', async () => {
      const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });

      await attachmentsApi.uploadAttachment('note-123', file);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/notes/note-123/attachments/upload',
        expect.objectContaining({ method: 'POST' }),
      );

      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1].body as FormData;
      expect(formData.get('file')).toBe(file);
      expect(formData.get('media_optimize')).toBeNull();
    });

    it('appends media_optimize=true when option is set', async () => {
      const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });

      await attachmentsApi.uploadAttachment('note-123', file, { mediaOptimize: true });

      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1].body as FormData;
      expect(formData.get('file')).toBe(file);
      expect(formData.get('media_optimize')).toBe('true');
    });

    it('does not append media_optimize when option is false', async () => {
      const file = new File(['data'], 'audio.mp3', { type: 'audio/mpeg' });

      await attachmentsApi.uploadAttachment('note-123', file, { mediaOptimize: false });

      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1].body as FormData;
      expect(formData.get('media_optimize')).toBeNull();
    });

    it('does not append media_optimize when options is undefined', async () => {
      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });

      await attachmentsApi.uploadAttachment('note-123', file);

      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1].body as FormData;
      expect(formData.get('media_optimize')).toBeNull();
    });

    it('throws when noteId is empty', async () => {
      const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
      await expect(attachmentsApi.uploadAttachment('', file)).rejects.toThrow('Note ID is required');
    });

    it('throws when file is missing', async () => {
      await expect(
        attachmentsApi.uploadAttachment('note-123', null as unknown as File),
      ).rejects.toThrow('File is required');
    });

    describe('error extraction', () => {
      it('extracts Fortemi nested error format { error: { message } }', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 415,
          json: () => Promise.resolve({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'video/x-matroska is not supported' } }),
        });

        const file = new File(['data'], 'video.mkv', { type: 'video/x-matroska' });
        await expect(attachmentsApi.uploadAttachment('note-123', file))
          .rejects.toThrow('video/x-matroska is not supported');
      });

      it('extracts flat { message } format', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 413,
          json: () => Promise.resolve({ message: 'File exceeds 100MB limit' }),
        });

        const file = new File(['data'], 'big.mkv', { type: 'video/x-matroska' });
        await expect(attachmentsApi.uploadAttachment('note-123', file))
          .rejects.toThrow('File exceeds 100MB limit');
      });

      it('extracts { error: "string" } format', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'Invalid file' }),
        });

        const file = new File(['data'], 'test.bin', { type: 'application/octet-stream' });
        await expect(attachmentsApi.uploadAttachment('note-123', file))
          .rejects.toThrow('Invalid file');
      });

      it('falls back to response.text() when JSON parse fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: () => Promise.reject(new Error('not json')),
          text: () => Promise.resolve('Bad Gateway'),
        });

        const file = new File(['data'], 'video.mkv', { type: 'video/x-matroska' });
        await expect(attachmentsApi.uploadAttachment('note-123', file))
          .rejects.toThrow('Bad Gateway');
      });

      it('falls back to HTTP status when all parsing fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 413,
          json: () => Promise.reject(new Error('not json')),
          text: () => Promise.reject(new Error('not text')),
        });

        const file = new File(['data'], 'video.mkv', { type: 'video/x-matroska' });
        await expect(attachmentsApi.uploadAttachment('note-123', file))
          .rejects.toThrow('HTTP 413');
      });

      it('never shows empty statusText from HTTP/2', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: '',
          json: () => Promise.resolve({ error: { message: 'Internal error' } }),
        });

        const file = new File(['data'], 'video.mkv', { type: 'video/x-matroska' });
        await expect(attachmentsApi.uploadAttachment('note-123', file))
          .rejects.toThrow('Upload failed: Internal error');
      });
    });
  });
});
