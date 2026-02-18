// Shared WebSocket service for job queue updates
import { useEffect, useState } from 'react';
import { createEventsClient, type ServerEvent, DEFAULT_SSE_EVENT_TYPES } from '@/api/events';
import { realtimeEventBus, type RealtimeEvent } from '@/services/realtimeEventBus';

export interface WsActiveJob {
  job_id: string;
  job_type: string;
  progress_percent: number;
  message?: string;
  started_at?: string;
}

export interface WsMessage extends RealtimeEvent {
  active_job?: WsActiveJob;
}

export interface QueueStatus {
  total_jobs: number;
  running: number;
  pending: number;
}

export type RealtimeTransportMode = 'none' | 'ws' | 'sse';
export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'stale';
export interface UseWebSocketState {
  connected: boolean;
  connectionState?: RealtimeConnectionState;
  transportMode?: RealtimeTransportMode;
  replayCursor?: string | null;
  subscribedEventTypes?: string[];
  queueStatus: QueueStatus;
  queueStatusAgeMs: number;
  isQueueStalled: boolean;
  sendMessage: (message: string) => void;
}

const QUEUE_STALE_THRESHOLD_MS = 5 * 60 * 1000;

type MessageHandler = (message: WsMessage) => void;
type ConnectionHandler = (connected: boolean) => void;
type ConnectionStateHandler = (state: RealtimeConnectionState) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private eventsClient: ReturnType<typeof createEventsClient> | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private handlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private connectionStateHandlers: Set<ConnectionStateHandler> = new Set();
  private connectionPromise: Promise<void> | null = null;
  private isClosing = false;
  private isDisabled = false;
  private transportMode: RealtimeTransportMode = 'none';
  private connectionState: RealtimeConnectionState = 'disconnected';

  constructor() {
    // Check if WebSocket is disabled via environment variable
    this.isDisabled = import.meta.env.VITE_DISABLE_WEBSOCKET === 'true';
    if (this.isDisabled) {
      console.log('WebSocket disabled via VITE_DISABLE_WEBSOCKET');
    }

    realtimeEventBus.subscribe((event) => {
      this.broadcastMessage(event);
    });
  }

  private notifyConnection(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Connection handler error:', error);
      }
    });
  }

  private notifyConnectionState(state: RealtimeConnectionState): void {
    this.connectionState = state;
    this.connectionStateHandlers.forEach((handler) => {
      try {
        handler(state);
      } catch (error) {
        console.error('Connection state handler error:', error);
      }
    });
  }

  private getApiBaseUrl(): string {
    const fallbackBase =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';
    return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || fallbackBase;
  }

  private buildWebSocketUrl(): string {
    const fallbackBase =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';
    const apiBase = this.getApiBaseUrl();

    const parsed = new URL(apiBase, fallbackBase);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss' : 'ws';

    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    const wsPath = normalizedPath.endsWith('/api/v1')
      ? `${normalizedPath}/ws`
      : '/api/v1/ws';

    return `${wsProtocol}://${parsed.host}${wsPath}`;
  }

  private broadcastMessage(message: WsMessage): void {
    this.handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Handler error:', error);
      }
    });
  }

  private startSseFallback(): void {
    if (this.isClosing || this.handlers.size === 0) {
      return;
    }
    if (this.unsubscribeEvents) {
      return;
    }

    try {
      this.eventsClient = createEventsClient(this.getApiBaseUrl(), {
        onStatusChange: (status) => {
          if (status === 'reconnecting') {
            this.isConnected = false;
            this.notifyConnection(false);
            this.notifyConnectionState('reconnecting');
          } else if (status === 'connected') {
            this.isConnected = true;
            this.notifyConnection(true);
            this.notifyConnectionState('degraded');
          } else if (status === 'closed' && !this.isClosing && this.handlers.size > 0) {
            this.isConnected = false;
            this.notifyConnection(false);
            this.notifyConnectionState('reconnecting');
          }
        },
      });
      this.unsubscribeEvents = this.eventsClient.subscribe((event) => {
        if (!this.isConnected) {
          this.isConnected = true;
          this.notifyConnection(true);
        }
        this.transportMode = 'sse';
        this.notifyConnectionState('degraded');
        realtimeEventBus.publishFromTransport(event);
      });

      console.log('Falling back to SSE real-time events');
    } catch (error) {
      console.error('Failed to initialize SSE fallback:', error);
      this.isConnected = false;
      this.transportMode = 'none';
      this.notifyConnection(false);
      this.notifyConnectionState('disconnected');
    }
  }

  private stopSseFallback(): void {
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents();
      this.unsubscribeEvents = null;
    }
    if (this.eventsClient) {
      this.eventsClient.close();
      this.eventsClient = null;
    }
  }

  private connect(): Promise<void> {
    // If WebSocket is disabled, don't attempt connection
    if (this.isDisabled) {
      this.notifyConnectionState('disconnected');
      return Promise.resolve();
    }

    // If we're in the process of closing, don't create new connections
    if (this.isClosing) {
      return Promise.reject(new Error('Service is closing'));
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If we already have a connected WebSocket, return immediately
    if (this.ws && this.isConnected) {
      return Promise.resolve();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.notifyConnectionState('connecting');
        // Clear any existing connection
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        // Clear any existing timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }

        // Build WebSocket URL from API base URL.
        // Supports base URLs like:
        // - https://memory.integrolabs.net
        // - https://memory.integrolabs.net/api/v1
        // - relative/default origin fallbacks
        const wsUrl = this.buildWebSocketUrl();
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Shared WebSocket connected');
          this.stopSseFallback();
          this.isConnected = true;
          this.transportMode = 'ws';
          this.notifyConnection(true);
          this.notifyConnectionState('connected');
          this.isClosing = false;
          this.connectionPromise = null;
          this.ws?.send('refresh');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ServerEvent = JSON.parse(event.data);
            realtimeEventBus.publishFromTransport(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Shared WebSocket error:', error);
          this.isConnected = false;
          this.transportMode = 'none';
          this.notifyConnection(false);
          this.connectionPromise = null;
          this.startSseFallback();
          
          // Don't reject immediately - let onclose handle it
          // This prevents double error handling
        };

        this.ws.onclose = (event) => {
          console.log('Shared WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.transportMode = 'none';
          this.notifyConnection(false);
          this.connectionPromise = null;
          this.startSseFallback();
          
          // If we were in the process of closing, don't reconnect
          if (this.isClosing) {
            return;
          }
          
          // Only reconnect if it wasn't a manual close (code 1000) and we have active handlers
          if (event.code !== 1000 && this.handlers.size > 0) {
            this.notifyConnectionState('reconnecting');
            this.reconnectTimeout = setTimeout(() => {
              console.log('Shared WebSocket attempting to reconnect...');
              this.connect().catch(console.error);
            }, 3000);
          } else if (event.code === 1000) {
            this.notifyConnectionState('disconnected');
          }
          
          // If this was an error during connection, reject the promise
          if (event.code !== 1000) {
            reject(new Error(`WebSocket closed with code ${event.code}: ${event.reason}`));
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.isConnected = false;
        this.transportMode = 'none';
        this.notifyConnection(false);
        this.connectionPromise = null;
        this.notifyConnectionState('disconnected');
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  public subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    
    // Ensure connection is established only if we have handlers and not closing
    if (!this.isConnected && !this.isClosing && this.handlers.size > 0) {
      this.connect().catch(error => {
        console.error('Failed to establish WebSocket connection:', error);
      });
    }

    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler);
      
      // Use setTimeout to delay closing - this helps with React StrictMode
      // where components unmount and remount quickly
      setTimeout(() => {
        if (this.handlers.size === 0 && !this.isClosing) {
          this.close();
        }
      }, 100);
    };
  }

  public send(message: string): void {
    if (this.ws && this.isConnected) {
      this.ws.send(message);
    }
  }

  public close(): void {
    this.isClosing = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Service closing');
      this.ws = null;
    }
    this.stopSseFallback();
    
    this.isConnected = false;
    this.transportMode = 'none';
    this.notifyConnection(false);
    this.notifyConnectionState('disconnected');
    this.connectionPromise = null;
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public subscribeConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    handler(this.isConnected);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  public subscribeConnectionState(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler);
    handler(this.connectionState);
    return () => {
      this.connectionStateHandlers.delete(handler);
    };
  }

  public getTransportMode(): RealtimeTransportMode {
    return this.transportMode;
  }

  public getConnectionState(): RealtimeConnectionState {
    return this.connectionState;
  }

  public getReplayCursor(): string | null {
    return this.eventsClient?.replayCursor ?? null;
  }

  public getSubscribedEventTypes(): string[] {
    return [...DEFAULT_SSE_EVENT_TYPES];
  }

  // Reset the closing state - useful for development mode
  public reset(): void {
    this.isClosing = false;
  }
}

// Singleton instance
const webSocketService = new WebSocketService();

// In development mode, add some debugging
if (import.meta.env.DEV) {
  (window as any).__webSocketService = webSocketService;
}

// Hook for React components
export function useWebSocket(): UseWebSocketState {
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('disconnected');
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    total_jobs: 0,
    running: 0,
    pending: 0,
  });
  const [lastQueueUpdateAt, setLastQueueUpdateAt] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  const markQueueUpdated = () => {
    setLastQueueUpdateAt(Date.now());
  };

  useEffect(() => {
    // Reset the service state in case we're in development mode
    webSocketService.reset();

    let isSubscribed = true;
    
    const unsubscribeConnection = webSocketService.subscribeConnection((status) => {
      if (!isSubscribed) return;
      setConnected(status);
    });
    const unsubscribeConnectionState = webSocketService.subscribeConnectionState((status) => {
      if (!isSubscribed) return;
      setConnectionState(status);
    });

    const unsubscribe = webSocketService.subscribe((message) => {
      if (!isSubscribed) return; // Prevent updates after unmount

      // Handle queue status messages
      switch (message.type) {
        case 'QueueStatus':
          markQueueUpdated();
          setQueueStatus({
            total_jobs: message.total_jobs || 0,
            running: message.running || 0,
            pending: message.pending || 0,
          });
          break;
          
        case 'JobQueued':
          markQueueUpdated();
          setQueueStatus(prev => ({
            ...prev,
            pending: prev.pending + 1,
            total_jobs: prev.total_jobs + 1,
          }));
          break;
          
        case 'JobStarted':
          markQueueUpdated();
          setQueueStatus(prev => ({
            ...prev,
            pending: Math.max(0, prev.pending - 1),
            running: prev.running + 1,
          }));
          break;
          
        case 'JobCompleted':
        case 'JobFailed':
          markQueueUpdated();
          setQueueStatus(prev => ({
            ...prev,
            running: Math.max(0, prev.running - 1),
            total_jobs: Math.max(0, prev.total_jobs - 1),
          }));
          break;
      }
    });

    // Initial connection status
    setConnected(webSocketService.getConnectionStatus());

    return () => {
      isSubscribed = false;
      unsubscribeConnection();
      unsubscribeConnectionState();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  const sendMessage = (message: string) => {
    webSocketService.send(message);
  };

  const queueStatusAgeMs = now - lastQueueUpdateAt;
  const isQueueStalled =
    connected &&
    queueStatus.running > 0 &&
    queueStatusAgeMs >= QUEUE_STALE_THRESHOLD_MS;

  const effectiveConnectionState: RealtimeConnectionState =
    isQueueStalled && connected ? 'stale' : connectionState;

  return {
    connected,
    connectionState: effectiveConnectionState,
    transportMode: webSocketService.getTransportMode(),
    replayCursor: webSocketService.getReplayCursor(),
    subscribedEventTypes: webSocketService.getSubscribedEventTypes(),
    queueStatus,
    queueStatusAgeMs,
    isQueueStalled,
    sendMessage,
  };
}

export default webSocketService;
