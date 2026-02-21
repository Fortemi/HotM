import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { getJobTypeColor, formatJobType, formatDuration } from '@/components/jobs/job-utils';

const JobQueueMonitor: React.FC = () => {
  const { connected, queueStatus, isQueueStalled, queueStatusAgeMs, activeJobs, completedJobs } = useJobStore();

  const activeJobList = Array.from(activeJobs.values());

  return (
    <div className="space-y-4 p-4">
      {!connected && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span>WebSocket disconnected - queue status may be outdated</span>
        </div>
      )}
      {connected && isQueueStalled && (
        <div className="flex items-center gap-2 text-sm text-amber-600 mb-4">
          <AlertCircle className="h-4 w-4" />
          <span>
            Queue appears stalled ({Math.floor(queueStatusAgeMs / 60000)}m with no updates).
          </span>
        </div>
      )}

      {/* Active Jobs */}
      {activeJobList.map((activeJob) => (
        <Card key={activeJob.job_id}>
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
                {activeJob.progress_percent > 0 ? `${activeJob.progress_percent}%` : <span className="animate-pulse">Processing...</span>}
              </span>
            </div>
            {activeJob.progress_percent > 0 && (
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${getJobTypeColor(activeJob.job_type)}`}
                  style={{ width: `${Math.min(100, activeJob.progress_percent)}%` }}
                />
              </div>
            )}
            {activeJob.step_name && (
              <p className="text-sm text-muted-foreground">
                {activeJob.steps_total && activeJob.step_current
                  ? `Step ${activeJob.step_current}/${activeJob.steps_total}: ${activeJob.step_name}`
                  : activeJob.step_name}
              </p>
            )}
            {activeJob.message && !activeJob.step_name && (
              <p className="text-sm text-muted-foreground">{activeJob.message}</p>
            )}
            {activeJob.note_id && (
              <p className="text-xs text-muted-foreground">
                Note: {activeJob.note_id.substring(0, 8)}...
              </p>
            )}
          </CardContent>
        </Card>
      ))}

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
                      <span>{new Date(job.timestamp).toLocaleTimeString()}</span>
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
