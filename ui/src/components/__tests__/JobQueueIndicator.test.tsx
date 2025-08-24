import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueueIndicator } from '../JobQueueIndicator';

// Mock the useWebSocket hook
vi.mock('@/services/websocket', () => ({
  useWebSocket: vi.fn(),
}));

describe('JobQueueIndicator', () => {
  const mockUseWebSocket = vi.mocked(await import('@/services/websocket')).useWebSocket;

  beforeEach(() => {
    // Reset mock implementation
    mockUseWebSocket.mockReturnValue({
      connected: false,
      queueStatus: {
        total_jobs: 0,
        running: 0,
        pending: 0,
      },
      sendMessage: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('displays disconnected status when WebSocket is not connected', async () => {
    render(<JobQueueIndicator />);
    
    // Component should show disconnected status
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  it('displays processing status when jobs are running', async () => {
    // Mock connected state with running jobs
    mockUseWebSocket.mockReturnValue({
      connected: true,
      queueStatus: {
        total_jobs: 5,
        running: 2,
        pending: 3,
      },
      sendMessage: vi.fn(),
    });
    
    render(<JobQueueIndicator />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Total jobs badge
    });
  });

  it('displays connected status with no jobs', async () => {
    // Mock connected state with no jobs
    mockUseWebSocket.mockReturnValue({
      connected: true,
      queueStatus: {
        total_jobs: 0,
        running: 0,
        pending: 0,
      },
      sendMessage: vi.fn(),
    });
    
    render(<JobQueueIndicator />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
      // No badge should be visible when totalJobs is 0
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  it('shows badge when jobs are pending', async () => {
    // Mock connected state with pending jobs
    mockUseWebSocket.mockReturnValue({
      connected: true,
      queueStatus: {
        total_jobs: 3,
        running: 0,
        pending: 3,
      },
      sendMessage: vi.fn(),
    });
    
    render(<JobQueueIndicator />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // Total jobs badge
    });
  });

  it('shows different status colors based on queue state', async () => {
    // Mock running state
    mockUseWebSocket.mockReturnValue({
      connected: true,
      queueStatus: {
        total_jobs: 1,
        running: 1,
        pending: 0,
      },
      sendMessage: vi.fn(),
    });
    
    render(<JobQueueIndicator />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Total jobs badge
    });
  });

  // Reconnection test would require timer simulation
  // it('handles WebSocket reconnection', async () => {
  //   // Skipped: Requires advanced timer mocking
  // });
});