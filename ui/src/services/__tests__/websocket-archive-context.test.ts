import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import producerFixtures from '@/api/contracts/fortemi-producer-event-fixtures.json';
type MemoryContext = { name: string; schema_name: string };

const mocks = vi.hoisted(() => ({ preflight: vi.fn(), context: vi.fn() }));
vi.mock('@/api', () => ({ api: {
  compatibilityGate: { preflight: mocks.preflight },
  archives: { context: mocks.context },
} }));
vi.mock('@/lib/tauri', () => ({
  getCachedConfig: () => null, isTauri: () => false, getHostAdapter: () => null,
  getTauriFetch: () => fetch,
}));

const tenant = '11111111-1111-4111-8111-111111111111';
type Stream = { controller: ReadableStreamDefaultController<Uint8Array>; headers: Headers; signal: AbortSignal };
let streams: Stream[];
let service: typeof import('../websocket').default;
let select: typeof import('@/api/memory-context').setActiveMemory;
let setToken: typeof import('@/api/auth-context').setApiBearerToken;
let setTenant: typeof import('@/api/auth-context').setActiveTenantId;
let unsubscribe: (() => void) | undefined;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const archive = (name: string, schema = `owned_${name}`) => ({ name, schema_name: schema }) as MemoryContext;
const received = vi.fn();
const eventId = (label: string) => '018f7d2d-0000-7000-8000-' +
  (['bad-name', 'bad-tenant', 'accepted', 'old-progress', 'new-note', 'default-note'].indexOf(label) + 1).toString(16).padStart(12, '0');

function emit(stream: Stream, label: string, schema: string, tenantId = tenant, type = 'note.updated') {
  const id = eventId(label);
  const value = structuredClone(producerFixtures.cases.find(c => c.eventType === type)!.envelope);
  Object.assign(value, { event_id: id, memory: schema, tenant_id: tenantId });
  stream.controller.enqueue(new TextEncoder().encode(`id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(value)}\n\n`));
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubEnv('VITE_DISABLE_WEBSOCKET', 'false');
  localStorage.clear();
  streams = [];
  unsubscribe = undefined;
  mocks.preflight.mockResolvedValue({ auth: { required: true, mode: 'hosted' } });
  mocks.context.mockImplementation(async () => {
    const { getActiveMemory } = await import('@/api/memory-context');
    const name = getActiveMemory();
    return name ? archive(name) : archive('public', 'public');
  });
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      const signal = init!.signal as AbortSignal;
      streams.push({ controller, headers: new Headers(init!.headers), signal });
      signal.addEventListener('abort', () => controller.close(), { once: true });
    } });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  ({ setActiveMemory: select } = await import('@/api/memory-context'));
  ({ setApiBearerToken: setToken, setActiveTenantId: setTenant } = await import('@/api/auth-context'));
  setToken('synthetic-session');
  setTenant(tenant);
  service = (await import('../websocket')).default;
});

