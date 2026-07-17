import {
  type EventActor,
  unwrapServerEventEnvelope,
} from '@/api/events';

export type RealtimeEventType =
  | 'Unknown'
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
  | 'ExtractionUpdated'
  | 'TagUpdated'
  | 'TagStatsUpdated'
  | 'CollectionUpdated'
  | 'ArchiveUpdated'
  | 'ConceptUpdated'
  | 'SearchIndexUpdated'
  | 'GraphUpdated'
  | 'ResyncRequired'
  | 'EventsLagged'
  | 'InferenceConfigChanged'
  | 'InferenceAvailabilityChanged';

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
  tenant_id?: string;
  correlation_id?: string;
  causation_id?: string;
  entity_type?: string;
  entity_id?: string;
  payload_version?: number;
  scope?: string;
  // Envelope metadata (SSE EventEnvelope)
  actor?: EventActor | string;
  occurred_at?: string;
  // Step-level progress (job pipeline)
  step_name?: string;
  steps_total?: number;
  step_current?: number;
  // Extraction progress fields (attachment.extraction.updated)
  extraction_status?: string;
  extraction_strategy?: string;
  extraction_progress?: number;
  extracted_text_preview?: string;
  metadata_count?: number;
  // Tag stats fields (tag.stats.updated)
  tag_name?: string;
  note_count?: number;
  // Synthetic event fields
  dropped_count?: number;
  // Inference config events (Fortemi #654/#657 — InferenceConfigChanged, InferenceAvailabilityChanged)
  default_backend?: string;
  embedding_backend?: string | null;
  changed_fields?: string[];
  /**
   * Optional archive name on InferenceConfigChanged when the change was
   * scoped to a per-archive override. Filed as a Fortemi follow-up — not
   * currently populated by the server. Treated as a no-op when absent.
   */
  archive_name?: string;
  available?: boolean;
}

type RealtimeEventHandler = (event: RealtimeEvent) => void;

