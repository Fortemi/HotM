/**
 * Backup & Export API client
 * Handles database backups, knowledge shards, and archives
 */

import type { ApiClient } from './client';
import type {
  BackupInfo,
  BackupListResponse,
  BackupMetadata,
  BackupMetadataResponse,
  BackupStatus,
  CreateSnapshotRequest,
  KnowledgeShardComponent,
  KnowledgeShardExport,
  KnowledgeShardImportResponse,
  KnowledgeShardImportResult,
  KnowledgeShardManifest,
  RestoreDatabaseRequest,
  SwapBackupRequest,
} from './types-extended';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';
import {
  inspectKnowledgeShard,
  normalizeKnowledgeShardInclude,
  SUPPORTED_FULL_V1_PROFILE,
  SUPPORTED_FULL_V1_SCHEMA,
} from './knowledgeShard';
import { getTauriFetch } from '@/lib/tauri';

type KnowledgeShardExportOptions = {
  include?: readonly KnowledgeShardComponent[];
  profile?: 'core-v1' | 'full-v1';
  schemaVersion?: string;
};

type ShardSignaturePolicy = 'require' | 'prefer' | 'trusted-local-only';

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
  const encodePathSegment = (value: string): string => encodeURIComponent(value.trim());
  const jsonErrorMessage = async (response: Response, fallback: string): Promise<string> => {
    const error = await response.json().catch(() => ({}));
    if (error && typeof error === 'object') {
      const message = (
        error as {
          message?: unknown;
          detail?: unknown;
          title?: unknown;
          error?: { message?: unknown };
        }
      ).message
        ?? (error as { detail?: unknown }).detail
        ?? (error as { error?: { message?: unknown } }).error?.message
        ?? (error as { title?: unknown }).title;
      if (typeof message === 'string' && message.trim()) return message;
    }
    return fallback;
  };
  const assertSuccessfulShardImport = (
    response: KnowledgeShardImportResponse | undefined,
  ): void => {
    if (!response) return;
    const errors = Array.isArray(response.errors)
      ? response.errors.filter((error) => typeof error === 'string' && error.trim())
      : [];
    if ((response.status && response.status !== 'success') || errors.length > 0) {
      throw new Error(
        errors[0]
        ?? `Knowledge shard import returned ${response.status ?? 'an unsuccessful result'}.`,
      );
    }
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
    // Knowledge Shards (Profile-gated)
    // ===========================

    /**
     * Export knowledge shard (application-level export)
     */
    async exportKnowledgeShard(
      options: KnowledgeShardExportOptions = {},
    ): Promise<KnowledgeShardExport> {
      const params: Record<string, string> = {};
      const profile = options.profile ?? 'core-v1';
      const schemaVersion = options.schemaVersion
        ?? (profile === SUPPORTED_FULL_V1_PROFILE ? SUPPORTED_FULL_V1_SCHEMA : undefined);
      if (profile === SUPPORTED_FULL_V1_PROFILE && options.include) {
        throw new Error('Knowledge shard 2.0.0/full-v1 export requires the complete component inventory.');
      }
      const include = profile === 'core-v1'
        ? normalizeKnowledgeShardInclude(options.include)
        : undefined;
      if (include) params.include = include;
      if (schemaVersion) params.schema_version = schemaVersion;
      params.profile = profile;
      if (profile === SUPPORTED_FULL_V1_PROFILE) params.include_blobs = 'true';

      const baseUrl = getBaseUrl();
      const queryString = new URLSearchParams(params).toString();
      const url = `${baseUrl}/backup/knowledge-shard${queryString ? `?${queryString}` : ''}`;

      const response = await getTauriFetch()(url, {
        headers: getMemoryHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const manifest = await inspectKnowledgeShard(blob);
      if (
        manifest.profile !== profile
        || (schemaVersion && manifest.version !== schemaVersion)
      ) {
        throw new Error(
          `Fortemi exported ${manifest.version}/${manifest.profile} instead of the requested ${schemaVersion ?? 'default'}/${profile}.`,
        );
      }
      return {
        blob,
        manifest,
      };
    },

    /**
     * Stream a server-generated shard directly to an operator-provided sink.
     * This is the required browser path for full-v1 so attachment sidecars are
     * never accumulated into a complete in-memory Blob.
     */
    async streamKnowledgeShardExport(
      sink: WritableStream<Uint8Array>,
      options: KnowledgeShardExportOptions,
    ): Promise<{ profile: 'core-v1' | 'full-v1'; schemaVersion: string | undefined }> {
      const profile = options.profile ?? 'core-v1';
      const schemaVersion = options.schemaVersion
        ?? (profile === SUPPORTED_FULL_V1_PROFILE ? SUPPORTED_FULL_V1_SCHEMA : undefined);
      if (profile === SUPPORTED_FULL_V1_PROFILE && options.include) {
        throw new Error('Knowledge shard 2.0.0/full-v1 export requires the complete component inventory.');
      }

      const params = new URLSearchParams();
      params.set('profile', profile);
      if (schemaVersion) params.set('schema_version', schemaVersion);
      if (profile === SUPPORTED_FULL_V1_PROFILE) {
        params.set('include_blobs', 'true');
      } else {
        const include = normalizeKnowledgeShardInclude(options.include);
        if (include) params.set('include', include);
      }

      const response = await getTauriFetch()(
        `${getBaseUrl()}/backup/knowledge-shard?${params.toString()}`,
        { headers: getMemoryHeaders() },
      );
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error('Streaming shard export is unavailable in this client.');
      }
      await response.body.pipeTo(sink);
      return { profile, schemaVersion };
    },

    /**
     * Inspect a Knowledge Shard locally before any upload.
     */
    async inspectKnowledgeShard(file: Blob): Promise<KnowledgeShardManifest> {
      return inspectKnowledgeShard(file);
    },

    /**
     * Import knowledge shard through the legacy base64 route.
     */
    async importKnowledgeShard(file: File): Promise<KnowledgeShardImportResult> {
      if (!file) {
        throw new Error('Knowledge shard file is required');
      }

      const manifest = await inspectKnowledgeShard(file);
      if (manifest.profile === SUPPORTED_FULL_V1_PROFILE) {
        throw new Error('Knowledge shard 2.0.0/full-v1 import requires the streaming multipart recovery path.');
      }
      const shardBase64 = await fileToBase64(file);
      const response = await client.post<KnowledgeShardImportResponse | undefined>(
        '/backup/knowledge-shard/import',
        {
          shard_base64: shardBase64,
        },
      );
      assertSuccessfulShardImport(response);
      return { manifest, response };
    },

    /**
     * Import knowledge shard via multipart upload.
     */
    async uploadKnowledgeShard(
      file: File,
      options: {
        include?: readonly KnowledgeShardComponent[];
        dryRun?: boolean;
        onConflict?: 'skip' | 'replace' | 'merge';
        skipEmbeddingRegen?: boolean;
        verifySignature?: ShardSignaturePolicy;
      } = {},
    ): Promise<KnowledgeShardImportResult> {
      if (!file) {
        throw new Error('Knowledge shard file is required');
      }

      const manifest = await inspectKnowledgeShard(file);
      const isFullV1 = manifest.profile === SUPPORTED_FULL_V1_PROFILE;
      if (isFullV1 && options.include) {
        throw new Error('Knowledge shard 2.0.0/full-v1 import requires the complete component inventory.');
      }
      if (isFullV1 && options.verifySignature && options.verifySignature !== 'require') {
        throw new Error('Knowledge shard 2.0.0/full-v1 recovery requires publisher signature verification.');
      }

      const uploadOnce = async (
        dryRun: boolean | undefined,
        verifySignature: ShardSignaturePolicy | undefined,
      ): Promise<KnowledgeShardImportResponse | undefined> => {
        const params: Record<string, string> = {};
        const include = isFullV1 ? undefined : normalizeKnowledgeShardInclude(options.include);
        if (include) params.include = include;
        if (dryRun !== undefined) params.dry_run = String(dryRun);
        if (options.onConflict) params.on_conflict = options.onConflict;
        if (options.skipEmbeddingRegen !== undefined) {
          params.skip_embedding_regen = String(options.skipEmbeddingRegen);
        }
        if (verifySignature) params.verify_signature = verifySignature;

        const queryString = new URLSearchParams(params).toString();
        const url = `${getBaseUrl()}/backup/knowledge-shard/upload${queryString ? `?${queryString}` : ''}`;
        const formData = new FormData();
        formData.append('file', file);
        const response = await getTauriFetch()(url, {
          method: 'POST',
          headers: getMemoryHeaders(),
          body: formData,
        });
        if (!response.ok) {
          throw new Error(await jsonErrorMessage(response, `Upload failed: ${response.statusText}`));
        }
        const result = await response
          .json()
          .catch(() => undefined) as KnowledgeShardImportResponse | undefined;
        assertSuccessfulShardImport(result);
        return result;
      };

      if (isFullV1) {
        const preflight = await uploadOnce(true, 'require');
        if (options.dryRun === true) {
          return { manifest, response: preflight, preflight };
        }
        const result = await uploadOnce(false, 'require');
        return { manifest, response: result, preflight };
      }

      const result = await uploadOnce(options.dryRun, options.verifySignature);
      return { manifest, response: result };
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
      await client.post('/backup/database/snapshot', {
        name: request.name ?? request.label,
        title: request.title ?? request.label,
        description: request.description,
      });
    },

    /**
     * Upload a database backup file
     */
    async uploadDatabaseBackup(
      file: File,
      metadata: { title?: string; description?: string } = {},
    ): Promise<void> {
      if (!file) {
        throw new Error('Database backup file is required');
      }

      const dataBase64 = await fileToBase64(file);
      await client.post('/backup/database/upload', {
        data_base64: dataBase64,
        original_filename: file.name,
        title: metadata.title,
        description: metadata.description,
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
      const url = `${baseUrl}/backup/knowledge-archive/${encodePathSegment(filename)}`;

      const response = await getTauriFetch()(url, {
        headers: getMemoryHeaders(),
      });

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
        throw new Error(await jsonErrorMessage(response, `Upload failed: ${response.statusText}`));
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

      return client.get<BackupInfo>(`/backup/list/${encodePathSegment(filename)}`);
    },

    /**
     * Swap current database with a backup
     * Creates backup of current state first
     */
    async swapBackup(request: SwapBackupRequest): Promise<void> {
      const filename = request.filename ?? request.backup_filename;
      if (!filename || filename.trim() === '') {
        throw new Error('Backup filename is required');
      }

      await client.post('/backup/swap', {
        filename,
        dry_run: request.dry_run,
        strategy: request.strategy,
      });
    },

    // ===========================
    // Backup Metadata
    // ===========================

    /**
     * Get metadata for a backup file
     */
    async getBackupMetadata(filename: string): Promise<BackupMetadataResponse> {
      if (!filename || filename.trim() === '') {
        throw new Error('Backup filename is required');
      }

      return client.get<BackupMetadataResponse>(
        `/backup/metadata/${encodePathSegment(filename)}`
      );
    },

    /**
     * Update metadata for a backup file
     */
    async updateBackupMetadata(
      filename: string,
      metadata: BackupMetadata
    ): Promise<BackupMetadataResponse> {
      if (!filename || filename.trim() === '') {
        throw new Error('Backup filename is required');
      }

      return client.put<BackupMetadataResponse>(
        `/backup/metadata/${encodePathSegment(filename)}`,
        {
          title: metadata.title ?? metadata.label,
          description: metadata.description,
        },
      );
    },
  };
}

export type BackupApi = ReturnType<typeof createBackupApi>;