afterEach(async () => {
  service.close();
  unsubscribe?.();
  await vi.advanceTimersByTimeAsync(0);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('application realtime archive context', () => {
  it.each(['token', 'tenant', 'other-tab-token', 'other-tab-memory', 'endpoint'])('replaces streams after %s changes', async change => {
    select('research');
    unsubscribe = service.subscribe(received);
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    emit(streams[0], 'accepted', 'owned_research');
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce());
    if (change === 'token') setToken('replacement-session');
    if (change === 'tenant') setTenant('22222222-2222-4222-8222-222222222222');
    if (change === 'endpoint') {
      const { setDataApiEndpoint } = await import('@/api/data-context');
      setDataApiEndpoint('https://server-b.example/api/v1');
    }
    if (change === 'other-tab-token') {
      localStorage.setItem('hotm_api_bearer_token', 'replacement-session');
      window.dispatchEvent(new StorageEvent('storage', { key: 'hotm_api_bearer_token', storageArea: localStorage }));
    }
    if (change === 'other-tab-memory') {
      localStorage.setItem('hotm_active_memory', 'second');
      window.dispatchEvent(new StorageEvent('storage', { key: 'hotm_active_memory', storageArea: localStorage }));
    }
    expect(streams[0].signal.aborted).toBe(true);
    await vi.waitFor(() => expect(streams).toHaveLength(2));
    if (change === 'endpoint') expect(String(fetchMock.mock.calls[1][0])).toContain('https://server-b.example/api/v1/events');
    expect(streams[1].headers.has('Last-Event-ID')).toBe(false);
    expect(streams[1].headers.get('Authorization')).toBe(
      change.includes('token') ? 'Bearer replacement-session' : 'Bearer synthetic-session');
    expect(streams[1].headers.get('X-Fortemi-Memory')).toBe(change === 'other-tab-memory' ? 'second' : 'research');
    expect(service.getReplayCursor()).toBeNull();
  });

  it('aborts the current authenticated stream on logout', async () => {
    select('research');
    unsubscribe = service.subscribe(received);
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    setToken(null);
    expect(streams[0].signal.aborted).toBe(true);
    await vi.waitFor(() => expect(streams).toHaveLength(2));
    expect(streams[1].headers.has('Authorization')).toBe(false);
  });

  it('uses request names, accepts only canonical schema events, and keeps cursors scoped', async () => {
    select('research');
    mocks.context.mockResolvedValue(archive('research', 'unrelated_schema'));
    unsubscribe = service.subscribe(received);
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0].headers.get('X-Fortemi-Memory')).toBe('research');
    expect(streams[0].headers.get('Authorization')).toBe('Bearer synthetic-session');
    emit(streams[0], 'bad-name', 'research');
    emit(streams[0], 'bad-tenant', 'unrelated_schema', '22222222-2222-4222-8222-222222222222');
    await vi.advanceTimersByTimeAsync(0);
    expect(received).not.toHaveBeenCalled();
    expect(service.getReplayCursor()).toBeNull();
    emit(streams[0], 'accepted', 'unrelated_schema');
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce());
    expect(received.mock.calls[0][0]).toMatchObject({ type: 'NoteUpdated', memory: 'unrelated_schema', tenant_id: tenant });
    expect(service.getReplayCursor()).toBe(eventId('accepted'));
    streams[0].controller.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(streams).toHaveLength(2);
    expect(streams[1].headers.get('Last-Event-ID')).toBe(eventId('accepted'));
    expect(streams[1].headers.get('X-Fortemi-Memory')).toBe('research');
  });

  it('replaces a selected archive stream and drops pending coalesced events and its cursor', async () => {
    select('first');
    unsubscribe = service.subscribe(received);
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    emit(streams[0], 'old-progress', 'owned_first', tenant, 'job.progress');
    await vi.advanceTimersByTimeAsync(0);
    select('second');
    expect(streams[0].signal.aborted).toBe(true);
    await vi.waitFor(() => expect(streams).toHaveLength(2));
    expect(streams[1].headers.get('X-Fortemi-Memory')).toBe('second');
    expect(streams[1].headers.has('Last-Event-ID')).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(received).not.toHaveBeenCalled();
    emit(streams[1], 'new-note', 'owned_second');
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce());
  });

  it('ignores a replaced archive lookup even when it resolves last', async () => {
    let finish!: (value: MemoryContext) => void;
    mocks.context.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    select('first');
    unsubscribe = service.subscribe(received);
    await vi.waitFor(() => expect(mocks.context).toHaveBeenCalledOnce());
    select('second');
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    finish(archive('first'));
    await vi.advanceTimersByTimeAsync(0);
    expect(streams).toHaveLength(1);
    expect(streams[0].headers.get('X-Fortemi-Memory')).toBe('second');
  });

  it('never starts a stream after closing during compatibility admission', async () => {
    let finish!: (value: unknown) => void;
    mocks.preflight.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    unsubscribe = service.subscribe(received);
    service.close();
    finish({ auth: { required: true, mode: 'hosted' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.context).toHaveBeenCalledTimes(0);
  });

  it.each([true, false])('resolves default selection (configured=%s) before connecting', async configured => {
    mocks.context.mockResolvedValue(configured ? archive('default-notes', 'default_schema') : archive('public', 'public'));
    unsubscribe = service.subscribe(received);
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0].headers.get('X-Fortemi-Memory')).toBe(configured ? 'default-notes' : 'public');
    emit(streams[0], 'default-note', configured ? 'default_schema' : 'public');
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce());
  });

  it.each([401, 403, 404, 503])('fails closed on archive lookup error %s', async status => {
    const { ApiError: CurrentApiError } = await import('@/api/errors');
    select('research');
    mocks.context.mockRejectedValue(new CurrentApiError('private upstream detail', status));
    unsubscribe = service.subscribe(received);
    await vi.waitFor(() => expect(mocks.context).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.getConnectionState()).toBe([401, 403].includes(status) ? 'auth-required' : 'disconnected');
    expect(mocks.context).toHaveBeenCalledOnce();
  });

  it('rejects a schema-less archive without guessing from its name', async () => {
    select('research');
    mocks.context.mockResolvedValue({ name: 'research' });
    unsubscribe = service.subscribe(received);
    await vi.waitFor(() => expect(service.getConnectionState()).toBe('incompatible'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
