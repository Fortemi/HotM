/**
 * Backup & Export API client
 * Handles database backups, knowledge shards, and archives
 */

import type { ApiClient } from './client';
import type {
  BackupInfo,
  BackupListResponse,
  BackupMetadata,
  BackupStatus,
  CreateSnapshotRequest,
  RestoreDatabaseRequest,
  SwapBackupRequest,
} from './types-extended';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';
import { getTauriFetch } from '@/lib/tauri';

export function createBackupApi(client: ApiClient) {
  const getBaseUrl = (): string => client.baseUrl;
  const getMemoryHeaders = (): Record<string, string> => {
    const activeMemory = getActiveMemory();
    if (!activeMemory) {
      return {};
    }
    return { [getMemoryRoutingHeaderName()]: activeMemory };
  };

  const fileToBase64 = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  return {
    // ===========================
    // JSON Export/Import (Legacy)
    // ===========================

    /**
     * Export all notes and metadata as JSON
     */
    async exportBackup(): Promise<unknown> {
      return client.get('/backup/export');
    },

    /**
     * Download the most recent backup as a file
     * Returns blob URL for download
     */
    async downloadBackup(): Promise<Blob> {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/backup/download`;

      const response = await getTauriFetch()(url, {
        headers: getMemoryHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      return response.blob();
    },

    /**
     * Import notes from a JSON backup file.
     *
     * @param file - JSON backup file (export from this or another Fortemi instance)
     * @param options.deferInference - When true, sends `defer_inference: true` so the
     *   Fortemi sidecar imports notes as raw content only and skips the NLP pipeline
     *   (embeddings, metadata, NER, link detection, AI title generation). FTS works
     *   immediately via the insert-trigger-maintained tsvector. Semantic backfill is
     *   on-demand via POST /api/v1/notes/reprocess. Default false preserves prior
     *   full-inference behavior. Added in Fortemi v2026.5.6 (#677), bundled in
     *   HotM v2026.5.7+.
     */
    async importBackup(
      file: File,
      options: { deferInference?: boolean } = {},
    ): Promise<void> {
      if (!file) {
        throw new Error('Backup file is required');
      }

      const text = await file.text();
      const parsed = JSON.parse(text);
      const backupPayload = parsed.backup ? parsed : { backup: parsed };
      const payload = options.deferInference
        ? { ...backupPayload, defer_inference: true }
        : backupPayload;
      await client.post('/backup/import', payload);
    },

    /**
     * Manually trigger a backup job
     */
    async triggerBackup(): Promise<void> {
      await client.post('/backup/trigger');
    },

    /**
     * Get status of the most recent backup
     */
    async getBackupStatus(): Promise<BackupStatus> {
      return client.get<BackupStatus>('/backup/status');
    },

    // ===========================
    // Knowledge Shards (Portable)
    // ===========================

    /**
     * Export knowledge shard (application-level export)
     */
    async exportKnowledgeShard(options: {
      format?: 'json' | 'yaml';
      include_deleted?: boolean;
    } = {}): Promise<Blob> {
      const params: Record<string, string> = {};

      if (options.format) {
        params.format = options.format;
      }

      if (options.include_deleted !== undefined) {
        params.include_deleted = String(options.include_deleted);
      }

      const baseUrl = getBaseUrl();
      const queryString = new URLSearchParams(params).toString();
      const url = `${baseUrl}/backup/knowledge-shard${queryString ? `?${queryString}` : ''}`;

      const response = await getTauriFetch()(url, {
        headers: getMemoryHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      return response.blob();
    },

    /**
     * Import knowledge shard
     */
    async importKnowledgeShard(file: File): Promise<void> {
      if (!file) {
        throw new Error('Knowledge shard file is required');
      }

      const shardBase64 = await fileToBase64(file);
      await client.post('/backup/knowledge-shard/import', {
        shard_base64: shardBase64,
      });
    },

    // ===========================
    // Database Backups (Full)
    // ===========================

    /**
     * Download full database backup (pg_dump)
     */
    async downloadDatabaseBackup(): Promise<Blob> {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/backup/database`;

      const response = await getTauriFetch()(url, {
        headers: getMemoryHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      return response.blob();
    },

    /**
     * Create a named database snapshot
     */
    async createSnapshot(request: CreateSnapshotRequest): Promise<void> {
      if (!request.label || request.label.trim() === '') {
        throw new Error('Snapshot label is required');
      }

      await client.post('/backup/database/snapshot', request);
    },

    /**
     * Upload a database backup file
     */
    async uploadDatabaseBackup(file: File): Promise<void> {
      if (!file) {
        throw new Error('Database backup file is required');
      }

      const dataBase64 = await fileToBase64(file);
      await client.post('/backup/database/upload', {
        data_base64: dataBase64,
        original_filename: file.name,
      });
    },

    /**
     * Restore database from backup file
     * WARNING: This will overwrite all current data
     */
    async restoreDatabase(request: RestoreDatabaseRequest): Promise<void> {
      if (!request.filename || request.filename.trim() === '') {
        throw new Error('Backup filename is required');
      }

      await client.post('/backup/database/restore', request);
    },

    /**
     * Download backup for a specific memory archive.
     */
    async downloadMemoryBackup(name: string): Promise<Blob> {
      if (!name || name.trim() === '') {
        throw new Error('Memory name is required');
      }

      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/backup/memory/${encodeURIComponent(name)}`;

      const response = await getTauriFetch()(url, {
        headers: getMemoryHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      return response.blob();
    },

    // ===========================
    // Knowledge Archives
    // ===========================

    /**
     * Download a knowledge archive
     */
    async downloadKnowledgeArchive(filename: string): Promise<Blob> {
      if (!filename || filename.trim() === '') {
        throw new Error('Archive filename is required');
      }

      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/backup/knowledge-archive/${filename}`;

      const response = await getTauriFetch()(url);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      return response.blob();
    },

    /**
     * Upload a knowledge archive
     */
    async uploadKnowledgeArchive(file: File): Promise<void> {
      if (!file) {
        throw new Error('Archive file is required');
      }

      const formData = new FormData();
      formData.append('file', file);

      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/backup/knowledge-archive`;

      const response = await getTauriFetch()(url, {
        method: 'POST',
        headers: getMemoryHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Upload failed: ${response.statusText}`);
      }
    },

    // ===========================
    // Backup Browser
    // ===========================

    /**
     * List all available backup files
     */
    async listBackups(): Promise<BackupInfo[]> {
      const response = await client.get<BackupListResponse | { shards?: BackupInfo[] }>(
        '/backup/list'
      );

      if ('backups' in response && Array.isArray(response.backups)) {
        return response.backups;
      }
      return (response as { shards?: BackupInfo[] }).shards ?? [];
    },

    /**
     * Get detailed info for a specific backup
     */
    async getBackupInfo(filename: string): Promise<BackupInfo> {
      if (!filename || filename.trim() === '') {
        throw new Error('Backup filename is required');
      }

      return client.get<BackupInfo>(`/backup/list/${filename}`);
    },

    /**
     * Swap current database with a backup
     * Creates backup of current state first
     */
    async swapBackup(request: SwapBackupRequest): Promise<void> {
      if (!request.backup_filename || request.backup_filename.trim() === '') {
        throw new Error('Backup filename is required');
      }

      await client.post('/backup/swap', request);
    },

    // ===========================
    // Backup Metadata
    // ===========================

    /**
     * Get metadata for a backup file
     */
    async getBackupMetadata(filename: string): Promise<BackupMetadata> {
      if (!filename || filename.trim() === '') {
        throw new Error('Backup filename is required');
      }

      return client.get<BackupMetadata>(
        `/backup/metadata/${filename}`
      );
    },

    /**
     * Update metadata for a backup file
     */
    async updateBackupMetadata(
      filename: string,
      metadata: BackupMetadata
    ): Promise<void> {
      if (!filename || filename.trim() === '') {
        throw new Error('Backup filename is required');
      }

      await client.put(`/backup/metadata/${filename}`, metadata);
    },
  };
}

export type BackupApi = ReturnType<typeof createBackupApi>;
