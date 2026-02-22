/**
 * Memory Search API client
 * Handles spatiotemporal search (location + time based queries)
 */

import type { ApiClient } from './client';
import type {
  LocationQuery,
  TimeRangeQuery,
  CombinedSearchQuery,
  MemorySearchResult,
} from './types-extended';

interface RawMemoryResult {
  note_id: string;
  attachment_id?: string | null;
  title?: string;
  snippet?: string;
  distance_meters?: number;
  capture_time?: string;
  capture_time_start?: string;
  capture_time_end?: string;
  location_name?: string | null;
  location?: { latitude?: number; longitude?: number } | null;
  device?: string;
  event_type?: string | null;
  provenance_id?: string | null;
}

function normalizeResult(raw: RawMemoryResult): MemorySearchResult {
  return {
    note_id: raw.note_id,
    attachment_id: raw.attachment_id ?? undefined,
    title: raw.title ?? '',
    snippet: raw.snippet ?? raw.location_name ?? undefined,
    distance_meters: raw.distance_meters,
    capture_time: raw.capture_time ?? raw.capture_time_start ?? undefined,
    location: raw.location && raw.location.latitude != null && raw.location.longitude != null
      ? { latitude: raw.location.latitude, longitude: raw.location.longitude }
      : undefined,
    device: raw.device,
  };
}

function extractMemoryResults(payload: unknown): MemorySearchResult[] {
  if (!payload) {
    return [];
  }
  const items: unknown[] = Array.isArray(payload)
    ? payload
    : ((payload as Record<string, unknown>).results as unknown[] | undefined) ?? [];
  return items.map((item) => normalizeResult(item as RawMemoryResult));
}

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
        radius: String(query.radius_meters),
      };

      if (query.limit !== undefined) {
        params.limit = String(query.limit);
      }

      const response = await client.get<unknown>(
        '/api/v1/memories/search',
        params
      );

      return extractMemoryResults(response);
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

      const response = await client.get<unknown>(
        '/api/v1/memories/search',
        params
      );

      return extractMemoryResults(response);
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
        radius: String(query.radius_meters),
        start: query.start,
        end: query.end,
      };

      if (query.limit !== undefined) {
        params.limit = String(query.limit);
      }

      if (query.order) {
        params.order = query.order;
      }

      const response = await client.get<unknown>(
        '/api/v1/memories/search',
        params
      );

      return extractMemoryResults(response);
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
        `/api/v1/notes/${noteId}/memory-provenance`
      );
    },
  };
}

export type MemoryApi = ReturnType<typeof createMemoryApi>;
