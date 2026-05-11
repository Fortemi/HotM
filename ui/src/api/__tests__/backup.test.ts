import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBackupApi } from '../backup';
import type { ApiClient } from '../client';

describe('Backup API', () => {
  let mockClient: ApiClient;
  let backupApi: ReturnType<typeof createBackupApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue(undefined),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
      baseUrl: 'http://localhost:3000',
    } as unknown as ApiClient;

    backupApi = createBackupApi(mockClient);
  });

  describe('importBackup', () => {
    // jsdom's File constructor does not implement .text() (Node 20 polyfill missing).
    // Construct the File and patch .text() to return the JSON body the production
    // code reads on import.
    const makeFile = (body: object): File => {
      const json = JSON.stringify(body);
      const file = new File([json], 'backup.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: () => Promise.resolve(json) });
      return file;
    };

    it('rejects when no file is supplied', async () => {
      await expect(
        // @ts-expect-error — intentionally calling with null to assert guard
        backupApi.importBackup(null),
      ).rejects.toThrow('Backup file is required');
    });

    it('wraps a bare notes object in { backup } and posts to /backup/import', async () => {
      await backupApi.importBackup(makeFile({ notes: [] }));

      expect(mockClient.post).toHaveBeenCalledWith('/backup/import', {
        backup: { notes: [] },
      });
    });

    it('preserves an existing { backup } wrapper as-is', async () => {
      await backupApi.importBackup(makeFile({ backup: { notes: [{ id: '1' }] } }));

      expect(mockClient.post).toHaveBeenCalledWith('/backup/import', {
        backup: { notes: [{ id: '1' }] },
      });
    });

    it('omits defer_inference when no options supplied (preserves prior behavior)', async () => {
      await backupApi.importBackup(makeFile({ notes: [] }));

      const payload = vi.mocked(mockClient.post).mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('defer_inference');
    });

    it('omits defer_inference when explicitly false', async () => {
      await backupApi.importBackup(makeFile({ notes: [] }), { deferInference: false });

      const payload = vi.mocked(mockClient.post).mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('defer_inference');
    });

    it('sends defer_inference: true when deferInference option is set (Fortemi v2026.5.6 #677)', async () => {
      await backupApi.importBackup(makeFile({ notes: [] }), { deferInference: true });

      expect(mockClient.post).toHaveBeenCalledWith('/backup/import', {
        backup: { notes: [] },
        defer_inference: true,
      });
    });
  });
});
