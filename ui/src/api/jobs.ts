import type { ApiClient } from './client';
import { getMemoryRoutingHeaderName } from './memory-context';

export interface JobQueueStats {
  pending: number;
  processing: number;
  completed_last_hour: number;
  failed_last_hour: number;
  total: number;
}

interface JobListItem {
  status?: string;
  completed_at?: string | null;
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
      return client.get<JobPauseState>('/api/v1/jobs/status');
    },

    async pauseGlobal(): Promise<JobPauseActionResponse> {
      return client.post<JobPauseActionResponse>('/api/v1/jobs/pause');
    },

    async resumeGlobal(): Promise<JobPauseActionResponse> {
      return client.post<JobPauseActionResponse>('/api/v1/jobs/resume');
    },

    async pauseArchive(archive: string): Promise<JobPauseActionResponse> {
      return client.post<JobPauseActionResponse>(`/api/v1/jobs/pause/${encodeURIComponent(archive)}`);
    },

    async resumeArchive(archive: string): Promise<JobPauseActionResponse> {
      return client.post<JobPauseActionResponse>(`/api/v1/jobs/resume/${encodeURIComponent(archive)}`);
    },

    async getQueueStats(): Promise<JobQueueStats> {
      return client.get<JobQueueStats>('/api/v1/jobs/stats');
    },

    async getQueueStatsForArchive(archive: string): Promise<JobQueueStats> {
      return client.get<JobQueueStats>(
        '/api/v1/jobs/stats',
        { archive },
        { [memoryHeader]: archive, 'Cache-Control': 'no-cache' }
      );
    },

    async getArchiveJobCounts(archive: string): Promise<JobQueueStats> {
      const response = await client.get<JobListResponse>(
        '/api/v1/jobs',
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
