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

const STORAGE_KEY = 'hotm.jobStore';
const MAX_COMPLETED = 50;
const STALE_ACTIVE_JOB_MS = 5 * 60 * 1000;
const QUEUE_STALE_THRESHOLD_MS = 5 * 60 * 1000;
const STALE_CHECK_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// Serializable subset for localStorage
// ---------------------------------------------------------------------------

interface PersistedState {
  activeJobs: [string, ActiveJob][];
  completedJobs: CompletedJob[];
  queueStatus: QueueStatus;
  activeStepLabel: string | null;
  pauseState: PauseState;
  lastUpdatedAt: number;
}

// ---------------------------------------------------------------------------
// JobEventStore
// ---------------------------------------------------------------------------

type Listener = () => void;

class JobEventStore {
  private state: JobStoreState;
  private listeners = new Set<Listener>();
  private lastQueueUpdateAt: number;

  constructor() {
    const hydrated = this.hydrate();

    this.lastQueueUpdateAt = hydrated?.lastUpdatedAt ?? Date.now();

    this.state = {
      activeJobs: hydrated?.activeJobs ?? new Map(),
      completedJobs: hydrated?.completedJobs ?? [],
      queueStatus: hydrated?.queueStatus ?? { total_jobs: 0, running: 0, pending: 0 },
      activeStepLabel: hydrated?.activeStepLabel ?? null,
      pauseState: hydrated?.pauseState ?? { global: 'running', archives: {} },
      connected: webSocketService.getConnectionStatus(),
      connectionState: webSocketService.getConnectionState(),
      isQueueStalled: false,
      queueStatusAgeMs: 0,
      lastUpdatedAt: hydrated?.lastUpdatedAt ?? Date.now(),
    };

    this.subscribeToEvents();
    this.subscribeToConnection();
    this.startStaleChecker();
  }

  // ---- useSyncExternalStore API ----

  subscribe = (listener: Listener): (() => void) => {
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
    try {
      const status = await api.jobs.getPauseStatus();
      this.mutate((s) => {
        s.pauseState = {
          global: status.global ?? 'running',
          archives: status.archives ?? {},
        };
      });
    } catch (err) {
      console.error('jobEventStore: failed to refresh pause state', err);
    }
  };

  // ---- Internal ----

  private mutate(updater: (state: JobStoreState) => void): void {
    // Shallow-clone so React detects referential change
    const next = { ...this.state };
    updater(next);
    next.lastUpdatedAt = Date.now();
    this.state = next;
    this.persist();
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
    realtimeEventBus.subscribe((event: RealtimeEvent) => {
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
    });
  }

  private handleJobQueued(_event: RealtimeEvent): void {
    this.mutate((s) => {
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
    webSocketService.subscribeConnection((connected) => {
      this.mutate((s) => {
        s.connected = connected;
      });
    });
    webSocketService.subscribeConnectionState((state) => {
      this.mutate((s) => {
        s.connectionState = state;
      });
    });
  }

  // ---- Stale queue checker ----

  private startStaleChecker(): void {
    setInterval(() => {
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
        });
      }
    }, STALE_CHECK_INTERVAL_MS);
  }

  // ---- localStorage persistence ----

  private persist(): void {
    try {
      const data: PersistedState = {
        activeJobs: Array.from(this.state.activeJobs.entries()),
        completedJobs: this.state.completedJobs,
        queueStatus: this.state.queueStatus,
        activeStepLabel: this.state.activeStepLabel,
        pauseState: this.state.pauseState,
        lastUpdatedAt: this.state.lastUpdatedAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be full or unavailable
    }
  }

  private hydrate(): Partial<Pick<JobStoreState, 'activeJobs' | 'completedJobs' | 'queueStatus' | 'activeStepLabel' | 'pauseState' | 'lastUpdatedAt'>> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data: PersistedState = JSON.parse(raw);

      const now = Date.now();
      // Clear stale active jobs (>5 min old)
      const freshActiveJobs = new Map<string, ActiveJob>();
      if (Array.isArray(data.activeJobs)) {
        for (const [id, job] of data.activeJobs) {
          const startedMs = Date.parse(job.started_at);
          if (Number.isFinite(startedMs) && now - startedMs < STALE_ACTIVE_JOB_MS) {
            freshActiveJobs.set(id, job);
          }
        }
      }

      return {
        activeJobs: freshActiveJobs,
        completedJobs: Array.isArray(data.completedJobs) ? data.completedJobs.slice(0, MAX_COMPLETED) : [],
        queueStatus: data.queueStatus ?? { total_jobs: 0, running: 0, pending: 0 },
        activeStepLabel: data.activeStepLabel ?? null,
        pauseState: data.pauseState ?? { global: 'running', archives: {} },
        lastUpdatedAt: data.lastUpdatedAt ?? now,
      };
    } catch {
      return null;
    }
  }
}

// Singleton
export const jobEventStore = new JobEventStore();
