import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useWebSocket } from '@/services/websocket';
import webSocketService from '@/services/websocket';
import type { WsMessage } from '@/services/websocket';

interface Job {
  job_id: string;
  job_type: string;
  note_id?: string;
  progress_percent: number;
  message?: string;
  started_at: string;
}

interface CompletedJob {
  job_id: string;
  job_type: string;
  note_id?: string;
  status: 'completed' | 'failed';
  duration_ms?: number;
  error?: string;
  timestamp: Date;
}

const JobQueueMonitor: React.FC = () => {
  const { connected, queueStatus } = useWebSocket();
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);

  // Subscribe to WebSocket messages for detailed job info
  useEffect(() => {
    const unsubscribe = webSocketService.subscribe((message: WsMessage) => {
      switch (message.type) {
        case 'JobStarted':
          if (message.job_id && message.job_type) {
            setActiveJob({
              job_id: message.job_id,
              job_type: message.job_type,
              note_id: message.note_id,
              progress_percent: 0,
              message: 'Starting...',
              started_at: new Date().toISOString(),
            });
          }
          break;

        case 'JobProgress':
          if (message.job_id && typeof message.progress_percent === 'number') {
            setActiveJob(prev => prev && prev.job_id === message.job_id ? {
              ...prev,
              progress_percent: message.progress_percent ?? prev.progress_percent,
              message: message.message || prev.message,
            } : prev);
          }
          break;

        case 'JobCompleted':
        case 'JobFailed':
          if (message.job_id) {
            setCompletedJobs(prev => [
              {
                job_id: message.job_id!,
                job_type: message.job_type || 'unknown',
                note_id: message.note_id,
                status: message.type === 'JobCompleted' ? 'completed' : 'failed',
                duration_ms: message.duration_ms,
                error: message.error,
                timestamp: new Date(),
              },
              ...prev.slice(0, 9)
            ]);

            setActiveJob(prev => prev?.job_id === message.job_id ? null : prev);
          }
          break;
      }
    });

    return unsubscribe;
  }, []);

  const getJobTypeColor = (jobType: string) => {
    switch (jobType.toLowerCase()) {
      case 'airevision':
        return 'bg-purple-500';
      case 'embedding':
        return 'bg-blue-500';
      case 'linking':
        return 'bg-green-500';
      case 'contextupdate':
        return 'bg-orange-500';
      case 'titlegeneration':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatJobType = (jobType: string) => {
    return jobType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-4 p-4">
      {!connected && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span>WebSocket disconnected - queue status may be outdated</span>
        </div>
      )}

      {/* Active Job */}
      {activeJob && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Job</CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getJobTypeColor(activeJob.job_type)}`} />
                <span className="font-medium">{formatJobType(activeJob.job_type)}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {activeJob.progress_percent}%
              </span>
            </div>
            <Progress value={activeJob.progress_percent} className="w-full" />
            {activeJob.message && (
              <p className="text-sm text-muted-foreground">{activeJob.message}</p>
            )}
            {activeJob.note_id && (
              <p className="text-xs text-muted-foreground">
                Note: {activeJob.note_id.substring(0, 8)}...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Queue Status Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Queue Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{queueStatus.running}</div>
              <p className="text-xs text-muted-foreground">Running</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{queueStatus.pending}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">{queueStatus.total_jobs}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Completed Jobs */}
      {completedJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Last {completedJobs.length} completed jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {completedJobs.map((job, index) => (
                  <div key={`${job.job_id}-${index}`} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      {job.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getJobTypeColor(job.job_type)}`} />
                        <span className="text-sm font-medium">
                          {formatJobType(job.job_type)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {job.duration_ms && (
                        <span>{formatDuration(job.duration_ms)}</span>
                      )}
                      <Clock className="h-3 w-3" />
                      <span>{job.timestamp.toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JobQueueMonitor;