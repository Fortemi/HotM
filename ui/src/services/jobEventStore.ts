/**
 * Centralized Job Event Store
 *
 * Single source of truth for all job-related state. Subscribes once to
 * realtimeEventBus and webSocketService, accumulates state, persists to
 * localStorage, and exposes a useSyncExternalStore-compatible API so any
 * React component can read consistent job data without duplicate
 * subscriptions.
 */

import { realtimeEventBus, type RealtimeEvent } from '@/services/realtimeEventBus';
import webSocketService, {
  type RealtimeConnectionState,
} from '@/services/websocket';
import { api } from '@/api';
import { getDataContextCacheIdentity, getDataContextRevision, subscribeDataContextChanges } from '@/api/data-context';
import { getActiveMemory } from '@/api/memory-context';
import { resolveRealtimeArchive } from '@/api/realtime-context';
import { readJobStoreCache, writeJobStoreCache } from './jobStorePersistence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveJob {
  job_id: string;
  job_type: string;
  note_id?: string;
  memory?: string; // archive name for filtering
  progress_percent: number;
  message?: string;
  started_at: string;
  step_name?: string;
  steps_total?: number;
  step_current?: number;
}

export interface CompletedJob {
  job_id: string;
  job_type: string;
  note_id?: string;
  memory?: string; // archive name for filtering
  status: 'completed' | 'failed';
  duration_ms?: number;
  error?: string;
  timestamp: number; // epoch ms — serializable, unlike Date
}

export interface QueueStatus {
  total_jobs: number;
  running: number;
  pending: number;
}

export interface PauseState {
  global: string;
  archives: Record<string, string>;
}

export interface JobStoreState {
  activeJobs: Map<string, ActiveJob>;
  completedJobs: CompletedJob[];
  queueStatus: QueueStatus;
  activeStepLabel: string | null;
  pauseState: PauseState;
  connected: boolean;
  connectionState: RealtimeConnectionState;
  isQueueStalled: boolean;
  queueStatusAgeMs: number;
  lastUpdatedAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_COMPLETED = 50;
const STALE_ACTIVE_JOB_MS = 5 * 60 * 1000;
const QUEUE_STALE_THRESHOLD_MS = 5 * 60 * 1000;
const STALE_CHECK_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// JobEventStore
// ---------------------------------------------------------------------------

type Listener = () => void;

class JobEventStore {
  private state: JobStoreState;
  private listeners = new Set<Listener>();
  private lastQueueUpdateAt: number;
  private contextRevision = getDataContextRevision();
  private pauseRevision = 0;
  private disposed = false;
  private subscriptions: (() => void)[] = [];
  private unsubscribeContext: () => void;
  private staleTimer: ReturnType<typeof setInterval>;
  private cacheOwner: string | null = null;
  private dataVersion = 0;
  ready: Promise<void>;

  constructor() {
    this.lastQueueUpdateAt = Date.now();

    this.state = {
      activeJobs: new Map(),
      completedJobs: [],
      queueStatus: { total_jobs: 0, running: 0, pending: 0 },
      activeStepLabel: null,
      pauseState: { global: 'running', archives: {} },
      connected: webSocketService.getConnectionStatus(),
      connectionState: webSocketService.getConnectionState(),
      isQueueStalled: false,
      queueStatusAgeMs: 0,
      lastUpdatedAt: Date.now(),
    };

    this.unsubscribeContext = subscribeDataContextChanges(this.resetContext);
    this.subscribeToEvents();
    this.subscribeToConnection();
    this.staleTimer = this.startStaleChecker();
    this.ready = this.initializePersistence();
  }

  // ---- useSyncExternalStore API ----

  subscribe = (listener: Listener): (() => void) => {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): JobStoreState => {
    return this.state;
  };

  getServerSnapshot = (): JobStoreState => {
    return this.state;
  };

  // ---- Public actions ----

  refreshPauseState = async (): Promise<void> => {
    if (this.disposed) return;
    const context = this.contextRevision;
    const request = ++this.pauseRevision;
    const current = () => this.isCurrent(context) && request === this.pauseRevision;
    try {
      const status = await api.jobs.getPauseStatus();
      if (!current()) return;
      this.mutate((s) => {
        s.pauseState = {
          global: status.global ?? 'running',
          archives: status.archives ?? {},
        };
      });
    } catch (err) {
      if (!current()) return;
      console.error('jobEventStore: failed to refresh pause state', err);
    }
  };

  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.cacheOwner = null;
    this.unsubscribeContext();
    this.subscriptions.splice(0).forEach(close => close());
    clearInterval(this.staleTimer);
    this.listeners.clear();
  };

  // ---- Internal ----

  private isCurrent(context: number): boolean {
    return !this.disposed && context === this.contextRevision && context === getDataContextRevision();
  }

