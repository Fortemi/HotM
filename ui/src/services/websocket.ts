// Shared WebSocket service for job queue updates
import { useEffect, useState } from 'react';

export interface WsMessage {
  type: 'QueueStatus' | 'JobQueued' | 'JobStarted' | 'JobProgress' | 'JobCompleted' | 'JobFailed' | 'NoteUpdated';
  job_id?: string;
  note_id?: string;
  job_type?: string;
  status?: string;
  progress?: number;
  message?: string;
  error?: string;
  duration_ms?: number;
  total_jobs?: number;
  running?: number;
  pending?: number;
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

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private handlers: Set<MessageHandler> = new Set();
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

        // Build WebSocket URL from API base URL
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const wsProtocol = apiBase.startsWith('https') ? 'wss' : 'ws';
        const wsHost = apiBase.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${wsHost}/api/v1/ws`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Shared WebSocket connected');
          this.isConnected = true;
          this.isClosing = false;
          this.connectionPromise = null;
          this.ws?.send('refresh');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WsMessage = JSON.parse(event.data);
            
            // Broadcast to all handlers
            this.handlers.forEach(handler => {
              try {
                handler(message);
              } catch (error) {
                console.error('Handler error:', error);
              }
            });

            // Handle NoteUpdated events globally
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
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Shared WebSocket error:', error);
          this.isConnected = false;
          this.connectionPromise = null;
          
          // Don't reject immediately - let onclose handle it
          // This prevents double error handling
        };

        this.ws.onclose = (event) => {
          console.log('Shared WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.connectionPromise = null;
          
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
    
    this.isConnected = false;
    this.connectionPromise = null;
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
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
    
    const unsubscribe = webSocketService.subscribe((message) => {
      if (!isSubscribed) return; // Prevent updates after unmount
      
      // Update connection status
      setConnected(webSocketService.getConnectionStatus());
      
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