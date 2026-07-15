import type { ApiClient } from './client';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';
import { getHostAdapter, getTauriFetch } from '@/lib/tauri';

export interface MintIngestTokenRequest {
  rateLimit?: number;
}

export interface MintIngestTokenResponse {
  token: string;
  token_id: string;
  rate_limit: number;
  expires_in: number;
}

export interface IngestAckEvent {
  event: 'ack';
  line: number;
  status: 'ok' | 'error';
  cursor: string;
  note_id?: string;
  error?: string;
}

export interface IngestProgressEvent {
  event: 'progress';
  processed: number;
}

export interface IngestDoneEvent {
  event: 'done';
  total: number;
  success: number;
  errors: number;
}

export interface IngestWarningEvent {
  event: 'warning';
  message?: string;
  advisory_rate?: number;
}

export interface IngestErrorEvent {
  event: 'error';
  status?: number;
  title?: string;
  detail?: string;
  error?: string;
  code?: string;
  retry_after_ms?: number;
}

export type IngestStreamEvent =
  | IngestAckEvent
  | IngestProgressEvent
  | IngestDoneEvent
  | IngestWarningEvent
  | IngestErrorEvent
  | {
      event: 'unknown';
      name: string;
      data: unknown;
    };

export interface StreamIngestOptions {
  token: string;
  cursor?: string;
  onEvent?: (event: IngestStreamEvent) => void;
}

export interface StreamIngestSummary {
  total: number;
  success: number;
  errors: number;
  lastCursor?: string;
  events: IngestStreamEvent[];
}

function buildTokenParams(request: MintIngestTokenRequest = {}): Record<string, string> | undefined {
  if (request.rateLimit === undefined) {
    return undefined;
  }
  return { rate_limit: String(request.rateLimit) };
}

function getMemoryHeaders(): Record<string, string> {
  const activeMemory = getActiveMemory();
  if (!activeMemory) {
    return {};
  }
  return { [getMemoryRoutingHeaderName()]: activeMemory };
}

function normalizeSseEvent(event: string, data: unknown): IngestStreamEvent {
  const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};

  if (event === 'ack') {
    return {
      event,
      line: Number(payload.line ?? 0),
      status: payload.status === 'ok' ? 'ok' : 'error',
      cursor: String(payload.cursor ?? ''),
      note_id: typeof payload.note_id === 'string' ? payload.note_id : undefined,
      error: typeof payload.error === 'string' ? payload.error : undefined,
    };
  }

  if (event === 'progress') {
    return {
      event,
      processed: Number(payload.processed ?? 0),
    };
  }

  if (event === 'done') {
    return {
      event,
      total: Number(payload.total ?? 0),
      success: Number(payload.success ?? 0),
      errors: Number(payload.errors ?? 0),
    };
  }

  if (event === 'warning') {
    return {
      event,
      message: typeof payload.message === 'string' ? payload.message : undefined,
      advisory_rate: typeof payload.advisory_rate === 'number' ? payload.advisory_rate : undefined,
    };
  }

  if (event === 'error') {
    return {
      event,
      status: typeof payload.status === 'number' ? payload.status : undefined,
      title: typeof payload.title === 'string' ? payload.title : undefined,
      detail: typeof payload.detail === 'string' ? payload.detail : undefined,
      error: typeof payload.error === 'string' ? payload.error : undefined,
      code: typeof payload.code === 'string' ? payload.code : undefined,
      retry_after_ms: typeof payload.retry_after_ms === 'number' ? payload.retry_after_ms : undefined,
    };
  }

  return { event: 'unknown', name: event, data };
}

export function parseIngestSseFrame(frame: string): IngestStreamEvent | null {
  const lines = frame.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).replace(/^ /, '');

    if (field === 'event') {
      event = value || 'message';
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join('\n');
  let parsed: unknown = rawData;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    // Preserve non-JSON payloads for forward compatibility.
  }

  return normalizeSseEvent(event, parsed);
}

export function parseIngestSseChunk(
  chunk: string,
  carry = '',
): { events: IngestStreamEvent[]; carry: string } {
  const combined = carry + chunk;
  const parts = combined.split(/\r?\n\r?\n/);
  const nextCarry = parts.pop() ?? '';
  const events = parts
    .map((frame) => parseIngestSseFrame(frame))
    .filter((event): event is IngestStreamEvent => event !== null);

  return { events, carry: nextCarry };
}

async function readIngestEventStream(
  response: Response,
  onEvent?: (event: IngestStreamEvent) => void,
): Promise<StreamIngestSummary> {
  if (!response.body) {
    throw new Error('Ingest stream response body is not readable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: IngestStreamEvent[] = [];
  let carry = '';
  let lastCursor: string | undefined;
  let done: IngestDoneEvent | undefined;

  const record = (event: IngestStreamEvent | null) => {
    if (!event) {
      return;
    }
    events.push(event);
    onEvent?.(event);
    if (event.event === 'ack' && event.cursor) {
      lastCursor = event.cursor;
    }
    if (event.event === 'done') {
      done = event;
    }
  };

  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) {
      break;
    }
    const parsed = parseIngestSseChunk(decoder.decode(value, { stream: true }), carry);
    carry = parsed.carry;
    parsed.events.forEach(record);
  }

  const finalParsed = parseIngestSseChunk(decoder.decode(), carry);
  finalParsed.events.forEach(record);
  record(finalParsed.carry ? parseIngestSseFrame(finalParsed.carry) : null);

  return {
    total: done?.total ?? events.filter((event) => event.event === 'ack').length,
    success: done?.success ?? events.filter((event) => event.event === 'ack' && event.status === 'ok').length,
    errors: done?.errors ?? events.filter((event) => event.event === 'ack' && event.status === 'error').length,
    lastCursor,
    events,
  };
}

export function createIngestApi(client: ApiClient) {
  return {
    async mintToken(request: MintIngestTokenRequest = {}): Promise<MintIngestTokenResponse> {
      return client.post<MintIngestTokenResponse>(
        '/ingest/tokens',
        undefined,
        undefined,
        buildTokenParams(request),
      );
    },

    async revokeToken(tokenId: string): Promise<void> {
      if (!tokenId || tokenId.trim() === '') {
        throw new Error('Ingest token id is required');
      }
      await client.delete<void>(`/ingest/tokens/${encodeURIComponent(tokenId)}`);
    },

    async streamNotes(file: File, options: StreamIngestOptions): Promise<StreamIngestSummary> {
      if (!file) {
        throw new Error('NDJSON ingest file is required');
      }
      if (!options.token || options.token.trim() === '') {
        throw new Error('Ingest stream token is required');
      }

      const headers: Record<string, string> = {
        ...getMemoryHeaders(),
        Accept: 'text/event-stream',
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/x-ndjson',
      };
      if (options.cursor) {
        headers['X-Ingest-Cursor'] = options.cursor;
      }

      const httpFetch = getHostAdapter() ? globalThis.fetch : getTauriFetch();
      const response = await httpFetch(`${client.baseUrl}/ingest/stream`, {
        method: 'POST',
        headers,
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Ingest stream failed: ${response.status} ${response.statusText}`);
      }

      return readIngestEventStream(response, options.onEvent);
    },
  };
}

export type IngestApi = ReturnType<typeof createIngestApi>;
