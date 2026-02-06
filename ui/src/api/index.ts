/**
 * Fortemi API Client
 * Main entry point for all API operations
 */

import { createApiClient } from './client';
import { createNotesApi } from './notes';
import { createSearchApi } from './search';
import { createTagsApi } from './tags';
import { createExtendedApi } from './extended';
import { createAuthApi } from './auth';
import { createVersionsApi } from './versions';
import { createAttachmentsApi } from './attachments';
import { createConceptsApi } from './concepts';
import { createCollectionsApi } from './collections';
import { createTemplatesApi } from './templates';
import { createDocumentsApi } from './documents';
import { createHealthApi } from './health';
import { createMemoryApi } from './memory';
import { createBackupApi } from './backup';
import { createEmbeddingsApi } from './embeddings';
import { createLinksApi } from './links';
import { createProvenanceApi } from './provenance';
import { createEventsClient } from './events';
import { createWebhooksApi } from './webhooks';

// Export core types
export type {
  NoteMeta,
  NoteOriginal,
  NoteRevised,
  Link,
  NoteFull,
  NoteSummary,
  CreateNoteRequest,
  CreateNoteResponse,
  UpdateNoteRequest,
  SearchResult,
  SearchResponse,
  Tag,
  TagListResponse,
  TagStats,
  HealthResponse,
  SearchMode,
  SortOrder,
  NoteListOptions,
  SearchOptions,
  TagListOptions,
  SimilarNotesOptions,
  TagUpdateRequest,
} from './types';

// Export extended types
export type {
  Job,
  JobStatus,
  JobType,
  JobQueueStatus,
  QueueJobResponse,
  RelatedNotesResponse,
  UserMetadataLabel,
} from './extended';

// Export all new extended types
export type {
  TokenResponse,
  ClientRegistration,
  ClientRegistrationRequest,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  Attachment,
  AttachmentListResponse,
  AttachmentMetadata,
  ExifData,
  LocationData,
  DeviceProvenance,
  TemporalContext,
  ProcessingStatus,
  NoteVersion,
  VersionListResponse,
  VersionContentResponse,
  VersionDiff,
  ConceptScheme,
  CreateConceptSchemeRequest,
  Concept,
  CreateConceptRequest,
  ConceptFull,
  ConceptRelation,
  AddConceptRelationRequest,
  SkosCollection,
  CreateSkosCollectionRequest,
  SkosCollectionWithMembers,
  SetCollectionMembersRequest,
  ConceptGovernanceStats,
  ConceptListResponse,
  ConceptAutocompleteResponse,
  Collection,
  CreateCollectionRequest,
  CollectionWithNotes,
  MoveNoteRequest,
  Template,
  CreateTemplateRequest,
  TemplateVariable,
  InstantiateTemplateRequest,
  DocumentType,
  CreateDocumentTypeRequest,
  DetectDocumentTypeRequest,
  DetectionResult,
  DocumentTypeListResponse,
  KnowledgeHealth,
  OrphanTag,
  StaleNote,
  TagCooccurrence,
  TagCooccurrenceResponse,
  MemorySearchResult,
  MemorySearchResponse,
  LocationQuery,
  LocationSearchResponse,
  TimeRangeQuery,
  TimeRangeSearchResponse,
  CombinedSearchQuery,
  CombinedSearchResponse,
  BackupInfo,
  BackupListResponse,
  BackupMetadata,
  BackupStatus,
  KnowledgeShard,
  CreateSnapshotRequest,
  RestoreDatabaseRequest,
  SwapBackupRequest,
  EmbeddingSet,
  CreateEmbeddingSetRequest,
  EmbeddingConfig,
  AddEmbeddingSetMembersRequest,
  GraphNode,
  GraphEdge,
  GraphExploreResponse,
  NoteLinksResponse,
  ProvenanceActivity,
  ProvenanceAgent,
  ProvenanceResponse,
  MemoryInfo,
  RateLimitStatus,
} from './types-extended';

// Export error classes
export {
  ApiError,
  NetworkError,
  ValidationError,
  NotFoundError,
  isApiError,
} from './errors';

// Export factory functions
export { createApiClient } from './client';
export { createNotesApi } from './notes';
export { createSearchApi } from './search';
export { createTagsApi } from './tags';
export { createExtendedApi } from './extended';
export { createAuthApi } from './auth';
export { createVersionsApi } from './versions';
export { createAttachmentsApi } from './attachments';
export { createConceptsApi } from './concepts';
export { createCollectionsApi } from './collections';
export { createTemplatesApi } from './templates';
export { createDocumentsApi } from './documents';
export { createHealthApi } from './health';
export { createMemoryApi } from './memory';
export { createBackupApi } from './backup';
export { createEmbeddingsApi } from './embeddings';
export { createLinksApi } from './links';
export type { LinkKind, CreateLinkRequest, CreateLinkResponse } from './links';
export { createProvenanceApi } from './provenance';
export { createEventsClient } from './events';
export type { ServerEvent, EventsClient } from './events';
export { createWebhooksApi } from './webhooks';
export type {
  Webhook,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookDelivery,
  WebhooksApi,
} from './webhooks';

// Export types for the API modules
export type { ApiClient } from './client';
export type { NotesApi } from './notes';
export type { SearchApi } from './search';
export type { TagsApi } from './tags';
export type { ExtendedApi } from './extended';
export type { AuthApi } from './auth';
export type { VersionsApi } from './versions';
export type { AttachmentsApi } from './attachments';
export type { ConceptsApi } from './concepts';
export type { CollectionsApi } from './collections';
export type { TemplatesApi } from './templates';
export type { DocumentsApi } from './documents';
export type { HealthApi } from './health';
export type { MemoryApi } from './memory';
export type { BackupApi } from './backup';
export type { EmbeddingsApi } from './embeddings';
export type { LinksApi } from './links';
export type { ProvenanceApi } from './provenance';

// Export compatibility layer
export { api as compatApi } from './compat';

/**
 * Get API base URL from environment or use default
 */
function getApiBaseUrl(): string {
  // Vite environment variables
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }

  // Default to Fortemi server port (changed from 53211 to 3000)
  return 'http://localhost:3000';
}

/**
 * Create a fully configured API client instance
 */
export function createApi(baseUrl?: string) {
  const url = baseUrl || getApiBaseUrl();
  const client = createApiClient(url);

  return {
    client,
    notes: createNotesApi(client),
    search: createSearchApi(client),
    tags: createTagsApi(client),
    extended: createExtendedApi(client),
    auth: createAuthApi(client),
    versions: createVersionsApi(client),
    attachments: createAttachmentsApi(client),
    concepts: createConceptsApi(client),
    collections: createCollectionsApi(client),
    templates: createTemplatesApi(client),
    documents: createDocumentsApi(client),
    health: createHealthApi(client),
    memory: createMemoryApi(client),
    backup: createBackupApi(client),
    embeddings: createEmbeddingsApi(client),
    links: createLinksApi(client),
    provenance: createProvenanceApi(client),
    events: createEventsClient(url),
    webhooks: createWebhooksApi(client),

    /**
     * Quick health check endpoint (legacy)
     */
    async healthCheck() {
      return client.get<{
        status: string;
        version: string;
        database: string;
        ollama?: string;
      }>('/health');
    },
  };
}

/**
 * Default API instance using environment configuration
 */
export const api = createApi();

/**
 * API client type
 */
export type Api = ReturnType<typeof createApi>;
