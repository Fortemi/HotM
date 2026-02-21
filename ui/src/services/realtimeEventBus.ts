export type RealtimeEventType =
  | 'QueueStatus'
  | 'JobQueued'
  | 'JobStarted'
  | 'JobProgress'
  | 'JobCompleted'
  | 'JobFailed'
  | 'JobsPaused'
  | 'JobsResumed'
  | 'NoteUpdated'
  | 'NoteCreated'
  | 'NoteDeleted'
  | 'AttachmentUpdated'
  | 'TagUpdated'
  | 'CollectionUpdated'
  | 'ArchiveUpdated'
  | 'ConceptUpdated'
  | 'SearchIndexUpdated'
  | 'GraphUpdated'
  | 'ResyncRequired'
  | 'EventsLagged';

export interface RealtimeEvent {
  type: RealtimeEventType;
  raw_event_type?: string;
  received_at?: number;
  event_id?: string;
  note_id?: string;
  attachment_id?: string;
  job_id?: string;
  job_type?: string;
  status?: string;
  progress_percent?: number;
  message?: string;
  error?: string;
  retry_count?: number;
  duration_ms?: number;
  estimated_duration_ms?: number;
  priority?: number;
  total_jobs?: number;
  running?: number;
  pending?: number;
  title?: string;
  tags?: string[];
  has_ai_content?: boolean;
  has_links?: boolean;
  memory?: string;
  correlation_id?: string;
  scope?: string;
  // Envelope metadata (SSE EventEnvelope)
  actor?: string;
  occurred_at?: string;
  // Step-level progress (job pipeline)
  step_name?: string;
  steps_total?: number;
  step_current?: number;
  // Synthetic event fields
  dropped_count?: number;
}

type RealtimeEventHandler = (event: RealtimeEvent) => void;

const DEFAULT_EVENT_TYPE: RealtimeEventType = 'QueueStatus';
const DEDUP_TTL_MS = 60_000;
const COALESCE_WINDOW_MS = 50;
const COALESCE_TYPES = new Set<RealtimeEventType>(['QueueStatus', 'JobProgress']);
const SUPPORTED_TYPES = new Set<RealtimeEventType>([
  'QueueStatus',
  'JobQueued',
  'JobStarted',
  'JobProgress',
  'JobCompleted',
  'JobFailed',
  'JobsPaused',
  'JobsResumed',
  'NoteUpdated',
  'NoteCreated',
  'NoteDeleted',
  'AttachmentUpdated',
  'TagUpdated',
  'CollectionUpdated',
  'ArchiveUpdated',
  'ConceptUpdated',
  'SearchIndexUpdated',
  'GraphUpdated',
  'ResyncRequired',
  'EventsLagged',
]);
const NOTE_UPDATE_ALIASES = new Set<string>([
  'NoteArchived',
  'NoteUnarchived',
  'NoteStarred',
  'NoteUnstarred',
  'NoteTagged',
  'NoteUntagged',
  'NoteConceptTagged',
  'NoteConceptUntagged',
  'NoteConceptUpdated',
  'NoteMetadataUpdated',
  'NoteLinksUpdated',
  'NoteProvenanceUpdated',
  'NoteRevisionUpdated',
]);

