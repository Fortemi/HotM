// Shared realtime service — SSE primary transport, WS for commands
import { useEffect, useState } from 'react';
import { createEventsClient, type EventsClientOptions, type ServerEvent, DEFAULT_SSE_EVENT_TYPES } from '@/api/events';
import { realtimeEventBus, type RealtimeEvent } from '@/services/realtimeEventBus';
import { getCachedConfig } from '@/lib/tauri';
import { getRuntimeConfig, normalizeBrowserApiBaseUrl } from '@/lib/runtime-config';
import {
  getActiveTenantId,
  getApiBearerToken,
} from '@/api/auth-context';
import { getActiveMemory } from '@/api/memory-context';
import { getDataApiEndpoint, subscribeDataContextChanges } from '@/api/data-context';
import { resolveRealtimeArchive } from '@/api/realtime-context';
import { ApiError, ContractDecodeError } from '@/api/errors';
import { api } from '@/api';

export interface WsActiveJob {
  job_id: string;
  job_type: string;
  progress_percent: number;
  message?: string;
  started_at?: string;
  step_name?: string;
  steps_total?: number;
  step_current?: number;
  duration_ms?: number;
}

export type ResyncReason = 'resync_required' | 'events_lagged';
type ResyncHandler = (reason: ResyncReason, droppedCount?: number) => void;

export interface WsMessage extends RealtimeEvent {
  active_job?: WsActiveJob;
}

export interface QueueStatus {
  total_jobs: number;
  running: number;
  pending: number;
}

export type RealtimeTransportMode = 'none' | 'ws' | 'sse';
export type RealtimeConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'reconnecting'
  | 'stale'
  | 'auth-required'
  | 'incompatible';
export interface UseWebSocketState {
  connected: boolean;
  connectionState?: RealtimeConnectionState;
  transportMode?: RealtimeTransportMode;
  replayCursor?: string | null;
  subscribedEventTypes?: string[];
  queueStatus: QueueStatus;
  queueStatusAgeMs: number;
  isQueueStalled: boolean;
  lastResyncAt?: number;
  sendMessage: (message: string) => void;
}

const QUEUE_STALE_THRESHOLD_MS = 5 * 60 * 1000;

type MessageHandler = (message: WsMessage) => void;
type ConnectionHandler = (connected: boolean) => void;
type ConnectionStateHandler = (state: RealtimeConnectionState) => void;

export interface LegacyWebSocketContext {
  authorization: string | null;
  memory: string | null;
  tenantId: string | null;
  anonymousLocalAdvertised: boolean;
}

export function canUseLegacyWebSocket(context: LegacyWebSocketContext): boolean {
  return context.anonymousLocalAdvertised
    && !context.authorization
    && !context.memory
    && !context.tenantId;
}

export type LegacyWebSocketCloseClassification = 'normal' | 'incompatible' | 'transport-failure';

