import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api } from '@/api';
import type { Webhook } from '@/api';
import { WebhooksPanel } from '../WebhooksPanel';

vi.mock('@/api', () => ({
  api: {
    webhooks: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      test: vi.fn(),
      listIncomingReceivers: vi.fn(),
      createIncomingReceiver: vi.fn(),
      deleteIncomingReceiver: vi.fn(),
      validateIncomingPayload: vi.fn(),
      listInboundSources: vi.fn(),
      createInboundSource: vi.fn(),
      deleteInboundSource: vi.fn(),
    },
  },
}));

const mockWebhooks: Webhook[] = [
  {
    id: 'wh-1',
    url: 'https://example.com/hotm',
    events: ['note.created', 'job.completed'],
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_triggered_at: null,
    failure_count: 0,
    max_retries: 3,
  },
];

describe('WebhooksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.webhooks.list).mockResolvedValue(mockWebhooks);
    vi.mocked(api.webhooks.listIncomingReceivers).mockResolvedValue([
      {
        id: 'receiver-1',
        slug_len: 18,
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
    vi.mocked(api.webhooks.listInboundSources).mockResolvedValue([
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
    ]);
    vi.mocked(api.webhooks.create).mockResolvedValue({
      ...mockWebhooks[0],
      id: 'wh-2',
      url: 'https://example.com/new',
      events: ['note.created', 'note.updated'],
    });
    vi.mocked(api.webhooks.delete).mockResolvedValue(undefined);
    vi.mocked(api.webhooks.createIncomingReceiver).mockResolvedValue({
      id: 'receiver-2',
      slug_len: 14,
      provider_len: 7,
      schema_ref_len: 16,
      signature_header_class: 'hmac_sha256',
      signature_header_len: 19,
      secret_set: true,
      is_active: true,
      schema_doc_class: null,
      schema_doc_len: null,
      schema_doc_secret_candidate: false,
      created_at: '2026-07-14T00:00:00Z',
      updated_at: '2026-07-14T00:00:00Z',
    });
    vi.mocked(api.webhooks.deleteIncomingReceiver).mockResolvedValue(undefined);
    vi.mocked(api.webhooks.validateIncomingPayload).mockResolvedValue({
      valid: false,
      schema_ref: 'generic.event.v1',
      errors: ['required'],
    });
    vi.mocked(api.webhooks.createInboundSource).mockResolvedValue({ id: 'source-2' });
    vi.mocked(api.webhooks.deleteInboundSource).mockResolvedValue(undefined);
    vi.mocked(api.webhooks.test).mockResolvedValue({
      id: 'delivery-1',
      webhook_id: 'wh-1',
      event_type: 'test',
      payload: {},
      status_code: 200,
      response_body: 'ok',
      delivered_at: '2026-01-01T00:00:00Z',
      success: true,
    });
  });

  it('lists registered webhooks', async () => {
    render(<WebhooksPanel />);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/hotm')).toBeInTheDocument();
      expect(screen.getByText('1 webhooks')).toBeInTheDocument();
      expect(screen.getByText('1 incoming receivers')).toBeInTheDocument();
      expect(screen.getByText('1 inbound sources')).toBeInTheDocument();
    });
    expect(screen.getByText('note.created, job.completed')).toBeInTheDocument();
    expect(screen.getByText('Slug length: 18')).toBeInTheDocument();
    expect(screen.getByText('Config keys: 5')).toBeInTheDocument();
    expect(screen.queryByText(/incoming-hmac-secret/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Authorization/i)).not.toBeInTheDocument();
  });

  it('registers a new webhook', async () => {
    const user = userEvent.setup();
    render(<WebhooksPanel />);

    await screen.findByText('https://example.com/hotm');
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com/new' } });
    fireEvent.change(screen.getByLabelText('Events'), { target: { value: 'note.created, note.updated' } });
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: 'secret-value' } });
    fireEvent.change(screen.getByLabelText('Max retries'), { target: { value: '5' } });
    await user.click(screen.getByRole('button', { name: /Register Webhook/i }));

    await waitFor(() => {
      expect(api.webhooks.create).toHaveBeenCalledWith({
        url: 'https://example.com/new',
        events: ['note.created', 'note.updated'],
        secret: 'secret-value',
        max_retries: 5,
      });
      expect(screen.getByText('Webhook created')).toBeInTheDocument();
    });
  });

  it('sends test deliveries and deletes webhooks', async () => {
    const user = userEvent.setup();
    render(<WebhooksPanel />);

    await screen.findByText('https://example.com/hotm');
    await user.click(screen.getByRole('button', { name: /Test/i }));
    await waitFor(() => {
      expect(api.webhooks.test).toHaveBeenCalledWith('wh-1');
      expect(screen.getByText('Test delivery succeeded')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^Delete$/i }));
    await waitFor(() => {
      expect(api.webhooks.delete).toHaveBeenCalledWith('wh-1');
      expect(screen.getByText('Webhook deleted')).toBeInTheDocument();
    });
  });

  it('registers and deletes incoming receivers without rendering raw secrets', async () => {
    const user = userEvent.setup();
    render(<WebhooksPanel />);

    await screen.findByText('Incoming Receivers');
    fireEvent.change(screen.getByLabelText('Receiver slug'), { target: { value: 'customer-created' } });
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'generic' } });
    fireEvent.change(screen.getByLabelText('Schema ref'), { target: { value: 'generic.event.v1' } });
    fireEvent.change(screen.getByLabelText('HMAC secret'), { target: { value: 'incoming-hmac-secret' } });
    await user.click(screen.getByRole('button', { name: /Register Incoming Receiver/i }));

    await waitFor(() => {
      expect(api.webhooks.createIncomingReceiver).toHaveBeenCalledWith({
        slug: 'customer-created',
        provider: 'generic',
        schema_ref: 'generic.event.v1',
        hmac_secret: 'incoming-hmac-secret',
        signature_header: 'X-Fortemi-Signature',
        is_active: true,
      });
      expect(screen.getByText('Incoming receiver created; secret cleared')).toBeInTheDocument();
      expect(screen.queryByText('incoming-hmac-secret')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Receiver slug'), { target: { value: 'customer-created' } });
    await user.click(screen.getByRole('button', { name: /Delete Receiver By Slug/i }));

    await waitFor(() => {
      expect(api.webhooks.deleteIncomingReceiver).toHaveBeenCalledWith('customer-created');
    });
  });

  it('validates incoming payload schemas and registers disabled inbound sources', async () => {
    const user = userEvent.setup();
    render(<WebhooksPanel />);

    await screen.findByText('Inbound Sources');
    fireEvent.change(screen.getByLabelText('Validation schema ref'), { target: { value: 'generic.event.v1' } });
    await user.click(screen.getByRole('button', { name: /Validate Empty Payload/i }));

    await waitFor(() => {
      expect(api.webhooks.validateIncomingPayload).toHaveBeenCalledWith('generic.event.v1', {});
      expect(screen.getByText('Incoming payload invalid (1 errors)')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Source name'), { target: { value: 'redis-events' } });
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'sse' } });
    await user.click(screen.getByRole('button', { name: /Register Disabled Source/i }));

    await waitFor(() => {
      expect(api.webhooks.createInboundSource).toHaveBeenCalledWith({
        name: 'redis-events',
        kind: 'sse',
        enabled: false,
      });
    });

    fireEvent.change(screen.getByLabelText('Source name'), { target: { value: 'redis-events' } });
    await user.click(screen.getByRole('button', { name: /Delete Source By Name/i }));

    await waitFor(() => {
      expect(api.webhooks.deleteInboundSource).toHaveBeenCalledWith('redis-events');
    });
    expect(screen.queryByText(/Bearer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/api_key/i)).not.toBeInTheDocument();
  });
});
