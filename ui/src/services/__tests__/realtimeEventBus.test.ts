import {
  createRealtimeEventBus,
  normalizeTransportEvent,
} from '@/services/realtimeEventBus';
import eventCatalog from '@/api/contracts/fortemi-event-catalog.json';
import asyncApiFixtures from '@/api/contracts/fortemi-asyncapi-event-fixtures.json';
import { describe, expect, it, vi } from 'vitest';

const asyncApiCaseByEventType = new Map(
  asyncApiFixtures.cases.map((fixture) => [fixture.eventType, fixture]),
);

function normalizeFixtureEvent(eventType: string) {
  const fixture = asyncApiCaseByEventType.get(eventType);
  if (!fixture) throw new Error(`missing AsyncAPI fixture for ${eventType}`);
  return normalizeTransportEvent(fixture.envelope);
}

describe('realtimeEventBus', () => {
  it('normalizes transport payload into typed event', () => {
    const event = normalizeTransportEvent({
      event_type: 'NoteUpdated',
      event_id: 'evt-1',
      note_id: '019508a0-1234-7def-8000-abcdef123457',
      title: 'Updated title',
      tags: ['a', 'b'],
      has_ai_content: true,
      has_links: false,
      correlation_id: 'corr-1',
    });

    expect(event.type).toBe('NoteUpdated');
    expect(event.event_id).toBe('evt-1');
    expect(event.note_id).toBe('019508a0-1234-7def-8000-abcdef123457');
    expect(event.tags).toEqual(['a', 'b']);
    expect(event.has_ai_content).toBe(true);
    expect(event.has_links).toBe(false);
    expect(event.correlation_id).toBe('corr-1');
  });

  it('deduplicates repeated events by event_id within TTL', () => {
    const bus = createRealtimeEventBus();
    const handler = vi.fn();
    bus.subscribe(handler);

    bus.publishFromTransport({
      type: 'JobCompleted',
      event_id: 'dup-1',
      job_id: 'job-1',
    });
    bus.publishFromTransport({
      type: 'JobCompleted',
      event_id: 'dup-1',
      job_id: 'job-1',
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('maps note mutation aliases into NoteUpdated events', () => {
    const event = normalizeTransportEvent({
      event_type: 'NoteArchived',
      note_id: '019508a0-1234-7def-8000-abcdef123457',
    });

    expect(event.type).toBe('NoteUpdated');
    expect(event.note_id).toBe('019508a0-1234-7def-8000-abcdef123457');
  });

  it('maps domain-specific raw event names to reactive view buckets', () => {
    expect(normalizeTransportEvent(asyncApiCaseByEventType.get('attachment.created')!.websocketPayload).type).toBe('AttachmentUpdated');
    expect(normalizeTransportEvent(asyncApiCaseByEventType.get('tag.renamed')!.websocketPayload).type).toBe('TagUpdated');
    expect(normalizeTransportEvent(asyncApiCaseByEventType.get('collection.membership.changed')!.websocketPayload).type).toBe('CollectionUpdated');
    expect(normalizeTransportEvent(asyncApiCaseByEventType.get('archive.default.changed')!.websocketPayload).type).toBe('ArchiveUpdated');
    expect(normalizeTransportEvent(asyncApiCaseByEventType.get('concept_scheme.updated')!.websocketPayload).type).toBe('ConceptUpdated');
  });

  it('keeps missing and unknown event names unknown', () => {
    expect(normalizeTransportEvent({}).type).toBe('Unknown');
    const event = normalizeTransportEvent({ event_type: 'future.domain.changed' });
    expect(event.type).toBe('Unknown');
    expect(event.raw_event_type).toBe('future.domain.changed');
    expect(event.raw_event).toEqual(expect.objectContaining({ event_type: 'future.domain.changed' }));
  });

  it('handles out-of-order note lifecycle fixtures with deterministic routing', () => {
    const bus = createRealtimeEventBus();
    const received: string[] = [];
    bus.subscribe((event) => {
      received.push(`${event.type}:${event.note_id ?? 'none'}`);
    });

    const fixture = [
      {
        event_type: 'NoteUpdated',
        note_id: '019508a0-1234-7def-8000-abcdef123457',
        event_id: 'evt-2',
        tags: [],
        has_ai_content: false,
        has_links: false,
      },
      {
        event_type: 'NoteCreated',
        note_id: '019508a0-1234-7def-8000-abcdef123457',
        event_id: 'evt-1',
        tags: [],
      },
      {
        event_type: 'NoteUpdated',
        note_id: '019508a0-1234-7def-8000-abcdef123457',
        event_id: 'evt-2',
        tags: [],
        has_ai_content: false,
        has_links: false,
      }, // duplicate
      {
        event_type: 'NoteDeleted',
        note_id: '019508a0-1234-7def-8000-abcdef123457',
        event_id: 'evt-3',
      },
    ];

    fixture.forEach((item) => bus.publishFromTransport(item));

    expect(received).toEqual([
      'NoteUpdated:019508a0-1234-7def-8000-abcdef123457',
      'NoteCreated:019508a0-1234-7def-8000-abcdef123457',
      'NoteDeleted:019508a0-1234-7def-8000-abcdef123457',
    ]);
  });

  it('coalesces burst queue status updates to latest event', () => {
    vi.useFakeTimers();
    try {
      const bus = createRealtimeEventBus();
      const handler = vi.fn();
      bus.subscribe(handler);

      bus.publishFromTransport({
        type: 'QueueStatus',
        total_jobs: 3,
        running: 1,
        pending: 2,
      });
      bus.publishFromTransport({
        type: 'QueueStatus',
        total_jobs: 2,
        running: 1,
        pending: 1,
      });

      vi.advanceTimersByTime(60);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'QueueStatus',
          total_jobs: 2,
          pending: 1,
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  describe('dot-notation event types (SSE v2)', () => {
    it('maps dot-notation core event types to PascalCase buckets', () => {
      expect(normalizeFixtureEvent('note.created').type).toBe('NoteCreated');
      expect(normalizeFixtureEvent('note.updated').type).toBe('NoteUpdated');
      expect(normalizeFixtureEvent('note.deleted').type).toBe('NoteDeleted');
      expect(normalizeFixtureEvent('job.queued').type).toBe('JobQueued');
      expect(normalizeFixtureEvent('job.started').type).toBe('JobStarted');
      expect(normalizeFixtureEvent('job.progress').type).toBe('JobProgress');
      expect(normalizeFixtureEvent('job.completed').type).toBe('JobCompleted');
      expect(normalizeFixtureEvent('job.failed').type).toBe('JobFailed');
      expect(normalizeFixtureEvent('jobs.paused').type).toBe('JobsPaused');
      expect(normalizeFixtureEvent('jobs.resumed').type).toBe('JobsResumed');
      expect(normalizeFixtureEvent('queue.status').type).toBe('QueueStatus');
    });

    it('maps dot-notation note mutation aliases to NoteUpdated', () => {
      expect(normalizeFixtureEvent('note.archived').type).toBe('NoteUpdated');
      expect(normalizeFixtureEvent('note.restored').type).toBe('NoteUpdated');
      expect(normalizeFixtureEvent('note.tags.updated').type).toBe('NoteUpdated');
      expect(normalizeFixtureEvent('note.links.updated').type).toBe('NoteUpdated');
      expect(normalizeFixtureEvent('note.revision.created').type).toBe('NoteUpdated');
    });

    it('maps dot-notation domain events to view buckets', () => {
      expect(normalizeFixtureEvent('tag.created').type).toBe('TagUpdated');
      expect(normalizeFixtureEvent('tag.merged').type).toBe('TagUpdated');
      expect(normalizeFixtureEvent('concept_scheme.updated').type).toBe('ConceptUpdated');
      expect(normalizeFixtureEvent('concept.relations.updated').type).toBe('ConceptUpdated');
      expect(normalizeFixtureEvent('collection.updated').type).toBe('CollectionUpdated');
      expect(normalizeFixtureEvent('attachment.extraction.updated').type).toBe('ExtractionUpdated');
      expect(normalizeFixtureEvent('tag.stats.updated').type).toBe('TagStatsUpdated');
      expect(normalizeFixtureEvent('archive.updated').type).toBe('ArchiveUpdated');
    });

    it('preserves raw_event_type for dot-notation events', () => {
      const event = normalizeFixtureEvent('note.created');
      expect(event.raw_event_type).toBe('note.created');
      expect(event.type).toBe('NoteCreated');
    });

    it('maps every event in the pinned producer catalog', () => {
      for (const type of eventCatalog.eventTypes) {
        const event = normalizeFixtureEvent(type);
        expect(event.type, type).not.toBe('Unknown');
        expect(event.raw_event_type).toBe(type);
      }
    });

    it('normalizes every generated AsyncAPI envelope and WebSocket payload fixture', () => {
      for (const fixture of asyncApiFixtures.cases) {
        const sseEvent = normalizeTransportEvent(fixture.envelope);
        const websocketEvent = normalizeTransportEvent(fixture.websocketPayload);

        expect(sseEvent.type, fixture.eventType).not.toBe('Unknown');
        expect(websocketEvent.type, fixture.legacyType).not.toBe('Unknown');
        expect(sseEvent.raw_event_type).toBe(fixture.eventType);
        expect(websocketEvent.raw_event_type).toBe(fixture.legacyType);
        expect(sseEvent.event_id).toBe(fixture.envelope.event_id);
        for (const key of Object.keys(fixture.websocketPayload)) {
          if (key !== 'type') {
            expect(sseEvent.raw_event?.[key], `${fixture.eventType}.${key}`).toEqual(
              fixture.websocketPayload[key as keyof typeof fixture.websocketPayload],
            );
          }
        }
      }
    });

    it('preserves unknown raw canonical envelopes without mapping to a known bucket', () => {
      const event = normalizeTransportEvent(asyncApiFixtures.unknownEventCase.envelope);

      expect(event.type).toBe('Unknown');
      expect(event.raw_event_type).toBe('future.domain.changed');
      expect(event.raw_event).toEqual(
        expect.objectContaining({
          type: 'future.domain.changed',
          important: 'preserve me',
          nested: { value: 7 },
        }),
      );
    });

    it('does not normalize malformed known SSE envelopes or WebSocket payloads into known buckets', () => {
      for (const mutation of asyncApiFixtures.negativeMutations) {
        const sseEvent = normalizeTransportEvent(mutation.envelope);
        const websocketEvent = normalizeTransportEvent(mutation.websocketPayload);

        expect(sseEvent.type, `sse:${mutation.eventType}:${mutation.mutation}`).toBe('Unknown');
        if (mutation.websocketExpectedUnknown) {
          expect(websocketEvent.type, `ws:${mutation.eventType}:${mutation.mutation}`).toBe('Unknown');
        }
        expect(sseEvent.raw_event_type).toBe(mutation.eventType);
      }
    });
  });

  describe('envelope metadata extraction', () => {
    it('extracts actor and occurred_at from unwrapped envelope data', () => {
      const event = normalizeTransportEvent({
        type: 'NoteCreated',
        note_id: 'note-1',
        actor: 'user-123',
        occurred_at: '2026-02-21T12:00:00Z',
        correlation_id: 'corr-abc',
        memory: 'mem-xyz',
      });

      expect(event.actor).toBe('user-123');
      expect(event.occurred_at).toBe('2026-02-21T12:00:00Z');
      expect(event.correlation_id).toBe('corr-abc');
      expect(event.memory).toBe('mem-xyz');
    });

    it('handles events without envelope metadata gracefully', () => {
      const event = normalizeTransportEvent({
        type: 'NoteUpdated',
        note_id: 'note-1',
      });

      expect(event.actor).toBeUndefined();
      expect(event.occurred_at).toBeUndefined();
    });

    it('unwraps canonical envelopes for the WebSocket normalization path', () => {
      const event = normalizeTransportEvent({
        event_id: '019508a0-1234-7def-8000-abcdef123456',
        event_type: 'note.created',
        occurred_at: '2026-07-17T12:00:00Z',
        memory: 'memory-1',
        tenant_id: 'tenant-1',
        actor: { kind: 'agent', name: 'indexer' },
        entity_type: 'note',
        entity_id: '019508a0-1234-7def-8000-abcdef123457',
        correlation_id: '019508a0-1234-7def-8000-abcdef12345e',
        causation_id: '019508a0-1234-7def-8000-abcdef12345f',
        payload_version: 1,
        payload: {
          type: 'NoteCreated',
          note_id: '019508a0-1234-7def-8000-abcdef123457',
          title: 'Envelope note',
          tags: [],
        },
      });

      expect(event).toEqual(expect.objectContaining({
        type: 'NoteCreated',
        raw_event_type: 'note.created',
        event_id: '019508a0-1234-7def-8000-abcdef123456',
        note_id: '019508a0-1234-7def-8000-abcdef123457',
        actor: { kind: 'agent', name: 'indexer', id: undefined },
        memory: 'memory-1',
        tenant_id: 'tenant-1',
        entity_type: 'note',
        entity_id: '019508a0-1234-7def-8000-abcdef123457',
        correlation_id: '019508a0-1234-7def-8000-abcdef12345e',
        causation_id: '019508a0-1234-7def-8000-abcdef12345f',
        occurred_at: '2026-07-17T12:00:00Z',
        payload_version: 1,
      }));
    });
  });

  describe('search/index and graph event types', () => {
    it('maps search/index events to SearchIndexUpdated', () => {
      expect(normalizeFixtureEvent('index.embedding.updated').type).toBe('SearchIndexUpdated');
      expect(normalizeFixtureEvent('index.fts.updated').type).toBe('SearchIndexUpdated');
      expect(normalizeFixtureEvent('readmodel.search.ready').type).toBe('SearchIndexUpdated');
    });

    it('maps readmodel.graph.updated to GraphUpdated', () => {
      expect(normalizeFixtureEvent('readmodel.graph.updated').type).toBe('GraphUpdated');
    });
  });

  describe('synthetic event types', () => {
    it('maps resync_required to ResyncRequired', () => {
      expect(normalizeTransportEvent({ type: 'resync_required' }).type).toBe('ResyncRequired');
    });

    it('maps events.lagged to EventsLagged with dropped_count', () => {
      const event = normalizeTransportEvent({ type: 'events.lagged', dropped_count: 15 });
      expect(event.type).toBe('EventsLagged');
      expect(event.dropped_count).toBe(15);
    });
  });

  describe('progress field normalization', () => {
    it('reads progress_percent field', () => {
      const event = normalizeTransportEvent({
        type: 'JobProgress',
        job_id: 'j-1',
        progress_percent: 50,
      });
      expect(event.progress_percent).toBe(50);
    });

    it('falls back to progress field when progress_percent absent', () => {
      const event = normalizeTransportEvent({
        type: 'JobProgress',
        job_id: '019508a0-1234-7def-8000-abcdef123458',
        progress: 75,
      });
      expect(event.progress_percent).toBe(75);
    });
  });

  describe('step-level progress fields', () => {
    it('extracts step_name, steps_total, and step_current from progress events', () => {
      const event = normalizeTransportEvent({
        type: 'JobProgress',
        job_id: '019508a0-1234-7def-8000-abcdef123458',
        progress: 40,
        step_name: 'Generating embeddings',
        steps_total: 5,
        step_current: 2,
      });
      expect(event.type).toBe('JobProgress');
      expect(event.step_name).toBe('Generating embeddings');
      expect(event.steps_total).toBe(5);
      expect(event.step_current).toBe(2);
      expect(event.progress_percent).toBe(40);
    });

    it('handles events without step fields gracefully', () => {
      const event = normalizeTransportEvent({
        type: 'JobProgress',
        job_id: 'j-2',
        progress_percent: 60,
      });
      expect(event.step_name).toBeUndefined();
      expect(event.steps_total).toBeUndefined();
      expect(event.step_current).toBeUndefined();
    });
  });

  describe('inference config events (Fortemi #654/#657 — Issue #203)', () => {
    it('maps inference.config.changed → InferenceConfigChanged and extracts payload', () => {
      const event = normalizeTransportEvent({
        type: 'InferenceConfigChanged',
        default_backend: 'openrouter',
        embedding_backend: 'ollama',
        changed_fields: ['default_backend', 'openrouter.api_key'],
      });
      expect(event.type).toBe('InferenceConfigChanged');
      expect(event.default_backend).toBe('openrouter');
      expect(event.embedding_backend).toBe('ollama');
      expect(event.changed_fields).toEqual(['default_backend', 'openrouter.api_key']);
    });

    it('preserves explicit null for embedding_backend (tri-state: cleared)', () => {
      const event = normalizeTransportEvent({
        type: 'InferenceConfigChanged',
        default_backend: 'ollama',
        embedding_backend: null,
        changed_fields: ['embedding_backend'],
      });
      expect(event.embedding_backend).toBeNull();
    });

    it('leaves embedding_backend undefined when key absent (tri-state: no change)', () => {
      const event = normalizeTransportEvent({
        type: 'InferenceConfigChanged',
        default_backend: 'ollama',
        changed_fields: ['ollama.base_url'],
      });
      expect(event.embedding_backend).toBeUndefined();
    });

    it('extracts __reset__ sentinel in changed_fields', () => {
      const event = normalizeTransportEvent({
        type: 'InferenceConfigChanged',
        default_backend: 'ollama',
        changed_fields: ['__reset__'],
      });
      expect(event.changed_fields).toContain('__reset__');
    });

    it('maps inference.availability.changed with the producer available flag', () => {
      const event = normalizeTransportEvent({
        type: 'InferenceAvailabilityChanged',
        available: false,
      });
      expect(event.type).toBe('InferenceAvailabilityChanged');
      expect(event.available).toBe(false);
    });
  });

  describe('AsyncAPI payload fields', () => {
    it('extracts schema-declared entity identifiers and governance fields', () => {
      expect(normalizeTransportEvent({
        type: 'CollectionCreated',
        collection_id: '019508a0-1234-7def-8000-abcdef12345a',
        name: 'Inbox',
      })).toEqual(expect.objectContaining({
        type: 'CollectionUpdated',
        collection_id: '019508a0-1234-7def-8000-abcdef12345a',
        name: 'Inbox',
      }));

      expect(normalizeTransportEvent({
        type: 'ConceptRelationsUpdated',
        concept_id: '019508a0-1234-7def-8000-abcdef12345c',
        relation_type: 'broader',
      })).toEqual(expect.objectContaining({
        type: 'ConceptUpdated',
        concept_id: '019508a0-1234-7def-8000-abcdef12345c',
        relation_type: 'broader',
      }));

      expect(normalizeTransportEvent({
        type: 'TagMerged',
        source_tag: 'draft',
        target_tag: 'final',
        affected_count: 3,
      })).toEqual(expect.objectContaining({
        type: 'TagUpdated',
        source_tag: 'draft',
        target_tag: 'final',
        affected_count: 3,
      }));
    });
  });
});
