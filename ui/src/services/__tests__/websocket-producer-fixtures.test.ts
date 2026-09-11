import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import producerFixtures from '@/api/contracts/fortemi-producer-event-fixtures.json';

vi.mock('@/api', () => ({ api: { compatibilityGate: { preflight: vi.fn(async () => ({ auth: { required: false, mode: 'anonymous_local' } })) } } }));
vi.mock('@/api/events', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/events')>(),
  createEventsClient: vi.fn(() => ({ subscribe: () => () => undefined, close: vi.fn() })),
}));
vi.mock('@/lib/tauri', () => ({ getCachedConfig: () => null }));

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: string) { MockWebSocket.instances.push(this); }
}

let service: typeof import('../websocket').default;
let unsubscribe: (() => void) | undefined;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubEnv('VITE_DISABLE_WEBSOCKET', 'false');
  localStorage.clear();
  MockWebSocket.instances = [];
  service = (await import('../websocket')).default;
});
afterEach(() => {
  unsubscribe?.();
  service.close();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe.each(['envelope', 'legacy payload'] as const)('producer fixtures over WebSocket: %s', (shape) => {
  it.each(producerFixtures.cases)('decodes $eventType through the production message handler', async ({ eventType, legacyType, envelope }) => {
    const handler = vi.fn();
    unsubscribe = service.subscribe(handler);
    await vi.waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    expect(service.getConnectionState()).toBe('connected');
    const input = shape === 'envelope' ? envelope : envelope.payload;
    socket.onmessage?.({ data: JSON.stringify(input) } as MessageEvent);
    await vi.advanceTimersByTimeAsync(500);
    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0];
    expect(event.type).not.toBe('Unknown');
    expect(event.raw_event_type).toBe(shape === 'envelope' ? eventType : legacyType);
    if (shape === 'envelope') {
      const { payload, event_type: _eventType, ...metadata } = envelope;
      expect(event.raw_event).toEqual({ ...payload, ...metadata, type: eventType, event_type: eventType, payload_type: legacyType });
    } else {
      expect(event.raw_event).toEqual(envelope.payload);
    }
  });
});
