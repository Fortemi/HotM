import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBackupApi } from '../backup';
import type { ApiClient } from '../client';
import { createKnowledgeShardFile } from './knowledgeShardFixtures';

vi.mock('@/lib/tauri', () => ({
  getTauriFetch: () => global.fetch,
}));

const memoryState = vi.hoisted(() => ({
  activeMemory: null as string | null,
}));

vi.mock('../memory-context', () => ({
  getActiveMemory: () => memoryState.activeMemory,
  getMemoryRoutingHeaderName: () => 'X-Fortemi-Memory',
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const expectBlobSize = async (value: Promise<Blob>, expectedText: string): Promise<void> => {
  const blob = await value;
  expect(blob).toEqual(expect.objectContaining({
    size: new TextEncoder().encode(expectedText).byteLength,
  }));
};

describe('Backup API', () => {
  let mockClient: ApiClient;
  let backupApi: ReturnType<typeof createBackupApi>;

  const makeBinaryFile = (body: string, name: string, type = 'application/octet-stream'): File => {
    const file = new File([body], name, { type });
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new TextEncoder().encode(body).buffer),
    });
    return file;
  };

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
    mockFetch.mockReset();
    memoryState.activeMemory = null;
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

  it('covers legacy export, download, trigger, and status routes', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ notes: [] });
    await expect(backupApi.exportBackup()).resolves.toEqual({ notes: [] });
    expect(mockClient.get).toHaveBeenCalledWith('/backup/export');

    mockFetch.mockResolvedValueOnce(new Response('backup-json'));
    await expectBlobSize(backupApi.downloadBackup(), 'backup-json');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/backup/download',
      { headers: {} },
    );

    await backupApi.triggerBackup();
    expect(mockClient.post).toHaveBeenCalledWith('/backup/trigger');

    vi.mocked(mockClient.get).mockResolvedValueOnce({ status: 'idle' });
    await expect(backupApi.getBackupStatus()).resolves.toEqual({ status: 'idle' });
    expect(mockClient.get).toHaveBeenCalledWith('/backup/status');
  });

  it('covers knowledge shard download, base64 import, and multipart upload routes', async () => {
    memoryState.activeMemory = 'research';
    const shard = createKnowledgeShardFile();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(shard),
    } as unknown as Response);

    const exported = await backupApi.exportKnowledgeShard({ include: ['notes', 'tags'] });
    expect(exported.blob.size).toBeGreaterThan(0);
    expect(exported.manifest).toMatchObject({ profile: 'core-v1', version: '1.2.0' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/backup/knowledge-shard?include=notes%2Ctags',
      { headers: { 'X-Fortemi-Memory': 'research' } },
    );

    await expect(backupApi.importKnowledgeShard(shard)).resolves.toMatchObject({
      manifest: { profile: 'core-v1', version: '1.2.0' },
    });
    expect(mockClient.post).toHaveBeenCalledWith('/backup/knowledge-shard/import', {
      shard_base64: expect.any(String),
    });

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success' }), {
      headers: { 'Content-Type': 'application/json' },
    }));
    await expect(
      backupApi.uploadKnowledgeShard(shard, {
        include: ['notes', 'tags'],
        dryRun: true,
        onConflict: 'replace',
        skipEmbeddingRegen: true,
      }),
    ).resolves.toEqual({
      manifest: expect.objectContaining({ profile: 'core-v1', version: '1.2.0' }),
      response: { status: 'success' },
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/backup/knowledge-shard/upload?include=notes%2Ctags&dry_run=true&on_conflict=replace&skip_embedding_regen=true',
      expect.objectContaining({ method: 'POST', headers: { 'X-Fortemi-Memory': 'research' } }),
    );
    const formData = mockFetch.mock.calls[1][1].body as FormData;
    expect(formData.get('file')).toBe(shard);
  });

  it('blocks unsupported shard manifests before any import request', async () => {
    const unsupported = createKnowledgeShardFile({
      ...await backupApi.inspectKnowledgeShard(createKnowledgeShardFile()),
      profile: 'full-v1',
    });

    await expect(backupApi.uploadKnowledgeShard(unsupported))
      .rejects.toThrow('profile full-v1 is not supported');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('surfaces server validation failures without claiming import success', async () => {
    const shard = createKnowledgeShardFile();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'partial',
      errors: ['Knowledge shard component count validation failed.'],
    }), {
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(backupApi.uploadKnowledgeShard(shard))
      .rejects.toThrow('Knowledge shard component count validation failed.');
  });

  it('uses Fortemi problem details for actionable upload errors', async () => {
    const shard = createKnowledgeShardFile();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      title: 'Invalid Knowledge Shard',
      detail: 'Knowledge shard checksum validation failed.',
    }), {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'Content-Type': 'application/problem+json' },
    }));

    await expect(backupApi.uploadKnowledgeShard(shard))
      .rejects.toThrow('Knowledge shard checksum validation failed.');
  });

  it('covers database backup download, snapshot, upload, and restore request shapes', async () => {
    memoryState.activeMemory = 'project-a';
    mockFetch.mockResolvedValueOnce(new Response('pgdump'));

    await expectBlobSize(backupApi.downloadDatabaseBackup(), 'pgdump');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/backup/database',
      { headers: { 'X-Fortemi-Memory': 'project-a' } },
    );

    await backupApi.createSnapshot({
      name: 'release-candidate',
      title: 'Release candidate',
      description: 'Before migration',
    });
    expect(mockClient.post).toHaveBeenCalledWith('/backup/database/snapshot', {
      name: 'release-candidate',
      title: 'Release candidate',
      description: 'Before migration',
    });

    await backupApi.createSnapshot({ label: 'Legacy label' });
    expect(mockClient.post).toHaveBeenCalledWith('/backup/database/snapshot', {
      name: 'Legacy label',
      title: 'Legacy label',
      description: undefined,
    });

    const database = makeBinaryFile('sql', 'restore.sql.gz');
    await backupApi.uploadDatabaseBackup(database, {
      title: 'Uploaded restore point',
      description: 'Known-good dump',
    });
    expect(mockClient.post).toHaveBeenCalledWith('/backup/database/upload', {
      data_base64: 'c3Fs',
      original_filename: 'restore.sql.gz',
      title: 'Uploaded restore point',
      description: 'Known-good dump',
    });

    await backupApi.restoreDatabase({
      filename: 'restore.sql.gz',
      skip_snapshot: true,
      memory: 'project-a',
    });
    expect(mockClient.post).toHaveBeenCalledWith('/backup/database/restore', {
      filename: 'restore.sql.gz',
      skip_snapshot: true,
      memory: 'project-a',
    });
  });

  it('covers memory and knowledge-archive download/upload routes with encoded filenames', async () => {
    memoryState.activeMemory = 'archive-a';
    mockFetch
      .mockResolvedValueOnce(new Response('memory'))
      .mockResolvedValueOnce(new Response('archive'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      }));

    await expectBlobSize(backupApi.downloadMemoryBackup('Project A'), 'memory');
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/backup/memory/Project%20A',
      { headers: { 'X-Fortemi-Memory': 'archive-a' } },
    );

    await expectBlobSize(backupApi.downloadKnowledgeArchive('snapshot 1.tar.gz'), 'archive');
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/backup/knowledge-archive/snapshot%201.tar.gz',
      { headers: { 'X-Fortemi-Memory': 'archive-a' } },
    );

    const archive = new File(['archive'], 'bundle.archive');
    await backupApi.uploadKnowledgeArchive(archive);
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/backup/knowledge-archive',
      expect.objectContaining({ method: 'POST', headers: { 'X-Fortemi-Memory': 'archive-a' } }),
    );
    const formData = mockFetch.mock.calls[2][1].body as FormData;
    expect(formData.get('file')).toBe(archive);
  });

  it('covers backup browser, swap, and metadata routes with encoded filenames', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      shards: [{
        filename: 'snapshot 1.tar.gz',
        size_bytes: 120,
        created_at: '2026-07-14T00:00:00Z',
        type: 'archive',
      }],
    });

    await expect(backupApi.listBackups()).resolves.toHaveLength(1);
    expect(mockClient.get).toHaveBeenCalledWith('/backup/list');

    vi.mocked(mockClient.get).mockResolvedValueOnce({
      filename: 'snapshot 1.tar.gz',
      size_bytes: 120,
      created_at: '2026-07-14T00:00:00Z',
      type: 'archive',
    });
    await backupApi.getBackupInfo('snapshot 1.tar.gz');
    expect(mockClient.get).toHaveBeenCalledWith('/backup/list/snapshot%201.tar.gz');

    await backupApi.swapBackup({
      filename: 'snapshot 1.tar.gz',
      dry_run: true,
      strategy: 'merge',
    });
    expect(mockClient.post).toHaveBeenCalledWith('/backup/swap', {
      filename: 'snapshot 1.tar.gz',
      dry_run: true,
      strategy: 'merge',
    });

    await backupApi.swapBackup({ backup_filename: 'legacy.tar.gz' });
    expect(mockClient.post).toHaveBeenCalledWith('/backup/swap', {
      filename: 'legacy.tar.gz',
      dry_run: undefined,
      strategy: undefined,
    });

    vi.mocked(mockClient.get).mockResolvedValueOnce({
      has_metadata: true,
      filename: 'filename_len:17',
      metadata: { title: 'Snapshot' },
    });
    await backupApi.getBackupMetadata('snapshot 1.tar.gz');
    expect(mockClient.get).toHaveBeenCalledWith('/backup/metadata/snapshot%201.tar.gz');

    vi.mocked(mockClient.put).mockResolvedValueOnce({
      success: true,
      filename: 'filename_len:17',
      metadata: { title: 'Updated' },
    });
    await expect(
      backupApi.updateBackupMetadata('snapshot 1.tar.gz', {
        label: 'Updated',
        description: 'Operator note',
      }),
    ).resolves.toEqual({
      success: true,
      filename: 'filename_len:17',
      metadata: { title: 'Updated' },
    });
    expect(mockClient.put).toHaveBeenCalledWith('/backup/metadata/snapshot%201.tar.gz', {
      title: 'Updated',
      description: 'Operator note',
    });
  });

  it('rejects blank backup route identifiers before issuing route requests', async () => {
    await expect(backupApi.downloadMemoryBackup(' ')).rejects.toThrow('Memory name is required');
    await expect(backupApi.downloadKnowledgeArchive(' ')).rejects.toThrow('Archive filename is required');
    await expect(backupApi.getBackupInfo(' ')).rejects.toThrow('Backup filename is required');
    await expect(backupApi.swapBackup({ filename: ' ' })).rejects.toThrow('Backup filename is required');
    await expect(backupApi.getBackupMetadata(' ')).rejects.toThrow('Backup filename is required');
    await expect(backupApi.updateBackupMetadata(' ', {})).rejects.toThrow('Backup filename is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
