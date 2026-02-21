/**
 * Extended TypeScript type definitions for Fortemi API
 * Covers authentication, attachments, versions, SKOS, and advanced features
 */

// ===========================
// OAuth2 & Authentication
// ===========================

/**
 * OAuth2 token response
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * OAuth2 client registration request
 */
export interface ClientRegistrationRequest {
  client_name: string;
  grant_types: string[];
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
}

/**
 * OAuth2 client registration response
 */
export interface ClientRegistration {
  client_id: string;
  client_secret: string;
  client_name: string;
  grant_types: string[];
  redirect_uris?: string[];
  client_id_issued_at: number;
  client_secret_expires_at: number;
}

/**
 * API key
 */
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
}

/**
 * Create API key request
 */
export interface CreateApiKeyRequest {
  name: string;
  expires_at?: string;
}

/**
 * Create API key response (includes full key only once)
 */
export interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string;
  created_at: string;
  expires_at?: string;
}

// ===========================
// File Attachments
// ===========================

/**
 * Attachment processing status from the API
 */
export type AttachmentStatus = 'uploaded' | 'processing' | 'completed' | 'failed';

/**
 * File attachment
 */
export interface Attachment {
  id: string;
  note_id: string;
  filename: string;
  original_filename?: string;
  content_type: string;
  size_bytes: number;
  /** Pipeline processing status (authoritative - use this for status display) */
  status: AttachmentStatus;
  /** Extraction strategy used by pipeline (e.g. 'video_multimodal', 'audio_transcribe') */
  extraction_strategy?: string | null;
  created_at: string;
  updated_at?: string;
  storage_path?: string;
  blob_id?: string;
  has_exif?: boolean;
  has_location?: boolean;
  has_preview?: boolean;
  is_canonical_content?: boolean;
  /** AI-generated description (vision models for images/3D) */
  ai_description?: string | null;
  /** Model used to generate ai_description */
  ai_model?: string | null;
  /** Extracted text content (transcript, OCR, PDF text, code) */
  extracted_text?: string | null;
  /** Structured metadata from extraction pipeline */
  extracted_metadata?: Record<string, unknown> | null;
}

/**
 * Extraction status inferred from attachment fields
 */
export type ExtractionStatus = 'pending' | 'complete' | 'failed' | 'none';

/**
 * List attachments response
 */
export interface AttachmentListResponse {
  attachments: Attachment[];
}

/**
 * EXIF metadata from images
 */
export interface ExifData {
  camera_make?: string;
  camera_model?: string;
  capture_time?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_altitude?: number;
  orientation?: number;
  iso?: number;
  focal_length?: string;
  exposure_time?: string;
  f_number?: number;
}

/**
 * Geographic location data
 */
export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  source?: string;
}

/**
 * Device provenance
 */
export interface DeviceProvenance {
  device_id?: string;
  device_name?: string;
  manufacturer?: string;
  model?: string;
  os?: string;
  os_version?: string;
  software?: string;
}

/**
 * Temporal context
 */
export interface TemporalContext {
  capture_time: string;
  timezone?: string;
  local_time?: string;
}

/**
 * Processing status
 */
export interface ProcessingStatus {
  ocr_completed?: boolean;
  thumbnail_generated?: boolean;
  embedding_generated?: boolean;
}

/**
 * Complete attachment metadata
 */
export interface AttachmentMetadata {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: AttachmentStatus;
  extraction_strategy?: string | null;
  created_at: string;
  updated_at?: string;
  exif?: ExifData;
  provenance?: DeviceProvenance & { location?: LocationData };
  processing?: ProcessingStatus;
  ai_description?: string | null;
  ai_model?: string | null;
  extracted_text?: string | null;
  extracted_metadata?: Record<string, unknown> | null;
}

// ===========================
// Note Versioning
// ===========================

/**
 * Note version entry
 */
export interface NoteVersion {
  version: number;
  created_at: string;
  change_summary?: string;
  content_hash: string;
}

/**
 * List versions response
 */
export interface VersionListResponse {
  versions: NoteVersion[];
}

/**
 * Version content response
 */
export interface VersionContentResponse {
  version: number;
  content: string;
  created_at: string;
}

/**
 * Version diff response
 */
export interface VersionDiff {
  from_version: number;
  to_version: number;
  diff: string;
}

// ===========================
// SKOS Concepts
// ===========================

/**
 * SKOS concept scheme (vocabulary)
 */
