import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiCapabilitiesPanel } from '../ApiCapabilitiesPanel';
import { api } from '@/api';

vi.mock('@/api', () => ({
  api: {
    client: { baseUrl: 'http://localhost:3000/api/v1' },
    healthCheck: vi.fn(),
  },
}));

describe('ApiCapabilitiesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.healthCheck).mockResolvedValue({
      status: 'healthy',
      version: '2026.5.25',
      database: 'connected',
      ollama: 'unavailable',
      job_processing: 'running',
      capabilities: {
        chat: { available: false, configured: true },
        webhooks: true,
        vision: true,
      },
      sse: { active_connections: 2, events_delivered: 42 },
    } as any);
  });

  it('renders endpoint, sidecar status, degraded state, and advertised capabilities', async () => {
    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('http://localhost:3000/api/v1')).toBeInTheDocument();
      expect(screen.getByText('v2026.5.25')).toBeInTheDocument();
      expect(screen.getByText(/one or more advertised capabilities are degraded/i)).toBeInTheDocument();
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getAllByText('Webhooks').length).toBeGreaterThan(0);
      expect(screen.getByText('Document types')).toBeInTheDocument();
    });
  });

  it('refreshes health on demand', async () => {
    const user = userEvent.setup();
    render(<ApiCapabilitiesPanel />);

    await screen.findByText('API Surface');
    await user.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(api.healthCheck).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a load error without hiding the screen', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.healthCheck).mockRejectedValue(new Error('offline'));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading API surface/i)).toBeInTheDocument();
      expect(screen.getByText(/No capability metadata reported/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });
});
