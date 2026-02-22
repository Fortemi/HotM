import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Upload, X, RotateCcw } from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { useUploadStore } from '@/hooks/useUploadStore';
import { uploadStore, type UploadFileEntry } from '@/services/uploadStore';
import { getJobTypeColor, formatJobType, formatDuration } from '@/components/jobs/job-utils';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadEntryRow({ entry }: { entry: UploadFileEntry }) {
  const isActive = entry.status === 'uploading';
  const isQueued = entry.status === 'queued';
  const isCompleted = entry.status === 'completed';
  const isFailed = entry.status === 'failed';

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0" data-testid={`upload-entry-${entry.id}`}>
      <div className="flex-shrink-0">
        {isActive && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
        {isQueued && <Upload className="h-4 w-4 text-yellow-500" />}
        {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        {isFailed && <XCircle className="h-4 w-4 text-red-500" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm truncate">{entry.file.name}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatFileSize(entry.bytesTotal)}
          </span>
        </div>
        {isActive && (
          <div className="w-full bg-muted rounded-full h-1 mt-1">
            {entry.bytesUploaded > 0 ? (
              <div
                className="h-1 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.round((entry.bytesUploaded / entry.bytesTotal) * 100)}%` }}
              />
            ) : (
              <div className="h-1 rounded-full bg-blue-500 animate-pulse w-full" />
            )}
          </div>
        )}
        {isActive && entry.bytesUploaded > 0 && (
          <span className="text-xs text-muted-foreground">
            {formatFileSize(entry.bytesUploaded)} / {formatFileSize(entry.bytesTotal)}
          </span>
        )}
        {isFailed && entry.error && (
          <p className="text-xs text-red-500 truncate mt-0.5">{entry.error}</p>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-1">
        {isFailed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => uploadStore.retryFile(entry.id)}
            aria-label="retry upload"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        {(isQueued || isActive) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => uploadStore.cancelFile(entry.id)}
            aria-label="cancel upload"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

const JobQueueMonitor: React.FC = () => {
  const { connected, queueStatus, isQueueStalled, queueStatusAgeMs, activeJobs, completedJobs } = useJobStore();
  const uploadState = useUploadStore();

  const activeJobList = Array.from(activeJobs.values());
  const uploadEntries = Array.from(uploadState.entries.values());
  const { summary } = uploadState;
  const hasUploads = uploadEntries.length > 0;
  const totalUploadActive = summary.queued + summary.uploading;
  const hasFinishedUploads = summary.completed > 0 || summary.failed > 0;

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

      {/* Transfers Section */}
      {hasUploads && (
        <Card data-testid="transfers-section">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Transfers
              </CardTitle>
              <div className="flex items-center gap-2">
                {totalUploadActive > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {totalUploadActive === 1
                      ? '1 file'
                      : `File ${summary.uploading > 0 ? (uploadEntries.findIndex(e => e.status === 'uploading') + 1) : 0} of ${totalUploadActive}`}
                  </Badge>
                )}
                {hasFinishedUploads && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => uploadStore.clearCompleted()}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className={uploadEntries.length > 4 ? 'h-40' : undefined}>
              <div>
                {uploadEntries.map((entry) => (
                  <UploadEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
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
