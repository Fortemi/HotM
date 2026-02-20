/**
 * SSE Events API client
 * Connects to Fortemi's /api/v1/events endpoint for real-time event streaming
 * Complements the WebSocket connection with unidirectional server-sent events
 *
 * In Tauri desktop mode, uses fetch-based streaming via the HTTP plugin
 * because native EventSource cannot make cross-origin requests from
 * the tauri:// scheme in WebKit2GTK.
 */

import { isTauri, getTauriFetch } from '@/lib/tauri';

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
  [key: string]: unknown;
}

type EventHandler = (event: ServerEvent) => void;
type EventsClientStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

interface EventsClientOptions {
  onStatusChange?: (status: EventsClientStatus) => void;
}

export const DEFAULT_SSE_EVENT_TYPES = [
  'JobStarted', 'JobProgress', 'JobCompleted', 'JobFailed',
  'JobQueued', 'NoteUpdated', 'NoteCreated', 'NoteDeleted',
  'JobsPaused', 'JobsResumed',
  'QueueStatus',
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

  function getEventsUrl(): string {
    const fallbackOrigin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsedBase = new URL(baseUrl, fallbackOrigin);
    const normalizedPath = parsedBase.pathname.replace(/\/+$/, '');
    const eventsPath = normalizedPath.endsWith('/api/v1')
      ? `${normalizedPath}/events`
      : '/api/v1/events';
    const url = new URL(`${parsedBase.origin}${eventsPath}`);
    if (lastEventId) {
      url.searchParams.set('last_event_id', lastEventId);
    }
    return url.toString();
  }

  function dispatchEvent(data: ServerEvent, eventId?: string): void {
    const replayCursor = typeof data.event_id === 'string' ? data.event_id : eventId;
    if (replayCursor) {
      lastEventId = replayCursor;
      data.event_id = replayCursor;
    }
    handlers.forEach(handler => {
      try {
        handler(data);
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

  function connect(): void {
    if (isTauri()) {
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
