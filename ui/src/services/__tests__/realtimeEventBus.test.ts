import {
  createRealtimeEventBus,
  normalizeTransportEvent,
} from '@/services/realtimeEventBus';
import { describe, expect, it, vi } from 'vitest';

describe('realtimeEventBus', () => {
  it('normalizes transport payload into typed event', () => {
    const event = normalizeTransportEvent({
      event_type: 'NoteUpdated',
      event_id: 'evt-1',
      note_id: 'note-1',
      title: 'Updated title',
      tags: ['a', 'b'],
      has_ai_content: true,
      has_links: false,
      correlation_id: 'corr-1',
    });

    expect(event.type).toBe('NoteUpdated');
    expect(event.event_id).toBe('evt-1');
    expect(event.note_id).toBe('note-1');
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
      note_id: 'note-archived-1',
    });

    expect(event.type).toBe('NoteUpdated');
    expect(event.note_id).toBe('note-archived-1');
  });

  it('maps domain-specific raw event names to reactive view buckets', () => {
    expect(normalizeTransportEvent({ event_type: 'AttachmentUploaded' }).type).toBe('AttachmentUpdated');
    expect(normalizeTransportEvent({ event_type: 'TagRenamed' }).type).toBe('TagUpdated');
    expect(normalizeTransportEvent({ event_type: 'CollectionNoteMoved' }).type).toBe('CollectionUpdated');
    expect(normalizeTransportEvent({ event_type: 'ArchiveDefaultChanged' }).type).toBe('ArchiveUpdated');
    expect(normalizeTransportEvent({ event_type: 'ConceptSchemeUpdated' }).type).toBe('ConceptUpdated');
  });

  it('handles out-of-order note lifecycle fixtures with deterministic routing', () => {
    const bus = createRealtimeEventBus();
    const received: string[] = [];
    bus.subscribe((event) => {
      received.push(`${event.type}:${event.note_id ?? 'none'}`);
    });

    const fixture = [
      { event_type: 'NoteUpdated', note_id: 'note-1', event_id: 'evt-2' },
      { event_type: 'NoteCreated', note_id: 'note-1', event_id: 'evt-1' },
      { event_type: 'NoteUpdated', note_id: 'note-1', event_id: 'evt-2' }, // duplicate
      { event_type: 'NoteDeleted', note_id: 'note-1', event_id: 'evt-3' },
    ];

    fixture.forEach((item) => bus.publishFromTransport(item));

    expect(received).toEqual([
      'NoteUpdated:note-1',
      'NoteCreated:note-1',
      'NoteDeleted:note-1',
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
      expect(normalizeTransportEvent({ type: 'note.created' }).type).toBe('NoteCreated');
      expect(normalizeTransportEvent({ type: 'note.updated' }).type).toBe('NoteUpdated');
      expect(normalizeTransportEvent({ type: 'note.deleted' }).type).toBe('NoteDeleted');
      expect(normalizeTransportEvent({ type: 'job.queued' }).type).toBe('JobQueued');
      expect(normalizeTransportEvent({ type: 'job.started' }).type).toBe('JobStarted');
      expect(normalizeTransportEvent({ type: 'job.progress' }).type).toBe('JobProgress');
      expect(normalizeTransportEvent({ type: 'job.completed' }).type).toBe('JobCompleted');
      expect(normalizeTransportEvent({ type: 'job.failed' }).type).toBe('JobFailed');
      expect(normalizeTransportEvent({ type: 'jobs.paused' }).type).toBe('JobsPaused');
      expect(normalizeTransportEvent({ type: 'jobs.resumed' }).type).toBe('JobsResumed');
      expect(normalizeTransportEvent({ type: 'queue.status' }).type).toBe('QueueStatus');
    });

    it('maps dot-notation note mutation aliases to NoteUpdated', () => {
      expect(normalizeTransportEvent({ type: 'note.archived' }).type).toBe('NoteUpdated');
      expect(normalizeTransportEvent({ type: 'note.starred' }).type).toBe('NoteUpdated');
      expect(normalizeTransportEvent({ type: 'note.tagged' }).type).toBe('NoteUpdated');
      expect(normalizeTransportEvent({ type: 'note.metadata_updated' }).type).toBe('NoteUpdated');
      expect(normalizeTransportEvent({ type: 'note.links_updated' }).type).toBe('NoteUpdated');
      expect(normalizeTransportEvent({ type: 'note.revision_updated' }).type).toBe('NoteUpdated');
    });

    it('maps dot-notation domain events to view buckets', () => {
      expect(normalizeTransportEvent({ type: 'tag.created' }).type).toBe('TagUpdated');
      expect(normalizeTransportEvent({ type: 'tag.merged' }).type).toBe('TagUpdated');
      expect(normalizeTransportEvent({ type: 'concept.scheme.updated' }).type).toBe('ConceptUpdated');
      expect(normalizeTransportEvent({ type: 'concept.relations.updated' }).type).toBe('ConceptUpdated');
      expect(normalizeTransportEvent({ type: 'collection.updated' }).type).toBe('CollectionUpdated');
      expect(normalizeTransportEvent({ type: 'attachment.extraction.updated' }).type).toBe('AttachmentUpdated');
      expect(normalizeTransportEvent({ type: 'archive.updated' }).type).toBe('ArchiveUpdated');
    });

    it('preserves raw_event_type for dot-notation events', () => {
      const event = normalizeTransportEvent({ type: 'note.created', note_id: 'n-1' });
      expect(event.raw_event_type).toBe('note.created');
      expect(event.type).toBe('NoteCreated');
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
  });

  describe('search/index and graph event types', () => {
    it('maps search/index events to SearchIndexUpdated', () => {
      expect(normalizeTransportEvent({ type: 'index.embedding.updated' }).type).toBe('SearchIndexUpdated');
      expect(normalizeTransportEvent({ type: 'index.fts.updated' }).type).toBe('SearchIndexUpdated');
      expect(normalizeTransportEvent({ type: 'readmodel.search.ready' }).type).toBe('SearchIndexUpdated');
    });

    it('maps readmodel.graph.updated to GraphUpdated', () => {
      expect(normalizeTransportEvent({ type: 'readmodel.graph.updated' }).type).toBe('GraphUpdated');
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
        type: 'job.progress',
        job_id: 'j-1',
        progress: 75,
      });
      expect(event.progress_percent).toBe(75);
    });
  });

  describe('step-level progress fields', () => {
    it('extracts step_name, steps_total, and step_current from progress events', () => {
      const event = normalizeTransportEvent({
        type: 'job.progress',
        job_id: 'j-1',
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
});
