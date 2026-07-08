import type { RealtimeEvent } from './realtimeEventBus';

export type RealtimeActivityCategory = 'connection' | 'job' | 'sync' | 'admin' | 'mcp' | 'content';
export type RealtimeActivitySeverity = 'info' | 'success' | 'warning' | 'error';

export interface RealtimeActivityItem {
  category: RealtimeActivityCategory;
  severity: RealtimeActivitySeverity;
  title: string;
  summary: string;
  entity: string;
}

function categoryForEvent(event: RealtimeEvent): RealtimeActivityCategory {
  const raw = (event.raw_event_type ?? event.type).toLowerCase();

  if (event.type === 'ResyncRequired' || event.type === 'EventsLagged' || raw.includes('connect')) {
    return 'connection';
  }
  if (event.type.startsWith('Job') || event.type.startsWith('Jobs') || event.type === 'QueueStatus') {
    return 'job';
  }
  if (event.type.includes('Inference') || raw.includes('quota') || raw.includes('kms') || raw.includes('audit')) {
    return 'admin';
  }
  if (raw.includes('mcp') || raw.includes('tool')) {
    return 'mcp';
  }
  if (event.type.includes('SearchIndex') || event.type.includes('Graph') || event.type.includes('Archive')) {
    return 'sync';
  }
  return 'content';
}

function severityForEvent(event: RealtimeEvent): RealtimeActivitySeverity {
  if (event.type === 'JobFailed' || event.status === 'failed') {
    return 'error';
  }
  if (event.type === 'ResyncRequired' || event.type === 'EventsLagged') {
    return 'warning';
  }
  if (event.type === 'JobCompleted' || event.status === 'completed') {
    return 'success';
  }
  return 'info';
}

function entityForEvent(event: RealtimeEvent): string {
  if (event.job_id) {
    return event.job_type ? `${event.job_type} job` : 'job';
  }
  if (event.note_id) return 'note';
  if (event.attachment_id) return 'attachment';
  if (event.memory) return 'archive';
  return 'system';
}

function titleForEvent(event: RealtimeEvent, category: RealtimeActivityCategory): string {
  if (event.type === 'ResyncRequired') return 'Resync required';
  if (event.type === 'EventsLagged') return 'Event replay lag';
  if (event.type === 'QueueStatus') return 'Queue status updated';
  if (event.type === 'InferenceConfigChanged') return 'Inference configuration changed';
  if (event.type === 'InferenceAvailabilityChanged') return 'Inference availability changed';
  if (category === 'job') return event.type.replace(/^Job/, 'Job ');
  if (category === 'sync') return 'Read model updated';
  if (category === 'admin') return 'Admin state updated';
  if (category === 'mcp') return 'Tool activity updated';
  return 'Content activity updated';
}

function summaryForEvent(event: RealtimeEvent): string {
  switch (event.type) {
    case 'ResyncRequired':
      return 'Replay history expired; HotM should refresh local state.';
    case 'EventsLagged':
      return `Client fell behind the event stream${event.dropped_count ? ` by ${event.dropped_count} events` : ''}.`;
    case 'QueueStatus':
      return `Queue has ${event.running ?? 0} running and ${event.pending ?? 0} pending jobs.`;
    case 'JobProgress':
      return `Job progress${typeof event.progress_percent === 'number' ? `: ${event.progress_percent}%` : ' updated'}.`;
    case 'JobCompleted':
      return event.duration_ms ? `Job completed in ${Math.round(event.duration_ms / 1000)}s.` : 'Job completed.';
    case 'JobFailed':
      return 'Job failed; details are available in backend diagnostics.';
    case 'InferenceConfigChanged':
      return 'Inference routing changed; sensitive provider settings are hidden.';
    case 'InferenceAvailabilityChanged':
      return `Provider availability changed${event.reachable === false ? ': unavailable' : ''}.`;
    default:
      return `${event.type} received.`;
  }
}

export function describeRealtimeActivity(event: RealtimeEvent): RealtimeActivityItem {
  const category = categoryForEvent(event);
  return {
    category,
    severity: severityForEvent(event),
    title: titleForEvent(event, category),
    summary: summaryForEvent(event),
    entity: entityForEvent(event),
  };
}
