// Shared WebSocket service for job queue updates
import { useEffect, useState } from 'react';
import { createEventsClient, type ServerEvent } from '@/api/events';

export interface WsActiveJob {
  job_id: string;
  job_type: string;
  progress_percent: number;
  message?: string;
  started_at?: string;
}

export interface WsMessage {
  type: 'QueueStatus' | 'JobQueued' | 'JobStarted' | 'JobProgress' | 'JobCompleted' | 'JobFailed' | 'NoteUpdated';
  job_id?: string;
  note_id?: string;
  job_type?: string;
  status?: string;
  progress_percent?: number;
  message?: string;
  error?: string;
  retry_count?: number;
  duration_ms?: number;
  estimated_duration_ms?: number;
  priority?: number;
  total_jobs?: number;
  running?: number;
  pending?: number;
  active_job?: WsActiveJob;
  title?: string;
  tags?: string[];
  has_ai_content?: boolean;
  has_links?: boolean;
}

export interface QueueStatus {
  total_jobs: number;
  running: number;
  pending: number;
}

type MessageHandler = (message: WsMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private eventsClient: ReturnType<typeof createEventsClient> | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private handlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private connectionPromise: Promise<void> | null = null;
  private isClosing = false;
  private isDisabled = false;

  constructor() {
    // Check if WebSocket is disabled via environment variable
    this.isDisabled = import.meta.env.VITE_DISABLE_WEBSOCKET === 'true';
    if (this.isDisabled) {
      console.log('WebSocket disabled via VITE_DISABLE_WEBSOCKET');
    }
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

  private normalizeEventMessage(event: ServerEvent): WsMessage {
    const type = typeof event.type === 'string' ? event.type : 'QueueStatus';
    return {
      type: type as WsMessage['type'],
      job_id: typeof event.job_id === 'string' ? event.job_id : undefined,
      note_id: typeof event.note_id === 'string' ? event.note_id : undefined,
      job_type: typeof event.job_type === 'string' ? event.job_type : undefined,
      status: typeof event.status === 'string' ? event.status : undefined,
      progress_percent:
        typeof event.progress_percent === 'number' ? event.progress_percent : undefined,
      message: typeof event.message === 'string' ? event.message : undefined,
      error: typeof event.error === 'string' ? event.error : undefined,
      duration_ms: typeof event.duration_ms === 'number' ? event.duration_ms : undefined,
      total_jobs:
        typeof event.total_jobs === 'number' ? event.total_jobs : undefined,
      running: typeof event.running === 'number' ? event.running : undefined,
      pending: typeof event.pending === 'number' ? event.pending : undefined,
      title: typeof event.title === 'string' ? event.title : undefined,
      tags: Array.isArray(event.tags) ? (event.tags as string[]) : undefined,
      has_ai_content:
        typeof event.has_ai_content === 'boolean' ? event.has_ai_content : undefined,
      has_links: typeof event.has_links === 'boolean' ? event.has_links : undefined,
    };
  }

  private broadcastMessage(message: WsMessage): void {
    this.handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Handler error:', error);
      }
    });

    if (message.type === 'NoteUpdated') {
      window.dispatchEvent(new CustomEvent('noteUpdated', {
        detail: {
          note_id: message.note_id,
          title: message.title,
          tags: message.tags,
          has_ai_content: message.has_ai_content,
          has_links: message.has_links,
        }
      }));
    }
  }

  private startSseFallback(): void {
    if (this.isClosing || this.handlers.size === 0) {
      return;
    }
    if (this.unsubscribeEvents) {
      return;
    }

    try {
      this.eventsClient = createEventsClient(this.getApiBaseUrl());
      this.unsubscribeEvents = this.eventsClient.subscribe((event) => {
        if (!this.isConnected) {
          this.isConnected = true;
          this.notifyConnection(true);
        }
        this.broadcastMessage(this.normalizeEventMessage(event));
      });

      // Optimistically mark connected while SSE handshake completes.
      this.isConnected = true;
      this.notifyConnection(true);
      console.log('Falling back to SSE real-time events');
    } catch (error) {
      console.error('Failed to initialize SSE fallback:', error);
      this.isConnected = false;
      this.notifyConnection(false);
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
          this.notifyConnection(true);
          this.isClosing = false;
          this.connectionPromise = null;
          this.ws?.send('refresh');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WsMessage = JSON.parse(event.data);
            this.broadcastMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Shared WebSocket error:', error);
          this.isConnected = false;
          this.notifyConnection(false);
          this.connectionPromise = null;
          this.startSseFallback();
          
          // Don't reject immediately - let onclose handle it
          // This prevents double error handling
        };

        this.ws.onclose = (event) => {
          console.log('Shared WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.notifyConnection(false);
          this.connectionPromise = null;
          this.startSseFallback();
          
          // If we were in the process of closing, don't reconnect
          if (this.isClosing) {
            return;
          }
          
          // Only reconnect if it wasn't a manual close (code 1000) and we have active handlers
          if (event.code !== 1000 && this.handlers.size > 0) {
            this.reconnectTimeout = setTimeout(() => {
              console.log('Shared WebSocket attempting to reconnect...');
              this.connect().catch(console.error);
            }, 3000);
          }
          
          // If this was an error during connection, reject the promise
          if (event.code !== 1000) {
            reject(new Error(`WebSocket closed with code ${event.code}: ${event.reason}`));
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.isConnected = false;
        this.notifyConnection(false);
        this.connectionPromise = null;
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
    this.notifyConnection(false);
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
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    total_jobs: 0,
    running: 0,
    pending: 0,
  });

  useEffect(() => {
    // Reset the service state in case we're in development mode
    webSocketService.reset();

    let isSubscribed = true;
    
    const unsubscribeConnection = webSocketService.subscribeConnection((status) => {
      if (!isSubscribed) return;
      setConnected(status);
    });

    const unsubscribe = webSocketService.subscribe((message) => {
      if (!isSubscribed) return; // Prevent updates after unmount

      // Handle queue status messages
      switch (message.type) {
        case 'QueueStatus':
          setQueueStatus({
            total_jobs: message.total_jobs || 0,
            running: message.running || 0,
            pending: message.pending || 0,
          });
          break;
          
        case 'JobQueued':
          setQueueStatus(prev => ({
            ...prev,
            pending: prev.pending + 1,
            total_jobs: prev.total_jobs + 1,
          }));
          break;
          
        case 'JobStarted':
          setQueueStatus(prev => ({
            ...prev,
            pending: Math.max(0, prev.pending - 1),
            running: prev.running + 1,
          }));
          break;
          
        case 'JobCompleted':
        case 'JobFailed':
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
      unsubscribe();
    };
  }, []);

  const sendMessage = (message: string) => {
    webSocketService.send(message);
  };

  return {
    connected,
    queueStatus,
    sendMessage,
  };
}

export default webSocketService;
