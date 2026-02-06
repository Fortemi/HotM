/**
 * SSE Events API client
 * Connects to Fortemi's /api/v1/events endpoint for real-time event streaming
 * Complements the WebSocket connection with unidirectional server-sent events
 */

export interface ServerEvent {
  type: string;
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

export function createEventsClient(baseUrl: string) {
  let eventSource: EventSource | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  const handlers = new Set<EventHandler>();
  let isClosing = false;

  function getEventsUrl(): string {
    const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${normalized}/api/v1/events`;
  }

  function connect(): void {
    if (isClosing || eventSource) return;

    try {
      eventSource = new EventSource(getEventsUrl());

      eventSource.onopen = () => {
        isClosing = false;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: ServerEvent = JSON.parse(event.data);
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
      const eventTypes = [
        'JobStarted', 'JobProgress', 'JobCompleted', 'JobFailed',
        'JobQueued', 'NoteUpdated', 'NoteCreated', 'NoteDeleted',
        'QueueStatus',
      ];

      for (const eventType of eventTypes) {
        eventSource.addEventListener(eventType, (event: MessageEvent) => {
          try {
            const data: ServerEvent = JSON.parse(event.data);
            data.type = eventType;
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
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    } catch (err) {
      console.error('Failed to create EventSource:', err);
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
    },

    get connected(): boolean {
      return eventSource?.readyState === EventSource.OPEN;
    },
  };
}

export type EventsClient = ReturnType<typeof createEventsClient>;