function getStringField(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberField(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  return typeof value === 'number' ? value : undefined;
}

function getBooleanField(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getStringArrayField(input: Record<string, unknown>, key: string): string[] | undefined {
  const value = input[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

// Dot-notation (SSE v2) → PascalCase mapping
const DOT_NOTATION_MAP: Record<string, string> = {
  'note.created': 'NoteCreated',
  'note.updated': 'NoteUpdated',
  'note.deleted': 'NoteDeleted',
  'note.archived': 'NoteArchived',
  'note.unarchived': 'NoteUnarchived',
  'note.starred': 'NoteStarred',
  'note.unstarred': 'NoteUnstarred',
  'note.tagged': 'NoteTagged',
  'note.untagged': 'NoteUntagged',
  'note.concept_tagged': 'NoteConceptTagged',
  'note.concept_untagged': 'NoteConceptUntagged',
  'note.concept_updated': 'NoteConceptUpdated',
  'note.metadata_updated': 'NoteMetadataUpdated',
  'note.links_updated': 'NoteLinksUpdated',
  'note.provenance_updated': 'NoteProvenanceUpdated',
  'note.revision_updated': 'NoteRevisionUpdated',
  'job.queued': 'JobQueued',
  'job.started': 'JobStarted',
  'job.progress': 'JobProgress',
  'job.completed': 'JobCompleted',
  'job.failed': 'JobFailed',
  'jobs.paused': 'JobsPaused',
  'jobs.resumed': 'JobsResumed',
  'queue.status': 'QueueStatus',
  'collection.created': 'CollectionUpdated',
  'collection.updated': 'CollectionUpdated',
  'collection.deleted': 'CollectionUpdated',
  'archive.updated': 'ArchiveUpdated',
  'attachment.updated': 'AttachmentUpdated',
  'attachment.extraction.updated': 'AttachmentUpdated',
  'tag.created': 'TagUpdated',
  'tag.renamed': 'TagUpdated',
  'tag.deleted': 'TagUpdated',
  'tag.merged': 'TagUpdated',
  'tag.stats.updated': 'TagUpdated',
  'concept.created': 'ConceptUpdated',
  'concept.updated': 'ConceptUpdated',
  'concept.deleted': 'ConceptUpdated',
  'concept.scheme.created': 'ConceptUpdated',
  'concept.scheme.updated': 'ConceptUpdated',
  'concept.scheme.deleted': 'ConceptUpdated',
  'concept.relations.updated': 'ConceptUpdated',
  'concept.scheme.changed': 'ConceptUpdated',
  'concept.collection.membership.changed': 'ConceptUpdated',
  // Search/index materialization events
  'index.embedding.updated': 'SearchIndexUpdated',
  'index.linking.updated': 'SearchIndexUpdated',
  'index.fts.updated': 'SearchIndexUpdated',
  'readmodel.search.ready': 'SearchIndexUpdated',
  'readmodel.graph.updated': 'GraphUpdated',
  // Synthetic SSE events
  'resync_required': 'ResyncRequired',
  'events.lagged': 'EventsLagged',
};

function normalizeEventType(input: Record<string, unknown>): RealtimeEventType {
  const rawType = getStringField(input, 'type') ?? getStringField(input, 'event_type');
  if (!rawType) {
    return DEFAULT_EVENT_TYPE;
  }
  // Map dot-notation to PascalCase, then normalize through existing logic
  const mapped = DOT_NOTATION_MAP[rawType] ?? rawType;
  if (NOTE_UPDATE_ALIASES.has(mapped)) {
    return 'NoteUpdated';
  }
  if (mapped.includes('Attachment')) {
    return 'AttachmentUpdated';
  }
  if (mapped.includes('Collection')) {
    return 'CollectionUpdated';
  }
  if (mapped.includes('Archive')) {
    return 'ArchiveUpdated';
  }
  if (mapped.includes('Concept')) {
    return 'ConceptUpdated';
  }
  if (mapped.includes('Tag')) {
    return 'TagUpdated';
  }
  return SUPPORTED_TYPES.has(mapped as RealtimeEventType)
    ? (mapped as RealtimeEventType)
    : DEFAULT_EVENT_TYPE;
}

function coalesceKey(event: RealtimeEvent): string {
  return [event.type, event.job_id ?? '-', event.note_id ?? '-'].join(':');
}

export function normalizeTransportEvent(input: unknown): RealtimeEvent {
  const normalizedInput = (input ?? {}) as Record<string, unknown>;
  const rawType = getStringField(normalizedInput, 'type') ?? getStringField(normalizedInput, 'event_type');

  return {
    type: normalizeEventType(normalizedInput),
    raw_event_type: rawType,
    received_at: Date.now(),
    event_id: getStringField(normalizedInput, 'event_id') ?? getStringField(normalizedInput, 'id'),
    note_id: getStringField(normalizedInput, 'note_id'),
    attachment_id: getStringField(normalizedInput, 'attachment_id'),
    job_id: getStringField(normalizedInput, 'job_id'),
    job_type: getStringField(normalizedInput, 'job_type'),
    status: getStringField(normalizedInput, 'status'),
    progress_percent: getNumberField(normalizedInput, 'progress_percent') ?? getNumberField(normalizedInput, 'progress'),
    message: getStringField(normalizedInput, 'message'),
    error: getStringField(normalizedInput, 'error'),
    retry_count: getNumberField(normalizedInput, 'retry_count'),
    duration_ms: getNumberField(normalizedInput, 'duration_ms'),
    estimated_duration_ms: getNumberField(normalizedInput, 'estimated_duration_ms'),
    priority: getNumberField(normalizedInput, 'priority'),
    total_jobs: getNumberField(normalizedInput, 'total_jobs'),
    running: getNumberField(normalizedInput, 'running'),
    pending: getNumberField(normalizedInput, 'pending'),
    title: getStringField(normalizedInput, 'title'),
    tags: getStringArrayField(normalizedInput, 'tags'),
    has_ai_content: getBooleanField(normalizedInput, 'has_ai_content'),
    has_links: getBooleanField(normalizedInput, 'has_links'),
    memory: getStringField(normalizedInput, 'memory'),
    correlation_id: getStringField(normalizedInput, 'correlation_id'),
    scope: getStringField(normalizedInput, 'scope'),
    // Step-level progress (job pipeline)
    step_name: getStringField(normalizedInput, 'step_name'),
    steps_total: getNumberField(normalizedInput, 'steps_total'),
    step_current: getNumberField(normalizedInput, 'step_current'),
    // Envelope metadata
    actor: getStringField(normalizedInput, 'actor'),
    occurred_at: getStringField(normalizedInput, 'occurred_at'),
    // Synthetic event fields
    dropped_count: getNumberField(normalizedInput, 'dropped_count'),
  };
}

export class RealtimeEventBus {
  private handlers: Set<RealtimeEventHandler> = new Set();
  private dedupCache: Map<string, number> = new Map();
  private pendingCoalesced: Map<string, RealtimeEvent> = new Map();
  private coalesceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  public subscribe(handler: RealtimeEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public publishFromTransport(input: unknown): void {
    const event = normalizeTransportEvent(input);
    this.publish(event);
  }

  public publish(event: RealtimeEvent): void {
    if (!this.shouldPublish(event)) {
      return;
    }

    if (COALESCE_TYPES.has(event.type)) {
      this.enqueueCoalesced(event);
      return;
    }

    this.emit(event);
  }

  private shouldPublish(event: RealtimeEvent): boolean {
    const now = Date.now();

    for (const [eventId, timestamp] of this.dedupCache.entries()) {
      if (now - timestamp > DEDUP_TTL_MS) {
        this.dedupCache.delete(eventId);
      }
    }

    if (!event.event_id) {
      return true;
    }

    const lastSeen = this.dedupCache.get(event.event_id);
    if (typeof lastSeen === 'number' && now - lastSeen <= DEDUP_TTL_MS) {
      return false;
    }

    this.dedupCache.set(event.event_id, now);
    return true;
  }

  private enqueueCoalesced(event: RealtimeEvent): void {
    const key = coalesceKey(event);
    this.pendingCoalesced.set(key, event);

    if (this.coalesceTimers.has(key)) {
      return;
    }

    const timer = setTimeout(() => {
      const latest = this.pendingCoalesced.get(key);
      this.pendingCoalesced.delete(key);
      this.coalesceTimers.delete(key);
      if (latest) {
        this.emit(latest);
      }
    }, COALESCE_WINDOW_MS);

    this.coalesceTimers.set(key, timer);
  }

  private emit(event: RealtimeEvent): void {
    this.handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Realtime event handler error:', error);
      }
    });
  }
}

export function createRealtimeEventBus(): RealtimeEventBus {
  return new RealtimeEventBus();
}

export const realtimeEventBus = createRealtimeEventBus();
