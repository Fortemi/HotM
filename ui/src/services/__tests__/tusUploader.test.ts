import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock tus-js-client
// ---------------------------------------------------------------------------

const mockStart = vi.fn();
const mockAbort = vi.fn();

let capturedOptions: Record<string, unknown> = {};

vi.mock('tus-js-client', () => ({
  // vitest 4: arrow-based mockImplementation is not constructable with `new`.
  // Use vi.fn(function(){}) so `this` binds to the new instance.
  Upload: vi.fn(function (this: Record<string, unknown>, _file: File, options: Record<string, unknown>) {
    capturedOptions = options;
    this.start = mockStart;
    this.abort = mockAbort;
    this.url = 'https://api.example.com/tus/upload-123';
  }),
}));

// Mock API singleton
vi.mock('@/api', () => ({
  api: {
    client: { baseUrl: 'https://api.example.com/api/v1' },
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
    it('routes small remote files through TUS', () => {
      const small = makeFile('doc.pdf', 1);
      expect(shouldUseTus(small)).toBe(true);
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
    it('creates Upload with correct endpoint, creation query, metadata, headers, and chunkSize', () => {
      const file = makeFile('video.mp4', 100 * 1024 * 1024, 'video/mp4');

      startTusUpload({
        noteId: 'note-42',
        file,
        mediaOptimize: true,
      });

      expect(tus.Upload).toHaveBeenCalledTimes(1);
      const [passedFile, options] = vi.mocked(tus.Upload).mock.calls[0];
      expect(passedFile).toBe(file);
      expect(options.endpoint).toBe('https://api.example.com/api/v1/notes/note-42/attachments/tus?media_optimize=true');
      expect(options.chunkSize).toBe(TUS_CHUNK_SIZE);
      expect(options.metadata).toEqual({
        filename: 'video.mp4',
        filetype: 'video/mp4',
      });
      expect(options.metadata).not.toHaveProperty('media_optimize');
      const stack = options.httpStack as { getName: () => string };
      expect(stack).toBeDefined();
      expect(stack.getName()).toBe('FetchHttpStack');
    });

    it('omits media_optimize metadata when false', () => {
      const file = makeFile('doc.pdf', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      const [, options] = vi.mocked(tus.Upload).mock.calls[0];
      expect(options.endpoint).toBe('https://api.example.com/api/v1/notes/note-1/attachments/tus');
      expect(options.metadata).toEqual({
        filename: 'doc.pdf',
        filetype: 'application/octet-stream',
      });
      expect(options.metadata).not.toHaveProperty('media_optimize');
    });

    it('encodes note ids in the tus creation endpoint', () => {
      const file = makeFile('doc.pdf', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note with spaces', file, mediaOptimize: false });

      const [, options] = vi.mocked(tus.Upload).mock.calls[0];
      expect(options.endpoint).toBe('https://api.example.com/api/v1/notes/note%20with%20spaces/attachments/tus');
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

    it('sends tus chunks through the Tauri fetch adapter stack', async () => {
      mockFetchFn.mockResolvedValueOnce({
        status: 204,
        headers: new Headers({ 'Upload-Offset': '3' }),
        text: () => Promise.resolve(''),
      });
      const file = makeFile('f.bin', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      const [, options] = vi.mocked(tus.Upload).mock.calls[0];
      const stack = options.httpStack as { createRequest: (method: string, url: string) => {
        setHeader: (header: string, value: string) => void;
        setProgressHandler: (handler: (bytesSent: number) => void) => void;
        send: (body: BodyInit) => Promise<{ getStatus: () => number; getHeader: (header: string) => string | undefined }>;
      } };
      const progress = vi.fn();
      const body = new Blob(['abc']);
      const request = stack.createRequest('PATCH', 'https://api.example.com/tus/upload-123');
      request.setHeader('Tus-Resumable', '1.0.0');
      request.setHeader('Content-Type', 'application/offset+octet-stream');
      request.setHeader('Upload-Offset', '0');
      request.setProgressHandler(progress);

      const response = await request.send(body);

      expect(mockFetchFn).toHaveBeenCalledWith(
        'https://api.example.com/tus/upload-123',
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'Tus-Resumable': '1.0.0',
            'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': '0',
          },
          body,
        }),
      );
      expect(response.getStatus()).toBe(204);
      expect(response.getHeader('Upload-Offset')).toBe('3');
      expect(progress).toHaveBeenCalledWith(3);
    });

    it('supports tus OPTIONS capability discovery through the fetch adapter stack', async () => {
      mockFetchFn.mockResolvedValueOnce({
        status: 204,
        headers: new Headers({
          'Tus-Resumable': '1.0.0',
          'Tus-Version': '1.0.0',
          'Tus-Extension': 'creation,termination,expiration',
          'Tus-Max-Size': '104857600',
        }),
        text: () => Promise.resolve(''),
      });
      const file = makeFile('f.bin', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      const [, options] = vi.mocked(tus.Upload).mock.calls[0];
      const stack = options.httpStack as { createRequest: (method: string, url: string) => {
        setHeader: (header: string, value: string) => void;
        send: (body?: BodyInit | null) => Promise<{ getStatus: () => number; getHeader: (header: string) => string | undefined }>;
      } };
      const request = stack.createRequest('OPTIONS', 'https://api.example.com/api/v1/notes/note-1/attachments/tus');
      request.setHeader('Tus-Resumable', '1.0.0');

      const response = await request.send(null);

      expect(mockFetchFn).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/notes/note-1/attachments/tus',
        expect.objectContaining({
          method: 'OPTIONS',
          headers: { 'Tus-Resumable': '1.0.0' },
        }),
      );
      expect(response.getStatus()).toBe(204);
      expect(response.getHeader('Tus-Extension')).toContain('termination');
      expect(response.getHeader('Tus-Max-Size')).toBe('104857600');
    });

    it('supports tus HEAD resume state through the fetch adapter stack', async () => {
      mockFetchFn.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({
          'Upload-Offset': '1048576',
          'Upload-Length': '2097152',
          'Upload-Expires': 'Wed, 15 Jul 2026 00:00:00 GMT',
          'Cache-Control': 'no-store',
        }),
        text: () => Promise.resolve(''),
      });
      const file = makeFile('f.bin', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      const [, options] = vi.mocked(tus.Upload).mock.calls[0];
      const stack = options.httpStack as unknown as { createRequest: (method: string, url: string) => {
        setHeader: (header: string, value: string) => void;
        send: (body?: BodyInit | null) => Promise<{ getStatus: () => number; getHeader: (header: string) => string | undefined }>;
      } };
      const request = stack.createRequest('HEAD', 'https://api.example.com/tus/upload-123');
      request.setHeader('Tus-Resumable', '1.0.0');

      const response = await request.send();

      expect(mockFetchFn).toHaveBeenCalledWith(
        'https://api.example.com/tus/upload-123',
        expect.objectContaining({
          method: 'HEAD',
          headers: { 'Tus-Resumable': '1.0.0' },
        }),
      );
      expect(response.getStatus()).toBe(200);
      expect(response.getHeader('Upload-Offset')).toBe('1048576');
      expect(response.getHeader('Upload-Length')).toBe('2097152');
      expect(response.getHeader('Cache-Control')).toBe('no-store');
    });

    it('supports tus DELETE termination through the fetch adapter stack', async () => {
      mockFetchFn.mockResolvedValueOnce({
        status: 204,
        headers: new Headers({ 'Tus-Resumable': '1.0.0' }),
        text: () => Promise.resolve(''),
      });
      const file = makeFile('f.bin', 60 * 1024 * 1024);

      startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      const [, options] = vi.mocked(tus.Upload).mock.calls[0];
      const stack = options.httpStack as unknown as { createRequest: (method: string, url: string) => {
        setHeader: (header: string, value: string) => void;
        send: (body?: BodyInit | null) => Promise<{ getStatus: () => number; getHeader: (header: string) => string | undefined }>;
      } };
      const request = stack.createRequest('DELETE', 'https://api.example.com/tus/upload-123');
      request.setHeader('Tus-Resumable', '1.0.0');

      const response = await request.send();

      expect(mockFetchFn).toHaveBeenCalledWith(
        'https://api.example.com/tus/upload-123',
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Tus-Resumable': '1.0.0' },
        }),
      );
      expect(response.getStatus()).toBe(204);
      expect(response.getHeader('Tus-Resumable')).toBe('1.0.0');
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

    it('abort() asks tus-js-client to terminate the server upload', () => {
      const file = makeFile('f.bin', 60 * 1024 * 1024);
      const handle = startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      handle.abort();

      expect(mockAbort).toHaveBeenCalledWith(true);
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

    it('redacts upload URLs and credentials from tus errors', async () => {
      const file = makeFile('f.bin', 60 * 1024 * 1024);
      const handle = startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });

      // Simulate tus onError callback
      const tusOnError = capturedOptions.onError as (err: Error) => void;
      tusOnError(new Error('Connection reset at https://api.example.com/tus/upload-123?token=secret path=/home/private'));

      await expect(handle.promise).rejects.toThrow('TUS upload failed.');
    });

    it('classifies authorization expiry without exposing the bearer artifact', async () => {
      const file = makeFile('f.bin', 60 * 1024 * 1024);
      const handle = startTusUpload({ noteId: 'note-1', file, mediaOptimize: false });
      const tusOnError = capturedOptions.onError as (err: Error) => void;
      tusOnError(new Error('HTTP 401 Authorization: Bearer secret-value'));
      await expect(handle.promise).rejects.toThrow('TUS upload authorization expired or was denied.');
    });

    it('rejects malformed metadata before starting a transport', () => {
      const file = makeFile('bad\nname.bin', 1024);
      expect(() => startTusUpload({ noteId: 'note-1', file, mediaOptimize: false }))
        .toThrow('invalid upload metadata');
      expect(mockStart).not.toHaveBeenCalled();
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
