import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Activity, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import JobQueueMonitor from './JobQueueMonitor';
import { useWebSocket } from '@/services/websocket';

export const JobQueueIndicator: React.FC = () => {
  const { connected, queueStatus, isQueueStalled, queueStatusAgeMs } = useWebSocket();
  const [isOpen, setIsOpen] = useState(false);

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
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          {isQueueStalled && (
            <div className="mt-2 text-xs text-amber-600">
              Queue appears stalled ({Math.floor(queueStatusAgeMs / 60000)}m since last update).
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
        </div>
        
        <JobQueueMonitor />
      </PopoverContent>
    </Popover>
  );
};

export default JobQueueIndicator;
