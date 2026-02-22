import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
  RefreshCw,
  Pause,
  Play,
  Activity,
  AlertTriangle,
  Filter,
  ListOrdered,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJobStore } from '@/hooks/useJobStore';
import { jobEventStore } from '@/services/jobEventStore';
import { api } from '@/api';
import type { MemoryArchive, JobListItem } from '@/api';
import { getJobTypeColor, formatJobType, formatDuration } from './job-utils';
import { JobManagementPanel } from '@/components/JobManagementPanel';

interface JobQueueViewProps {
  archives: MemoryArchive[];
}

const ALL_ARCHIVES = '__all__';

export function JobQueueView({ archives }: JobQueueViewProps) {
  const store = useJobStore();
  const {
    connected,
    connectionState,
    queueStatus,
    isQueueStalled,
    queueStatusAgeMs,
    activeJobs,
    completedJobs,
    pauseState,
  } = store;

  const [archiveFilter, setArchiveFilter] = useState(ALL_ARCHIVES);
  const [pendingJobs, setPendingJobs] = useState<JobListItem[]>([]);
  const [apiCompletedJobs, setApiCompletedJobs] = useState<JobListItem[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  const fetchJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const [pendingResp, completedResp, failedResp] = await Promise.all([
        api.jobs.listJobs({ status: 'pending', limit: 50 }),
        api.jobs.listJobs({ status: 'completed', limit: 30 }),
        api.jobs.listJobs({ status: 'failed', limit: 20 }),
      ]);
      setPendingJobs(pendingResp.jobs);
      setApiCompletedJobs([...completedResp.jobs, ...failedResp.jobs].sort((a, b) => {
        const ta = a.completed_at ? Date.parse(a.completed_at) : 0;
        const tb = b.completed_at ? Date.parse(b.completed_at) : 0;
        return tb - ta; // newest first
      }));
    } catch (err) {
      console.error('Failed to fetch jobs from API:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const archiveNames = useMemo(
    () =>
      archives
        .map((a) => a.name)
        .filter((n): n is string => Boolean(n))
        .sort((a, b) => a.localeCompare(b)),
    [archives],
  );

  // Build unique archive names from jobs for filter options
  const jobArchiveNames = useMemo(() => {
    const names = new Set<string>();
    for (const job of activeJobs.values()) {
      if (job.memory) names.add(job.memory);
    }
    for (const job of completedJobs) {
      if (job.memory) names.add(job.memory);
    }
    for (const job of pendingJobs) {
      if (job.payload && typeof job.payload === 'object' && 'memory' in job.payload) {
        const mem = job.payload.memory;
        if (typeof mem === 'string') names.add(mem);
      }
    }
    // Merge with known archive names
    for (const name of archiveNames) {
      names.add(name);
    }
    return Array.from(names).sort();
  }, [activeJobs, completedJobs, pendingJobs, archiveNames]);

  const filteredActiveJobs = useMemo(() => {
    const all = Array.from(activeJobs.values());
    if (archiveFilter === ALL_ARCHIVES) return all;
    return all.filter((j) => j.memory === archiveFilter);
  }, [activeJobs, archiveFilter]);

  const filteredPendingJobs = useMemo(() => {
    if (archiveFilter === ALL_ARCHIVES) return pendingJobs;
    return pendingJobs.filter((j) => {
      const mem = j.payload && typeof j.payload === 'object' && 'memory' in j.payload
        ? j.payload.memory : undefined;
      return mem === archiveFilter;
    });
  }, [pendingJobs, archiveFilter]);

  // Merge WebSocket-sourced completed jobs with API-fetched ones (deduplicated)
  const mergedCompletedJobs = useMemo(() => {
    const seen = new Set<string>();
    const merged: typeof completedJobs = [];
    // WebSocket events are more recent, add them first
    for (const job of completedJobs) {
      if (!seen.has(job.job_id)) {
        seen.add(job.job_id);
        merged.push(job);
      }
    }
    // Add API-fetched completed jobs that weren't already seen via WebSocket
    for (const apiJob of apiCompletedJobs) {
      if (!seen.has(apiJob.id)) {
        seen.add(apiJob.id);
        merged.push({
          job_id: apiJob.id,
          job_type: apiJob.job_type,
          note_id: apiJob.note_id ?? undefined,
          status: apiJob.status === 'failed' ? 'failed' : 'completed',
          duration_ms: apiJob.started_at && apiJob.completed_at
            ? Date.parse(apiJob.completed_at) - Date.parse(apiJob.started_at)
            : undefined,
          error: apiJob.error_message ?? undefined,
          timestamp: apiJob.completed_at ? Date.parse(apiJob.completed_at) : Date.parse(apiJob.created_at),
        });
      }
    }
    return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  }, [completedJobs, apiCompletedJobs]);

  const filteredCompletedJobs = useMemo(() => {
    if (archiveFilter === ALL_ARCHIVES) return mergedCompletedJobs;
    return mergedCompletedJobs.filter((j) => j.memory === archiveFilter);
  }, [mergedCompletedJobs, archiveFilter]);

  const globalState = pauseState.global;
  const [isMutating, setIsMutating] = useState(false);

  const handlePauseResume = async (action: () => Promise<unknown>) => {
    setIsMutating(true);
    try {
      await action();
      await jobEventStore.refreshPauseState();
    } catch (err) {
      console.error('Pause/resume action failed:', err);
    } finally {
      setIsMutating(false);
    }
  };

  const connectionLabel =
    connectionState === 'stale'
      ? 'Stale'
      : connectionState === 'reconnecting'
        ? 'Reconnecting'
        : connected
          ? 'Connected'
          : 'Disconnected';

  const connectionColor = !connected
    ? 'text-red-500'
    : isQueueStalled
      ? 'text-amber-500'
      : 'text-green-500';

  const connectionIcon = !connected ? (
    <AlertCircle className="h-4 w-4" />
  ) : isQueueStalled ? (
    <AlertTriangle className="h-4 w-4" />
  ) : (
    <Activity className="h-4 w-4" />
  );

  return (
    <div className="flex flex-col h-full gap-6 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor active and completed processing jobs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 ${connectionColor}`}>
            {connectionIcon}
            <span className="text-sm">{connectionLabel}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoadingJobs}
            onClick={() => {
              void jobEventStore.refreshPauseState();
              void fetchJobs();
            }}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingJobs ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Queue Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {archiveFilter !== ALL_ARCHIVES ? filteredActiveJobs.length : queueStatus.running}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Running</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {archiveFilter !== ALL_ARCHIVES ? filteredPendingJobs.length : Math.max(queueStatus.pending, pendingJobs.length)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-gray-600">{queueStatus.total_jobs}</div>
            <p className="text-sm text-muted-foreground mt-1">Total (global)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-emerald-600">{filteredCompletedJobs.length}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Completed{archiveFilter !== ALL_ARCHIVES ? '' : ' (recent)'}
            </p>
          </CardContent>
        </Card>
      </div>

      {isQueueStalled && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            Queue appears stalled ({Math.floor(queueStatusAgeMs / 60000)}m since last update).
          </span>
        </div>
      )}

      {/* Global Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Global Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant={globalState === 'paused' ? 'destructive' : 'secondary'}>
              {globalState}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={isMutating || globalState === 'paused'}
              onClick={() => void handlePauseResume(() => api.jobs.pauseGlobal())}
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause All
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isMutating || globalState !== 'paused'}
              onClick={() => void handlePauseResume(() => api.jobs.resumeGlobal())}
            >
              <Play className="h-4 w-4 mr-2" />
              Resume All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Archive Filter */}
      {jobArchiveNames.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by archive:</span>
          <Select value={archiveFilter} onValueChange={setArchiveFilter}>
            <SelectTrigger className="w-[200px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ARCHIVES}>All Archives</SelectItem>
              {jobArchiveNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {archiveFilter !== ALL_ARCHIVES && (
            <Button variant="ghost" size="sm" onClick={() => setArchiveFilter(ALL_ARCHIVES)}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Active Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Active Jobs{' '}
            {filteredActiveJobs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filteredActiveJobs.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredActiveJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active jobs
            </p>
          ) : (
            <div className="space-y-4">
              {filteredActiveJobs.map((job) => (
                <div key={job.job_id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${getJobTypeColor(job.job_type)}`} />
                      <span className="font-medium">{formatJobType(job.job_type)}</span>
                      {job.memory && (
                        <Badge variant="outline" className="text-xs">
                          {job.memory}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-sm text-muted-foreground">
                        {job.progress_percent > 0
                          ? `${job.progress_percent}%`
                          : 'Starting...'}
                      </span>
                    </div>
                  </div>
                  {job.progress_percent > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getJobTypeColor(job.job_type)}`}
                        style={{ width: `${Math.min(100, job.progress_percent)}%` }}
                      />
                    </div>
                  )}
                  {job.step_name && (
                    <p className="text-sm text-muted-foreground">
                      {job.steps_total && job.step_current
                        ? `Step ${job.step_current}/${job.steps_total}: ${job.step_name}`
                        : job.step_name}
                    </p>
                  )}
                  {job.message && !job.step_name && (
                    <p className="text-sm text-muted-foreground">{job.message}</p>
                  )}
                  {job.note_id && (
                    <p className="text-xs text-muted-foreground">
                      Note: {job.note_id.substring(0, 8)}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Queue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              Pending Queue
              {filteredPendingJobs.length > 0 && (
                <Badge variant="secondary">
                  {filteredPendingJobs.length}
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Jobs waiting to be processed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPendingJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No pending jobs
            </p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto rounded-md border">
              <div className="divide-y divide-border/50">
                {filteredPendingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between py-2.5 px-3 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${getJobTypeColor(job.job_type)}`}
                      />
                      <span className="text-sm font-medium">{formatJobType(job.job_type)}</span>
                      {job.note_id && (
                        <span className="text-xs text-muted-foreground font-mono truncate" title={job.note_id}>
                          {job.note_id.substring(0, 12)}
                        </span>
                      )}
                      {job.priority != null && job.priority > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          P{job.priority}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                      {job.retry_count != null && job.retry_count > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600">
                          retry {job.retry_count}
                        </Badge>
                      )}
                      <Clock className="h-3 w-3" />
                      <span>{new Date(job.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Recent Activity
              {filteredCompletedJobs.length > 0 && (
                <Badge variant="secondary">
                  {filteredCompletedJobs.length}
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Recently completed and failed jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompletedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto rounded-md border">
              <div className="divide-y divide-border/50">
                {filteredCompletedJobs.map((job, index) => (
                  <div
                    key={`${job.job_id}-${index}`}
                    className="flex items-center justify-between py-2.5 px-3 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {job.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${getJobTypeColor(job.job_type)}`}
                      />
                      <span className="text-sm font-medium">{formatJobType(job.job_type)}</span>
                      {job.note_id && (
                        <span className="text-xs text-muted-foreground font-mono truncate" title={job.note_id}>
                          {job.note_id.substring(0, 12)}
                        </span>
                      )}
                      {job.memory && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {job.memory}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                      {job.error && (
                        <span className="text-red-500 max-w-[200px] truncate" title={job.error}>
                          {job.error}
                        </span>
                      )}
                      {job.duration_ms != null && (
                        <span>{formatDuration(job.duration_ms)}</span>
                      )}
                      <Clock className="h-3 w-3" />
                      <span>{new Date(job.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Archive Stats */}
      {archives.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
            Per-Archive Job Management
          </summary>
          <div className="mt-3">
            <JobManagementPanel archives={archives} />
          </div>
        </details>
      )}
    </div>
  );
}