const DEDUP_TTL_MS = 60_000;
const COALESCE_WINDOW_MS = 50;
const COALESCE_TYPES = new Set<RealtimeEventType>(['QueueStatus', 'JobProgress']);
const SUPPORTED_TYPES = new Set<RealtimeEventType>([
  'Unknown',
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
  'ExtractionUpdated',
  'TagUpdated',
  'TagStatsUpdated',
  'CollectionUpdated',
  'ArchiveUpdated',
  'ConceptUpdated',
  'SearchIndexUpdated',
  'GraphUpdated',
  'ResyncRequired',
  'EventsLagged',
  'InferenceConfigChanged',
  'InferenceAvailabilityChanged',
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

function getActorField(
  input: Record<string, unknown>,
  key: string,
): EventActor | string | undefined {
  const value = input[key];
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const kind = getStringField(candidate, 'kind');
  if (!kind) return undefined;
  return {
    kind,
    id: getStringField(candidate, 'id'),
    name: getStringField(candidate, 'name'),
  };
}

// Exact Fortemi EventEnvelope names plus transport-level synthetic events.
const NAMESPACED_EVENT_MAP: Record<string, RealtimeEventType> = {
  'queue.status': 'QueueStatus',
  'job.queued': 'JobQueued',
  'job.started': 'JobStarted',
  'job.progress': 'JobProgress',
  'job.completed': 'JobCompleted',
  'job.failed': 'JobFailed',
  'note.created': 'NoteCreated',
  'note.updated': 'NoteUpdated',
  'note.deleted': 'NoteDeleted',
  'note.archived': 'NoteUpdated',
  'note.restored': 'NoteUpdated',
  'note.tags.updated': 'NoteUpdated',
  'note.links.updated': 'NoteUpdated',
  'note.revision.created': 'NoteUpdated',
  'attachment.created': 'AttachmentUpdated',
  'attachment.deleted': 'AttachmentUpdated',
  'attachment.extraction.updated': 'ExtractionUpdated',
  'collection.created': 'CollectionUpdated',
  'collection.updated': 'CollectionUpdated',
  'collection.deleted': 'CollectionUpdated',
  'collection.membership.changed': 'CollectionUpdated',
  'archive.created': 'ArchiveUpdated',
  'archive.updated': 'ArchiveUpdated',
  'archive.deleted': 'ArchiveUpdated',
  'archive.default.changed': 'ArchiveUpdated',
  'concept_scheme.created': 'ConceptUpdated',
  'concept_scheme.updated': 'ConceptUpdated',
  'concept_scheme.deleted': 'ConceptUpdated',
  'concept.created': 'ConceptUpdated',
  'concept.updated': 'ConceptUpdated',
  'concept.deleted': 'ConceptUpdated',
  'concept.relations.updated': 'ConceptUpdated',
  'concept.scheme.changed': 'ConceptUpdated',
  'concept.collection.membership.changed': 'ConceptUpdated',
  'tag.created': 'TagUpdated',
  'tag.renamed': 'TagUpdated',
  'tag.deleted': 'TagUpdated',
  'tag.merged': 'TagUpdated',
  'tag.stats.updated': 'TagStatsUpdated',
  'jobs.paused': 'JobsPaused',
  'jobs.resumed': 'JobsResumed',
  'index.embedding.updated': 'SearchIndexUpdated',
  'index.linking.updated': 'SearchIndexUpdated',
  'index.fts.updated': 'SearchIndexUpdated',
  'readmodel.search.ready': 'SearchIndexUpdated',
  'readmodel.graph.updated': 'GraphUpdated',
  // Synthetic SSE events
  'resync_required': 'ResyncRequired',
  'events.lagged': 'EventsLagged',
  // Inference config events (Fortemi #654 family)
  'inference.config.changed': 'InferenceConfigChanged',
  'inference.availability.changed': 'InferenceAvailabilityChanged',
};

// Exact legacy names emitted by ServerEvent::event_type for WebSocket compatibility.
const LEGACY_EVENT_MAP: Record<string, RealtimeEventType> = {
  QueueStatus: 'QueueStatus',
  JobQueued: 'JobQueued',
  JobStarted: 'JobStarted',
  JobProgress: 'JobProgress',
  JobCompleted: 'JobCompleted',
  JobFailed: 'JobFailed',
  NoteUpdated: 'NoteUpdated',
  NoteCreated: 'NoteCreated',
  NoteDeleted: 'NoteDeleted',
  NoteArchived: 'NoteUpdated',
  NoteRestored: 'NoteUpdated',
  NoteTagsUpdated: 'NoteUpdated',
  NoteLinksUpdated: 'NoteUpdated',
  NoteRevisionCreated: 'NoteUpdated',
  AttachmentCreated: 'AttachmentUpdated',
  AttachmentDeleted: 'AttachmentUpdated',
  AttachmentExtractionUpdated: 'ExtractionUpdated',
  CollectionCreated: 'CollectionUpdated',
  CollectionUpdated: 'CollectionUpdated',
  CollectionDeleted: 'CollectionUpdated',
  CollectionMembershipChanged: 'CollectionUpdated',
  ArchiveCreated: 'ArchiveUpdated',
  ArchiveUpdated: 'ArchiveUpdated',
  ArchiveDeleted: 'ArchiveUpdated',
  ArchiveDefaultChanged: 'ArchiveUpdated',
  ConceptSchemeCreated: 'ConceptUpdated',
  ConceptSchemeUpdated: 'ConceptUpdated',
  ConceptSchemeDeleted: 'ConceptUpdated',
  ConceptCreated: 'ConceptUpdated',
  ConceptUpdated: 'ConceptUpdated',
  ConceptDeleted: 'ConceptUpdated',
  ConceptRelationsUpdated: 'ConceptUpdated',
  ConceptSchemeChanged: 'ConceptUpdated',
  ConceptCollectionMembershipChanged: 'ConceptUpdated',
  TagCreated: 'TagUpdated',
  TagRenamed: 'TagUpdated',
  TagDeleted: 'TagUpdated',
  TagMerged: 'TagUpdated',
  TagStatsUpdated: 'TagStatsUpdated',
  JobsPaused: 'JobsPaused',
  JobsResumed: 'JobsResumed',
  IndexEmbeddingUpdated: 'SearchIndexUpdated',
  IndexLinkingUpdated: 'SearchIndexUpdated',
  IndexFtsUpdated: 'SearchIndexUpdated',
  ReadmodelGraphUpdated: 'GraphUpdated',
  ReadmodelSearchReady: 'SearchIndexUpdated',
  InferenceAvailabilityChanged: 'InferenceAvailabilityChanged',
  InferenceConfigChanged: 'InferenceConfigChanged',
  ResyncRequired: 'ResyncRequired',
  EventsLagged: 'EventsLagged',
};

function normalizeEventType(input: Record<string, unknown>): RealtimeEventType {
  const rawType = getStringField(input, 'type') ?? getStringField(input, 'event_type');
  if (!rawType) return 'Unknown';
  return NAMESPACED_EVENT_MAP[rawType]
    ?? LEGACY_EVENT_MAP[rawType]
    ?? (SUPPORTED_TYPES.has(rawType as RealtimeEventType)
      ? rawType as RealtimeEventType
      : 'Unknown');
}

function coalesceKey(event: RealtimeEvent): string {
  return [event.type, event.job_id ?? '-', event.note_id ?? '-'].join(':');
}

export function normalizeTransportEvent(input: unknown): RealtimeEvent {
  const record = (input && typeof input === 'object' && !Array.isArray(input))
    ? input as Record<string, unknown>
    : {};
  const normalizedInput = unwrapServerEventEnvelope(record) as Record<string, unknown>;
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
    tenant_id: getStringField(normalizedInput, 'tenant_id'),
    correlation_id: getStringField(normalizedInput, 'correlation_id'),
    causation_id: getStringField(normalizedInput, 'causation_id'),
    entity_type: getStringField(normalizedInput, 'entity_type'),
    entity_id: getStringField(normalizedInput, 'entity_id'),
    payload_version: getNumberField(normalizedInput, 'payload_version'),
    scope: getStringField(normalizedInput, 'scope'),
    // Step-level progress (job pipeline)
    step_name: getStringField(normalizedInput, 'step_name'),
    steps_total: getNumberField(normalizedInput, 'steps_total'),
    step_current: getNumberField(normalizedInput, 'step_current'),
    // Envelope metadata
    actor: getActorField(normalizedInput, 'actor'),
    occurred_at: getStringField(normalizedInput, 'occurred_at'),
    // Extraction progress fields
    extraction_status: getStringField(normalizedInput, 'extraction_status'),
    extraction_strategy: getStringField(normalizedInput, 'extraction_strategy'),
    extraction_progress: getNumberField(normalizedInput, 'extraction_progress'),
    extracted_text_preview: getStringField(normalizedInput, 'extracted_text_preview'),
    metadata_count: getNumberField(normalizedInput, 'metadata_count'),
    // Tag stats fields
    tag_name: getStringField(normalizedInput, 'tag_name'),
    note_count: getNumberField(normalizedInput, 'note_count'),
    // Synthetic event fields
    dropped_count: getNumberField(normalizedInput, 'dropped_count'),
    // Inference config events
    default_backend: getStringField(normalizedInput, 'default_backend'),
    embedding_backend: ((): string | null | undefined => {
      // embedding_backend on the server payload is Option<Option<String>>
      // — present-but-null distinct from absent. Preserve null when explicitly set.
      if (!('embedding_backend' in normalizedInput)) return undefined;
      const raw = normalizedInput.embedding_backend;
      if (raw === null) return null;
      return typeof raw === 'string' ? raw : undefined;
    })(),
    changed_fields: getStringArrayField(normalizedInput, 'changed_fields'),
    archive_name: getStringField(normalizedInput, 'archive_name'),
    available: getBooleanField(normalizedInput, 'available'),
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
