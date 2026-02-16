import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createArchivesApi } from '../archives';
import type { ApiClient } from '../client';
import { clearActiveMemory, getActiveMemory } from '../memory-context';

describe('Archives API', () => {
  let mockClient: ApiClient;
  let archivesApi: ReturnType<typeof createArchivesApi>;

  beforeEach(() => {
    clearActiveMemory();
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as unknown as ApiClient;
    archivesApi = createArchivesApi(mockClient);
  });

  it('lists archives', async () => {
    const mockResponse = [
      {
        id: 'a1',
        name: 'projecte',
        schema_name: 'memory_projecte',
        created_at: '2026-02-16T00:00:00Z',
        is_default: false,
        schema_version: 1,
      },
    ];
    vi.mocked(mockClient.get).mockResolvedValueOnce(mockResponse);

    const result = await archivesApi.list();

    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/archives');
    expect(result).toEqual(mockResponse);
  });

  it('creates an archive', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({ id: 'a1', name: 'projecte' });

    const result = await archivesApi.create({ name: 'projecte', description: 'test' });

    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/archives', {
      name: 'projecte',
      description: 'test',
    });
    expect(result).toEqual({ id: 'a1', name: 'projecte' });
  });

  it('clones an archive', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({ id: 'a2', name: 'projecte-copy' });

    await archivesApi.clone('projecte', { new_name: 'projecte-copy' });

    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/archives/projecte/clone', {
      new_name: 'projecte-copy',
    });
  });

  it('sets default archive', async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce(undefined);

    await archivesApi.setDefault('projecte');

    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/archives/projecte/set-default');
  });

  it('updates selected active memory locally', () => {
    archivesApi.select('projecte');
    expect(getActiveMemory()).toBe('projecte');

    archivesApi.select(null);
    expect(getActiveMemory()).toBeNull();
  });
});
