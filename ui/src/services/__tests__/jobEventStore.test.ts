import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RealtimeEvent, RealtimeEventType } from '@/services/realtimeEventBus';

// Capture the handler registered by the store
let capturedEventHandler: ((event: RealtimeEvent) => void) | null = null;
let capturedConnectionHandler: ((connected: boolean) => void) | null = null;

vi.mock('@/services/realtimeEventBus', () => ({
  realtimeEventBus: {
    subscribe: vi.fn((handler: (event: RealtimeEvent) => void) => {
      capturedEventHandler = handler;
      return () => { capturedEventHandler = null; };
    }),
  },
}));

vi.mock('@/services/websocket', () => ({
  default: {
    getConnectionStatus: vi.fn(() => true),
    getConnectionState: vi.fn(() => 'connected'),
    subscribeConnection: vi.fn((handler: (connected: boolean) => void) => {
      capturedConnectionHandler = handler;
      handler(true);
      return () => { capturedConnectionHandler = null; };
    }),
    subscribeConnectionState: vi.fn((handler: (state: string) => void) => {
      handler('connected');
      return () => {};
    }),
  },
}));

vi.mock('@/api', () => ({
  api: {
    jobs: {
      getPauseStatus: vi.fn(() => Promise.resolve({ global: 'running', archives: {} })),
    },
  },
}));

function makeEvent(overrides: Partial<RealtimeEvent> & { type: RealtimeEventType }): RealtimeEvent {
  return {
    received_at: Date.now(),
    ...overrides,
  };
}

