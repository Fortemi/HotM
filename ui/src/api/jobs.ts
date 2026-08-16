import type { ApiClient } from './client';
import { getMemoryRoutingHeaderName } from './memory-context';
import { asRecord, ContractDecodeError, finiteNumber, optionalString, requiredString } from './contract-codecs';

const MAX_ARCHIVE_PAUSE_STATES = 100;
const MAX_EXTRACTION_STRATEGIES = 100;

export interface JobQueueStats {
  pending: number;
  processing: number;
  completed_last_hour: number;
  failed_last_hour: number;
  total: number;
  delayed?: number;
  dead?: number;
  incompatible?: number;
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
  has_payload?: boolean;
  has_result?: boolean;
  payload?: { memory?: string } | null;
}

export interface CreateJobRequest {
  job_type: string;
  note_id?: string | null;
  priority?: number | null;
  payload?: Record<string, unknown> | null;
  deduplicate?: boolean;
}

export interface CreateJobResult {
  id: string | null;
  status: 'queued' | 'already_pending' | string;
  message?: string;
}

export interface ExtractionStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  avg_duration_secs: number | null;
  strategy_breakdown: Record<string, number>;
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

function decodeJob(payload: unknown, operationId: string): JobListItem {
  const raw = asRecord(payload, operationId);
  const rawPayload = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
    ? raw.payload as Record<string, unknown>
    : null;
  const memory = typeof rawPayload?.memory === 'string' && rawPayload.memory.length <= 128
    ? rawPayload.memory
    : undefined;
  return {
    id: requiredString(raw, 'id', operationId),
    job_type: requiredString(raw, 'job_type', operationId),
    status: requiredString(raw, 'status', operationId),
    note_id: typeof raw.note_id === 'string' ? raw.note_id : null,
    priority: finiteNumber(raw, 'priority', operationId),
    progress_percent: finiteNumber(raw, 'progress_percent', operationId),
    progress_message: typeof raw.progress_message === 'string' ? raw.progress_message : null,
    error_message: typeof raw.error_message === 'string' ? 'Job failed. Check server logs for diagnostics.' : null,
    created_at: requiredString(raw, 'created_at', operationId),
    started_at: typeof raw.started_at === 'string' ? raw.started_at : null,
    completed_at: typeof raw.completed_at === 'string' ? raw.completed_at : null,
    retry_count: finiteNumber(raw, 'retry_count', operationId),
    max_retries: finiteNumber(raw, 'max_retries', operationId),
    cost_tier: typeof raw.cost_tier === 'string' ? raw.cost_tier : raw.cost_tier == null ? null : String(raw.cost_tier),
    has_payload: raw.payload !== null && raw.payload !== undefined,
    has_result: raw.result !== null && raw.result !== undefined,
    payload: rawPayload ? { ...(memory ? { memory } : {}) } : null,
  };
}

function decodePauseAction(
  payload: unknown,
  operationId: string,
  expectedStatus: 'paused' | 'resumed',
  expectedScope: 'global' | 'archive',
): JobPauseActionResponse {
  const raw = asRecord(payload, operationId);
  const status = requiredString(raw, 'status', operationId);
  const scope = requiredString(raw, 'scope', operationId);
  if (status !== expectedStatus || scope !== expectedScope) {
    throw new ContractDecodeError(operationId, `expected ${expectedStatus}/${expectedScope} result`);
  }
  return {
    status,
    scope,
    archive: optionalString(raw, 'archive'),
  };
}

function decodeQueueStats(payload: unknown, operationId: string): JobQueueStats {
  const raw = asRecord(payload, operationId);
  return {
    pending: finiteNumber(raw, 'pending', operationId),
    processing: finiteNumber(raw, 'processing', operationId),
    completed_last_hour: finiteNumber(raw, 'completed_last_hour', operationId),
    failed_last_hour: finiteNumber(raw, 'failed_last_hour', operationId),
    total: finiteNumber(raw, 'total', operationId),
    delayed: finiteNumber(raw, 'delayed', operationId, 0),
    dead: finiteNumber(raw, 'dead', operationId, 0),
    incompatible: finiteNumber(raw, 'incompatible', operationId, 0),
  };
}

function decodePauseState(payload: unknown): JobPauseState {
  const raw = asRecord(payload, 'get_job_pause_status');
  const global = requiredString(raw, 'global', 'get_job_pause_status');
  if (global !== 'running' && global !== 'paused') {
    throw new ContractDecodeError('get_job_pause_status', 'global must be running or paused');
  }
  const archivesRaw = asRecord(raw.archives ?? {}, 'get_job_pause_status');
  const archiveEntries = Object.entries(archivesRaw);
  if (archiveEntries.length > MAX_ARCHIVE_PAUSE_STATES) {
    throw new ContractDecodeError('get_job_pause_status', `archives exceeds ${MAX_ARCHIVE_PAUSE_STATES} entries`);
  }
  const archives: Record<string, string> = {};
  for (const [archive, state] of archiveEntries) {
    if (state !== 'running' && state !== 'paused') {
      throw new ContractDecodeError('get_job_pause_status', `invalid pause state for archive ${archive}`);
    }
    archives[archive] = state;
  }
  const queueRaw = raw.queue == null ? null : asRecord(raw.queue, 'get_job_pause_status');
  return {
    global,
    archives,
    queue: queueRaw ? {
      pending: finiteNumber(queueRaw, 'pending', 'get_job_pause_status'),
      running: finiteNumber(queueRaw, 'running', 'get_job_pause_status'),
    } : undefined,
  };
}

