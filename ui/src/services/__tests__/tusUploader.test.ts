import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock tus-js-client
// ---------------------------------------------------------------------------

const mockStart = vi.fn();
const mockAbort = vi.fn();

let capturedOptions: Record<string, unknown> = {};

vi.mock('tus-js-client', () => ({
  Upload: vi.fn().mockImplementation((_file: File, options: Record<string, unknown>) => {
    capturedOptions = options;
    return {
      start: mockStart,
      abort: mockAbort,
      url: 'https://api.example.com/tus/upload-123',
    };
  }),
}));

// Mock API singleton
vi.mock('@/api', () => ({
  api: {
    client: { baseUrl: 'https://api.example.com' },
    attachments: { uploadAttachment: vi.fn() },
  },
}));

// Mock memory context
vi.mock('@/api/memory-context', () => ({
  getActiveMemory: vi.fn(() => null),
  getMemoryRoutingHeaderName: vi.fn(() => 'X-Fortemi-Memory'),
}));

// Mock Tauri fetch
const mockFetchFn = vi.fn();
vi.mock('@/lib/tauri', () => ({
  getTauriFetch: () => mockFetchFn,
}));

import { shouldUseTus, startTusUpload, TUS_THRESHOLD_BYTES, TUS_CHUNK_SIZE } from '../tusUploader';
import * as tus from 'tus-js-client';
import { getActiveMemory } from '@/api/memory-context';

describe('tusUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOptions = {};
  });

  function makeFile(name: string, size: number, type = 'application/octet-stream'): File {
    // Use a minimal blob — actual size doesn't matter for unit tests,
    // but File.size should reflect the intended value.
    const blob = new Blob(['x'], { type });
    const file = new File([blob], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  }

  // ---- shouldUseTus ----

  describe('shouldUseTus', () => {
    it('returns false for files below threshold', () => {
      const small = makeFile('doc.pdf', TUS_THRESHOLD_BYTES - 1);
      expect(shouldUseTus(small)).toBe(false);
    });

    it('returns true for files at threshold', () => {
      const exact = makeFile('big.zip', TUS_THRESHOLD_BYTES);
      expect(shouldUseTus(exact)).toBe(true);
    });

    it('returns true for files above threshold', () => {
      const big = makeFile('huge.mp4', TUS_THRESHOLD_BYTES + 1);
      expect(shouldUseTus(big)).toBe(true);
    });
  });

  // ---- startTusUpload ----

  describe('startTusUpload', () => {
    it('creates Upload with correct endpoint, metadata, headers, and chunkSize', () => {
      const file = makeFile('video.mp4', 100 * 1024 * 1024, 'video/mp4');

      startTusUpload({
        noteId: 'note-42',
        file,
        mediaOptimize: true,
      });

      expect(tus.Upload).toHaveBeenCalledTimes(1);
      const [passedFile, options] = vi.mocked(tus.Upload).mock.calls[0];
      expect(passedFile).toBe(file);
      expect(options.endpoint).toBe('https://api.example.com/api/v1/notes/note-42/attachments/tus');
      expect(options.chunkSize).toBe(TUS_CHUNK_SIZE);
      expect(options.metadata).toEqual({
        filename: 'video.mp4',
        filetype: 'video/mp4',
        media_optimize: 'true',
      });
    });

    it('omits media_optimize metadata when false', () => {
      const file = makeFile('doc.pdf', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      const [, options] = vi.mocked(tus.Upload).mock.calls[0];
      expect(options.metadata).toEqual({
        filename: 'doc.pdf',
        filetype: 'application/octet-stream',
      });
      expect(options.metadata).not.toHaveProperty('media_optimize');
    });

    it('includes memory routing header when active', () => {
      vi.mocked(getActiveMemory).mockReturnValueOnce('research');
      const file = makeFile('f.bin', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      const [, options] = vi.mocked(tus.Upload).mock.calls[0];
      expect(options.headers).toEqual({ 'X-Fortemi-Memory': 'research' });
    });

    it('calls start() on the tus Upload', () => {
      const file = makeFile('f.bin', 60 * 1024 * 1024);
      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });
      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it('delegates progress callback correctly', () => {
      const onProgress = vi.fn();
      const file = makeFile('f.bin', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false, onProgress });

      // Simulate tus progress callback
      const tusOnProgress = capturedOptions.onProgress as (a: number, b: number) => void;
      tusOnProgress(1024, 60 * 1024 * 1024);

      expect(onProgress).toHaveBeenCalledWith(1024, 60 * 1024 * 1024);
    });

    it('abort() calls underlying upload.abort()', () => {
      const file = makeFile('f.bin', 60 * 1024 * 1024);
      const handle = startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      handle.abort();

      expect(mockAbort).toHaveBeenCalledTimes(1);
    });

    it('promise resolves with Attachment from finalize GET on success', async () => {
      const attachment = { id: 'att-99', filename: 'video.mp4' };
      mockFetchFn.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(attachment),
      });

      const file = makeFile('video.mp4', 60 * 1024 * 1024);
      const handle = startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      // Simulate tus onSuccess callback
      const tusOnSuccess = capturedOptions.onSuccess as () => Promise<void>;
      await tusOnSuccess();

      await expect(handle.promise).resolves.toEqual(attachment);

      // Verify finalize GET was called to the upload URL
      expect(mockFetchFn).toHaveBeenCalledWith(
        'https://api.example.com/tus/upload-123',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('promise rejects on tus error', async () => {
      const file = makeFile('f.bin', 60 * 1024 * 1024);
      const handle = startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      // Simulate tus onError callback
      const tusOnError = capturedOptions.onError as (err: Error) => void;
      tusOnError(new Error('Connection reset'));

      await expect(handle.promise).rejects.toThrow('Connection reset');
    });

    it('promise rejects when finalize GET returns non-ok response', async () => {
      mockFetchFn.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const file = makeFile('f.bin', 60 * 1024 * 1024);
      const handle = startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      const tusOnSuccess = capturedOptions.onSuccess as () => Promise<void>;
      await tusOnSuccess();

      await expect(handle.promise).rejects.toThrow('Finalize failed: HTTP 500');
    });
  });
});
