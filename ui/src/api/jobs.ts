import type { ApiClient } from './client';
import { getMemoryRoutingHeaderName } from './memory-context';

export interface JobQueueStats {
  pending: number;
  processing: number;
  completed_last_hour: number;
  failed_last_hour: number;
  total: number;
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
        undefined,
        { [memoryHeader]: archive }
      );
    },
  };
}

export type JobsApi = ReturnType<typeof createJobsApi>;
