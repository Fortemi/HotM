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

export interface ServerEvent {
  type: string;
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
  actor?: string;
  memory?: string;
  correlation_id?: string;
  occurred_at?: string;
  [key: string]: unknown;
}

type EventHandler = (event: ServerEvent) => void;
type EventsClientStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

interface EventsClientOptions {
  onStatusChange?: (status: EventsClientStatus) => void;
  /** SSE type prefixes for server-side filtering (e.g., ['note', 'job', 'queue']) */
  typePrefixes?: string[];
}

/** Default type prefixes that cover all events the UI currently handles */
export const DEFAULT_SSE_TYPE_PREFIXES = [
  'note', 'job', 'jobs', 'queue', 'collection', 'tag', 'concept',
  'archive', 'attachment', 'events', 'resync_required',
  'index', 'readmodel',
] as const;

export const DEFAULT_SSE_EVENT_TYPES = [
  // PascalCase (WebSocket legacy format)
  'JobStarted', 'JobProgress', 'JobCompleted', 'JobFailed',
  'JobQueued', 'NoteUpdated', 'NoteCreated', 'NoteDeleted',
  'JobsPaused', 'JobsResumed',
  'QueueStatus',
  // Dot-notation (SSE EventEnvelope format)
  'job.started', 'job.progress', 'job.completed', 'job.failed',
  'job.queued', 'note.updated', 'note.created', 'note.deleted',
  'jobs.paused', 'jobs.resumed',
  'queue.status',
  // SKOS concept events
  'concept.created', 'concept.updated', 'concept.deleted',
  'concept.scheme.created', 'concept.scheme.updated', 'concept.scheme.deleted',
  'concept.relations.updated', 'concept.scheme.changed',
  'concept.collection.membership.changed',
  // Tag governance events
  'tag.created', 'tag.renamed', 'tag.deleted', 'tag.merged', 'tag.stats.updated',
  // Search/index materialization events
  'index.embedding.updated', 'index.linking.updated', 'index.fts.updated',
  'readmodel.search.ready', 'readmodel.graph.updated',
  // Note lifecycle events (NLP pipeline)
  'note.tags.updated', 'note.links.updated', 'note.revision.created',
  // Attachment extraction
  'attachment.extraction.updated',
  // Synthetic SSE events (client resilience)
  'resync_required', 'events.lagged',
  // Inference config events (Fortemi #654/#657 — InferenceConfigChanged + InferenceAvailabilityChanged)
  'inference.config.changed', 'inference.availability.changed',
] as const;

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

  const typePrefixes = options.typePrefixes ?? [...DEFAULT_SSE_TYPE_PREFIXES];

  function getEventsUrl(): string {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = new URL(`${normalizedBase}/events`);
    if (lastEventId) {
      url.searchParams.set('last_event_id', lastEventId);
    }
    if (typePrefixes.length > 0) {
      url.searchParams.set('types', typePrefixes.join(','));
    }
    return url.toString();
  }

  function unwrapEnvelope(data: Record<string, unknown>): ServerEvent {
    const payload = data.payload;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const payloadObj = payload as Record<string, unknown>;
      const metadata = data.metadata;
      const metadataObj = (metadata && typeof metadata === 'object' && !Array.isArray(metadata))
        ? metadata as Record<string, unknown>
        : {};

      return {
        ...payloadObj,
        // Preserve type from outer data if payload doesn't have one
        type: (payloadObj.type as string) ?? (data.type as string) ?? '',
        // Preserve event_id from either level
        event_id: (payloadObj.event_id as string) ?? (data.event_id as string),
        // Flatten envelope metadata
        actor: metadataObj.actor as string | undefined,
        memory: metadataObj.memory as string | undefined,
        correlation_id: metadataObj.correlation_id as string | undefined,
        occurred_at: metadataObj.occurred_at as string | undefined,
      } as ServerEvent;
    }
    return data as ServerEvent;
  }

  function dispatchEvent(data: ServerEvent, eventId?: string): void {
    const unwrapped = unwrapEnvelope(data as Record<string, unknown>);
    const replayCursor = typeof unwrapped.event_id === 'string' ? unwrapped.event_id : eventId;
    if (replayCursor) {
      lastEventId = replayCursor;
      unwrapped.event_id = replayCursor;
    }
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

      console.log('SSE fetch connecting to:', url);
      const response = await httpFetch(url, {
        headers: { 'Accept': 'text/event-stream' },
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
      console.error('SSE fetch error:', err);
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
      notifyStatus('connecting');
      eventSource = new EventSource(getEventsUrl());

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
      console.error('Failed to create EventSource:', err);
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
      console.log('SSE host adapter connecting to:', url);

      const result = await adapter.network.sse.connect({ url });
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
      console.error('SSE host adapter error:', err);
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
    if (getHostAdapter()) {
      connectHostProxy();
    } else if (isTauri()) {
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
      if (isTauri()) {
        return isFetchConnected;
      }
      return eventSource?.readyState === EventSource.OPEN;
    },
    get replayCursor(): string | null {
      return lastEventId;
    },
  };
}

export type EventsClient = ReturnType<typeof createEventsClient>;
