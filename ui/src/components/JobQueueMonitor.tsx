import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Activity, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Job {
  job_id: string;
  job_type: string;
  progress_percent: number;
  message?: string;
  started_at: string;
}

interface QueueStatus {
  total_jobs: number;
  running: number;
  pending: number;
  active_job?: Job;
}

interface WsMessage {
  type: string;
  job_id?: string;
  job_type?: string;
  progress_percent?: number;
  message?: string;
  error?: string;
  duration_ms?: number;
  total_jobs?: number;
  running?: number;
  pending?: number;
  active_job?: Job;
}

const JobQueueMonitor: React.FC = () => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    total_jobs: 0,
    running: 0,
    pending: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Array<{
    job_id: string;
    job_type: string;
    status: 'completed' | 'failed';
    duration_ms?: number;
    error?: string;
    timestamp: Date;
  }>>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = () => {
    try {
      // Use ws:// for local development
      const wsUrl = `ws://localhost:53211/api/v1/ws`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        // Send refresh request to get initial status
        ws.current?.send('refresh');
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);
          handleWsMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setWsConnected(false);
    }
  };

  const handleWsMessage = (message: WsMessage) => {
    switch (message.type) {
      case 'QueueStatus':
        setQueueStatus({
          total_jobs: message.total_jobs || 0,
          running: message.running || 0,
          pending: message.pending || 0,
          active_job: message.active_job,
        });
        break;

      case 'JobStarted':
        // Update active job
        if (message.job_id && message.job_type) {
          setQueueStatus(prev => ({
            ...prev,
            active_job: {
              job_id: message.job_id!,
              job_type: message.job_type!,
              progress_percent: 0,
              message: 'Starting...',
              started_at: new Date().toISOString(),
            },
          }));
        }
        break;

      case 'JobProgress':
        // Update progress of active job
        if (message.job_id && queueStatus.active_job?.job_id === message.job_id) {
          setQueueStatus(prev => ({
            ...prev,
            active_job: {
              ...prev.active_job!,
              progress_percent: message.progress_percent || 0,
              message: message.message,
            },
          }));
        }
        break;

      case 'JobCompleted':
        // Add to recent jobs and clear active if it's the same
        if (message.job_id) {
          setRecentJobs(prev => [{
            job_id: message.job_id!,
            job_type: queueStatus.active_job?.job_type || 'Unknown',
            status: 'completed',
            duration_ms: message.duration_ms,
            timestamp: new Date(),
          }, ...prev].slice(0, 10)); // Keep last 10 jobs

          if (queueStatus.active_job?.job_id === message.job_id) {
            setQueueStatus(prev => ({
              ...prev,
              active_job: undefined,
              running: Math.max(0, prev.running - 1),
              total_jobs: Math.max(0, prev.total_jobs - 1),
            }));
          }
        }
        break;

      case 'JobFailed':
        // Add to recent jobs with error
        if (message.job_id) {
          setRecentJobs(prev => [{
            job_id: message.job_id!,
            job_type: queueStatus.active_job?.job_type || 'Unknown',
            status: 'failed',
            error: message.error,
            timestamp: new Date(),
          }, ...prev].slice(0, 10));

          if (queueStatus.active_job?.job_id === message.job_id) {
            setQueueStatus(prev => ({
              ...prev,
              active_job: undefined,
              running: Math.max(0, prev.running - 1),
            }));
          }
        }
        break;
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
      default:
        return 'bg-gray-500';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Job Queue Monitor
            </CardTitle>
            <CardDescription>
              Real-time ML pipeline processing status
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={wsConnected ? "default" : "destructive"}>
              {wsConnected ? "Connected" : "Disconnected"}
            </Badge>
            {queueStatus.total_jobs > 0 && (
              <Badge variant="secondary">
                {queueStatus.total_jobs} jobs
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Queue Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{queueStatus.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{queueStatus.running}</div>
            <div className="text-sm text-muted-foreground">Running</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{recentJobs.filter(j => j.status === 'completed').length}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
        </div>

        {/* Active Job */}
        {queueStatus.active_job && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">Active Job</span>
                <Badge className={getJobTypeColor(queueStatus.active_job.job_type)}>
                  {queueStatus.active_job.job_type}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {queueStatus.active_job.progress_percent}%
              </span>
            </div>
            <Progress value={queueStatus.active_job.progress_percent} />
            {queueStatus.active_job.message && (
              <p className="text-sm text-muted-foreground">
                {queueStatus.active_job.message}
              </p>
            )}
          </div>
        )}

        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">Recent Jobs</h3>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {recentJobs.map((job) => (
                  <div
                    key={job.job_id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {job.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant="outline" className={getJobTypeColor(job.job_type)}>
                        {job.job_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {job.job_id.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.duration_ms && (
                        <span className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDuration(job.duration_ms)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty State */}
        {queueStatus.total_jobs === 0 && recentJobs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No jobs in queue</p>
            <p className="text-sm">Jobs will appear here when notes are processed</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JobQueueMonitor;