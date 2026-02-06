/**
 * Memory Search API client
 * Handles spatiotemporal search (location + time based queries)
 */

import type { ApiClient } from './client';
import type {
  LocationQuery,
  TimeRangeQuery,
  CombinedSearchQuery,
  LocationSearchResponse,
  TimeRangeSearchResponse,
  CombinedSearchResponse,
  MemorySearchResult,
} from './types-extended';

export function createMemoryApi(client: ApiClient) {
  return {
    /**
     * Search memories by geographic location
     * Finds notes/attachments within a radius
     */
    async searchByLocation(query: LocationQuery): Promise<MemorySearchResult[]> {
      if (query.lat === undefined || query.lon === undefined) {
        throw new Error('Latitude and longitude are required');
      }

      if (query.radius_meters === undefined || query.radius_meters <= 0) {
        throw new Error('Radius must be greater than 0');
      }

      const params: Record<string, string> = {
        lat: String(query.lat),
        lon: String(query.lon),
        radius_meters: String(query.radius_meters),
      };

      if (query.limit !== undefined) {
        params.limit = String(query.limit);
      }

      const response = await client.get<LocationSearchResponse>(
        '/api/v1/memories/search/location',
        params
      );

      return response.results;
    },

    /**
     * Search memories by time range
     * Finds notes/attachments captured within a date range
     */
    async searchByTimeRange(query: TimeRangeQuery): Promise<MemorySearchResult[]> {
      if (!query.start || !query.end) {
        throw new Error('Start and end times are required');
      }

      const params: Record<string, string> = {
        start: query.start,
        end: query.end,
      };

      if (query.limit !== undefined) {
        params.limit = String(query.limit);
      }

      if (query.order) {
        params.order = query.order;
      }

      const response = await client.get<TimeRangeSearchResponse>(
        '/api/v1/memories/search/timerange',
        params
      );

      return response.results;
    },

    /**
     * Combined location and time search
     * Finds notes/attachments matching both criteria
     */
    async searchCombined(query: CombinedSearchQuery): Promise<MemorySearchResult[]> {
      if (query.lat === undefined || query.lon === undefined) {
        throw new Error('Latitude and longitude are required');
      }

      if (query.radius_meters === undefined || query.radius_meters <= 0) {
        throw new Error('Radius must be greater than 0');
      }

      if (!query.start || !query.end) {
        throw new Error('Start and end times are required');
      }

      const params: Record<string, string> = {
        lat: String(query.lat),
        lon: String(query.lon),
        radius_meters: String(query.radius_meters),
        start: query.start,
        end: query.end,
      };

      if (query.limit !== undefined) {
        params.limit = String(query.limit);
      }

      if (query.order) {
        params.order = query.order;
      }

      const response = await client.get<CombinedSearchResponse>(
        '/api/v1/memories/search/combined',
        params
      );

      return response.results;
    },

    /**
     * Get memory provenance chain for a note
     * Returns spatial/temporal provenance data distinct from AI revision provenance
     */
    async getProvenance(noteId: string): Promise<Record<string, unknown>> {
      if (!noteId || noteId.trim() === '') {
        throw new Error('Note ID is required');
      }

      return client.get<Record<string, unknown>>(
        `/api/v1/notes/${noteId}/memories/provenance`
      );
    },
  };
}

export type MemoryApi = ReturnType<typeof createMemoryApi>;
