import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  status: undefined as undefined | ((value: string) => void),
  options: [] as Array<{ authorization?: string | null }>,
  preflight: vi.fn(async () => ({ auth: { required: true, mode: 'hosted' } })),
}));
vi.mock('@/api', () => ({ api: { compatibilityGate: { preflight: mocks.preflight } } }));
vi.mock('@/api/events', () => ({
  DEFAULT_SSE_EVENT_TYPES: [],
  createEventsClient: vi.fn((_base: string, options: { onStatusChange: (status: string) => void; authorization?: string | null }) => {
    mocks.status = options.onStatusChange;
    mocks.options.push(options);
    return { subscribe: () => () => undefined, close: vi.fn() };
  }),
}));
vi.mock('@/lib/tauri', () => ({ getCachedConfig: () => null }));
let service: typeof import('../websocket').default;
let unsubscribe: Array<() => void>;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.options = [];
  mocks.status = undefined;
  unsubscribe = [];
  service = (await import('../websocket')).default;
});
afterEach(() => {
  service.close();
  unsubscribe.forEach((close) => close());
  localStorage.clear();
});
describe('late realtime subscribers', () => {
  it.each(['auth-required', 'incompatible'] as const)('preserves %s when a second view subscribes', async (state) => {
    unsubscribe.push(service.subscribe(vi.fn()));
    await vi.waitFor(() => expect(mocks.status).toBeTypeOf('function'));
    mocks.status!(state);
    const observed = vi.fn();
    unsubscribe.push(service.subscribeConnectionState(observed));
    unsubscribe.push(service.subscribe(vi.fn()));
    await Promise.resolve();
    expect(service.getConnectionState()).toBe(state);
    expect(observed.mock.calls.map(([value]) => value)).toEqual([state]);
    expect(mocks.preflight).toHaveBeenCalledTimes(1);
    expect(mocks.options).toHaveLength(1);
  });
  it('allows a new authenticated transport after explicit close and reset', async () => {
    unsubscribe.push(service.subscribe(vi.fn()));
    await vi.waitFor(() => expect(mocks.status).toBeTypeOf('function'));
    mocks.status!('auth-required');
    service.close();
    localStorage.setItem('hotm_api_bearer_token', 'synthetic-new-session');
    service.reset();
    unsubscribe.push(service.subscribe(vi.fn()));
    await vi.waitFor(() => expect(mocks.options).toHaveLength(2));
    expect(mocks.options[1].authorization).toBe('Bearer synthetic-new-session');
    expect(mocks.preflight).toHaveBeenCalledTimes(2);
  });
});
