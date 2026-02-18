/**
 * SSE Events API client
 * Connects to Fortemi's /api/v1/events endpoint for real-time event streaming
 * Complements the WebSocket connection with unidirectional server-sent events
 */

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
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  const handlers = new Set<EventHandler>();
  let isClosing = false;
  let lastEventId: string | null = null;

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

  function connect(): void {
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
          const replayCursor = typeof data.event_id === 'string' ? data.event_id : event.lastEventId;
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
        } catch {
          // Ignore non-JSON messages (keepalive etc.)
        }
      };

      // Listen for typed events from Fortemi
      const eventTypes = DEFAULT_SSE_EVENT_TYPES;

      for (const eventType of eventTypes) {
        eventSource.addEventListener(eventType, (event: MessageEvent) => {
          try {
            const data: ServerEvent = JSON.parse(event.data);
            data.type = eventType;
            const replayCursor = typeof data.event_id === 'string' ? data.event_id : event.lastEventId;
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
          } catch {
            // Ignore parse errors
          }
        });
      }

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;

        if (!isClosing && handlers.size > 0) {
          notifyStatus('reconnecting');
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 5000);
        } else {
          notifyStatus('closed');
        }
      };
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      notifyStatus('closed');
    }
  }

  return {
    subscribe(handler: EventHandler): () => void {
      handlers.add(handler);

      if (!eventSource && !isClosing) {
        connect();
      }

      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          setTimeout(() => {
            if (handlers.size === 0) {
              isClosing = true;
              eventSource?.close();
              eventSource = null;
              if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
              }
              isClosing = false;
              notifyStatus('closed');
            }
          }, 100);
        }
      };
    },

    close(): void {
      isClosing = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      eventSource?.close();
      eventSource = null;
      notifyStatus('closed');
    },

    get connected(): boolean {
      return eventSource?.readyState === EventSource.OPEN;
    },
    get replayCursor(): string | null {
      return lastEventId;
    },
  };
}

export type EventsClient = ReturnType<typeof createEventsClient>;
