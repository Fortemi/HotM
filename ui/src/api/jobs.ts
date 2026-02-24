import type { ApiClient } from './client';
import { getMemoryRoutingHeaderName } from './memory-context';

export interface JobQueueStats {
  pending: number;
  processing: number;
  completed_last_hour: number;
  failed_last_hour: number;
  total: number;
}

export interface JobListItem {
  id: string;
  job_type: string;
  status: string;
  note_id?: string | null;
  priority?: number;
  progress_percent?: number;
  progress_message?: string | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  retry_count?: number;
  max_retries?: number;
  cost_tier?: string | null;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
}

interface JobListResponse {
  jobs?: JobListItem[];
  pending?: number;
  processing?: number;
  completed_last_hour?: number;
  failed_last_hour?: number;
  total?: number;
}

export interface JobPauseQueueStats {
  pending: number;
  running: number;
}

export interface JobPauseState {
  global: 'running' | 'paused' | string;
  archives: Record<string, string>;
  queue?: JobPauseQueueStats;
}

export interface JobPauseActionResponse {
  status: 'paused' | 'resumed' | string;
  scope: 'global' | 'archive' | string;
  archive?: string;
}

export function createJobsApi(client: ApiClient) {
  const memoryHeader = getMemoryRoutingHeaderName();

  return {
    async getPauseStatus(): Promise<JobPauseState> {
      return client.get<JobPauseState>('/jobs/status');
    },

    async pauseGlobal(): Promise<JobPauseActionResponse> {
      return client.post<JobPauseActionResponse>('/jobs/pause');
    },

    async resumeGlobal(): Promise<JobPauseActionResponse> {
      return client.post<JobPauseActionResponse>('/jobs/resume');
    },

    async pauseArchive(archive: string): Promise<JobPauseActionResponse> {
      return client.post<JobPauseActionResponse>(`/jobs/pause/${encodeURIComponent(archive)}`);
    },

    async resumeArchive(archive: string): Promise<JobPauseActionResponse> {
      return client.post<JobPauseActionResponse>(`/jobs/resume/${encodeURIComponent(archive)}`);
    },

    async listJobs(params?: {
      status?: string;
      limit?: number;
      offset?: number;
      archive?: string;
    }): Promise<{ jobs: JobListItem[]; total: number }> {
      const query: Record<string, string> = {};
      if (params?.status) query.status = params.status;
      if (params?.limit != null) query.limit = String(params.limit);
      if (params?.offset != null) query.offset = String(params.offset);
      if (params?.archive) query.archive = params.archive;
      const headers: Record<string, string> = {};
      if (params?.archive) headers[memoryHeader] = params.archive;
      const resp = await client.get<JobListResponse>('/jobs', query, headers);
      return {
        jobs: Array.isArray(resp.jobs) ? resp.jobs as JobListItem[] : [],
        total: resp.total ?? 0,
      };
    },

    async getQueueStats(): Promise<JobQueueStats> {
      return client.get<JobQueueStats>('/jobs/stats');
    },

    async getQueueStatsForArchive(archive: string): Promise<JobQueueStats> {
      return client.get<JobQueueStats>(
        '/jobs/stats',
        { archive },
        { [memoryHeader]: archive, 'Cache-Control': 'no-cache' }
      );
    },

    async getArchiveJobCounts(archive: string): Promise<JobQueueStats> {
      const response = await client.get<JobListResponse>(
        '/jobs',
        {
          limit: '500',
          offset: '0',
          archive,
        },
        { [memoryHeader]: archive, 'Cache-Control': 'no-cache' }
      );

      const jobs = Array.isArray(response.jobs) ? response.jobs : [];
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const completedLastHourFromJobs = jobs.filter((job) => {
        if (job.status !== 'completed' || !job.completed_at) return false;
        const ts = Date.parse(job.completed_at);
        return Number.isFinite(ts) && ts >= oneHourAgo;
      }).length;
      const failedLastHourFromJobs = jobs.filter((job) => {
        if (job.status !== 'failed' || !job.completed_at) return false;
        const ts = Date.parse(job.completed_at);
        return Number.isFinite(ts) && ts >= oneHourAgo;
      }).length;

      return {
        pending: response.pending ?? jobs.filter((job) => job.status === 'pending').length,
        processing: response.processing ?? jobs.filter((job) => job.status === 'running').length,
        completed_last_hour: response.completed_last_hour ?? completedLastHourFromJobs,
        failed_last_hour: response.failed_last_hour ?? failedLastHourFromJobs,
        total: response.total ?? jobs.length,
      };
    },
  };
}

export type JobsApi = ReturnType<typeof createJobsApi>;
