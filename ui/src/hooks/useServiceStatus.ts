/**
 * Service Status Management Hook
 * 
 * React hook for managing service status, health monitoring, and control operations
 * Provides real-time updates and WebSocket integration for service management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ServiceInfo,
  SystemHealth,
  ServiceOperation,
  ServiceOperationResult,
  ServiceEvent,
  UseServiceStatusReturn
} from '../types/serviceTypes';

// Mock WebSocket URL - in real implementation this would come from configuration
const WEBSOCKET_URL = 'ws://localhost:53211/ws/services';

/**
 * Custom hook for service status management
 */
export function useServiceStatus(): UseServiceStatusReturn {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const eventCallbacksRef = useRef<Set<(event: ServiceEvent) => void>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Establishes WebSocket connection for real-time updates
   */
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      
      ws.onopen = () => {
        console.log('Service status WebSocket connected');
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const serviceEvent: ServiceEvent = JSON.parse(event.data);
          
          // Update local state based on event type
          switch (serviceEvent.type) {
            case 'status_changed':
              setServices(prev => prev.map(service => 
                service.name === serviceEvent.service
                  ? { ...service, status: serviceEvent.data.status }
                  : service
              ));
              break;

            case 'health_changed':
              setServices(prev => prev.map(service => 
                service.name === serviceEvent.service
                  ? { ...service, health: serviceEvent.data.health }
                  : service
              ));
              break;

            case 'performance_updated':
              // Performance updates would be handled by a separate hook
              break;

            default:
              // Handle other event types
              break;
          }

          // Notify event subscribers
          eventCallbacksRef.current.forEach(callback => {
            try {
              callback(serviceEvent);
            } catch (err) {
              console.error('Error in service event callback:', err);
            }
          });

        } catch (err) {
          console.error('Error parsing service event:', err);
        }
      };

      ws.onclose = () => {
        console.log('Service status WebSocket disconnected');
        wsRef.current = null;
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      ws.onerror = (err) => {
        console.error('Service status WebSocket error:', err);
        setError('Lost connection to service status updates');
      };

      wsRef.current = ws;

    } catch (err) {
      console.error('Failed to connect to service status WebSocket:', err);
      setError('Failed to connect to real-time service updates');
    }
  }, []);

  /**
   * Disconnects WebSocket
   */
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /**
   * Refreshes service status from the API
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // In real implementation, this would call the actual API
      // For now, we'll use mock data with some randomization

      const mockServices: ServiceInfo[] = [
        {
          name: 'HotM-PostgreSQL',
          displayName: 'HotM PostgreSQL Database Service',
          description: 'PostgreSQL database server with pgvector extension for HotM',
          status: 'Running',
          health: 'Healthy',
          uptime: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
          port: 54321,
          dependencies: [],
          isRequired: true,
          canRestart: true,
          canStop: true
        },
        {
          name: 'HotM-Ollama',
          displayName: 'HotM Ollama AI Service',
          description: 'Local AI inference service for NLP processing',
          status: 'Running',
          health: 'Healthy',
          uptime: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
          port: 11434,
          dependencies: [],
          isRequired: false,
          canRestart: true,
          canStop: true
        },
        {
          name: 'HotM-Server',
          displayName: 'Hall of the Mind Server',
          description: 'Main HotM API server and MCP integration',
          status: 'Running',
          health: 'Healthy',
          uptime: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
          port: 53211,
          dependencies: ['HotM-PostgreSQL', 'HotM-Ollama'],
          isRequired: true,
          canRestart: true,
          canStop: false // Main server shouldn't be stoppable in normal operation
        }
      ];

      const mockSystemHealth: SystemHealth = {
        overallHealthy: true,
        serviceResults: mockServices,
        systemChecks: [
          { 
            check: 'Disk Space (C:)', 
            healthy: true, 
            message: `${(30 + Math.random() * 30).toFixed(1)} GB free (${(50 + Math.random() * 30).toFixed(1)}%)`,
            severity: 'info'
          },
          { 
            check: 'Memory Usage', 
            healthy: true, 
            message: `${(30 + Math.random() * 40).toFixed(0)}% used (${(2 + Math.random() * 4).toFixed(1)} GB free)`,
            severity: 'info'
          },
          { 
            check: 'Port 53211 (HotM-Server)', 
            healthy: true, 
            message: 'Port 53211 in use by HotM-Server (expected)',
            severity: 'info'
          },
          { 
            check: 'Port 54321 (HotM-PostgreSQL)', 
            healthy: true, 
            message: 'Port 54321 in use by HotM-PostgreSQL (expected)',
            severity: 'info'
          },
          { 
            check: 'Port 11434 (HotM-Ollama)', 
            healthy: true, 
            message: 'Port 11434 in use by HotM-Ollama (expected)',
            severity: 'info'
          }
        ],
        checkTime: new Date().toISOString(),
        recommendations: [],
        resourceUsage: {
          cpuPercent: 15 + Math.random() * 20,
          memoryPercent: 40 + Math.random() * 30,
          diskPercent: 60 + Math.random() * 20,
          availableMemoryMB: 2048 + Math.random() * 2048,
          availableDiskMB: 30000 + Math.random() * 20000
        }
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setServices(mockServices);
      setSystemHealth(mockSystemHealth);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh service status';
      setError(errorMessage);
      console.error('Service status refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Controls a service (start, stop, restart, etc.)
   */
  const controlService = useCallback(async (
    service: string, 
    operation: ServiceOperation
  ): Promise<ServiceOperationResult> => {
    setLoading(true);
    setError(null);

    try {
      // In real implementation, this would call the service control API
      console.log(`${operation} service: ${service}`);
      
      // Simulate the operation with realistic delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update service status optimistically
      setServices(prev => prev.map(svc => 
        svc.name === service 
          ? { 
              ...svc, 
              status: operation === 'stop' ? 'Stopped' : 
                     operation === 'start' ? 'Running' : 
                     operation === 'restart' ? 'Running' : svc.status,
              health: operation === 'stop' ? 'Unknown' : 'Healthy'
            }
          : svc
      ));

      const result: ServiceOperationResult = {
        success: true,
        message: `Successfully ${operation}ed service ${service}`,
        timestamp: new Date().toISOString()
      };

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${operation} service`;
      setError(errorMessage);
      
      const result: ServiceOperationResult = {
        success: false,
        message: errorMessage,
        details: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      };

      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Subscribes to service events for real-time updates
   */
  const subscribeToEvents = useCallback((callback: (event: ServiceEvent) => void): (() => void) => {
    eventCallbacksRef.current.add(callback);
    
    return () => {
      eventCallbacksRef.current.delete(callback);
    };
  }, []);

  // Initialize WebSocket connection and load initial data
  useEffect(() => {
    refreshStatus();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [refreshStatus, connectWebSocket, disconnectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  return {
    services,
    systemHealth,
    loading,
    error,
    refreshStatus,
    controlService,
    subscribeToEvents
  };
}

/**
 * Hook for managing service configurations
 */
export function useServiceConfiguration(serviceName: string) {
  const [configuration, setConfiguration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Implementation would go here - this is a placeholder
  return {
    configuration,
    loading,
    error,
    updateConfiguration: async (config: any) => ({ success: true, message: 'Updated', timestamp: new Date().toISOString() }),
    validateConfiguration: async (config: any) => ({ valid: true, errors: [] }),
    resetConfiguration: async () => ({ success: true, message: 'Reset', timestamp: new Date().toISOString() })
  };
}

/**
 * Hook for managing service logs
 */
export function useServiceLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Implementation would go here - this is a placeholder
  return {
    logs,
    loading,
    error,
    filter: {},
    totalCount: 0,
    hasMore: false,
    setFilter: () => {},
    loadMore: async () => {},
    exportLogs: async () => new Blob(),
    clearLogs: async () => ({ success: true, message: 'Cleared', timestamp: new Date().toISOString() })
  };
}