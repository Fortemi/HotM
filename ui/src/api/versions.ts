/**
 * Note Versioning API client
 * Handles note version history, diffs, and restoration
 */

import type { ApiClient } from './client';
import type {
  NoteVersion,
  VersionListResponse,
  VersionContentResponse,
  VersionDiff,
} from './types-extended';

export function createVersionsApi(client: ApiClient) {
  return {
    /**
     * List all versions of a note
     */
    async listVersions(noteId: string): Promise<NoteVersion[]> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<VersionListResponse>(
        `/api/v1/notes/${noteId}/versions`
      );

      return response.versions;
    },

    /**
     * Get a specific version of a note
     */
    async getVersion(
      noteId: string,
      version: number
    ): Promise<VersionContentResponse> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (version < 1) {
        throw new Error('Version must be greater than 0');
      }

      return client.get<VersionContentResponse>(
        `/api/v1/notes/${noteId}/versions/${version}`
      );
    },

    /**
     * Restore a note to a previous version
     * Creates a new version in the process
     */
    async restoreVersion(noteId: string, version: number): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (version < 1) {
        throw new Error('Version must be greater than 0');
      }

      await client.post(
        `/api/v1/notes/${noteId}/versions/${version}/restore`
      );
    },

    /**
     * Delete a specific version
     * Cannot delete the current version
     */
    async deleteVersion(noteId: string, version: number): Promise<void> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (version < 1) {
        throw new Error('Version must be greater than 0');
      }

      await client.delete(`/api/v1/notes/${noteId}/versions/${version}`);
    },

    /**
     * Get unified diff between two versions
     */
    async diffVersions(
      noteId: string,
      fromVersion: number,
      toVersion: number
    ): Promise<VersionDiff> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (fromVersion < 1 || toVersion < 1) {
        throw new Error('Versions must be greater than 0');
      }

      if (fromVersion === toVersion) {
        throw new Error('Cannot diff identical versions');
      }

      const params: Record<string, string> = {
        from: String(fromVersion),
        to: String(toVersion),
      };

      return client.get<VersionDiff>(
        `/api/v1/notes/${noteId}/versions/diff`,
        params
      );
    },
  };
}

export type VersionsApi = ReturnType<typeof createVersionsApi>;
