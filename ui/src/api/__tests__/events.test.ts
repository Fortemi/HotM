import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createEventsClient } from '@/api/events';

type Listener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  emitTyped(type: string, payload: unknown, lastEventId = '') {
    const listeners = this.listeners.get(type) ?? [];
    const evt = { data: JSON.stringify(payload), lastEventId } as MessageEvent;
    listeners.forEach((listener) => listener(evt));
  }

  close() {
    this.readyState = 2;
  }
}

describe('events client replay handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reconnects with replay cursor query when event_id is known', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const first = MockEventSource.instances[0];
    expect(first.url).toContain('/api/v1/events');

    first.onmessage?.({ data: JSON.stringify({ type: 'NoteUpdated', event_id: 'evt-42' }), lastEventId: '' } as MessageEvent);
    first.onerror?.();
    vi.advanceTimersByTime(5000);

    const second = MockEventSource.instances[1];
    expect(second.url).toContain('last_event_id=evt-42');
  });

  it('normalizes base URLs that already include /api/v1', () => {
    const handler = vi.fn();
    const client = createEventsClient('https://memory.integrolabs.net/api/v1');
    client.subscribe(handler);

    const first = MockEventSource.instances[0];
    expect(first.url).toContain('/api/v1/events');
    expect(first.url).not.toContain('/api/v1/api/v1/events');
  });
});
