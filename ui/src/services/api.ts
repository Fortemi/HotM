/**
 * Legacy API Service for Hall of the Mind
 *
 * DEPRECATED: This file is maintained for backward compatibility.
 * New code should import from '@/api' or '@/api/compat' directly.
 *
 * This re-exports the new API client to maintain compatibility with
 * existing components during migration.
 */

// Re-export everything from the compatibility layer
export { api } from '@/api/compat';

// Re-export types for backward compatibility
export type {
  NoteFull,
  SearchHit,
  UserMetadataLabel,
  NoteSummary,
  Job,
  JobQueueStatus,
  QueueJobResponse,
  JobType,
  JobStatus,
  RelatedNotesResponse,
  HealthResponse,
} from '@/api/compat';

// Additional types that may be used by components
export type { CreateNoteResponse, SearchResult } from '@/api/types';
