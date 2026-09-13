import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeEvent } from '@/services/realtimeEventBus';

const mocks = vi.hoisted(() => ({
  events: new Set<(e: RealtimeEvent) => void>(),
  connections: new Set<(connected: boolean) => void>(),
  states: new Set<(state: string) => void>(),
  pause: vi.fn(),
}));
vi.mock('@/services/realtimeEventBus', () => ({ realtimeEventBus: {
  subscribe: (handler: (e: RealtimeEvent) => void) => {
    mocks.events.add(handler); return () => { mocks.events.delete(handler); };
  },
} }));
vi.mock('@/services/websocket', () => ({ default: {
  getConnectionStatus: () => false, getConnectionState: () => 'disconnected',
  subscribeConnection: (h: (v: boolean) => void) => { mocks.connections.add(h); return () => { mocks.connections.delete(h); }; },
  subscribeConnectionState: (h: (v: string) => void) => { mocks.states.add(h); return () => { mocks.states.delete(h); }; },
} }));
vi.mock('@/api', () => ({ api: { jobs: { getPauseStatus: mocks.pause } } }));

let store: typeof import('../jobEventStore')['jobEventStore'];
let auth: typeof import('@/api/auth-context');
let memory: typeof import('@/api/memory-context');
const emit = (event: Partial<RealtimeEvent>) => {
  mocks.events.forEach(h => h({ received_at: Date.now(), type: 'JobStarted', ...event }));
};
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear();
  mocks.events.clear(); mocks.connections.clear(); mocks.states.clear();
  mocks.pause.mockReset().mockResolvedValue({ global: 'running', archives: {} });
  auth = await import('@/api/auth-context'); memory = await import('@/api/memory-context');
  auth.setApiBearerToken('test-session-a');
  store = (await import('../jobEventStore')).jobEventStore;
});
afterEach(() => {
  (store as typeof store & { dispose?: () => void }).dispose?.();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
});
const changes = {
  token: () => auth.setApiBearerToken('test-session-b'),
  tenant: () => auth.setActiveTenantId('tenant-b'),
  archive: () => memory.setActiveMemory('archive-b'),
  logout: () => auth.setApiBearerToken(null),
  'storage-token': () => {
    localStorage.setItem('hotm_api_bearer_token', 'test-session-b');
    window.dispatchEvent(new StorageEvent('storage', { key: 'hotm_api_bearer_token', storageArea: localStorage }));
  },
  'storage-memory': () => {
    localStorage.setItem('hotm_active_memory', 'archive-b');
    window.dispatchEvent(new StorageEvent('storage', { key: 'hotm_active_memory', storageArea: localStorage }));
  },
  'storage-clear': () => {
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));
  },
};
describe('job store live context lifetime', () => {
  it.each(Object.keys(changes) as (keyof typeof changes)[])('clears every live data field on %s', async kind => {
    emit({ job_id: 'old', job_type: 'Embedding', note_id: 'private-note' });
    emit({ type: 'JobProgress', job_id: 'old', step_name: 'private-step' });
    emit({ type: 'JobCompleted', job_id: 'old', job_type: 'Embedding' });
    emit({ job_id: 'active', job_type: 'Embedding' });
    mocks.pause.mockResolvedValue({ global: 'paused', archives: { old: 'paused' } });
    await store.refreshPauseState();
    const listener = vi.fn(); store.subscribe(listener);
    const oldHandler = [...mocks.events][0];
    changes[kind]();
    expect(store.getSnapshot()).toMatchObject({
      activeJobs: new Map(), completedJobs: [], activeStepLabel: null,
      queueStatus: { total_jobs: 0, running: 0, pending: 0 },
      pauseState: { global: 'running', archives: {} }, isQueueStalled: false, queueStatusAgeMs: 0,
    });
    expect(listener).toHaveBeenCalled();
    const reset = store.getSnapshot();
    oldHandler({ type: 'JobStarted', job_id: 'late-old', job_type: 'Embedding', received_at: Date.now() });
    expect(store.getSnapshot()).toBe(reset);
    emit({ job_id: 'new', job_type: 'Embedding' });
    expect([...store.getSnapshot().activeJobs.keys()]).toEqual(['new']);
  });
  it('ignores no-op selection and unrelated storage events', () => {
    emit({ job_id: 'current', job_type: 'Embedding' });
    const before = store.getSnapshot();
    auth.setApiBearerToken('test-session-a'); memory.setActiveMemory('public');
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', storageArea: localStorage }));
    expect(store.getSnapshot()).toBe(before);
  });
  it.each(['resolve', 'reject'] as const)('ignores old pause %s after A-B-A', async result => {
    let resolve!: (x: unknown) => void, reject!: (x: Error) => void;
    mocks.pause.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pending = store.refreshPauseState();
    auth.setApiBearerToken('test-session-b'); auth.setApiBearerToken('test-session-a');
    mocks.pause.mockResolvedValue({ global: 'current', archives: {} });
    await store.refreshPauseState();
    if (result === 'resolve') resolve({ global: 'old', archives: { old: 'paused' } });
    else reject(new Error('old request failed'));
    await pending;
    expect(store.getSnapshot().pauseState.global).toBe('current');
    expect(error).not.toHaveBeenCalled();
  });
  it('does not let an older same-context pause refresh replace the newest response', async () => {
    let resolve!: (x: unknown) => void;
    mocks.pause.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
    const first = store.refreshPauseState();
    mocks.pause.mockResolvedValue({ global: 'newest', archives: {} });
    await store.refreshPauseState();
    resolve({ global: 'old', archives: {} }); await first;
    expect(store.getSnapshot().pauseState.global).toBe('newest');
  });
  it('disposes subscriptions, timer and late callbacks without stopping shared transport', async () => {
    const event = [...mocks.events][0], connection = [...mocks.connections][0], state = [...mocks.states][0];
    let resolve!: (x: unknown) => void;
    mocks.pause.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
    const pending = store.refreshPauseState();
    const dispose = (store as typeof store & { dispose?: () => void }).dispose;
    expect(dispose).toBeTypeOf('function');
    dispose!(); dispose!();
    const before = store.getSnapshot();
    event({ type: 'JobStarted', job_id: 'late', job_type: 'Embedding', received_at: Date.now() });
    connection(true); state('connected'); auth.setApiBearerToken('test-session-b');
    resolve({ global: 'old', archives: {} }); await pending;
    vi.advanceTimersByTime(60_000);
    expect(store.getSnapshot()).toBe(before);
    expect([mocks.events.size, mocks.connections.size, mocks.states.size]).toEqual([0, 0, 0]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
