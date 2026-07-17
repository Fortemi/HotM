import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createEventsClient,
  DEFAULT_SSE_TYPE_PREFIXES,
  FORTEMI_SSE_EVENT_TYPES,
} from '@/api/events';
import eventCatalog from '@/api/contracts/fortemi-event-catalog.json';

type Listener = (event: MessageEvent) => void;

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
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
    const client = createEventsClient('http://localhost:3000/api/v1');
    client.subscribe(handler);

    const first = MockEventSource.instances[0];
    expect(first.url).toContain('/api/v1/events');

    first.onmessage?.({ data: JSON.stringify({ type: 'NoteUpdated', event_id: 'evt-42' }), lastEventId: '' } as MessageEvent);
    // Simulate permanent close (readyState=CLOSED) so client reconnects manually
    first.readyState = 2;
    first.onerror?.();
    vi.advanceTimersByTime(2000);

    const second = MockEventSource.instances[1];
    expect(second.url).toContain('last_event_id=evt-42');
  });

  it('normalizes base URLs that already include /api/v1', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000/api/v1');
    client.subscribe(handler);

    const first = MockEventSource.instances[0];
    expect(first.url).toContain('/api/v1/events');
    expect(first.url).not.toContain('/api/v1/api/v1/events');
  });

  it('registers every exact Fortemi event type from the pinned catalog', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    expect([...FORTEMI_SSE_EVENT_TYPES].sort()).toEqual(
      [...eventCatalog.eventTypes].sort(),
    );
    eventCatalog.eventTypes.forEach((type) => {
      es.emitTyped(type, { event_type: type, payload: { type: 'QueueStatus' } });
    });
    expect(handler).toHaveBeenCalledTimes(eventCatalog.eventTypes.length);
  });

  it('unwraps the canonical EventEnvelope and preserves top-level metadata', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    // Emit an envelope-wrapped event
    es.emitTyped('note.created', {
      event_id: 'evt-1',
      event_type: 'note.created',
      occurred_at: '2026-07-17T12:00:00Z',
      memory: 'mem-xyz',
      tenant_id: 'tenant-1',
      actor: { kind: 'user', id: 'user-abc', name: 'Ada' },
      entity_type: 'note',
      entity_id: 'n-1',
      correlation_id: 'corr-123',
      causation_id: 'cause-123',
      payload_version: 1,
      payload: {
        type: 'NoteCreated',
        note_id: 'n-1',
        title: 'Test Note',
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'note.created',
        event_type: 'note.created',
        event_id: 'evt-1',
        note_id: 'n-1',
        title: 'Test Note',
        actor: { kind: 'user', id: 'user-abc', name: 'Ada' },
        memory: 'mem-xyz',
        tenant_id: 'tenant-1',
        entity_type: 'note',
        entity_id: 'n-1',
        correlation_id: 'corr-123',
        causation_id: 'cause-123',
        occurred_at: '2026-07-17T12:00:00Z',
        payload_version: 1,
      })
    );
  });

  it('passes through flat legacy WebSocket events unchanged', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    // Legacy flat format (WebSocket style)
    es.onmessage?.({
      data: JSON.stringify({ type: 'NoteUpdated', note_id: 'n-2', title: 'Flat' }),
      lastEventId: '',
    } as MessageEvent);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NoteUpdated', note_id: 'n-2', title: 'Flat' })
    );
  });

  it('includes types query parameter for server-side filtering', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    expect(es.url).toContain('types=');
    // Should include key prefixes
    expect(es.url).toContain('note');
    expect(es.url).toContain('job');
    expect(es.url).toContain('queue');
    expect([...DEFAULT_SSE_TYPE_PREFIXES]).toEqual(eventCatalog.defaultTypePrefixes);
    expect(es.url).toContain('concept_scheme');
    expect(es.url).toContain('inference');
  });

  it('supports custom type prefixes', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000', {
      typePrefixes: ['note', 'concept'],
    });
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    const url = new URL(es.url);
    expect(url.searchParams.get('types')).toBe('note,concept');
  });

  it('extracts event_id from envelope payload for replay cursor', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    es.emitTyped('note.updated', {
      event_id: 'evt-99',
      event_type: 'note.updated',
      payload: { type: 'NoteUpdated', note_id: 'n-3' },
    });

    expect(client.replayCursor).toBe('evt-99');
  });
});