export function createJobsApi(client: ApiClient) {
  const memoryHeader = getMemoryRoutingHeaderName();

  return {
    async getPauseStatus(): Promise<JobPauseState> {
      return decodePauseState(await client.get<unknown>('/jobs/status'));
    },

    async pauseGlobal(): Promise<JobPauseActionResponse> {
      return decodePauseAction(await client.post<unknown>('/jobs/pause'), 'pause_jobs_global', 'paused', 'global');
    },

    async resumeGlobal(): Promise<JobPauseActionResponse> {
      return decodePauseAction(await client.post<unknown>('/jobs/resume'), 'resume_jobs_global', 'resumed', 'global');
    },

    async pauseArchive(archive: string): Promise<JobPauseActionResponse> {
      if (!archive.trim()) throw new Error('Archive name is required');
      return decodePauseAction(
        await client.post<unknown>(`/jobs/pause/${encodeURIComponent(archive)}`),
        'pause_jobs_archive', 'paused', 'archive',
      );
    },

    async resumeArchive(archive: string): Promise<JobPauseActionResponse> {
      if (!archive.trim()) throw new Error('Archive name is required');
      return decodePauseAction(
        await client.post<unknown>(`/jobs/resume/${encodeURIComponent(archive)}`),
        'resume_jobs_archive', 'resumed', 'archive',
      );
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
      const headers: Record<string, string> = {};
      if (params?.archive) headers[memoryHeader] = params.archive;
      const resp = await client.get<JobListResponse>('/jobs', query, headers);
      return {
        jobs: Array.isArray(resp.jobs) ? resp.jobs.map((job) => decodeJob(job, 'list_jobs')) : [],
        total: resp.total ?? 0,
      };
    },

    async getQueueStats(): Promise<JobQueueStats> {
      return decodeQueueStats(await client.get<unknown>('/jobs/stats'), 'queue_stats');
    },

    async get(jobId: string): Promise<JobListItem> {
      if (!jobId || jobId.trim() === '') throw new Error('Job ID is required');
      return decodeJob(await client.get<unknown>(`/jobs/${encodeURIComponent(jobId)}`), 'get_job');
    },

    async create(request: CreateJobRequest): Promise<CreateJobResult> {
      if (!request.job_type || request.job_type.trim() === '') throw new Error('Job type is required');
      const raw = asRecord(await client.post<unknown>('/jobs', {
        job_type: request.job_type.trim(),
        note_id: request.note_id ?? null,
        priority: request.priority ?? null,
        payload: request.payload ?? null,
        deduplicate: request.deduplicate ?? true,
      }), 'create_job');
      return {
        id: typeof raw.id === 'string' ? raw.id : null,
        status: requiredString(raw, 'status', 'create_job'),
        message: optionalString(raw, 'message'),
      };
    },

    async getPendingCount(): Promise<number> {
      const raw = asRecord(await client.get<unknown>('/jobs/pending'), 'pending_jobs_count');
      return finiteNumber(raw, 'pending', 'pending_jobs_count');
    },

    async getExtractionStats(): Promise<ExtractionStats> {
      const raw = asRecord(await client.get<unknown>('/extraction/stats'), 'extraction_stats');
      const breakdownRaw = raw.strategy_breakdown;
      const strategy_breakdown: Record<string, number> = {};
      if (breakdownRaw && typeof breakdownRaw === 'object' && !Array.isArray(breakdownRaw)) {
        const entries = Object.entries(breakdownRaw);
        if (entries.length > MAX_EXTRACTION_STRATEGIES) {
          throw new ContractDecodeError('extraction_stats', `strategy_breakdown exceeds ${MAX_EXTRACTION_STRATEGIES} entries`);
        }
        entries.forEach(([key, value]) => {
          if (typeof value === 'number' && Number.isFinite(value)) strategy_breakdown[key] = value;
        });
      }
      return {
        total_jobs: finiteNumber(raw, 'total_jobs', 'extraction_stats'),
        completed_jobs: finiteNumber(raw, 'completed_jobs', 'extraction_stats'),
        failed_jobs: finiteNumber(raw, 'failed_jobs', 'extraction_stats'),
        pending_jobs: finiteNumber(raw, 'pending_jobs', 'extraction_stats'),
        avg_duration_secs: typeof raw.avg_duration_secs === 'number' ? raw.avg_duration_secs : null,
        strategy_breakdown,
      };
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
