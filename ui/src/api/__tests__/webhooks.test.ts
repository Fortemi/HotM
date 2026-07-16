import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../client';
import { createWebhooksApi } from '../webhooks';

describe('Webhooks API', () => {
  let mockClient: ApiClient;
  let webhooksApi: ReturnType<typeof createWebhooksApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as unknown as ApiClient;

    webhooksApi = createWebhooksApi(mockClient);
  });

  it('lists incoming receivers from metadata-only responses', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce([
      {
        id: 'receiver-1',
        slug_len: 12,
        provider_len: 7,
        schema_ref_len: 16,
        signature_header_class: 'hmac_sha256',
        signature_header_len: 19,
        secret_set: true,
        is_active: true,
        schema_doc_class: 'object',
        schema_doc_len: 88,
        schema_doc_secret_candidate: true,
        created_at: '2026-07-14T00:00:00Z',
        updated_at: '2026-07-14T00:00:00Z',
      },
    ]);

    const result = await webhooksApi.listIncomingReceivers();

    expect(mockClient.get).toHaveBeenCalledWith('/webhooks/incoming');
    expect(result[0].signature_header_class).toBe('hmac_sha256');
    expect(JSON.stringify(result)).not.toContain('incoming-hmac-secret');
  });

  it('creates, updates, deletes, and validates incoming receivers', async () => {
    vi.mocked(mockClient.post)
      .mockResolvedValueOnce({ id: 'receiver-1', slug_len: 8 })
      .mockResolvedValueOnce({ valid: false, schema_ref: 'generic.event.v1', errors: ['required'] });
    vi.mocked(mockClient.patch).mockResolvedValueOnce({ id: 'receiver-1', is_active: false });
    vi.mocked(mockClient.delete).mockResolvedValueOnce(undefined);

    await webhooksApi.createIncomingReceiver({
      slug: 'receiver-a',
      provider: 'generic',
      schema_ref: 'generic.event.v1',
      hmac_secret: 'secret-value',
    });
    await webhooksApi.updateIncomingReceiver('receiver-a', { is_active: false });
    await webhooksApi.deleteIncomingReceiver('receiver-a');
    const validation = await webhooksApi.validateIncomingPayload('generic.event.v1', {});

    expect(mockClient.post).toHaveBeenNthCalledWith(1, '/webhooks/incoming', {
      slug: 'receiver-a',
      provider: 'generic',
      schema_ref: 'generic.event.v1',
      hmac_secret: 'secret-value',
    });
    expect(mockClient.patch).toHaveBeenCalledWith('/webhooks/incoming/receiver-a', { is_active: false });
    expect(mockClient.delete).toHaveBeenCalledWith('/webhooks/incoming/receiver-a');
    expect(mockClient.post).toHaveBeenNthCalledWith(2, '/webhooks/incoming/validate', {
      schema_ref: 'generic.event.v1',
      payload: {},
    });
    expect(validation.valid).toBe(false);
  });

  it('lists, creates, and deletes inbound sources through metadata-only endpoints', async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      sources: [
        {
          id: 'source-1',
          name_len: 12,
          kind_len: 3,
          config_class: 'object',
          config_len: 144,
          config_secret_candidate: true,
          config_key_count: 5,
          enabled: false,
          created_at: '2026-07-14T00:00:00Z',
          updated_at: '2026-07-14T00:00:00Z',
        },
      ],
    });
    vi.mocked(mockClient.post).mockResolvedValueOnce({ id: 'source-1' });
    vi.mocked(mockClient.delete).mockResolvedValueOnce(undefined);

    const sources = await webhooksApi.listInboundSources();
    const created = await webhooksApi.createInboundSource({
      name: 'redis-events',
      kind: 'sse',
      enabled: false,
    });
    await webhooksApi.deleteInboundSource('redis-events');

    expect(mockClient.get).toHaveBeenCalledWith('/inbound-sources');
    expect(sources[0].config_secret_candidate).toBe(true);
    expect(created.id).toBe('source-1');
    expect(mockClient.post).toHaveBeenCalledWith('/inbound-sources', {
      name: 'redis-events',
      kind: 'sse',
      enabled: false,
    });
    expect(mockClient.delete).toHaveBeenCalledWith('/inbound-sources/redis-events');
    expect(JSON.stringify(sources)).not.toContain('Authorization');
  });
});
