import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCallsApi } from '../calls';
import type { ApiClient } from '../client';

describe('Calls API', () => {
  let get: ReturnType<typeof vi.fn>;
  let api: ReturnType<typeof createCallsApi>;

  beforeEach(() => {
    get = vi.fn();
    api = createCallsApi({
      baseUrl: 'http://localhost:3000/api/v1',
      get,
    } as unknown as ApiClient);
  });

  it('fetches call detail with encoded id and pagination params', async () => {
    const detail = {
      call_id: '018f2d2d-bc00-7cc8-8ad2-f147d6a2e77a',
      provider: 'twilio',
      provider_call: {
        provider_call_id_present: true,
        provider_call_id_len: 34,
      },
      started_at: '2026-07-14T12:00:00Z',
      ended_at: null,
      end_reason: null,
      duration_secs: null,
      asr_backend_len: 7,
      remote_party_present: true,
      remote_party_len: 12,
      archive_id: null,
      metadata_class: 'object',
      metadata_len: 22,
      segment_count: 1,
      segments: [{
        id: '018f2d2d-bc00-7cc8-8ad2-f147d6a2e77b',
        call_id: '018f2d2d-bc00-7cc8-8ad2-f147d6a2e77a',
        text: 'hello',
        sequence: 0,
        created_at: '2026-07-14T12:00:01Z',
        start_ts: 0,
        end_ts: 2.5,
        speaker_label: null,
        confidence: 0.98,
      }],
      pagination: { total: 1, limit: 1, offset: 0, has_more: false },
    };
    get.mockResolvedValueOnce(detail);

    await expect(api.getCall('call/id with spaces', { limit: 1, offset: 0 })).resolves.toEqual(detail);

    expect(get).toHaveBeenCalledWith('/calls/call%2Fid%20with%20spaces', {
      limit: '1',
      offset: '0',
    });
  });

  it('omits pagination query when no options are provided', async () => {
    get.mockResolvedValueOnce({ call_id: 'call-1' });

    await api.getCall('call-1');

    expect(get).toHaveBeenCalledWith('/calls/call-1', undefined);
  });

  it('rejects blank call ids before requesting', async () => {
    await expect(api.getCall('   ')).rejects.toThrow('Call ID is required');
    expect(get).not.toHaveBeenCalled();
  });

  it('does not expose a Twilio realtime WebSocket helper from the REST client', () => {
    expect(api).not.toHaveProperty('connectTwilioRealtime');
  });
});