export function classifyLegacyWebSocketClose(
  event: Pick<CloseEvent, 'code' | 'reason'>,
): LegacyWebSocketCloseClassification {
  if (event.code === 1000) return 'normal';
  if (event.code === 410 || /\b410\b|gone/i.test(event.reason)) return 'incompatible';
  return 'transport-failure';
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private eventsClient: ReturnType<typeof createEventsClient> | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private sseConnected = false;
  private handlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private connectionStateHandlers: Set<ConnectionStateHandler> = new Set();
  private connectionPromise: Promise<void> | null = null;
  private isClosing = false;
  private isDisabled = false;
  private transportMode: RealtimeTransportMode = 'none';
  private connectionState: RealtimeConnectionState = 'disconnected';
  private resyncHandlers: Set<ResyncHandler> = new Set();
  private lastResyncAt: number | null = null;
  private anonymousLocalAdvertised = false;
  private contextGeneration = 0;
  private unsubscribeContext: (() => void) | null = null;
  private readonly contextChanged = () => {
    if (this.isClosing || this.handlers.size === 0) return;
    this.close();
    this.reset();
    this.listenForContextChanges();
    void this.connect().catch(() => console.error('Realtime context reconnect failed'));
  };

  private listenForContextChanges(): void {
    if (this.unsubscribeContext || typeof window === 'undefined') return;
    this.unsubscribeContext = subscribeDataContextChanges(this.contextChanged);
  }

  constructor() {
    // Check if WebSocket is disabled via environment variable
    this.isDisabled = import.meta.env.VITE_DISABLE_WEBSOCKET === 'true';
    if (this.isDisabled) {
      console.log('WebSocket disabled via VITE_DISABLE_WEBSOCKET');
    }

    realtimeEventBus.subscribe((event) => {
      // Handle synthetic SSE events for client resilience
      if (event.type === 'ResyncRequired') {
        console.warn('SSE resync_required: replay buffer expired, triggering full state refresh');
        this.lastResyncAt = Date.now();
        this.notifyResync('resync_required');
        // Trigger refresh via WS if available
        this.send('refresh');
      } else if (event.type === 'EventsLagged') {
        const dropped = event.dropped_count;
        console.warn(`SSE events.lagged: ${dropped ?? 'unknown'} events dropped, client was too slow`);
        this.lastResyncAt = Date.now();
        this.notifyResync('events_lagged', dropped);
        // Trigger refresh to recover from dropped events
        this.send('refresh');
      }
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
    const activeEndpoint = getDataApiEndpoint();
    if (activeEndpoint) return activeEndpoint;
    // Tauri desktop config (loaded at startup, cached synchronously)
    const tauriConfig = getCachedConfig();
    if (tauriConfig?.api_base_url) {
      return normalizeBrowserApiBaseUrl(tauriConfig.api_base_url);
    }

    // Docker runtime config (injected by docker-entrypoint.sh)
    const runtimeUrl = getRuntimeConfig('VITE_API_BASE_URL');
    if (runtimeUrl) {
      return normalizeBrowserApiBaseUrl(runtimeUrl);
    }

    const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    if (envUrl) {
      return normalizeBrowserApiBaseUrl(envUrl);
    }

    const fallbackBase =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/api/v1`
        : 'http://localhost:3000/api/v1';
    return fallbackBase;
  }

  private buildWebSocketUrl(): string | null {
    if (!canUseLegacyWebSocket({
      authorization: getApiBearerToken(),
      memory: getActiveMemory(),
      tenantId: getActiveTenantId(),
      anonymousLocalAdvertised: this.anonymousLocalAdvertised,
    })) {
      return null;
    }
    const fallbackBase =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';
    const apiBase = this.getApiBaseUrl();

    const parsed = new URL(apiBase, fallbackBase);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss' : 'ws';

    const normalizedPath = parsed.pathname.replace(/\/+$/, '');

    return `${wsProtocol}://${parsed.host}${normalizedPath}/ws`;
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

  private startSseTransport(context: EventsClientOptions, current: () => boolean): void {
    if (this.isClosing || this.handlers.size === 0) {
      return;
    }
    if (this.unsubscribeEvents) {
      return;
    }

    try {
      this.eventsClient = createEventsClient(this.getApiBaseUrl(), {
        ...context,
        preferFetch: true,
        onStatusChange: (status) => {
          if (!current()) return;
          if (status === 'reconnecting') {
            this.sseConnected = false;
            // Only mark disconnected if WS isn't providing fallback
            if (!this.isWsReceiving()) {
              this.isConnected = false;
              this.notifyConnection(false);
              this.notifyConnectionState('reconnecting');
            }
          } else if (status === 'connected') {
            this.sseConnected = true;
            this.isConnected = true;
            this.transportMode = 'sse';
            this.notifyConnection(true);
            this.notifyConnectionState('connected');
          } else if (status === 'auth-required') {
            this.sseConnected = false;
            this.isConnected = false;
            this.transportMode = 'none';
            this.notifyConnection(false);
            this.notifyConnectionState('auth-required');
          } else if (status === 'incompatible') {
            this.sseConnected = false;
            this.isConnected = false;
            this.transportMode = 'none';
            this.notifyConnection(false);
            this.notifyConnectionState('incompatible');
          } else if (status === 'closed' && !this.isClosing && this.handlers.size > 0) {
            this.sseConnected = false;
            // Fall back to WS if available
            if (!this.isWsReceiving()) {
              this.isConnected = false;
              this.notifyConnection(false);
              this.notifyConnectionState('reconnecting');
            }
          }
        },
      });
      this.unsubscribeEvents = this.eventsClient.subscribe((event) => {
        if (!current()) return;
        if (!this.sseConnected) {
          this.sseConnected = true;
        }
        if (!this.isConnected) {
          this.isConnected = true;
          this.transportMode = 'sse';
          this.notifyConnection(true);
          this.notifyConnectionState('connected');
        }
        realtimeEventBus.publishFromTransport(event);
      });

      console.log('SSE transport starting (primary)');
    } catch (error) {
      console.error('Failed to initialize SSE transport:', error);
      this.sseConnected = false;
      // Try WS fallback for receiving
      if (!this.ws) {
        this.connectWsChannel(true);
      }
    }
  }

  private stopSseTransport(): void {
    this.sseConnected = false;
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents();
      this.unsubscribeEvents = null;
    }
    if (this.eventsClient) {
      this.eventsClient.close();
      this.eventsClient = null;
    }
  }

  /** Check if WS is open and actively receiving events (fallback mode) */
  private isWsReceiving(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && !this.sseConnected;
  }

  private connect(): Promise<void> {
    // If disabled, don't attempt any connection
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

    // New views must not overwrite a terminal SSE result without a new stream.
    // Explicit close/reset still permits reconnecting with a changed session.
    if (this.eventsClient && (
      this.connectionState === 'auth-required' || this.connectionState === 'incompatible'
    )) {
      return Promise.resolve();
    }

    // If already connected via SSE, just ensure WS command channel is up
    if (this.sseConnected && this.isConnected) {
      this.connectWsChannel(false);
      return Promise.resolve();
    }

    const generation = this.contextGeneration;
    const token = getApiBearerToken();
    const tenantId = getActiveTenantId();
    const memory = getActiveMemory();
    const current = () => generation === this.contextGeneration && !this.isClosing
      && token === getApiBearerToken() && tenantId === getActiveTenantId()
      && memory === getActiveMemory();
    this.connectionPromise = (async () => {
      this.notifyConnectionState('connecting');

      const compatibility = await api.compatibilityGate.preflight();
      if (!current()) return;
      this.anonymousLocalAdvertised = !compatibility.auth.required
        && compatibility.auth.mode === 'anonymous_local';
      const context: EventsClientOptions = {
        authorization: token ? `Bearer ${token}` : null, memory, tenantId,
      };
      if (token && tenantId) {
        Object.assign(context, await resolveRealtimeArchive(api.archives, memory));
        if (!current()) return;
      }

      // Clear any existing timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // 1. Start SSE as primary event transport
      this.startSseTransport(context, current);

      // 2. Start WS command channel in parallel (non-blocking)
      this.connectWsChannel(false);

      this.isClosing = false;
    })().catch((error: unknown) => {
      if (!current()) return;
      this.isConnected = false;
      this.transportMode = 'none';
      this.notifyConnection(false);
      this.notifyConnectionState(error instanceof ApiError && [401, 403].includes(error.statusCode)
        ? 'auth-required' : error instanceof ContractDecodeError ? 'incompatible' : 'disconnected');
      console.error('Realtime context admission failed');
    }).finally(() => {
      if (generation === this.contextGeneration) this.connectionPromise = null;
    });

    return this.connectionPromise;
  }

  /**
   * Connect WebSocket as a command channel (for send('refresh') etc.)
   * When `fallbackReceive` is true, also use WS for receiving events (SSE failed).
   */
  private connectWsChannel(fallbackReceive: boolean): void {
    if (this.isClosing || this.ws) return;

    try {
      const wsUrl = this.buildWebSocketUrl();
      if (!wsUrl) return;
      this.ws = new WebSocket(wsUrl);
      const socket = this.ws;
      const generation = this.contextGeneration;
      const current = () => !this.isClosing && generation === this.contextGeneration
        && this.ws === socket;

      this.ws.onopen = () => {
        if (!current()) return;
        console.log('WebSocket command channel connected');
        // If SSE is not connected, WS serves as receive fallback
        if (!this.sseConnected || fallbackReceive) {
          this.isConnected = true;
          this.transportMode = 'ws';
          this.notifyConnection(true);
          this.notifyConnectionState('connected');
        }
        // Send initial refresh to get queue status
        this.ws?.send('refresh');
      };

      this.ws.onmessage = (event) => {
        if (!current()) return;
        // Only publish WS messages if SSE is not the active event source
        // This avoids duplicate events when both transports are connected
        if (!this.sseConnected) {
          try {
            const message: ServerEvent = JSON.parse(event.data);
            realtimeEventBus.publishFromTransport(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        }
      };

      this.ws.onerror = () => {
        if (!current()) return;
        // WS errors are non-fatal if SSE is healthy
        if (this.sseConnected) {
          console.log('WebSocket command channel error (SSE active, non-critical)');
        } else {
          console.error('WebSocket command channel error');
        }
      };

      this.ws.onclose = (event) => {
        if (!current()) return;
        console.log('WebSocket command channel disconnected:', event.code);
        this.ws = null;

        // If SSE is connected, WS loss is non-critical
        if (this.sseConnected) {
          // Attempt quiet reconnect for command channel
          if (!this.isClosing && event.code !== 1000 && this.handlers.size > 0) {
            this.wsReconnectTimeout = setTimeout(() => {
              this.connectWsChannel(false);
            }, 5000);
          }
          return;
        }

        const closeClassification = classifyLegacyWebSocketClose(event);
        if (closeClassification === 'incompatible') {
          this.isConnected = false;
          this.transportMode = 'none';
          this.notifyConnection(false);
          this.notifyConnectionState('incompatible');
          return;
        }

        // SSE is also down — we're disconnected
        this.isConnected = false;
        this.transportMode = 'none';
        this.notifyConnection(false);

        if (this.isClosing) {
          this.notifyConnectionState('disconnected');
          return;
        }

        // Attempt reconnect
        if (event.code !== 1000 && this.handlers.size > 0) {
          this.notifyConnectionState('reconnecting');
          this.wsReconnectTimeout = setTimeout(() => {
            this.connectWsChannel(true);
          }, 3000);
        } else {
          this.notifyConnectionState('disconnected');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket command channel:', error);
      if (!this.sseConnected) {
        this.isConnected = false;
        this.transportMode = 'none';
        this.notifyConnection(false);
        this.notifyConnectionState('disconnected');
      }
    }
  }

  public subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    this.listenForContextChanges();
    
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  public close(): void {
    this.isClosing = true;
    this.contextGeneration++;
    this.unsubscribeContext?.();
    this.unsubscribeContext = null;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    this.stopSseTransport();
    realtimeEventBus.clearPending();

    if (this.ws) {
      this.ws.close(1000, 'Service closing');
      this.ws = null;
    }

    this.isConnected = false;
    this.sseConnected = false;
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

  public subscribeResync(handler: ResyncHandler): () => void {
    this.resyncHandlers.add(handler);
    return () => {
      this.resyncHandlers.delete(handler);
    };
  }

  private notifyResync(reason: ResyncReason, droppedCount?: number): void {
    this.resyncHandlers.forEach((handler) => {
      try {
        handler(reason, droppedCount);
      } catch (error) {
        console.error('Resync handler error:', error);
      }
    });
  }

  public getLastResyncAt(): number | null {
    return this.lastResyncAt;
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
  const [lastResyncAt, setLastResyncAt] = useState<number | undefined>(undefined);
  const [now, setNow] = useState<number>(Date.now());

  const markQueueUpdated = () => {
    setLastQueueUpdateAt(Date.now());
  };

  useEffect(() => {
    // Reset the service state in case we're in development mode
    webSocketService.reset();

    let isSubscribed = true;
    const resetQueueContext = () => {
      setQueueStatus({ total_jobs: 0, running: 0, pending: 0 });
      setLastQueueUpdateAt(Date.now());
      setLastResyncAt(undefined);
    };
    const unsubscribeContext = subscribeDataContextChanges(resetQueueContext);
    
    const unsubscribeConnection = webSocketService.subscribeConnection((status) => {
      if (!isSubscribed) return;
      setConnected(status);
    });
    const unsubscribeConnectionState = webSocketService.subscribeConnectionState((status) => {
      if (!isSubscribed) return;
      setConnectionState(status);
    });

    const unsubscribeResync = webSocketService.subscribeResync(() => {
      if (!isSubscribed) return;
      setLastResyncAt(Date.now());
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
      unsubscribeContext();
      unsubscribeConnection();
      unsubscribeConnectionState();
      unsubscribeResync();
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
    lastResyncAt,
    sendMessage,
  };
}

export default webSocketService;
