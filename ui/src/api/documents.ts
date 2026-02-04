/**
 * Document Types API client
 * Handles document type definitions and detection
 */

import type { ApiClient } from './client';
import type {
  DocumentType,
  CreateDocumentTypeRequest,
  DetectDocumentTypeRequest,
  DetectionResult,
  DocumentTypeListResponse,
} from './types-extended';

export function createDocumentsApi(client: ApiClient) {
  return {
    /**
     * List all document types
     * Optionally filter by category
     */
    async list(category?: string): Promise<DocumentType[]> {
      const params: Record<string, string> = {};

      if (category) {
        params.category = category;
      }

      const response = await client.get<DocumentTypeListResponse>(
        '/api/v1/document-types',
        params
      );

      return response.document_types;
    },

    /**
     * Get a specific document type
     */
    async get(name: string): Promise<DocumentType> {
      if (!name || name.trim() === '') {
        throw new Error('Document type name is required');
      }

      return client.get<DocumentType>(`/api/v1/document-types/${name}`);
    },

    /**
     * Create a custom document type
     */
    async create(
      request: CreateDocumentTypeRequest
    ): Promise<DocumentType> {
      if (!request.name || request.name.trim() === '') {
        throw new Error('Document type name is required');
      }

      if (!request.display_name || request.display_name.trim() === '') {
        throw new Error('Display name is required');
      }

      if (!request.category || request.category.trim() === '') {
        throw new Error('Category is required');
      }

      if (!request.chunking_strategy || request.chunking_strategy.trim() === '') {
        throw new Error('Chunking strategy is required');
      }

      return client.post<DocumentType>('/api/v1/document-types', request);
    },

    /**
     * Update a custom document type
     * System types cannot be updated
     */
    async update(
      name: string,
      updates: Partial<CreateDocumentTypeRequest>
    ): Promise<DocumentType> {
      if (!name || name.trim() === '') {
        throw new Error('Document type name is required');
      }

      return client.patch<DocumentType>(
        `/api/v1/document-types/${name}`,
        updates
      );
    },

    /**
     * Delete a custom document type
     * System types cannot be deleted
     */
    async delete(name: string): Promise<void> {
      if (!name || name.trim() === '') {
        throw new Error('Document type name is required');
      }

      await client.delete(`/api/v1/document-types/${name}`);
    },

    /**
     * Detect document type from filename and/or content
     */
    async detect(
      request: DetectDocumentTypeRequest
    ): Promise<DetectionResult> {
      if (!request.filename && !request.content) {
        throw new Error('Either filename or content is required');
      }

      return client.post<DetectionResult>(
        '/api/v1/document-types/detect',
        request
      );
    },
  };
}

export type DocumentsApi = ReturnType<typeof createDocumentsApi>;