  private resetContext = (): void => {
    const next = getDataContextRevision();
    if (this.disposed || next === this.contextRevision) return;
    this.contextRevision = next;
    this.cacheOwner = null;
    this.dataVersion = 0;
    this.subscriptions.splice(0).forEach(close => close());
    this.lastQueueUpdateAt = Date.now();
    this.state = {
      activeJobs: new Map(), completedJobs: [],
      queueStatus: { total_jobs: 0, running: 0, pending: 0 },
      activeStepLabel: null, pauseState: { global: 'running', archives: {} },
      connected: webSocketService.getConnectionStatus(),
      connectionState: webSocketService.getConnectionState(),
      isQueueStalled: false, queueStatusAgeMs: 0, lastUpdatedAt: Date.now(),
    };
    // Replace owned callbacks so queued callbacks from the old subscription fail closed.
    this.subscribeToEvents();
    this.subscribeToConnection();
    this.ready = this.initializePersistence();
    this.notify();
  };

  private mutate(updater: (state: JobStoreState) => void, persist = true): void {
    if (!this.isCurrent(this.contextRevision)) return;
    // Shallow-clone so React detects referential change
    const next = { ...this.state };
    updater(next);
    next.lastUpdatedAt = Date.now();
    this.state = next;
    if (persist) { this.dataVersion += 1; this.persist(); }
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('jobEventStore listener error:', err);
      }
    });
  }

  // ---- Event bus subscription ----

  private subscribeToEvents(): void {
    const context = this.contextRevision;
    this.subscriptions.push(realtimeEventBus.subscribe((event: RealtimeEvent) => {
      if (!this.isCurrent(context)) return;
      switch (event.type) {
        case 'JobQueued':
          this.handleJobQueued(event);
          break;
        case 'JobStarted':
          this.handleJobStarted(event);
          break;
        case 'JobProgress':
          this.handleJobProgress(event);
          break;
        case 'JobCompleted':
          this.handleJobCompleted(event);
          break;
        case 'JobFailed':
          this.handleJobFailed(event);
          break;
        case 'QueueStatus':
          this.handleQueueStatus(event);
          break;
        case 'JobsPaused':
        case 'JobsResumed':
          void this.refreshPauseState();
          break;
      }
    }));
  }

  private handleJobQueued(_event: RealtimeEvent): void {
    this.mutate((s) => {
      if (_event.job_id) {
        s.completedJobs = s.completedJobs.filter((job) => job.job_id !== _event.job_id);
      }
      s.queueStatus = {
        ...s.queueStatus,
        pending: s.queueStatus.pending + 1,
        total_jobs: s.queueStatus.total_jobs + 1,
      };
    });
    this.lastQueueUpdateAt = Date.now();
  }

  private handleJobStarted(event: RealtimeEvent): void {
    if (!event.job_id || !event.job_type) return;
    this.mutate((s) => {
      const newActiveJobs = new Map(s.activeJobs);
      newActiveJobs.set(event.job_id!, {
        job_id: event.job_id!,
        job_type: event.job_type!,
        note_id: event.note_id,
        memory: event.memory,
        progress_percent: 0,
        message: 'Starting...',
        started_at: new Date().toISOString(),
      });
      s.activeJobs = newActiveJobs;
      s.completedJobs = s.completedJobs.filter((job) => job.job_id !== event.job_id);
      s.queueStatus = {
        ...s.queueStatus,
        pending: Math.max(0, s.queueStatus.pending - 1),
        running: s.queueStatus.running + 1,
      };
    });
    this.lastQueueUpdateAt = Date.now();
  }

  private handleJobProgress(event: RealtimeEvent): void {
    if (!event.job_id) return;
    const stepLabel =
      event.step_name
        ? event.steps_total && event.step_current
          ? `${event.step_current}/${event.steps_total}: ${event.step_name}`
          : event.step_name
        : null;

    this.mutate((s) => {
      const existing = s.activeJobs.get(event.job_id!);
      if (existing) {
        const newActiveJobs = new Map(s.activeJobs);
        newActiveJobs.set(event.job_id!, {
          ...existing,
          progress_percent: event.progress_percent ?? existing.progress_percent,
          message: event.message || existing.message,
          step_name: event.step_name ?? existing.step_name,
          steps_total: event.steps_total ?? existing.steps_total,
          step_current: event.step_current ?? existing.step_current,
        });
        s.activeJobs = newActiveJobs;
      }
      if (stepLabel) {
        s.activeStepLabel = stepLabel;
      }
    });
  }

  private handleJobCompleted(event: RealtimeEvent): void {
    if (!event.job_id) return;
    this.mutate((s) => {
      const newActiveJobs = new Map(s.activeJobs);
      const prev = newActiveJobs.get(event.job_id!);
      newActiveJobs.delete(event.job_id!);
      s.activeJobs = newActiveJobs;
      s.completedJobs = [
        {
          job_id: event.job_id!,
          job_type: event.job_type || 'unknown',
          note_id: event.note_id,
          memory: event.memory ?? prev?.memory,
          status: 'completed',
          duration_ms: event.duration_ms,
          timestamp: Date.now(),
        },
        ...s.completedJobs.slice(0, MAX_COMPLETED - 1),
      ];
      s.queueStatus = {
        ...s.queueStatus,
        running: Math.max(0, s.queueStatus.running - 1),
        total_jobs: Math.max(0, s.queueStatus.total_jobs - 1),
      };
      if (newActiveJobs.size === 0) {
        s.activeStepLabel = null;
      }
    });
    this.lastQueueUpdateAt = Date.now();
  }

  private handleJobFailed(event: RealtimeEvent): void {
    if (!event.job_id) return;
    this.mutate((s) => {
      const newActiveJobs = new Map(s.activeJobs);
      const prev = newActiveJobs.get(event.job_id!);
      newActiveJobs.delete(event.job_id!);
      s.activeJobs = newActiveJobs;
      s.completedJobs = [
        {
          job_id: event.job_id!,
          job_type: event.job_type || 'unknown',
          note_id: event.note_id,
          memory: event.memory ?? prev?.memory,
          status: 'failed',
          duration_ms: event.duration_ms,
          error: event.error,
          timestamp: Date.now(),
        },
        ...s.completedJobs.slice(0, MAX_COMPLETED - 1),
      ];
      s.queueStatus = {
        ...s.queueStatus,
        running: Math.max(0, s.queueStatus.running - 1),
        total_jobs: Math.max(0, s.queueStatus.total_jobs - 1),
      };
      if (newActiveJobs.size === 0) {
        s.activeStepLabel = null;
      }
    });
    this.lastQueueUpdateAt = Date.now();
  }

  private handleQueueStatus(event: RealtimeEvent): void {
    this.mutate((s) => {
      s.queueStatus = {
        total_jobs: event.total_jobs ?? 0,
        running: event.running ?? 0,
        pending: event.pending ?? 0,
      };
    });
    this.lastQueueUpdateAt = Date.now();
  }

  // ---- Connection state ----

  private subscribeToConnection(): void {
    const context = this.contextRevision;
    this.subscriptions.push(webSocketService.subscribeConnection((connected) => {
      if (!this.isCurrent(context)) return;
      this.mutate((s) => {
        s.connected = connected;
      }, false);
    }));
    this.subscriptions.push(webSocketService.subscribeConnectionState((state) => {
      if (!this.isCurrent(context)) return;
      this.mutate((s) => {
        s.connectionState = state;
      }, false);
    }));
  }

  // ---- Stale queue checker ----

  private startStaleChecker(): ReturnType<typeof setInterval> {
    return setInterval(() => {
      if (!this.isCurrent(this.contextRevision)) return;
      const now = Date.now();
      const ageMs = now - this.lastQueueUpdateAt;
      const isStalled =
        this.state.connected &&
        this.state.queueStatus.running > 0 &&
        ageMs >= QUEUE_STALE_THRESHOLD_MS;

      if (
        isStalled !== this.state.isQueueStalled ||
        Math.abs(ageMs - this.state.queueStatusAgeMs) > STALE_CHECK_INTERVAL_MS
      ) {
        this.mutate((s) => {
          s.isQueueStalled = isStalled;
          s.queueStatusAgeMs = ageMs;
        }, false);
      }
    }, STALE_CHECK_INTERVAL_MS);
  }

  // ---- localStorage persistence ----

  private persist(): void {
    if (this.cacheOwner && this.isCurrent(this.contextRevision)) {
      writeJobStoreCache(this.cacheOwner, {
        activeJobs: Array.from(this.state.activeJobs.entries()),
        completedJobs: this.state.completedJobs,
        queueStatus: this.state.queueStatus,
        activeStepLabel: this.state.activeStepLabel,
        pauseState: this.state.pauseState,
        lastUpdatedAt: this.state.lastUpdatedAt,
      });
    }
  }

  private async initializePersistence(): Promise<void> {
    const context = this.contextRevision, version = this.dataVersion;
    try {
      const selected = getActiveMemory(), baseUrl = api.client.baseUrl;
      const archive = await resolveRealtimeArchive(api.archives, selected);
      if (!this.isCurrent(context)) return;
      const owner = await getDataContextCacheIdentity(JSON.stringify([baseUrl, archive.memory, archive.memorySchema]));
      if (!owner || !this.isCurrent(context)) return;
      this.cacheOwner = owner;
      // Live updates received during admission take precedence over the saved snapshot.
      if (version !== this.dataVersion) { this.persist(); return; }
      const data = readJobStoreCache(owner);
      if (!data) return;
      const now = Date.now();
      const freshActiveJobs = new Map<string, ActiveJob>();
      for (const [id, job] of data.activeJobs) {
        if (now - Date.parse(job.started_at) < STALE_ACTIVE_JOB_MS) {
          freshActiveJobs.set(id, job);
        }
      }
      this.lastQueueUpdateAt = data.lastUpdatedAt;
      this.state = {
        ...this.state, ...data,
        activeJobs: freshActiveJobs,
        queueStatusAgeMs: now - data.lastUpdatedAt,
      };
      this.notify();
    } catch {
      // No ownership proof means no hydration or persistence; retain original bytes.
    }
  }
}

// Singleton
export const jobEventStore = new JobEventStore();

if (import.meta.hot) import.meta.hot.dispose(() => jobEventStore.dispose());
