/**
 * Call session API client.
 *
 * Fortemi returns redaction-conscious call metadata and paginated final
 * transcript segments. Realtime provider WebSocket diagnostics are intentionally
 * not exposed by this REST client.
 */

import type { ApiClient } from './client';

export interface CallQueryOptions {
  limit?: number;
  offset?: number;
}

export interface CallProviderReference {
  provider_call_id_present?: boolean;
  provider_call_id_len?: number | null;
  [key: string]: unknown;
}

export interface CallTranscriptWord {
  word: string;
  start_secs: number;
  end_secs: number;
  confidence?: number | null;
}

export interface CallTranscriptSegment {
  start_secs: number;
  end_secs: number;
  text: string;
  speaker_id?: string | null;
  words?: CallTranscriptWord[] | null;
}

export interface CallPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface CallDetailResponse {
  call_id: string;
  provider: string;
  provider_call: CallProviderReference;
  started_at: string;
  ended_at?: string | null;
  end_reason?: string | null;
  duration_secs?: number | null;
  asr_backend_len?: number | null;
  remote_party_present: boolean;
  remote_party_len?: number | null;
  archive_id?: string | null;
  metadata_class: string;
  metadata_len: number;
  segment_count: number;
  segments: CallTranscriptSegment[];
  pagination: CallPagination;
}

function buildQuery(options?: CallQueryOptions): Record<string, string> | undefined {
  const query: Record<string, string> = {};
  if (options?.limit !== undefined) query.limit = String(options.limit);
  if (options?.offset !== undefined) query.offset = String(options.offset);
  return Object.keys(query).length > 0 ? query : undefined;
}

export function createCallsApi(client: ApiClient) {
  return {
    async getCall(callId: string, options?: CallQueryOptions): Promise<CallDetailResponse> {
      if (!callId || callId.trim() === '') {
        throw new Error('Call ID is required');
      }

      return client.get<CallDetailResponse>(
        `/calls/${encodeURIComponent(callId)}`,
        buildQuery(options),
      );
    },
  };
}

export type CallsApi = ReturnType<typeof createCallsApi>;
