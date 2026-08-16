/**
 * File Attachments API client
 * Handles file upload, download, and metadata operations
 */

import type { ApiClient } from './client';
import { getAuthorizationHeader } from './auth-context';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';
import { getTauriFetch, invokeTauri, isTauri } from '@/lib/tauri';
import type {
  Attachment,
  AttachmentListResponse,
  AttachmentMetadata,
} from './types-extended';

function transferFailure(action: 'Upload' | 'Download', status: number): Error {
  if (status === 401 || status === 403) return new Error(`${action} authorization expired or was denied.`);
  if (status === 413) return new Error(`${action} exceeds the server size limit.`);
  if (status === 416) return new Error('The requested download range is unavailable.');
  if (status === 429) return new Error(`${action} is rate limited. Retry later.`);
  if (status >= 500) return new Error(`${action} service is unavailable.`);
  return new Error(`${action} failed (HTTP ${status}).`);
}

export function createAttachmentsApi(client: ApiClient) {
  const getBaseUrl = (): string => {
    return client.baseUrl;
  };

  const buildRoutingHeaders = (): Headers => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(getAuthorizationHeader())) {
      headers.set(name, value);
    }
    const selectedMemory = getActiveMemory();
    if (selectedMemory) {
      headers.set(getMemoryRoutingHeaderName(), selectedMemory);
    }
    return headers;
  };

  return {
    /**
     * Compatibility guard for the uncontracted multipart route.
     * Remote attachment callers must use the typed TUS workflow.
     */
    async uploadAttachment(
      noteId: string,
      file: File,
      options?: { mediaOptimize?: boolean },
    ): Promise<Attachment> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!file) {
        throw new Error('File is required');
      }

      void options;
      throw new Error('Multipart attachment upload is disabled. Use the resumable upload workflow.');
    },

    /**
     * List all attachments for a note
     */
    async listAttachments(noteId: string): Promise<Attachment[]> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      const response = await client.get<AttachmentListResponse | Attachment[]>(
        `/notes/${noteId}/attachments`
      );

      return Array.isArray(response) ? response : response.attachments;
    },

    /**
     * List all attachments across all notes (global)
     * Supports pagination, content type filtering, and sorting
     */
    async listAllAttachments(params?: {
      page?: number;
      per_page?: number;
      content_type?: string;
      status?: string;
      sort?: string;
    }): Promise<{ attachments: Attachment[]; total: number }> {
      const queryParams: Record<string, string> = {};
      if (params?.page !== undefined) queryParams.page = String(params.page);
      if (params?.per_page !== undefined) queryParams.per_page = String(params.per_page);
      if (params?.content_type) queryParams.content_type = params.content_type;
      if (params?.status) queryParams.status = params.status;
      if (params?.sort) queryParams.sort = params.sort;

      const response = await client.get<{ attachments: Attachment[]; total: number } | Attachment[]>(
        '/attachments',
        queryParams
      );

      if (Array.isArray(response)) {
        return { attachments: response, total: response.length };
      }
      return response;
    },

    /**
     * Download an attachment
     * Returns blob URL for client-side handling
     */
    async downloadAttachment(attachmentId: string, variant?: string): Promise<Blob> {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      // Use fetch directly to handle binary response
      const baseUrl = getBaseUrl();
      let url = `${baseUrl}/attachments/${attachmentId}/download`;
      if (variant) {
        url += `?variant=${encodeURIComponent(variant)}`;
      }

      const response = await getTauriFetch()(url, {
        method: 'GET',
        headers: buildRoutingHeaders(),
      });

      if (!response.ok) {
        throw transferFailure('Download', response.status);
      }

      return response.blob();
    },

    /**
     * Save an attachment through the desktop host when running in Tauri.
     * Returns false in web mode or when the user cancels the save dialog.
     */
    async downloadAttachmentToLocalFile(
      attachmentId: string,
      filename: string,
      variant?: string,
    ): Promise<boolean> {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }
      if (!isTauri()) return false;

      const headers: Record<string, string> = {};
      for (const [name, value] of buildRoutingHeaders()) {
        headers[name] = value;
      }

      try {
        const result = await invokeTauri<{
          path: string;
          bytes_written: number;
          sha256: string;
          reopened: boolean;
          reopened_bytes: number;
        } | null>(
          'hotm_download_attachment_to_file',
          {
            api_base_url: getBaseUrl(),
            attachment_id: attachmentId,
            suggested_filename: filename,
            variant,
            headers,
          },
        );
        return Boolean(result);
      } catch {
        throw new Error('Desktop download failed.');
      }
    },

    /**
     * Get download URL for an attachment
     */
    getDownloadUrl(attachmentId: string, variant?: string): string {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      const baseUrl = getBaseUrl();
      const base = `${baseUrl}/attachments/${attachmentId}/download`;
      return variant ? `${base}?variant=${encodeURIComponent(variant)}` : base;
    },

    /**
     * Get comprehensive attachment metadata
     * Includes EXIF, location, device provenance
     */
    async getMetadata(attachmentId: string): Promise<AttachmentMetadata> {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      const attachment = await client.get<Attachment>(`/attachments/${attachmentId}`);
      return {
        id: attachment.id,
        filename: attachment.filename,
        content_type: attachment.content_type,
        size_bytes: attachment.size_bytes,
        status: attachment.status,
        extraction_strategy: attachment.extraction_strategy,
        created_at: attachment.created_at,
        updated_at: attachment.updated_at,
        ai_description: attachment.ai_description,
        ai_model: attachment.ai_model,
        extracted_text: attachment.extracted_text,
        extracted_metadata: attachment.extracted_metadata,
      };
    },

    /**
     * Get thumbnail URL for an attachment (dedicated endpoint with immutable cache headers)
     */
    getThumbnailUrl(attachmentId: string): string {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      const baseUrl = getBaseUrl();
      return `${baseUrl}/attachments/${attachmentId}/thumbnail`;
    },

    /**
     * Get subtitle URL for an attachment (server-side VTT/SRT/RTTM)
     */
    getSubtitleUrl(attachmentId: string, format: 'vtt' | 'srt' | 'rttm' = 'vtt'): string {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      const baseUrl = getBaseUrl();
      return `${baseUrl}/attachments/${attachmentId}/subtitles?format=${format}`;
    },

    /**
     * Get thumbnail sprites VTT URL for video scrubbing preview.
     * Returns the URL to a WebVTT file mapping timestamps to sprite sheet coordinates.
     */
    getThumbnailVttUrl(attachmentId: string): string {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      const baseUrl = getBaseUrl();
      return `${baseUrl}/attachments/${attachmentId}/thumbnails.vtt`;
    },

    /**
     * Get sprite sheet image URL for a specific sprite index.
     */
    getSpriteUrl(attachmentId: string, index: number): string {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      const baseUrl = getBaseUrl();
      return `${baseUrl}/attachments/${attachmentId}/sprites/${index}.jpg`;
    },

    /**
     * Delete an attachment permanently
     */
    async deleteAttachment(attachmentId: string): Promise<void> {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      await client.delete(`/attachments/${attachmentId}`);
    },
  };
}

export type AttachmentsApi = ReturnType<typeof createAttachmentsApi>;
