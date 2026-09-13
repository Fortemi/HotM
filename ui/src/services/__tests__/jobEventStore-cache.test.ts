import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeEvent } from '../realtimeEventBus';

const mocks = vi.hoisted(() => ({
  handlers: new Set<(event: RealtimeEvent) => void>(),
  context: vi.fn(), baseUrl: 'https://api-a.example/api/v1',
}));
vi.mock('@/services/realtimeEventBus', () => ({ realtimeEventBus: {
  subscribe: (h: (e: RealtimeEvent) => void) => { mocks.handlers.add(h); return () => { mocks.handlers.delete(h); }; },
} }));
vi.mock('@/services/websocket', () => ({ default: {
  getConnectionStatus: () => false, getConnectionState: () => 'disconnected',
  subscribeConnection: () => () => {}, subscribeConnectionState: () => () => {},
} }));
vi.mock('@/api', () => ({ api: {
  client: { get baseUrl() { return mocks.baseUrl; } },
  archives: { context: mocks.context },
  jobs: { getPauseStatus: async () => ({ global: 'running', archives: {} }) },
} }));
let store: typeof import('../jobEventStore')['jobEventStore'];
let auth: typeof import('@/api/auth-context');
const ready = () => (store as typeof store & { ready?: Promise<void> }).ready;
const emit = (id: string) => mocks.handlers.forEach(h => h({
  type: 'JobCompleted', job_id: id, job_type: 'Embedding', note_id: 'note-'+id, received_at: Date.now(),
}));
const keys = () => Object.keys(localStorage).filter(k => k.startsWith('hotm.jobStore.v2.'));
async function reload() {
  store?.dispose(); vi.resetModules();
  auth = await import('@/api/auth-context');
  store = (await import('../jobEventStore')).jobEventStore;
  await ready();
}
beforeEach(async () => {
  localStorage.clear(); mocks.handlers.clear(); mocks.baseUrl = 'https://api-a.example/api/v1';
  mocks.context.mockReset().mockResolvedValue({ name: 'public', schema_name: 'public' });
  vi.stubGlobal('crypto', webcrypto);
  localStorage.setItem('hotm_api_bearer_token', 'fixture-session-a');
  await reload();
});
afterEach(() => { store?.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('owned job cache', () => {
  it('preserves same-context reload with a versioned opaque owner', async () => {
    emit('same');
    expect(keys()).toHaveLength(1);
    const raw = localStorage.getItem(keys()[0])!;
    expect(raw).not.toContain('fixture-session-a');
    expect(keys()[0]).toMatch(/^hotm\.jobStore\.v2\.[a-f0-9]{64}$/);
    await reload();
    expect(store.getSnapshot().completedJobs.map(j => j.job_id)).toEqual(['same']);
    expect(mocks.context).toHaveBeenCalledTimes(2);
  });
  it.each(['session', 'memory', 'origin', 'default'] as const)('does not hydrate a foreign %s', async kind => {
    emit('foreign');
    const original = Object.fromEntries(keys().map(k => [k, localStorage.getItem(k)]));
    expect(Object.keys(original)).toHaveLength(1);
    if (kind === 'session') localStorage.setItem('hotm_api_bearer_token', 'fixture-session-b');
    if (kind === 'memory') localStorage.setItem('hotm_active_memory', 'archive-b');
    if (kind === 'origin') mocks.baseUrl = 'https://api-b.example/api/v1';
    if (kind === 'memory' || kind === 'default') mocks.context.mockResolvedValue({ name: 'archive-b', schema_name: 'archive_b' });
    await reload();
    expect(store.getSnapshot().completedJobs).toEqual([]);
    for (const [key, bytes] of Object.entries(original)) expect(localStorage.getItem(key)).toBe(bytes);
  });
  it('keeps legacy and unrelated data intact without hydrating unknown ownership', async () => {
    const legacy = JSON.stringify({ activeJobs: [], completedJobs: [{ job_id: 'legacy', job_type: 'Embedding', status: 'completed', timestamp: Date.now() }] });
    localStorage.setItem('hotm.jobStore', legacy); localStorage.setItem('personal-draft', 'retain');
    await reload();
    expect(store.getSnapshot().completedJobs).toEqual([]);
    emit('new');
    expect(localStorage.getItem('hotm.jobStore')).toBe(legacy);
    expect(localStorage.getItem('personal-draft')).toBe('retain');
    expect(keys()).toHaveLength(1);
  });
  it('separates tenant hints and restores only the identical context on return', async () => {
    emit('tenant-a');
    auth.setActiveTenantId('tenant-b'); await ready();
    expect(store.getSnapshot().completedJobs).toEqual([]);
    emit('tenant-b'); expect(keys()).toHaveLength(2);
    auth.setActiveTenantId(null); await ready();
    expect(store.getSnapshot().completedJobs.map(j => j.job_id)).toEqual(['tenant-a']);
  });
  it.each([401, 403, 404, 503])('does not hydrate when current archive admission fails with %s', async status => {
    emit('old');
    mocks.context.mockRejectedValue(new Error('HTTP '+status));
    await reload();
    expect(store.getSnapshot().completedJobs).toEqual([]);
  });
  it('keeps live updates received while ownership is resolving', async () => {
    emit('old');
    let resolve!: (v: unknown) => void;
    mocks.context.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
    store.dispose(); vi.resetModules(); store = (await import('../jobEventStore')).jobEventStore;
    emit('live');
    expect(resolve).toBeTypeOf('function');
    resolve({ name: 'public', schema_name: 'public' }); await ready();
    expect(store.getSnapshot().completedJobs.map(j => j.job_id)).toEqual(['live']);
    await reload();
    expect(store.getSnapshot().completedJobs.map(j => j.job_id)).toEqual(['live']);
  });
  it('rejects late ownership from the previous session', async () => {
    let resolve!: (v: unknown) => void;
    mocks.context.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
    store.dispose(); vi.resetModules(); store = (await import('../jobEventStore')).jobEventStore;
    auth = await import('@/api/auth-context');
    const pending = ready();
    expect(resolve).toBeTypeOf('function');
    auth.setApiBearerToken('fixture-session-b'); await ready(); emit('new');
    resolve({ name: 'public', schema_name: 'public' }); await pending;
    expect(store.getSnapshot().completedJobs.map(j => j.job_id)).toEqual(['new']);
    expect(keys()).toHaveLength(1);
  });
  it('fails closed when Web Crypto is unavailable without disabling live events', async () => {
    emit('old'); vi.stubGlobal('crypto', {});
    await reload();
    expect(store.getSnapshot().completedJobs).toEqual([]);
    emit('live'); expect(store.getSnapshot().completedJobs[0].job_id).toBe('live');
  });
  it('rejects stale digest completion after context replacement', async () => {
    const digest = webcrypto.subtle.digest.bind(webcrypto.subtle);
    let finish!: () => void;
    vi.spyOn(webcrypto.subtle, 'digest').mockImplementationOnce((algorithm, data) => new Promise(resolve => {
      finish = () => { void digest(algorithm, data).then(resolve); };
    }));
    store.dispose(); vi.resetModules(); store = (await import('../jobEventStore')).jobEventStore;
    auth = await import('@/api/auth-context');
    const pending = ready();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    auth.setApiBearerToken('fixture-session-b'); await ready(); emit('new');
    finish(); await pending;
    expect(store.getSnapshot().completedJobs.map(j => j.job_id)).toEqual(['new']);
    expect(keys()).toHaveLength(1);
  });
  it('does not hydrate or persist after disposal during admission', async () => {
    let resolve!: (v: unknown) => void;
    mocks.context.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
    store.dispose(); vi.resetModules(); store = (await import('../jobEventStore')).jobEventStore;
    const pending=ready(); store.dispose();
    resolve({ name:'public', schema_name:'public' }); await pending;
    expect(keys()).toHaveLength(0); expect(store.getSnapshot().completedJobs).toEqual([]);
  });
  it('keeps live updates when cache writes are unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => emit('live')).not.toThrow();
    expect(store.getSnapshot().completedJobs[0].job_id).toBe('live');
  });
  it('does not hydrate when cache reads are unavailable', async () => {
    emit('old');
    const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(this: Storage, key) {
      if (key.startsWith('hotm.jobStore.')) throw new Error('cache read denied');
      return get.call(this, key);
    });
    await reload(); expect(store.getSnapshot().completedJobs).toEqual([]);
  });
  it.each(['version','owner','negative-queue','pause-array','future-time','oversized'] as const)('rejects %s cache corruption and retains its bytes', async kind => {
    emit('old'); const key=keys()[0], data=JSON.parse(localStorage.getItem(key)!);
    if (kind==='version') data.version=3;
    if (kind==='owner') data.owner='0'.repeat(64);
    if (kind==='negative-queue') data.data.queueStatus.running=-1;
    if (kind==='pause-array') data.data.pauseState.archives=[];
    if (kind==='future-time') data.data.lastUpdatedAt=Date.now()+60_000;
    const raw=kind==='oversized'?' '.repeat(1024*1024+1):JSON.stringify(data);
    localStorage.setItem(key,raw); await reload();
    expect(store.getSnapshot().completedJobs).toEqual([]);
    expect(localStorage.getItem(key)===raw).toBe(true);
  });
  it('ignores a malformed owned entry without modifying its bytes', async () => {
    emit('old'); expect(keys()).toHaveLength(1);
    const key=keys()[0], data=JSON.parse(localStorage.getItem(key)!);
    data.data.completedJobs = [{ job_id: 'bad' }];
    const malformed=JSON.stringify(data); localStorage.setItem(key,malformed);
    await reload();
    expect(store.getSnapshot().completedJobs).toEqual([]);
    expect(localStorage.getItem(key)).toBe(malformed);
  });
});
