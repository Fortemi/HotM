import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useJobStore } from "@/hooks/useJobStore";
import { getJobTypeColor, formatJobType, formatDuration } from "@/components/jobs/job-utils";
import { api } from "@/api";
import type { JobType } from "@/api/extended";
import type { ActiveJob, CompletedJob } from "@/services/jobEventStore";

export interface NoteJobProgressProps {
  noteId: string;
  fallbackContent?: React.ReactNode;
}

export function NoteJobProgress({ noteId, fallbackContent }: NoteJobProgressProps) {
  const jobStore = useJobStore();

  // Fetch initial job state on mount
  useEffect(() => {
    api.extended.getNoteJobs(noteId).catch(() => {
      // Silently handle — store will populate from WebSocket events
    });
  }, [noteId]);

  // Filter active jobs for this note
  const activeJobs: ActiveJob[] = Array.from(jobStore.activeJobs.values()).filter(
    (j) => j.note_id === noteId
  );

  // Filter recent failed jobs for this note
  const failedJobs: CompletedJob[] = jobStore.completedJobs.filter(
    (j) => j.note_id === noteId && j.status === 'failed'
  );

  const handleRetry = async (jobType: string) => {
    try {
      await api.extended.queueJob(noteId, jobType as JobType, 8);
    } catch {
      // Error handling — user will see the job fail again if it persists
    }
  };

  // If no active or failed jobs, show fallback
  if (activeJobs.length === 0 && failedJobs.length === 0) {
    return <>{fallbackContent}</>;
  }

  return (
    <div className="flex flex-col space-y-3 p-4" data-testid="note-job-progress">
      {/* Active jobs with progress bars */}
      {activeJobs.map((job) => {
        const colorClass = getJobTypeColor(job.job_type);
        const stepLabel = job.step_name
          ? `Step ${job.step_current ?? '?'}/${job.steps_total ?? '?'}: ${job.step_name}`
          : job.message ?? 'Processing...';

        return (
          <div key={job.job_id} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${colorClass}`} />
                <span className="font-medium">{formatJobType(job.job_type)}</span>
              </div>
              <span className="text-muted-foreground">
                {Math.round(job.progress_percent)}%
              </span>
            </div>
            <Progress value={job.progress_percent} className="h-1.5" />
            <p className="text-xs text-muted-foreground" data-testid={`step-label-${job.job_id}`}>
              {stepLabel}
            </p>
          </div>
        );
      })}

      {/* Failed jobs with retry */}
      {failedJobs.map((job) => (
        <div
          key={job.job_id}
          className="flex items-center justify-between p-2 rounded-md bg-destructive/10 border border-destructive/20"
          data-testid={`failed-job-${job.job_id}`}
        >
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="font-medium text-destructive">
              {formatJobType(job.job_type)} failed
            </span>
            {job.error && (
              <span className="text-muted-foreground truncate max-w-[200px]">
                — {job.error}
              </span>
            )}
            {job.duration_ms !== undefined && (
              <span className="text-muted-foreground">
                ({formatDuration(job.duration_ms)})
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => handleRetry(job.job_type)}
            data-testid={`retry-${job.job_type}`}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      ))}
    </div>
  );
}
