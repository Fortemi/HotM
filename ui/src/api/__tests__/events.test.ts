import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createEventsClient,
  DEFAULT_SSE_TYPE_PREFIXES,
  eventMatchesRealtimeContext,
  FORTEMI_SSE_EVENT_TYPES,
} from '@/api/events';
import eventCatalog from '@/api/contracts/fortemi-event-catalog.json';
import asyncApiFixtures from '@/api/contracts/fortemi-asyncapi-event-fixtures.json';
import { normalizeTransportEvent } from '@/services/realtimeEventBus';

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

  it('keeps credentials and replay state out of local EventSource URLs', () => {
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
    expect(second.url).not.toContain('last_event_id');
    expect(second.url).not.toContain('token');
    expect(client.replayCursor).toBe('evt-42');
  });

  it('reconnects authenticated fetch SSE with header-only context and replay cursor', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(
        'id: evt-42\nevent: note.updated\ndata: {"event_type":"note.updated","memory":"research","tenant_id":"tenant-a","payload":{"type":"NoteUpdated","note_id":"n-1"}}\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      ))
      .mockImplementationOnce(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000/api/v1', {
      authorization: 'Bearer fixture-token',
      memory: 'research',
      tenantId: 'tenant-a',
      preferFetch: true,
    });
    client.subscribe(handler);

    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    const firstHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    const reconnectHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(firstUrl).not.toContain('token');
    expect(firstUrl).not.toContain('memory');
    expect(firstHeaders.get('Authorization')).toBe('Bearer fixture-token');
    expect(firstHeaders.get('X-Fortemi-Memory')).toBe('research');
    expect(reconnectHeaders.get('Last-Event-ID')).toBe('evt-42');
    client.close();
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

  it('subscribes to all producer events when no explicit filter is requested', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    expect(es.url).not.toContain('types=');
    expect([...DEFAULT_SSE_TYPE_PREFIXES]).toEqual(eventCatalog.defaultTypePrefixes);
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

  it('uses the producer-owned memory query only for local EventSource fallback', () => {
    const client = createEventsClient('http://localhost:3000', { memory: 'research' });
    client.subscribe(vi.fn());
    const url = new URL(MockEventSource.instances[0].url);
    expect(url.searchParams.get('memory')).toBe('research');
    expect(url.searchParams.has('token')).toBe(false);
  });

  it('rejects events outside the active memory and tenant', () => {
    const context = { memory: 'research', tenantId: 'tenant-a' };
    expect(eventMatchesRealtimeContext({
      type: 'note.updated', memory: 'research', tenant_id: 'tenant-a',
    }, context)).toBe(true);
    expect(eventMatchesRealtimeContext({
      type: 'note.updated', memory: 'other', tenant_id: 'tenant-a',
    }, context)).toBe(false);
    expect(eventMatchesRealtimeContext({
      type: 'note.updated', memory: 'research', tenant_id: 'tenant-b',
    }, context)).toBe(false);
    expect(eventMatchesRealtimeContext({ type: 'resync_required' }, context)).toBe(true);
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

  it('decodes every generated AsyncAPI positive envelope through the SSE typed-event path', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    for (const fixture of asyncApiFixtures.cases) {
      es.emitTyped(fixture.sseFrame.event, fixture.envelope, fixture.sseFrame.id);
    }

    expect(handler).toHaveBeenCalledTimes(asyncApiFixtures.cases.length);
    asyncApiFixtures.cases.forEach((fixture, index) => {
      expect(handler.mock.calls[index][0]).toEqual(
        expect.objectContaining({
          type: fixture.eventType,
          event_type: fixture.eventType,
          event_id: fixture.envelope.event_id,
          payload_version: 1,
        }),
      );
    });
  });

  it('preserves unknown canonical SSE envelopes without coercing their payload type', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    const fixture = asyncApiFixtures.unknownEventCase;
    es.onmessage?.({
      data: JSON.stringify(fixture.envelope),
      lastEventId: fixture.envelope.event_id,
    } as MessageEvent);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'future.domain.changed',
        event_type: 'future.domain.changed',
        important: 'preserve me',
        nested: { value: 7 },
      }),
    );
  });

  it('decodes malformed known SSE frames without normalizing them into known realtime types', () => {
    const handler = vi.fn();
    const client = createEventsClient('http://localhost:3000');
    client.subscribe(handler);

    const es = MockEventSource.instances[0];
    for (const mutation of asyncApiFixtures.negativeMutations) {
      es.emitTyped(mutation.eventType, mutation.envelope, mutation.envelope.event_id);
    }

    expect(handler).toHaveBeenCalledTimes(asyncApiFixtures.negativeMutations.length);
    for (const [index, mutation] of asyncApiFixtures.negativeMutations.entries()) {
      const decoded = handler.mock.calls[index][0];
      const normalized = normalizeTransportEvent(decoded);
      expect(normalized.type, `sse:${mutation.eventType}:${mutation.mutation}`).toBe('Unknown');
      expect(normalized.raw_event_type).toBe(mutation.eventType);
    }
  });
});
