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
    vi.mocked(api.webhooks.create).mockResolvedValue({
      ...mockWebhooks[0],
      id: 'wh-2',
      url: 'https://example.com/new',
      events: ['note.created', 'note.updated'],
    });
    vi.mocked(api.webhooks.delete).mockResolvedValue(undefined);
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
    });
    expect(screen.getByText('note.created, job.completed')).toBeInTheDocument();
  });

  it('registers a new webhook', async () => {
    const user = userEvent.setup();
    render(<WebhooksPanel />);

    await screen.findByText('https://example.com/hotm');
    await user.type(screen.getByLabelText('URL'), 'https://example.com/new');
    fireEvent.change(screen.getByLabelText('Events'), { target: { value: 'note.created, note.updated' } });
    await user.type(screen.getByLabelText('Secret'), 'secret-value');
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

    await user.click(screen.getByRole('button', { name: /Delete/i }));
    await waitFor(() => {
      expect(api.webhooks.delete).toHaveBeenCalledWith('wh-1');
      expect(screen.getByText('Webhook deleted')).toBeInTheDocument();
    });
  });
});
