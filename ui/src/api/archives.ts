/**
 * Archives API client
 * Handles Fortemi multi-memory (archive) management.
 */

import type { ApiClient } from './client';
import type {
  ArchiveStatsResponse,
  CloneArchiveRequest,
  CreateArchiveRequest,
  MemoryArchive,
  UpdateArchiveRequest,
} from './types-extended';
import { setActiveMemory } from './memory-context';

type CreateArchiveResponse = {
  id?: string;
  name?: string;
  schema_name?: string;
  cloned_from?: string;
};

export function createArchivesApi(client: ApiClient) {
  return {
    async list(): Promise<MemoryArchive[]> {
      return client.get<MemoryArchive[]>('/api/v1/archives');
    },

    async get(name: string): Promise<MemoryArchive> {
      return client.get<MemoryArchive>(`/api/v1/archives/${encodeURIComponent(name)}`);
    },

    async create(request: CreateArchiveRequest): Promise<CreateArchiveResponse> {
      return client.post<CreateArchiveResponse>('/api/v1/archives', request);
    },

    async update(name: string, request: UpdateArchiveRequest): Promise<void> {
      await client.patch<void>(`/api/v1/archives/${encodeURIComponent(name)}`, request);
    },

    async delete(name: string): Promise<void> {
      await client.delete<void>(`/api/v1/archives/${encodeURIComponent(name)}`);
    },

    async setDefault(name: string): Promise<void> {
      await client.post<void>(`/api/v1/archives/${encodeURIComponent(name)}/set-default`);
    },

    async stats(name: string): Promise<ArchiveStatsResponse> {
      return client.get<ArchiveStatsResponse>(`/api/v1/archives/${encodeURIComponent(name)}/stats`);
    },

    async clone(name: string, request: CloneArchiveRequest): Promise<CreateArchiveResponse> {
      return client.post<CreateArchiveResponse>(
        `/api/v1/archives/${encodeURIComponent(name)}/clone`,
        request
      );
    },

    /**
     * Select archive for subsequent API requests in this browser.
     * Pass null/public to return to default archive routing.
     */
    select(name: string | null): void {
      setActiveMemory(name);
    },
  };
}

export type ArchivesApi = ReturnType<typeof createArchivesApi>;

