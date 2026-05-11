/**
 * TypeScript type definitions for Fortemi API
 * Aligned with API specification from ADR-004
 */

/**
 * Note metadata
 */
export interface NoteMeta {
  id: string;
  collection_id?: string | null;
  format: string;
  source: string;
  created_at_utc: string;
  updated_at_utc: string;
  starred?: boolean;
  archived?: boolean;
  last_accessed_at?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Original note content (immutable)
 */
export interface NoteOriginal {
  content: string;
  hash: string;
  user_created_at?: string;
  user_last_edited_at?: string;
}

/**
 * Revised note content (AI-enhanced)
 */
export interface NoteRevised {
  content: string;
  last_revision_id?: string | null;
  ai_metadata?: Record<string, unknown>;
  model?: string | null;
  ai_generated_at?: string;
  user_last_edited_at?: string | null;
  is_user_edited?: boolean;
  generation_count?: number;
}

/**
 * Note link (dynamic or external)
 */
export interface Link {
  id: string;
  from_note_id: string;
  to_note_id?: string | null;
  to_url?: string | null;
  kind: string;
  score: number;
  created_at_utc: string;
  metadata?: Record<string, unknown>;
}

/**
 * SKOS concept summary attached to a note.
 * This is distinct from flat tags and may include scoring metadata.
 */
export interface NoteConceptSummary {
  concept_id: string;
  pref_label: string;
  notation?: string;
  confidence?: number;
  relevance_score?: number;
  is_primary?: boolean;
  source?: string;
}

/**
 * Complete note with all related data
 */
export interface NoteFull {
  note: NoteMeta;
  original: NoteOriginal;
  revised: NoteRevised;
  tags: string[];
  concepts?: NoteConceptSummary[];
  links: Link[];
}

/**
 * Note summary for list views
 */
export interface NoteSummary {
  id: string;
  title: string;
  snippet: string;
  created_at_utc: string;
  updated_at_utc: string;
  starred: boolean;
  archived: boolean;
  tags: string[];
  has_revision: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Revision mode for AI enhancement pipeline.
 *
 * New modes (fortemi#494):
 *  - none:                 No AI revision
 *  - light:                Formatting cleanup only
 *  - standard:             Revision using only submitted content (default)
 *  - contextual:           Revision with cross-references from knowledge base
 *  - contextual_filtered:  Contextual revision scoped to specific tags/collections
 *
 * Legacy alias: 'full' maps to 'contextual' for backward compatibility.
 */
export type RevisionMode =
  | 'none'
  | 'light'
  | 'standard'
  | 'contextual'
  | 'contextual_filtered'
  | 'full';   // legacy alias for contextual

/**
 * Scoping filters for contextual_filtered revision mode.
 * At least one filter must be provided when using contextual_filtered.
 */
export interface ContextFilter {
  tags?: string[];
  collection_id?: string | null;
  query?: string;
}

/**
 * Pipeline processing options controlling post-submission behavior.
 */
export interface ProcessingOptions {
  autoTagConcepts: boolean;
  generateEmbeddings: boolean;
  autoLinkRelated: boolean;
  extractMedia: boolean;
  generateTitle: boolean;
}

/**
 * Request to create a new note
 */
export interface CreateNoteRequest {
  content: string;
  /**
   * Optional explicit title. When provided, the Fortemi sidecar skips the AI
   * title-generation pipeline step — the caller's value is authoritative.
   * Added in Fortemi v2026.5.6 (#675), bundled in HotM v2026.5.7+.
   */
  title?: string;
  format?: string;
  source?: string;
  revision_mode?: RevisionMode;
  document_type?: string;
  context_filter?: ContextFilter;
  processing?: Partial<ProcessingOptions>;
}

/**
 * Response from creating a note
 */
export interface CreateNoteResponse {
  note_id: string;
  status?: string;
}

/**
 * Request to trigger AI regeneration for a note.
 * Supports revision mode selection, context filtering, processing options,
 * and selective job type execution.
 */
export interface RegenerateAIRequest {
  revision_mode?: RevisionMode;
  context_filter?: ContextFilter;
  processing?: Partial<ProcessingOptions>;
  job_types?: string[];
  model?: string;
}

/**
 * Response from triggering AI regeneration.
 */
export interface RegenerateAIResponse {
  status: string;
  note_id: string;
  job_ids: string[];
}

/**
 * Request to update a note
 */
export interface UpdateNoteRequest {
  content?: string;
  starred?: boolean;
  archived?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Search result hit
 */
export interface SearchResult {
  note_id: string;
  score: number;
  snippet: string;
  /** Note title (enriched by /related endpoint) */
  title?: string;
  /** Note tags (enriched by /related endpoint) */
  tags?: string[];
  /** Note source (enriched by /related endpoint) */
  source?: string;
}

/**
 * Search response
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

/**
 * Tag with usage count
 */
export interface Tag {
  name: string;
  count: number;
}

/**
 * Tag list response
 */
export interface TagListResponse {
  tags: Tag[];
}

/**
 * Tag statistics
 */
export interface TagStats {
  total_tags: number;
  total_tagged_notes: number;
  avg_tags_per_note: number | null;
  most_used: Tag[];
  stats_available?: boolean;
  unavailable_reason?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  ok: boolean;
  db: boolean;
  database?: boolean; // v1 compat alias
  ollama?: boolean;
  vector?: boolean;
  version?: string;
}

/**
 * Search mode
 */
export type SearchMode = 'hybrid' | 'fts' | 'semantic' | 'vector';

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Note list options
 */
export interface NoteListOptions {
  sortBy?: 'created_at' | 'updated_at' | 'accessed_at';
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
  tags?: string[];
  starred?: boolean;
  archived?: boolean;
}

/**
 * Search options
 */
export interface SearchOptions {
  mode?: SearchMode;
  tags?: string[];
  concepts?: string[];
  starred?: boolean;
  archived?: boolean;
  collection?: string;
  before?: string;
  after?: string;
  filters?: string;
  limit?: number;
  offset?: number;
}

/**
 * Tag list options
 */
export interface TagListOptions {
  sortBy?: 'name' | 'count';
  minCount?: number;
}

/**
 * Similar notes options
 */
export interface SimilarNotesOptions {
  limit?: number;
  threshold?: number;
}

/**
 * Tag update request
 */
export interface TagUpdateRequest {
  add?: string[];
  remove?: string[];
}
