/**
 * File Attachments API client
 * Handles file upload, download, and metadata operations
 */

import type { ApiClient } from './client';
import type {
  Attachment,
  AttachmentListResponse,
  AttachmentMetadata,
} from './types-extended';

export function createAttachmentsApi(client: ApiClient) {
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

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);

      // Use fetch directly for multipart/form-data (don't set Content-Type header)
      const baseUrl = (client as any).baseUrl || 'http://localhost:3000';
      const url = `${baseUrl}/api/v1/notes/${noteId}/attachments`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
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

      const response = await client.get<AttachmentListResponse>(
        `/api/v1/notes/${noteId}/attachments`
      );

      return response.attachments;
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
      const baseUrl = (client as any).baseUrl || 'http://localhost:3000';
      const url = `${baseUrl}/api/v1/attachments/${attachmentId}`;

      const response = await fetch(url, {
        method: 'GET',
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

      const baseUrl = (client as any).baseUrl || 'http://localhost:3000';
      return `${baseUrl}/api/v1/attachments/${attachmentId}`;
    },

    /**
     * Get comprehensive attachment metadata
     * Includes EXIF, location, device provenance
     */
    async getMetadata(attachmentId: string): Promise<AttachmentMetadata> {
      if (!attachmentId || attachmentId.trim() === '') {
        throw new Error('Attachment ID is required');
      }

      return client.get<AttachmentMetadata>(
        `/api/v1/attachments/${attachmentId}/metadata`
      );
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
