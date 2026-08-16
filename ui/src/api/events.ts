/**
 * SSE Events API client
 * Connects to Fortemi's events endpoint for real-time event streaming
 * Complements the WebSocket connection with unidirectional server-sent events
 *
 * In Tauri desktop mode, uses fetch-based streaming via the HTTP plugin
 * because native EventSource cannot make cross-origin requests from
 * the tauri:// scheme in WebKit2GTK.
 */

import { isTauri, getTauriFetch, getHostAdapter } from '@/lib/tauri';

export interface EventActor {
  kind: string;
  id?: string;
  name?: string;
}

export interface ServerEvent {
  type: string;
  event_type?: string;
  payload_type?: string;
  event_id?: string;
  job_id?: string;
  note_id?: string;
  job_type?: string;
  progress_percent?: number;
  message?: string;
  error?: string;
  duration_ms?: number;
  title?: string;
  tags?: string[];
  // Envelope metadata (SSE EventEnvelope format)
  actor?: EventActor | string;
  memory?: string;
  tenant_id?: string;
  entity_type?: string;
  entity_id?: string;
  correlation_id?: string;
  causation_id?: string;
  occurred_at?: string;
  payload_version?: number;
  [key: string]: unknown;
}

type EventHandler = (event: ServerEvent) => void;
type EventsClientStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

export interface EventsClientOptions {
  onStatusChange?: (status: EventsClientStatus) => void;
  /** Optional explicit server-side filter. Omit to consume all producer events. */
  typePrefixes?: string[];
  authorization?: string | null;
  memory?: string | null;
  tenantId?: string | null;
  preferFetch?: boolean;
}

export function eventMatchesRealtimeContext(
  event: ServerEvent,
  context: Pick<EventsClientOptions, 'memory' | 'tenantId'>,
): boolean {
  const systemEvent = [
    'resync_required',
    'events.lagged',
    'queue.status',
    'ResyncRequired',
    'EventsLagged',
    'QueueStatus',
  ].includes(event.type);
  if (systemEvent) return true;
  if (context.memory && event.memory !== context.memory) return false;
  if (context.tenantId && event.tenant_id !== context.tenantId) return false;
  return true;
}

/** Default type prefixes that cover all events the UI currently handles */
export const DEFAULT_SSE_TYPE_PREFIXES = [
  'note', 'job', 'jobs', 'queue', 'collection', 'tag', 'concept',
  'concept_scheme', 'archive', 'attachment', 'events', 'resync_required',
  'index', 'readmodel', 'inference',
] as const;

/** Exact names emitted by Fortemi's EventEnvelope catalog. */
export const FORTEMI_SSE_EVENT_TYPES = [
  'queue.status',
  'job.queued', 'job.started', 'job.progress', 'job.completed', 'job.failed',
  'note.updated', 'note.created', 'note.deleted', 'note.archived', 'note.restored',
  'note.tags.updated', 'note.links.updated', 'note.revision.created',
  'attachment.created', 'attachment.deleted', 'attachment.extraction.updated',
  'collection.created', 'collection.updated', 'collection.deleted',
  'collection.membership.changed',
  'archive.created', 'archive.updated', 'archive.deleted', 'archive.default.changed',
  'concept_scheme.created', 'concept_scheme.updated', 'concept_scheme.deleted',
  'concept.created', 'concept.updated', 'concept.deleted',
  'concept.relations.updated', 'concept.scheme.changed',
  'concept.collection.membership.changed',
  'tag.created', 'tag.renamed', 'tag.deleted', 'tag.merged', 'tag.stats.updated',
  'jobs.paused', 'jobs.resumed',
  'index.embedding.updated', 'index.linking.updated', 'index.fts.updated',
  'readmodel.graph.updated', 'readmodel.search.ready',
  'inference.config.changed', 'inference.availability.changed',
] as const;

export const DEFAULT_SSE_EVENT_TYPES = [
  ...FORTEMI_SSE_EVENT_TYPES,
  // Transport-level events emitted by the SSE endpoint.
  'resync_required', 'events.lagged',
] as const;

