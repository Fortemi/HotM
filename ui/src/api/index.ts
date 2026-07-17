/**
 * Fortemi API Client
 * Main entry point for all API operations
 */

import { getCachedConfig, getTauriFetch } from '@/lib/tauri';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { createApiClient, getServerRoot } from './client';
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
import { createArchivesApi } from './archives';
import { createJobsApi } from './jobs';
import { createChatApi } from './chat';
import { createInferenceApi } from './inference';
import { createIngestApi } from './ingest';
import { createMediaToolsApi } from './mediaTools';
import { createCallsApi } from './calls';
import { createSystemCompatibilityApi } from './systemCompatibility';

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
  RevisionMode,
  RegenerateAIRequest,
  RegenerateAIResponse,
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

export type {
  SystemCapability,
  SystemCapabilityState,
  SystemCompatibilityResponse,
} from './systemCompatibility';

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
  KnowledgeShardComponent,
  KnowledgeShardCounts,
  KnowledgeShardExport,
  KnowledgeShardImportResponse,
  KnowledgeShardImportResult,
  KnowledgeShardManifest,
  KnowledgeShardProducer,
  KnowledgeShardProfile,
  CreateSnapshotRequest,
  RestoreDatabaseRequest,
  SwapBackupRequest,
  EmbeddingSet,
  EmbeddingSetMode,
  EmbeddingSetCriteria,
  CreateEmbeddingSetRequest,
  UpdateEmbeddingSetRequest,
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
  MemoryArchive,
  CreateArchiveRequest,
  UpdateArchiveRequest,
  CloneArchiveRequest,
  ArchiveStatsResponse,
  FederatedSearchRequest,
  FederatedSearchHit,
  FederatedSearchResponse,
  ExtractionStatus,
  ChatRole,
  ChatMessage,
  ChatAction,
  ChatRequest,
  ChatResponse,
  ChatModelInfo,
  ChatModelsResponse,
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
export type {
  CaptureGraphDiagnosticsSnapshotRequest,
  CoarseCommunityRequest,
  ColdSpotBucket,
  ColdSpotNote,
  CreateLinkRequest,
  CreateLinkResponse,
  GraphColdSpotsResponse,
  GraphControlRequest,
  GraphControlResult,
  GraphDiagnostics,
  GraphDiagnosticsComparison,
  GraphDiagnosticsSnapshot,
  GraphMaintenanceRequest,
  GraphMaintenanceResponse,
  GraphTopologyStats,
  LinkKind,
  PfnetSparsifyRequest,
  RecomputeSnnRequest,
} from './links';
export { createProvenanceApi } from './provenance';
export { createEventsClient } from './events';
export type { ServerEvent, EventsClient } from './events';
export { createWebhooksApi } from './webhooks';
export { createArchivesApi } from './archives';
export { createJobsApi } from './jobs';
export { createChatApi } from './chat';
export { createInferenceApi } from './inference';
export { createIngestApi } from './ingest';
export { createMediaToolsApi } from './mediaTools';
export { createCallsApi } from './calls';
export type {
  IngestAckEvent,
  IngestApi,
  IngestDoneEvent,
  IngestErrorEvent,
  IngestProgressEvent,
  IngestStreamEvent,
  IngestWarningEvent,
  MintIngestTokenResponse,
  StreamIngestSummary,
} from './ingest';
export type {
  DescribeImageOptions,
  DescribeImageResponse,
  MediaToolsApi,
  TranscribeAudioOptions,
  TranscribeAudioResponse,
  TranscriptionSegment,
  TranscriptionWord,
} from './mediaTools';
export type {
  CallDetailResponse,
  CallPagination,
  CallProviderReference,
  CallQueryOptions,
  CallsApi,
  CallTranscriptSegment,
} from './calls';
export type {
  InferenceConfig,
  InferenceConfigUpdate,
  ConfigSource,
  AttributedValue,
  OllamaConfig,
  OpenAIConfig,
  ConnectionTestResult,
  ConnectionTestSuccess,
  ConnectionTestFailure,
  ConnectionTestRequest,
  ConnectionCapabilities,
  InferenceApi,
} from './inference';
export type {
  Webhook,
  IncomingWebhookReceiver,
  InboundSource,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookDelivery,
  WebhooksApi,
} from './webhooks';
export { getActiveMemory, setActiveMemory, clearActiveMemory } from './memory-context';

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
export type { HealthApi, StreamingHealthResponse } from './health';
export type { MemoryApi } from './memory';
export type { BackupApi } from './backup';
export type { EmbeddingsApi } from './embeddings';
export type { LinksApi } from './links';
export type { ProvenanceApi } from './provenance';
export type { ArchivesApi } from './archives';
export type { JobsApi, JobPauseState, JobPauseActionResponse, JobQueueStats, JobListItem } from './jobs';
export type { ChatApi } from './chat';

