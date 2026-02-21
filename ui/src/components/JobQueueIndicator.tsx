import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Activity, Loader2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import JobQueueMonitor from './JobQueueMonitor';
import { useWebSocket } from '@/services/websocket';
import type { WsMessage } from '@/services/websocket';
import webSocketService from '@/services/websocket';

export const JobQueueIndicator: React.FC = () => {
  const { connected, connectionState, transportMode, queueStatus, isQueueStalled, queueStatusAgeMs, lastResyncAt } = useWebSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [activeStepLabel, setActiveStepLabel] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = webSocketService.subscribe((message: WsMessage) => {
      if (message.type === 'JobProgress' && message.step_name) {
        const label = message.steps_total && message.step_current
          ? `${message.step_current}/${message.steps_total}: ${message.step_name}`
          : message.step_name;
        setActiveStepLabel(label);
      } else if (message.type === 'JobCompleted' || message.type === 'JobFailed') {
        setActiveStepLabel(null);
      }
    });
    return unsubscribe;
  }, []);

  // Determine status icon
  const getStatusIcon = () => {
    if (!connected) return <AlertCircle className="h-4 w-4" />;
    if (isQueueStalled) return <AlertTriangle className="h-4 w-4" />;
    if (queueStatus.running > 0) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (queueStatus.pending > 0) return <Activity className="h-4 w-4" />;
    return <CheckCircle2 className="h-4 w-4" />;
  };

  // Determine status color
  const getStatusColor = () => {
    if (!connected) return 'text-red-500';
    if (isQueueStalled) return 'text-amber-500';
    if (queueStatus.running > 0) return 'text-blue-500';
    if (queueStatus.pending > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Determine badge color
  const getBadgeColor = () => {
    if (!connected) return 'destructive';
    if (queueStatus.running > 0 || queueStatus.pending > 0) return 'secondary';
    return 'outline';
  };

  const totalJobs = queueStatus.running + queueStatus.pending;
  const connectionLabel =
    connectionState === 'stale'
      ? 'Stale'
      : connectionState === 'reconnecting'
        ? 'Reconnecting'
        : connected
          ? 'Connected'
          : 'Disconnected';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 gap-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className={`flex items-center gap-1 ${getStatusColor()}`}>
            {getStatusIcon()}
          </div>
          {totalJobs > 0 && (
            <Badge variant={getBadgeColor()} className="h-5 min-w-5 px-1 text-xs">
              {totalJobs}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Job Queue</h3>
            <div className={`flex items-center gap-1 text-sm ${getStatusColor()}`}>
              {getStatusIcon()}
              <span className="text-xs text-muted-foreground ml-1">
                {connectionLabel}
              </span>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            transport: {transportMode ?? 'none'}
          </div>
          {isQueueStalled && (
            <div className="mt-2 text-xs text-amber-600">
              Queue appears stalled ({Math.floor(queueStatusAgeMs / 60000)}m since last update).
            </div>
          )}
          {lastResyncAt && Date.now() - lastResyncAt < 60000 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
              <RefreshCw className="h-3 w-3" />
              <span>State resync triggered</span>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="text-center">
              <div className="font-medium text-lg text-blue-600">{queueStatus.running}</div>
              <div className="text-muted-foreground">Running</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-lg text-yellow-600">{queueStatus.pending}</div>
              <div className="text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-lg text-gray-600">{queueStatus.total_jobs}</div>
              <div className="text-muted-foreground">Total</div>
            </div>
          </div>
          {activeStepLabel && queueStatus.running > 0 && (
            <div className="mt-2 text-xs text-muted-foreground truncate">
              <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
              {activeStepLabel}
            </div>
          )}
        </div>
        
        <JobQueueMonitor />
      </PopoverContent>
    </Popover>
  );
};

export default JobQueueIndicator;
