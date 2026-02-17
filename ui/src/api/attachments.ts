/**
 * File Attachments API client
 * Handles file upload, download, and metadata operations
 */

import type { ApiClient } from './client';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';
import type {
  Attachment,
  AttachmentListResponse,
  AttachmentMetadata,
} from './types-extended';

export function createAttachmentsApi(client: ApiClient) {
  const getBaseUrl = (): string => {
    return client.baseUrl;
  };

  const buildRoutingHeaders = (): Headers => {
    const headers = new Headers();
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
     * @returns Attachment metadata
     */
    async uploadAttachment(noteId: string, file: File): Promise<Attachment> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      if (!file) {
        throw new Error('File is required');
      }

      // Fortemi multipart upload endpoint
      const formData = new FormData();
      formData.append('file', file);

      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/api/v1/notes/${noteId}/attachments/upload`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: buildRoutingHeaders(),
        // Let browser set Content-Type with boundary
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Upload failed: ${response.statusText}`);
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
        `/api/v1/notes/${noteId}/attachments`
      );

      return Array.isArray(response) ? response : response.attachments;
    },

    /**
     * Download an attachment
     * Returns blob URL for client-side handling
     */
    async downloadAttachment(attachmentId: string): Promise<Blob> {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      // Use fetch directly to handle binary response
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/api/v1/attachments/${attachmentId}/download`;

      const response = await fetch(url, {
        method: 'GET',
        headers: buildRoutingHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      return response.blob();
    },

    /**
     * Get download URL for an attachment
     */
    getDownloadUrl(attachmentId: string): string {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      const baseUrl = getBaseUrl();
      return `${baseUrl}/api/v1/attachments/${attachmentId}/download`;
    },

    /**
     * Get comprehensive attachment metadata
     * Includes EXIF, location, device provenance
     */
    async getMetadata(attachmentId: string): Promise<AttachmentMetadata> {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      const attachment = await client.get<Attachment>(`/api/v1/attachments/${attachmentId}`);
      return {
        id: attachment.id,
        filename: attachment.filename,
        content_type: attachment.content_type,
        size_bytes: attachment.size_bytes,
        created_at: attachment.created_at,
      };
    },

    /**
     * Delete an attachment permanently
     */
    async deleteAttachment(attachmentId: string): Promise<void> {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      await client.delete(`/api/v1/attachments/${attachmentId}`);
    },
  };
}

export type AttachmentsApi = ReturnType<typeof createAttachmentsApi>;
