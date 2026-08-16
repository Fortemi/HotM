import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAttachmentsApi } from '../attachments';
import type { ApiClient } from '../client';

const tauriState = vi.hoisted(() => ({ enabled: false, invoke: vi.fn() }));

// Mock getTauriFetch to return global.fetch
vi.mock('@/lib/tauri', () => ({
  getTauriFetch: () => global.fetch,
  invokeTauri: tauriState.invoke,
  isTauri: () => tauriState.enabled,
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
    tauriState.enabled = false;
    tauriState.invoke.mockReset();
    mockClient = {
      baseUrl: 'http://localhost:3000/api/v1',
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as unknown as ApiClient;

    attachmentsApi = createAttachmentsApi(mockClient);
  });

  describe('sensitive transfer boundaries', () => {
    it('keeps the uncontracted multipart upload disabled', async () => {
      const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
      await expect(attachmentsApi.uploadAttachment('note-123', file))
        .rejects.toThrow('Multipart attachment upload is disabled');
      expect(mockFetch).not.toHaveBeenCalled();
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

    it('redacts producer bodies and credential context from download errors', async () => {
      const json = vi.fn(() => Promise.resolve({
        detail: 'token=secret tenant=private path=/home/operator/private upload=https://host/upload/abc',
      }));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json });

      await expect(attachmentsApi.downloadAttachment('att-1'))
        .rejects.toThrow('Download authorization expired or was denied.');
      expect(json).not.toHaveBeenCalled();
    });

    it('maps range and size errors without exposing response content', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 416 });
      await expect(attachmentsApi.downloadAttachment('att-1'))
        .rejects.toThrow('requested download range is unavailable');
    });

    it('does not expose desktop paths from native failures', async () => {
      tauriState.enabled = true;
      tauriState.invoke.mockRejectedValueOnce(new Error('/home/operator/private/file.bin token=secret'));
      await expect(attachmentsApi.downloadAttachmentToLocalFile('att-1', 'file.bin'))
        .rejects.toThrow('Desktop download failed.');
    });
  });
});
