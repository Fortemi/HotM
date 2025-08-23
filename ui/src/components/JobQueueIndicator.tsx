import React, { useEffect, useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Activity, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import JobQueueMonitor from './JobQueueMonitor';

interface QueueStatus {
  total_jobs: number;
  running: number;
  pending: number;
}

interface WsMessage {
  type: string;
  total_jobs?: number;
  running?: number;
  pending?: number;
}

export const JobQueueIndicator: React.FC = () => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    total_jobs: 0,
    running: 0,
    pending: 0,
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = () => {
    try {
      const wsUrl = `ws://localhost:53211/api/v1/ws`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setWsConnected(true);
        ws.current?.send('refresh');
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);
          if (message.type === 'QueueStatus') {
            setQueueStatus({
              total_jobs: message.total_jobs || 0,
              running: message.running || 0,
              pending: message.pending || 0,
            });
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onerror = () => {
        setWsConnected(false);
      };

      ws.current.onclose = () => {
        setWsConnected(false);
        reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setWsConnected(false);
    }
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  // Determine status color and icon
  const getStatusColor = () => {
    if (!wsConnected) return 'bg-gray-400';
    if (queueStatus.running > 0) return 'bg-blue-500 animate-pulse';
    if (queueStatus.pending > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = () => {
    if (!wsConnected) return <AlertCircle className="h-4 w-4" />;
    if (queueStatus.running > 0) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (queueStatus.pending > 0) return <Activity className="h-4 w-4" />;
    return <CheckCircle2 className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!wsConnected) return 'Offline';
    if (queueStatus.running > 0) return 'Processing';
    if (queueStatus.pending > 0) return 'Queued';
    return 'Idle';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 px-3 hover:bg-accent"
        >
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
            {queueStatus.total_jobs > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {queueStatus.total_jobs}
              </Badge>
            )}
          </div>
          
          {/* Status bar indicators */}
          <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-px">
            {/* Connection status */}
            <div 
              className={`h-full transition-all ${
                wsConnected ? 'bg-green-500' : 'bg-red-500'
              }`} 
              style={{ width: '2px' }}
            />
            
            {/* Running jobs */}
            {Array.from({ length: Math.min(queueStatus.running, 3) }).map((_, i) => (
              <div 
                key={`running-${i}`}
                className="h-full bg-blue-500 animate-pulse" 
                style={{ width: '3px' }}
              />
            ))}
            
            {/* Pending jobs */}
            {Array.from({ length: Math.min(queueStatus.pending, 5) }).map((_, i) => (
              <div 
                key={`pending-${i}`}
                className="h-full bg-yellow-500" 
                style={{ width: '2px' }}
              />
            ))}
          </div>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[600px] p-0" align="end">
        <div className="max-h-[600px] overflow-auto">
          <JobQueueMonitor />
        </div>
      </PopoverContent>
    </Popover>
  );
};