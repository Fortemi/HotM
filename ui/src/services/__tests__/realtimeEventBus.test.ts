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
});
