import type { ActiveJob, JobStoreState } from './jobEventStore';

export type PersistedJobState = Pick<JobStoreState,
  'completedJobs' | 'queueStatus' | 'activeStepLabel' | 'pauseState' | 'lastUpdatedAt'
> & { activeJobs: [string, ActiveJob][] };

const PREFIX = 'hotm.jobStore.v2.';
const MAX_BYTES = 1024 * 1024;
const MAX_ACTIVE = 256;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 8192): v is string => typeof v === 'string' && v.length <= max;
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
const optionalText = (v: Record<string, unknown>, fields: string[]) => fields.every(k => v[k] === undefined || text(v[k]));
const optionalNumber = (v: Record<string, unknown>, fields: string[]) => fields.every(k => v[k] === undefined || number(v[k]));

function job(v: unknown, active: boolean): boolean {
  if (!record(v) || !text(v.job_id, 255) || !v.job_id || !text(v.job_type, 255) || !v.job_type) return false;
  if (!optionalText(v, ['note_id', 'memory'])) return false;
  if (active) {
    return keys(v, ['job_id','job_type','note_id','memory','progress_percent','message','started_at','step_name','steps_total','step_current'])
      && number(v.progress_percent) && v.progress_percent <= 100
      && text(v.started_at, 64) && Number.isFinite(Date.parse(v.started_at)) && Date.parse(v.started_at) <= Date.now()
      && optionalText(v, ['message', 'step_name']) && optionalNumber(v, ['steps_total', 'step_current']);
  }
  return keys(v, ['job_id','job_type','note_id','memory','status','duration_ms','error','timestamp'])
    && (v.status === 'completed' || v.status === 'failed')
    && number(v.timestamp) && v.timestamp <= Date.now()
    && optionalNumber(v, ['duration_ms']) && optionalText(v, ['error']);
}

function valid(v: unknown): v is PersistedJobState {
  if (!record(v) || !keys(v, ['activeJobs','completedJobs','queueStatus','activeStepLabel','pauseState','lastUpdatedAt'])) return false;
  if (!Array.isArray(v.activeJobs) || v.activeJobs.length > MAX_ACTIVE
    || !v.activeJobs.every(row => Array.isArray(row) && row.length === 2 && job(row[1], true) && row[0] === row[1].job_id)
    || new Set(v.activeJobs.map(row => row[0])).size !== v.activeJobs.length) return false;
  if (!Array.isArray(v.completedJobs) || v.completedJobs.length > 50 || !v.completedJobs.every(j => job(j, false))) return false;
  const queue = v.queueStatus;
  if (!record(queue) || !keys(queue, ['total_jobs','running','pending'])
    || !['total_jobs','running','pending'].every(k => number(queue[k]) && Number.isSafeInteger(queue[k]))) return false;
  if (v.activeStepLabel !== null && !text(v.activeStepLabel)) return false;
  if (!record(v.pauseState) || !keys(v.pauseState, ['global','archives']) || !text(v.pauseState.global, 255)
    || !record(v.pauseState.archives) || Object.keys(v.pauseState.archives).length > 256
    || !Object.entries(v.pauseState.archives).every(([k, value]) => text(k, 255) && text(value, 255))) return false;
  return number(v.lastUpdatedAt) && v.lastUpdatedAt <= Date.now();
}

function cacheKey(owner: string): string {
  if (!/^[a-f0-9]{64}$/.test(owner)) throw new Error('Invalid job cache owner');
  return PREFIX + owner;
}

export function readJobStoreCache(owner: string): PersistedJobState | null {
  try {
    const raw = localStorage.getItem(cacheKey(owner));
    if (!raw || raw.length > MAX_BYTES || new TextEncoder().encode(raw).length > MAX_BYTES) return null;
    const envelope: unknown = JSON.parse(raw);
    if (!record(envelope) || !keys(envelope, ['version','owner','data'])
      || envelope.version !== 2 || envelope.owner !== owner || !valid(envelope.data)) return null;
    return envelope.data;
  } catch { return null; }
}

export function writeJobStoreCache(owner: string, data: PersistedJobState): void {
  try {
    if (!valid(data)) return;
    const raw = JSON.stringify({ version: 2, owner, data });
    if (raw.length > MAX_BYTES || new TextEncoder().encode(raw).length > MAX_BYTES) return;
    localStorage.setItem(cacheKey(owner), raw);
  } catch {
    // An unavailable or full cache must not disable live job state.
  }
}