// Export compatibility layer
export { api as compatApi } from './compat';

/**
 * Get API base URL from environment or use default.
 *
 * Priority:
 * 1. Tauri runtime config (~/.config/com.hotm.app/config.json) — desktop only
 * 2. Docker runtime config (window.__RUNTIME_CONFIG__) — set at container start
 * 3. VITE_API_BASE_URL env var — set at build time
 * 4. http://localhost:3000 — development default
 */
function getApiBaseUrl(): string {
  // Tauri desktop config (loaded at startup, cached synchronously)
  const tauriConfig = getCachedConfig();
  if (tauriConfig?.api_base_url) {
    return tauriConfig.api_base_url;
  }

  // Docker runtime config (injected by docker-entrypoint.sh)
  const runtimeUrl = getRuntimeConfig('VITE_API_BASE_URL');
  if (runtimeUrl) {
    return runtimeUrl;
  }

  // Vite environment variables (dev server only — not set in production builds)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }

  // Fallback: same origin with /api/v1 path (works in deployed environments
  // where nginx proxies /api to Fortemi), or localhost for dev
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/v1`;
  }
  return 'http://localhost:3000/api/v1';
}

/**
 * Create a fully configured API client instance
 */
export function createApi(baseUrl?: string) {
  const url = baseUrl || getApiBaseUrl();
  const client = createApiClient(url);
  const normalizedBase = url.endsWith('/') ? url.slice(0, -1) : url;
  const serverRoot = getServerRoot(normalizedBase);

  const normalizeHealthPayload = (raw: Record<string, unknown>) => {
    const statusValue = typeof raw.status === 'string'
      ? raw.status
      : (raw.ok ? 'healthy' : 'unhealthy');
    const versionValue = typeof raw.version === 'string'
      ? raw.version
      : 'unknown';
    const databaseRaw = raw.database ?? raw.db ?? raw.postgres;
    const databaseValue = typeof databaseRaw === 'string'
      ? databaseRaw
      : (databaseRaw ? 'connected' : 'disconnected');
    const ollamaRaw = raw.ollama;
    const ollamaValue = typeof ollamaRaw === 'string'
      ? ollamaRaw
      : (ollamaRaw === undefined ? undefined : (ollamaRaw ? 'available' : 'unavailable'));

    return {
      ...raw,
      status: statusValue,
      version: versionValue,
      database: databaseValue,
      ollama: ollamaValue,
    };
  };

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
    archives: createArchivesApi(client),
    jobs: createJobsApi(client),
    chat: createChatApi(client),
    inference: createInferenceApi(client),
    ingest: createIngestApi(client),
    mediaTools: createMediaToolsApi(client),
    calls: createCallsApi(client),
    systemCompatibility: createSystemCompatibilityApi(client),

    /**
     * Quick health check endpoint (legacy)
     */
    async healthCheck() {
      // Root-level health probes use the server root (not the API base URL).
      // The API-level /health endpoint is accessed through the API base.
      const probes = [
        `${serverRoot}/health`,
        `${serverRoot}/health/live`,
        `${normalizedBase}/health`,
        `${serverRoot}/healthz`,
      ];
      let lastError: unknown;

      const httpFetch = getTauriFetch();
      for (const probeUrl of probes) {
        try {
          const response = await httpFetch(probeUrl);
          if (!response.ok) {
            throw new Error(`${probeUrl} returned ${response.status}`);
          }

          const rawBody = (await response.text()).trim();
          if (!rawBody) {
            return normalizeHealthPayload({ status: 'healthy', database: 'unknown' });
          }

          try {
            const parsed = JSON.parse(rawBody) as Record<string, unknown>;
            return normalizeHealthPayload(parsed);
          } catch {
            const body = rawBody.toLowerCase();
            const healthy = body.includes('healthy') || body === 'ok';
            return normalizeHealthPayload({
              status: healthy ? 'healthy' : 'unhealthy',
              database: 'unknown',
            });
          }
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error('Health check failed');
    },
  };
}

/**
 * Default API instance using environment configuration.
 * Mutable so it can be recreated after Tauri config loads at startup.
 */
export let api = createApi();

/**
 * Recreate the default API instance (e.g. after loading Tauri runtime config).
 */
export function reinitializeApi(baseUrl?: string) {
  api = createApi(baseUrl);
}

/**
 * API client type
 */
export type Api = ReturnType<typeof createApi>;
