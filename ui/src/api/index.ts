/**
 * matric-memory API Client
 * Main entry point for all API operations
 */

import { createApiClient } from './client';
import { createNotesApi } from './notes';
import { createSearchApi } from './search';
import { createTagsApi } from './tags';
import { createExtendedApi } from './extended';

// Export types
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

// Export types for the API modules
export type { ApiClient } from './client';
export type { NotesApi } from './notes';
export type { SearchApi } from './search';
export type { TagsApi } from './tags';
export type { ExtendedApi } from './extended';

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

  // Default to HotM server port
  return 'http://localhost:53211';
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

    /**
     * Health check endpoint
     */
    async health() {
      return client.get<{
        ok: boolean;
        database: boolean;
        ollama?: boolean;
        vector?: boolean;
      }>('/api/v1/health');
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