describe('jobEventStore', () => {
  let mod: typeof import('@/services/jobEventStore');

  beforeEach(async () => {
    capturedEventHandler = null;
    capturedConnectionHandler = null;
    localStorage.clear();
    vi.useFakeTimers();

    // Fresh import to get a new singleton each test
    vi.resetModules();
    mod = await import('@/services/jobEventStore');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with default state', () => {
    const state = mod.jobEventStore.getSnapshot();
    expect(state.activeJobs.size).toBe(0);
    expect(state.completedJobs).toEqual([]);
    expect(state.queueStatus).toEqual({ total_jobs: 0, running: 0, pending: 0 });
    expect(state.activeStepLabel).toBeNull();
    expect(state.connected).toBe(true);
  });

  it('tracks active jobs on JobStarted', () => {
    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'AiRevision',
      note_id: 'n1',
      memory: 'archive-a',
    }));

    const state = mod.jobEventStore.getSnapshot();
    expect(state.activeJobs.size).toBe(1);
    const job = state.activeJobs.get('j1')!;
    expect(job.job_type).toBe('AiRevision');
    expect(job.note_id).toBe('n1');
    expect(job.memory).toBe('archive-a');
    expect(job.progress_percent).toBe(0);
    expect(state.queueStatus.running).toBe(1);
  });

  it('updates progress on JobProgress', () => {
    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'Embedding',
    }));
    capturedEventHandler!(makeEvent({
      type: 'JobProgress',
      job_id: 'j1',
      progress_percent: 50,
      step_name: 'Chunking',
      step_current: 2,
      steps_total: 4,
    }));

    const state = mod.jobEventStore.getSnapshot();
    const job = state.activeJobs.get('j1')!;
    expect(job.progress_percent).toBe(50);
    expect(job.step_name).toBe('Chunking');
    expect(state.activeStepLabel).toBe('2/4: Chunking');
  });

  it('moves job to completed on JobCompleted', () => {
    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'Linking',
      memory: 'archive-b',
    }));
    capturedEventHandler!(makeEvent({
      type: 'JobCompleted',
      job_id: 'j1',
      job_type: 'Linking',
      duration_ms: 1200,
    }));

    const state = mod.jobEventStore.getSnapshot();
    expect(state.activeJobs.size).toBe(0);
    expect(state.completedJobs).toHaveLength(1);
    expect(state.completedJobs[0].status).toBe('completed');
    expect(state.completedJobs[0].duration_ms).toBe(1200);
    expect(state.completedJobs[0].memory).toBe('archive-b');
    expect(state.activeStepLabel).toBeNull();
  });

  it('moves job to completed on JobFailed', () => {
    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'Embedding',
    }));
    capturedEventHandler!(makeEvent({
      type: 'JobFailed',
      job_id: 'j1',
      job_type: 'Embedding',
      error: 'Ollama unavailable',
    }));

    const state = mod.jobEventStore.getSnapshot();
    expect(state.activeJobs.size).toBe(0);
    expect(state.completedJobs).toHaveLength(1);
    expect(state.completedJobs[0].status).toBe('failed');
    expect(state.completedJobs[0].error).toBe('Ollama unavailable');
  });

  it('updates queue status on QueueStatus event', () => {
    capturedEventHandler!(makeEvent({
      type: 'QueueStatus',
      total_jobs: 10,
      running: 3,
      pending: 7,
    }));

    const state = mod.jobEventStore.getSnapshot();
    expect(state.queueStatus).toEqual({ total_jobs: 10, running: 3, pending: 7 });
  });

  it('increments pending on JobQueued', () => {
    capturedEventHandler!(makeEvent({ type: 'QueueStatus', total_jobs: 5, running: 1, pending: 4 }));
    capturedEventHandler!(makeEvent({ type: 'JobQueued', job_id: 'j-new' }));

    const state = mod.jobEventStore.getSnapshot();
    expect(state.queueStatus.pending).toBe(5);
    expect(state.queueStatus.total_jobs).toBe(6);
  });

  it('removes retry failures when the same job is queued again', () => {
    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'KeyframeVision',
    }));
    capturedEventHandler!(makeEvent({
      type: 'JobFailed',
      job_id: 'j1',
      job_type: 'KeyframeVision',
      error: 'Vision LLM failed - will retry',
    }));
    expect(mod.jobEventStore.getSnapshot().completedJobs).toHaveLength(1);

    capturedEventHandler!(makeEvent({
      type: 'JobQueued',
      job_id: 'j1',
      job_type: 'KeyframeVision',
    }));

    const state = mod.jobEventStore.getSnapshot();
    expect(state.completedJobs).toHaveLength(0);
    expect(state.queueStatus.pending).toBe(1);
  });

  it('removes retry failures when the same job starts again', () => {
    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'KeyframeVision',
    }));
    capturedEventHandler!(makeEvent({
      type: 'JobFailed',
      job_id: 'j1',
      job_type: 'KeyframeVision',
      error: 'Vision LLM failed - will retry',
    }));
    expect(mod.jobEventStore.getSnapshot().completedJobs).toHaveLength(1);

    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'KeyframeVision',
    }));

    const state = mod.jobEventStore.getSnapshot();
    expect(state.completedJobs).toHaveLength(0);
    expect(state.activeJobs.has('j1')).toBe(true);
  });

  it('caps completed jobs at 50', () => {
    for (let i = 0; i < 60; i++) {
      capturedEventHandler!(makeEvent({
        type: 'JobStarted',
        job_id: `j${i}`,
        job_type: 'Embedding',
      }));
      capturedEventHandler!(makeEvent({
        type: 'JobCompleted',
        job_id: `j${i}`,
        job_type: 'Embedding',
      }));
    }

    const state = mod.jobEventStore.getSnapshot();
    expect(state.completedJobs.length).toBeLessThanOrEqual(50);
  });

  it('notifies subscribers on state change', () => {
    const listener = vi.fn();
    const unsub = mod.jobEventStore.subscribe(listener);

    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'Linking',
    }));

    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('persists to localStorage and hydrates', async () => {
    capturedEventHandler!(makeEvent({
      type: 'JobStarted',
      job_id: 'j1',
      job_type: 'AiRevision',
    }));
    capturedEventHandler!(makeEvent({
      type: 'JobCompleted',
      job_id: 'j1',
      job_type: 'AiRevision',
      duration_ms: 500,
    }));

    // Verify localStorage was written
    const stored = localStorage.getItem('hotm.jobStore');
    expect(stored).toBeTruthy();

    // Re-import to test hydration
    vi.resetModules();
    const mod2 = await import('@/services/jobEventStore');
    const state = mod2.jobEventStore.getSnapshot();
    expect(state.completedJobs).toHaveLength(1);
    expect(state.completedJobs[0].job_type).toBe('AiRevision');
  });

  it('clears stale active jobs on hydration', async () => {
    // Simulate an old active job in localStorage
    const staleData = {
      activeJobs: [['old-j', {
        job_id: 'old-j',
        job_type: 'Embedding',
        progress_percent: 50,
        started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
        message: 'Stale',
      }]],
      completedJobs: [],
      queueStatus: { total_jobs: 1, running: 1, pending: 0 },
      activeStepLabel: null,
      pauseState: { global: 'running', archives: {} },
      lastUpdatedAt: Date.now() - 10 * 60 * 1000,
    };
    localStorage.setItem('hotm.jobStore', JSON.stringify(staleData));

    vi.resetModules();
    const mod2 = await import('@/services/jobEventStore');
    const state = mod2.jobEventStore.getSnapshot();
    expect(state.activeJobs.size).toBe(0); // stale job was pruned
  });

  it('updates connection state from websocket', () => {
    capturedConnectionHandler!(false);
    expect(mod.jobEventStore.getSnapshot().connected).toBe(false);

    capturedConnectionHandler!(true);
    expect(mod.jobEventStore.getSnapshot().connected).toBe(true);
  });
});
