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

/**
 * Extract a human-readable error message from an API error response.
 * Handles Fortemi standard format, flat error objects, and plain text responses.
 * Falls back to HTTP status code when no message can be extracted.
 */
function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'string' && body.length > 0) {
    return body;
  }

  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;

    // Fortemi standard: { error: { message: "..." } }
    if (obj.error && typeof obj.error === 'object') {
      const nested = obj.error as Record<string, unknown>;
      if (typeof nested.message === 'string') return nested.message;
      if (typeof nested.code === 'string') return nested.code;
    }

    // Flat variants: { error: "..." }, { message: "..." }, { detail: "..." }
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.detail === 'string') return obj.detail;
  }

  return `HTTP ${status}`;
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
     * Upload a file attachment to a note
     * @param noteId - Note ID to attach file to
     * @param file - File object to upload
     * @param options - Upload options
     * @param options.mediaOptimize - When true, request backend media optimization
     *   (faststart MP4, remuxed containers, preview clips). Only effective for audio/video files.
     * @returns Attachment metadata
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

      // Fortemi multipart upload endpoint
      const formData = new FormData();
      formData.append('file', file);
      if (options?.mediaOptimize) {
        formData.append('media_optimize', 'true');
      }

      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/notes/${noteId}/attachments/upload`;

      // Build headers as plain object — do NOT set Content-Type so the
      // browser auto-generates the multipart boundary for FormData.
      const headers: Record<string, string> = { ...getAuthorizationHeader() };
      const selectedMemory = getActiveMemory();
      if (selectedMemory) {
        headers[getMemoryRoutingHeaderName()] = selectedMemory;
      }

      const response = await getTauriFetch()(url, {
        method: 'POST',
        body: formData,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      });

      if (!response.ok) {
        let body: unknown;
        try { body = await response.json(); }
        catch { try { body = await response.text(); } catch { /* empty */ } }
        throw new Error(`Upload failed: ${extractErrorMessage(body, response.status)}`);
      }

      return response.json();
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
        let body: unknown;
        try { body = await response.json(); }
        catch { try { body = await response.text(); } catch { /* empty */ } }
        throw new Error(`Download failed: ${extractErrorMessage(body, response.status)}`);
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
