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
import { asRecord, booleanField, ContractDecodeError, finiteNumber, optionalString, requiredString, stringArray } from './contract-codecs';

const MAX_DETECTION_CONTENT_CHARS = 64 * 1024;

function decodeDocumentType(payload: unknown, operationId: string): DocumentType {
  const raw = asRecord(payload, operationId);
  return {
    id: optionalString(raw, 'id'),
    name: requiredString(raw, 'name', operationId),
    display_name: optionalString(raw, 'display_name') ?? requiredString(raw, 'name', operationId),
    category: optionalString(raw, 'category') ?? 'unknown',
    description: optionalString(raw, 'description'),
    file_extensions: stringArray(raw.file_extensions),
    filename_patterns: stringArray(raw.filename_patterns),
    content_magic: stringArray(raw.magic_patterns),
    magic_patterns: stringArray(raw.magic_patterns),
    mime_types: stringArray(raw.mime_types),
    content_types: stringArray(raw.content_types),
    chunking_strategy: optionalString(raw, 'chunking_strategy') ?? 'unknown',
    syntax_language: optionalString(raw, 'tree_sitter_language'),
    tree_sitter_language: optionalString(raw, 'tree_sitter_language'),
    extraction_strategy: optionalString(raw, 'extraction_strategy'),
    chunk_size_default: typeof raw.chunk_size_default === 'number' ? raw.chunk_size_default : undefined,
    chunk_overlap_default: typeof raw.chunk_overlap_default === 'number' ? raw.chunk_overlap_default : undefined,
    preserve_boundaries: typeof raw.preserve_boundaries === 'boolean' ? raw.preserve_boundaries : undefined,
    requires_attachment: typeof raw.requires_attachment === 'boolean' ? raw.requires_attachment : undefined,
    attachment_generates_content: typeof raw.attachment_generates_content === 'boolean' ? raw.attachment_generates_content : undefined,
    is_system: booleanField(raw, 'is_system', operationId, false),
    is_active: booleanField(raw, 'is_active', operationId, true),
    created_at: optionalString(raw, 'created_at') ?? '',
  };
}

function serializeDocumentType(request: Partial<CreateDocumentTypeRequest>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const directFields: Array<keyof CreateDocumentTypeRequest> = [
    'name', 'display_name', 'category', 'description', 'file_extensions', 'filename_patterns',
    'mime_types', 'content_types', 'chunking_strategy', 'extraction_strategy', 'chunk_size_default',
    'chunk_overlap_default', 'preserve_boundaries', 'requires_attachment',
    'attachment_generates_content', 'recommended_config_id', 'extraction_config', 'chunking_config',
    'agentic_config',
  ];
  directFields.forEach((field) => {
    if (request[field] !== undefined) payload[field] = request[field];
  });
  const magicPatterns = request.magic_patterns ?? request.content_magic;
  if (magicPatterns !== undefined) payload.magic_patterns = magicPatterns;
  const treeSitterLanguage = request.tree_sitter_language ?? request.syntax_language;
  if (treeSitterLanguage !== undefined) payload.tree_sitter_language = treeSitterLanguage;
  return payload;
}

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

      const response = await client.get<DocumentTypeListResponse | unknown[]>(
        '/document-types',
        params
      );

      const entries = Array.isArray(response) ? response : response.document_types;
      return entries.map((entry) => decodeDocumentType(entry, 'list_document_types'));
    },

    /**
     * Get a specific document type
     */
    async get(name: string): Promise<DocumentType> {
      if (!name || name.trim() === '') {
        throw new Error('Document type name is required');
      }

      return decodeDocumentType(
        await client.get<unknown>(`/document-types/${encodeURIComponent(name)}`),
        'get_document_type',
      );
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

      if (!request.category || request.category.trim() === '') {
        throw new Error('Category is required');
      }
      await client.post('/document-types', serializeDocumentType(request));
      return this.get(request.name);
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

      await client.patch(`/document-types/${encodeURIComponent(name)}`, serializeDocumentType(updates));
      return this.get(name);
    },

    /**
     * Delete a custom document type
     * System types cannot be deleted
     */
    async delete(name: string): Promise<void> {
      if (!name || name.trim() === '') {
        throw new Error('Document type name is required');
      }

      await client.delete(`/document-types/${name}`);
    },

    /**
     * Detect document type from filename and/or content
     */
    async detect(
      request: DetectDocumentTypeRequest
    ): Promise<DetectionResult> {
      if (!request.filename && !request.content && !request.mime_type) {
        throw new Error('A filename, content sample, or MIME type is required');
      }
      if ((request.content?.length ?? 0) > MAX_DETECTION_CONTENT_CHARS) {
        throw new Error(`Detection content cannot exceed ${MAX_DETECTION_CONTENT_CHARS} characters`);
      }
      const response = await client.post<unknown>('/document-types/detect', request);
      if (response === null) {
        return { matched: false, document_type: null, confidence: null, detection_method: null };
      }
      const raw = asRecord(response, 'detect_document_type');
      const confidence = finiteNumber(raw, 'confidence', 'detect_document_type');
      if (confidence < 0 || confidence > 1) {
        throw new ContractDecodeError('detect_document_type', 'confidence must be between 0 and 1');
      }
      return {
        matched: true,
        document_type: decodeDocumentType(raw.document_type, 'detect_document_type'),
        confidence,
        detection_method: requiredString(raw, 'detection_method', 'detect_document_type'),
      };
    },
  };
}

export type DocumentsApi = ReturnType<typeof createDocumentsApi>;