export function unwrapServerEventEnvelope(data: Record<string, unknown>): ServerEvent {
  const payload = data.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const payloadObj = payload as Record<string, unknown>;
    const legacyMetadata = data.metadata;
    const legacyMetadataObj = (
      legacyMetadata
      && typeof legacyMetadata === 'object'
      && !Array.isArray(legacyMetadata)
    )
      ? legacyMetadata as Record<string, unknown>
      : {};

    return {
      ...payloadObj,
      // The envelope/SSE event name is authoritative over the legacy payload tag.
      type: (
        data.event_type
        ?? data.type
        ?? payloadObj.type
        ?? ''
      ) as string,
      event_type: data.event_type as string | undefined,
      payload_type: payloadObj.type as string | undefined,
      event_id: (data.event_id ?? payloadObj.event_id) as string | undefined,
      occurred_at: (data.occurred_at ?? legacyMetadataObj.occurred_at) as string | undefined,
      memory: (data.memory ?? legacyMetadataObj.memory) as string | undefined,
      tenant_id: (data.tenant_id ?? legacyMetadataObj.tenant_id) as string | undefined,
      actor: (data.actor ?? legacyMetadataObj.actor) as EventActor | string | undefined,
      entity_type: (data.entity_type ?? legacyMetadataObj.entity_type) as string | undefined,
      entity_id: (data.entity_id ?? legacyMetadataObj.entity_id) as string | undefined,
      correlation_id: (
        data.correlation_id
        ?? legacyMetadataObj.correlation_id
      ) as string | undefined,
      causation_id: (data.causation_id ?? legacyMetadataObj.causation_id) as string | undefined,
      payload_version: data.payload_version as number | undefined,
    };
  }

  if (!data.type && typeof data.event_type === 'string') {
    return { ...data, type: data.event_type } as ServerEvent;
  }
  return data as ServerEvent;
}

