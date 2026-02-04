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
}

/**
 * Original note content (immutable)
 */
export interface NoteOriginal {
  content: string;
  hash: string;
}

/**
 * Revised note content (AI-enhanced)
 */
export interface NoteRevised {
  content: string;
  last_revision_id?: string | null;
  ai_metadata?: Record<string, unknown>;
  model?: string | null;
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
 * Complete note with all related data
 */
export interface NoteFull {
  note: NoteMeta;
  original: NoteOriginal;
  revised: NoteRevised;
  tags: string[];
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
 * Request to create a new note
 */
export interface CreateNoteRequest {
  content: string;
  format?: string;
  source?: string;
}

/**
 * Response from creating a note
 */
export interface CreateNoteResponse {
  note_id: string;
}

/**
 * Request to update a note
 */
export interface UpdateNoteRequest {
  content?: string;
  starred?: boolean;
  archived?: boolean;
}

/**
 * Search result hit
 */
export interface SearchResult {
  note_id: string;
  score: number;
  snippet: string;
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
  avg_tags_per_note: number;
  most_used: Tag[];
}

/**
 * Health check response
 */
export interface HealthResponse {
  ok: boolean;
  database: boolean;
  ollama?: boolean;
  vector?: boolean;
}

/**
 * Search mode
 */
export type SearchMode = 'hybrid' | 'fts' | 'semantic';

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
  starred?: boolean;
  archived?: boolean;
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
