import { describe, expect, it } from 'vitest';
import { describeRealtimeActivity } from '@/services/realtimeActivity';

describe('describeRealtimeActivity', () => {
  it('HUX-REQ-006 HUX-REQ-011 classifies job progress without exposing raw note or job identifiers', () => {
    const activity = describeRealtimeActivity({
      type: 'JobProgress',
      raw_event_type: 'job.progress',
      job_id: 'job-secret-123',
      note_id: 'note-secret-456',
      job_type: 'embedding',
      progress_percent: 65,
      message: 'Processing /private/user/file.md with bearer token abc',
    });

    expect(activity).toEqual({
      category: 'job',
      severity: 'info',
      title: 'Job Progress',
      summary: 'Job progress: 65%.',
      entity: 'embedding job',
    });
    expect(JSON.stringify(activity)).not.toContain('job-secret-123');
    expect(JSON.stringify(activity)).not.toContain('note-secret-456');
    expect(JSON.stringify(activity)).not.toContain('/private/user/file.md');
    expect(JSON.stringify(activity)).not.toContain('bearer token');
  });

  it('HUX-REQ-006 classifies replay expiry and lag as connection warnings', () => {
    expect(describeRealtimeActivity({ type: 'ResyncRequired' })).toEqual({
      category: 'connection',
      severity: 'warning',
      title: 'Resync required',
      summary: 'Replay history expired; HotM should refresh local state.',
      entity: 'system',
    });

    expect(describeRealtimeActivity({ type: 'EventsLagged', dropped_count: 3 })).toEqual({
      category: 'connection',
      severity: 'warning',
      title: 'Event replay lag',
      summary: 'Client fell behind the event stream by 3 events.',
      entity: 'system',
    });
  });

  it('HUX-REQ-011 hides sensitive admin and provider details in summaries', () => {
    const activity = describeRealtimeActivity({
      type: 'InferenceConfigChanged',
      raw_event_type: 'inference.config.changed',
      changed_fields: ['openrouter.api_key', 'kms.key_id', 'license.raw'],
      correlation_id: 'corr-secret',
      memory: 'tenant-private-id',
    });

    expect(activity.category).toBe('admin');
    expect(activity.summary).toBe('Inference routing changed; sensitive provider settings are hidden.');
    expect(JSON.stringify(activity)).not.toContain('openrouter.api_key');
    expect(JSON.stringify(activity)).not.toContain('kms.key_id');
    expect(JSON.stringify(activity)).not.toContain('license.raw');
    expect(JSON.stringify(activity)).not.toContain('tenant-private-id');
    expect(JSON.stringify(activity)).not.toContain('corr-secret');
  });
});