export interface ConceptScheme {
  id: string;
  title: string;
  description?: string;
  namespace?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create concept scheme request
 */
export interface CreateConceptSchemeRequest {
  title: string;
  description?: string;
  namespace?: string;
}

/**
 * SKOS concept
 */
export interface Concept {
  id: string;
  concept_id?: string;
  scheme_id: string;
  pref_label: string;
  alt_labels?: string[];
  definition?: string;
  notation?: string;
  confidence?: number;
  relevance_score?: number;
  is_primary?: boolean;
  source?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create concept request
 */
export interface CreateConceptRequest {
  scheme_id: string;
  pref_label: string;
  alt_labels?: string[];
  definition?: string;
  notation?: string;
}

/**
 * Full concept with relationships
 */
export interface ConceptFull extends Concept {
  broader: Concept[];
  narrower: Concept[];
  related: Concept[];
  usage_count?: number;
}

/**
 * Concept relationship
 */
export interface ConceptRelation {
  concept_id: string;
  related_id: string;
  relation_type: 'broader' | 'narrower' | 'related';
}

/**
 * Add relationship request
 */
export interface AddConceptRelationRequest {
  broader_id?: string;
  narrower_id?: string;
  related_id?: string;
}

/**
 * SKOS collection
 */
export interface SkosCollection {
  id: string;
  scheme_id: string;
  label: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create SKOS collection request
 */
export interface CreateSkosCollectionRequest {
  scheme_id: string;
  label: string;
  description?: string;
}

/**
 * SKOS collection with members
 */
export interface SkosCollectionWithMembers extends SkosCollection {
  members: Concept[];
}

/**
 * Set collection members request
 */
export interface SetCollectionMembersRequest {
  concept_ids: string[];
}

/**
 * Concept governance statistics
 */
export interface ConceptGovernanceStats {
  total_schemes: number;
  total_concepts: number;
  concepts_with_definitions: number;
  concepts_in_use: number;
  avg_hierarchy_depth: number;
  orphan_concepts: number;
}

/**
 * List concepts response
 */
export interface ConceptListResponse {
  concepts: Concept[];
  total?: number;
}

/**
 * Autocomplete response
 */
export interface ConceptAutocompleteResponse {
  suggestions: Array<{
    id: string;
    pref_label: string;
    scheme_id: string;
  }>;
}

// ===========================
// Collections (Note Folders)
// ===========================

/**
 * Note collection (folder)
 */
export interface Collection {
  id: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create collection request
 */
export interface CreateCollectionRequest {
  name: string;
  description?: string;
  parent_id?: string | null;
}

/**
 * Collection with notes
 */
export interface CollectionWithNotes extends Collection {
  note_count: number;
}

/**
 * Move note to collection request
 */
export interface MoveNoteRequest {
  collection_id: string | null;
}

// ===========================
// Templates
// ===========================

/**
 * Note template
 */
export interface Template {
  id: string;
  name: string;
  content: string;
  default_tags?: string[];
  variables?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Create template request
 */
export interface CreateTemplateRequest {
  name: string;
  content: string;
  default_tags?: string[];
}

/**
 * Template variables for instantiation
 */
export interface TemplateVariable {
  name: string;
  value: string;
}

/**
 * Instantiate template request
 */
export interface InstantiateTemplateRequest {
  variables: Record<string, string>;
}

// ===========================
// Document Types
// ===========================

/**
 * Document type definition
 */
export interface DocumentType {
  name: string;
  display_name: string;
  category: string;
  description?: string;
  file_extensions?: string[];
  filename_patterns?: string[];
  content_magic?: string[];
  chunking_strategy: string;
  syntax_language?: string | null;
  embedding_model_hint?: string | null;
  is_system: boolean;
  created_at: string;
}

/**
 * Create document type request
 */
export interface CreateDocumentTypeRequest {
  name: string;
  display_name: string;
  category: string;
  description?: string;
  file_extensions?: string[];
  filename_patterns?: string[];
  content_magic?: string[];
  chunking_strategy: string;
  syntax_language?: string | null;
  embedding_model_hint?: string | null;
}

/**
 * Document type detection request
 */
export interface DetectDocumentTypeRequest {
  filename?: string;
  content?: string;
}

/**
 * Document type detection result
 */
export interface DetectionResult {
  document_type: string;
  confidence: number;
  detection_method: string;
  category: string;
  chunking_strategy: string;
  alternatives?: Array<{
    document_type: string;
    confidence: number;
    detection_method: string;
  }>;
}

/**
 * List document types response
 */
export interface DocumentTypeListResponse {
  document_types: DocumentType[];
}

// ===========================
// Knowledge Health
// ===========================

/**
 * Overall knowledge base health metrics
 */
export interface KnowledgeHealth {
  total_notes: number;
  orphan_notes: number;
  stale_notes: number;
  unlinked_notes: number;
  avg_links_per_note: number;
  tag_coverage: number;
  last_activity: string;
}

/**
 * Orphan tag (defined but unused)
 */
export interface OrphanTag {
  name: string;
  last_used?: string;
}

/**
 * Stale note (not updated in N days)
 */
export interface StaleNote {
  note_id: string;
  title: string;
  last_updated: string;
  days_since_update: number;
}

/**
 * Tag co-occurrence pair
 */
export interface TagCooccurrence {
  tag_a: string;
  tag_b: string;
  count: number;
  correlation: number;
}

/**
 * Tag co-occurrence response
 */
export interface TagCooccurrenceResponse {
  pairs: TagCooccurrence[];
  cooccurrence_pairs?: TagCooccurrence[];
}

// ===========================
// Memory Search (Spatiotemporal)
// ===========================

/**
 * Memory search result
 */
export interface MemorySearchResult {
  note_id: string;
  attachment_id?: string;
  title: string;
  distance_meters?: number;
  capture_time?: string;
  location?: LocationData;
  device?: string;
  snippet?: string;
}

/**
 * Memory search response
 */
export interface MemorySearchResponse {
  results: MemorySearchResult[];
  total: number;
}

/**
 * Location search query
 */
export interface LocationQuery {
  lat: number;
  lon: number;
  radius_meters: number;
  radius?: number;
  limit?: number;
}

/**
 * Location search response
 */
export interface LocationSearchResponse extends MemorySearchResponse {
  center: {
    latitude: number;
    longitude: number;
  };
  radius_meters: number;
}

/**
 * Time range query
 */
export interface TimeRangeQuery {
  start: string;
  end: string;
  limit?: number;
  order?: 'asc' | 'desc';
}

/**
 * Time range search response
 */
export interface TimeRangeSearchResponse extends MemorySearchResponse {
  time_range: {
    start: string;
    end: string;
  };
}

/**
 * Combined location and time search
 */
export interface CombinedSearchQuery extends LocationQuery, Omit<TimeRangeQuery, 'order'> {
  order?: 'distance' | 'time' | 'asc' | 'desc';
}

/**
 * Combined search response
 */
export interface CombinedSearchResponse extends MemorySearchResponse {
  search_criteria: {
    center: {
      latitude: number;
      longitude: number;
    };
    radius_meters: number;
    time_range: {
      start: string;
      end: string;
    };
  };
}

// ===========================
// Backup & Export
// ===========================

/**
 * Backup file information
 */
export interface BackupInfo {
  filename: string;
  size_bytes: number;
  created_at: string;
  type: 'database' | 'knowledge-shard' | 'archive';
  label?: string;
  description?: string;
  tags?: string[];
}

/**
 * List backups response
 */
export interface BackupListResponse {
  backups: BackupInfo[];
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  label?: string;
  description?: string;
  tags?: string[];
}

/**
 * Backup status
 */
export interface BackupStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  last_backup?: string;
  last_backup_size?: number;
  error?: string;
}

/**
 * Knowledge shard export (application-level)
 */
export interface KnowledgeShard {
  version: string;
  exported_at: string;
  notes: unknown[];
  concepts: unknown[];
  collections: unknown[];
  metadata: Record<string, unknown>;
}

/**
 * Create snapshot request
 */
export interface CreateSnapshotRequest {
  label: string;
}

/**
 * Restore database request
 */
export interface RestoreDatabaseRequest {
  filename: string;
}

/**
 * Swap backup request
 */
export interface SwapBackupRequest {
  backup_filename: string;
}

// ===========================
// Archives / Multi-Memory
// ===========================

export interface MemoryArchive {
  id: string;
  name: string;
  schema_name: string;
  description?: string;
  created_at: string;
  last_accessed?: string;
  note_count?: number;
  size_bytes?: number;
  is_default: boolean;
  schema_version: number;
}

export interface CreateArchiveRequest {
  name: string;
  description?: string;
}

export interface UpdateArchiveRequest {
  description?: string;
}

export interface CloneArchiveRequest {
  new_name: string;
  description?: string;
}

export interface ArchiveStatsResponse {
  name: string;
  note_count: number;
  size_bytes: number;
  schema_name: string;
}

export interface FederatedSearchRequest {
  q: string;
  memories: string[];
  limit?: number;
}

export interface FederatedSearchHit {
  note_id: string;
  score: number;
  snippet?: string;
  title?: string;
  tags: string[];
  memory: string;
}

export interface FederatedSearchResponse {
  results: FederatedSearchHit[];
  query: string;
  total: number;
  memories_searched: string[];
}

// ===========================
// Embedding Sets
// ===========================

/**
 * Embedding set (isolated vector space)
 */
export interface EmbeddingSet {
  slug: string;
  name: string;
  embedding_config_id: string;
  created_at: string;
  updated_at: string;
  note_count?: number;
}

/**
 * Create embedding set request
 */
export interface CreateEmbeddingSetRequest {
  slug: string;
  name: string;
  embedding_config_id: string;
}

/**
 * Embedding configuration
 */
export interface EmbeddingConfig {
  id: string;
  name: string;
  model: string;
  dimensions: number;
  is_default: boolean;
  created_at: string;
}

/**
 * Add embedding set members request
 */
export interface AddEmbeddingSetMembersRequest {
  note_ids: string[];
}

// ===========================
// Links & Graph Exploration
// ===========================

/**
 * Graph node (v1 payload — enriched with community, tags, concepts)
 */
export interface GraphNode {
  id: string;
  title: string;
  depth: number;
  // v1 enriched fields (populated by backend, may be absent on legacy payloads)
  collection_id?: string | null;
  tags?: string[];
  concepts?: string[];
  archived?: boolean;
  created_at_utc?: string;
  updated_at_utc?: string;
  community_id?: number | null;
  community_label?: string | null;
  community_confidence?: number | null;
}

/**
 * Edge provenance metadata (v1)
 */
export interface GraphEdgeMetadata {
  normalized_weight?: number;
  embedding_set?: string;
  model?: string;
  computed_at?: string;
  snn_score?: number | null;
}

/**
 * Graph edge (v1 payload — supports both legacy from/to and new source/target)
 */
export interface GraphEdge {
  // v1 fields
  source?: string;
  target?: string;
  edge_type?: 'semantic' | 'explicit';
  rank?: number;
  metadata?: GraphEdgeMetadata;
  // Legacy fields (served during transition alongside source/target)
  from?: string;
  to?: string;
  // Common
  score: number;
}

/**
 * Graph response metadata (v1)
 */
export interface GraphMeta {
  returned_nodes?: number;
  returned_edges?: number;
  total_candidate_nodes?: number;
  total_candidate_edges?: number;
  truncated_nodes?: boolean;
  truncated_edges?: boolean;
}

/**
 * Graph exploration response (v1 with backward compatibility)
 */
export interface GraphExploreResponse {
  graph_version?: string;
  generated_at?: string;
  root_note_id?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta?: GraphMeta;
}

/**
 * Note links response (bidirectional)
 */
export interface NoteLinksResponse {
  outgoing: Array<{
    to_note_id: string;
    score: number;
    kind: string;
  }>;
  incoming: Array<{
    from_note_id: string;
    score: number;
    kind: string;
  }>;
}

// ===========================
// Provenance Tracking
// ===========================

/**
 * W3C PROV activity
 */
export interface ProvenanceActivity {
  activity: string;
  agent: string;
  timestamp: string;
  inputs?: string[];
  outputs?: string[];
  parameters?: Record<string, unknown>;
  location?: LocationData;
  device?: DeviceProvenance;
  temporal_context?: TemporalContext;
}

/**
 * Provenance agent
 */
export interface ProvenanceAgent {
  agent: string;
  type: 'human' | 'software' | 'device';
}

/**
 * Note provenance response
 */
export interface ProvenanceResponse {
  note_id: string;
  created_at: string;
  provenance: ProvenanceActivity[];
  attachments?: Array<{
    attachment_id: string;
    filename: string;
    capture_time?: string;
    location?: LocationData;
  }>;
}

// ===========================
// System & Rate Limiting
// ===========================

/**
 * Memory info response
 */
export interface MemoryInfo {
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  percent_used: number;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset_at: string;
  retry_after_seconds?: number;
}