export function createEventsClient(baseUrl: string, options: EventsClientOptions = {}) {
  let eventSource: EventSource | null = null;
  let fetchAbort: AbortController | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  const handlers = new Set<EventHandler>();
  let isClosing = false;
  let lastEventId: string | null = null;
  let isFetchConnected = false;
  let fetchReconnectAttempts = 0;

  const notifyStatus = (status: EventsClientStatus) => {
    try {
      options.onStatusChange?.(status);
    } catch (error) {
      console.error('SSE status handler error:', error);
    }
  };

  const typePrefixes = options.typePrefixes;

  function getEventsUrl(): string {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = new URL(`${normalizedBase}/events`);
    if (typePrefixes && typePrefixes.length > 0) {
      url.searchParams.set('types', typePrefixes.join(','));
    }
    return url.toString();
  }

  function getRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (options.authorization) headers.Authorization = options.authorization;
    if (options.memory) headers['X-Fortemi-Memory'] = options.memory;
    if (lastEventId) headers['Last-Event-ID'] = lastEventId;
    return headers;
  }

  function matchesContext(event: ServerEvent): boolean {
    return eventMatchesRealtimeContext(event, options);
  }

  function dispatchEvent(data: ServerEvent, eventId?: string): void {
    const unwrapped = unwrapServerEventEnvelope(data as Record<string, unknown>);
    const replayCursor = typeof unwrapped.event_id === 'string' ? unwrapped.event_id : eventId;
    if (replayCursor) {
      lastEventId = replayCursor;
      unwrapped.event_id = replayCursor;
    }
    if (!matchesContext(unwrapped)) return;
    handlers.forEach(handler => {
      try {
        handler(unwrapped);
      } catch (err) {
        console.error('SSE handler error:', err);
      }
    });
  }

  /**
   * Fetch-based SSE for Tauri desktop mode.
   * Uses getTauriFetch() which routes through the Rust HTTP plugin,
   * bypassing WebKit2GTK cross-origin restrictions.
   */
  async function connectFetch(): Promise<void> {
    if (isClosing || fetchAbort) return;

    try {
      notifyStatus('connecting');
      fetchAbort = new AbortController();
      const httpFetch = getTauriFetch();
      const url = getEventsUrl();

      const response = await httpFetch(url, {
        headers: getRequestHeaders(),
        signal: fetchAbort.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE endpoint returned ${response.status}`);
      }

      if (!response.body) {
        throw new Error('SSE response has no body stream');
      }

      isFetchConnected = true;
      fetchReconnectAttempts = 0; // Reset backoff on successful connect
      notifyStatus('connected');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';
      let currentData = '';
      let currentId = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done || isClosing) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep incomplete last line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line === '') {
            // Empty line = end of event
            if (currentData) {
              try {
                const parsed: ServerEvent = JSON.parse(currentData);
                if (currentEventType) {
                  parsed.type = currentEventType;
                }
                dispatchEvent(parsed, currentId);
              } catch {
                // Ignore non-JSON (keepalive etc.)
              }
            }
            currentEventType = '';
            currentData = '';
            currentId = '';
          } else if (line.startsWith('data:')) {
            const dataValue = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
            currentData += (currentData ? '\n' : '') + dataValue;
          } else if (line.startsWith('event:')) {
            currentEventType = line.startsWith('event: ') ? line.slice(7) : line.slice(6);
          } else if (line.startsWith('id:')) {
            currentId = line.startsWith('id: ') ? line.slice(4) : line.slice(3);
          }
          // Ignore retry: and comment lines (starting with :)
        }
      }
    } catch (err) {
      if (fetchAbort?.signal.aborted) {
        // Intentional abort
        return;
      }
      console.error('SSE fetch connection failed');
    } finally {
      isFetchConnected = false;
      fetchAbort = null;
    }

    // Reconnect if not intentionally closing (exponential backoff: 1s, 2s, 4s, 8s, max 15s)
    if (!isClosing && handlers.size > 0) {
      notifyStatus('reconnecting');
      const delay = Math.min(1000 * Math.pow(2, fetchReconnectAttempts), 15000);
      fetchReconnectAttempts++;
      reconnectTimeout = setTimeout(() => {
        connectFetch();
      }, delay);
    } else {
      notifyStatus('closed');
    }
  }

  /**
   * Native EventSource for web/browser mode.
   */
  function connectNative(): void {
    if (isClosing || eventSource) return;

    try {
      if (options.authorization || options.tenantId) {
        throw new Error('Native EventSource is unavailable for authenticated realtime sessions.');
      }
      notifyStatus('connecting');
      const url = new URL(getEventsUrl());
      if (options.memory) url.searchParams.set('memory', options.memory);
      eventSource = new EventSource(url.toString());

      eventSource.onopen = () => {
        isClosing = false;
        notifyStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data: ServerEvent = JSON.parse(event.data);
          dispatchEvent(data, event.lastEventId);
        } catch {
          // Ignore non-JSON messages (keepalive etc.)
        }
      };

      // Listen for typed events from Fortemi
      for (const eventType of DEFAULT_SSE_EVENT_TYPES) {
        eventSource.addEventListener(eventType, (event: MessageEvent) => {
          try {
            const data: ServerEvent = JSON.parse(event.data);
            data.type = eventType;
            dispatchEvent(data, event.lastEventId);
          } catch {
            // Ignore parse errors
          }
        });
      }

      eventSource.onerror = () => {
        // EventSource fires onerror during auto-reconnection attempts.
        // Don't close — let the browser handle reconnection natively.
        if (eventSource?.readyState === EventSource.CLOSED) {
          // Server permanently closed the connection; manual reconnect needed
          eventSource = null;
          if (!isClosing && handlers.size > 0) {
            notifyStatus('reconnecting');
            reconnectTimeout = setTimeout(() => {
              connectNative();
            }, 2000);
          } else {
            notifyStatus('closed');
          }
        } else if (eventSource?.readyState === EventSource.CONNECTING) {
          // Browser is auto-reconnecting — just update status
          notifyStatus('reconnecting');
        }
      };
    } catch (err) {
      console.error('SSE EventSource connection failed');
      notifyStatus('closed');
    }
  }

  /**
   * Host-adapter SSE for embedding shells that publish a __HOTM_HOST__
   * adapter (see lib/tauri.ts → HotmHostAdapter, docs/host-adapter.md).
   *
   * Listens for forwarded SSE events via postMessage rather than reading
   * a synthetic ReadableStream response. Some webviews (Linux WebKit2GTK
   * in particular) cannot reliably read from synthetic streams produced
   * by the plugin-http SSE shim, so this direct path is preferred when
   * an adapter is available.
   */
  async function connectHostProxy(): Promise<void> {
    if (isClosing || fetchAbort) return;

    const adapter = getHostAdapter();
    if (!adapter) {
      console.error('SSE host adapter missing, falling back to fetch');
      return connectFetch();
    }

    try {
      notifyStatus('connecting');
      fetchAbort = new AbortController();
      const url = getEventsUrl();
      const result = await adapter.network.sse.connect({ url, headers: getRequestHeaders() });
      const handle = result.handle;

      isFetchConnected = true;
      fetchReconnectAttempts = 0;
      notifyStatus('connected');

      // Await forwarded SSE events via postMessage.
      await new Promise<void>((resolve) => {
        function onMsg(ev: MessageEvent) {
          const d = ev.data as
            | {
                __hotm_host_event?: boolean;
                event?: string;
                handle?: string;
                payload?: { type?: string; id?: string; data?: string };
              }
            | undefined;
          if (!d) return;
          const isEvent = d.__hotm_host_event;
          if (!isEvent || d.event !== 'network.sse' || d.handle !== handle) return;
          const p = d.payload;
          if (!p) return;
          if (p.type === '__close' || p.type === '__error') {
            window.removeEventListener('message', onMsg);
            resolve();
            return;
          }
          if (p.data) {
            try {
              const parsed: ServerEvent = JSON.parse(p.data);
              if (p.type && p.type !== 'message') {
                parsed.type = p.type;
              }
              dispatchEvent(parsed, p.id);
            } catch {
              // Non-JSON — ignore (keepalive etc.)
            }
          }
        }
        window.addEventListener('message', onMsg);

        fetchAbort!.signal.addEventListener('abort', () => {
          window.removeEventListener('message', onMsg);
          adapter.network.sse.close?.({ handle }).catch(() => { /* best effort */ });
          resolve();
        });
      });
    } catch (err) {
      if (fetchAbort?.signal.aborted) return;
      console.error('SSE host adapter connection failed');
    } finally {
      isFetchConnected = false;
      fetchAbort = null;
    }

    if (!isClosing && handlers.size > 0) {
      notifyStatus('reconnecting');
      const delay = Math.min(1000 * Math.pow(2, fetchReconnectAttempts), 15000);
      fetchReconnectAttempts++;
      reconnectTimeout = setTimeout(() => {
        connectHostProxy();
      }, delay);
    } else {
      notifyStatus('closed');
    }
  }

  function connect(): void {
    // Prefer the direct host-adapter path when an embedding shell provides
    // one — avoids the synthetic-ReadableStream pitfall on Linux WebKit2GTK.
    if (options.authorization && !options.tenantId) {
      console.error('SSE authenticated context is missing a tenant binding');
      notifyStatus('closed');
    } else if (getHostAdapter()) {
      connectHostProxy();
    } else if (isTauri() || options.preferFetch) {
      connectFetch();
    } else {
      connectNative();
    }
  }

  function closeConnection(): void {
    isClosing = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    // Close native EventSource
    eventSource?.close();
    eventSource = null;
    // Abort fetch-based SSE
    fetchAbort?.abort();
    fetchAbort = null;
    isFetchConnected = false;
    notifyStatus('closed');
  }

  return {
    subscribe(handler: EventHandler): () => void {
      handlers.add(handler);

      if (!eventSource && !fetchAbort && !isClosing) {
        connect();
      }

      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          setTimeout(() => {
            if (handlers.size === 0) {
              closeConnection();
              isClosing = false;
            }
          }, 100);
        }
      };
    },

    close(): void {
      closeConnection();
    },

    get connected(): boolean {
      return isFetchConnected || eventSource?.readyState === EventSource.OPEN;
    },
    get replayCursor(): string | null {
      return lastEventId;
    },
  };
}

export type EventsClient = ReturnType<typeof createEventsClient>;
