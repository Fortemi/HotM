import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueueIndicator } from '../JobQueueIndicator';
import * as websocketModule from '@/services/websocket';

// Mock the useWebSocket hook
vi.mock('@/services/websocket', () => ({
  useWebSocket: vi.fn(),
}));

describe('JobQueueIndicator', () => {
  const mockUseWebSocket = vi.mocked(websocketModule.useWebSocket);

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

  it('displays button when WebSocket is not connected', async () => {
    render(<JobQueueIndicator />);
    
    // Component should render a button (the actual visible element)
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Should have red status color for disconnected state
      expect(button.querySelector('.text-red-500')).toBeInTheDocument();
    });
  });

  it('displays badge when jobs are running', async () => {
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
      expect(screen.getByText('5')).toBeInTheDocument(); // Total jobs badge
      const button = screen.getByRole('button');
      // Should have blue status color for running state
      expect(button.querySelector('.text-blue-500')).toBeInTheDocument();
    });
  });

  it('displays no badge when no jobs are queued', async () => {
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
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // No badge should be visible when totalJobs is 0
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      // Should have green status color for idle state
      expect(button.querySelector('.text-green-500')).toBeInTheDocument();
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
      expect(screen.getByText('3')).toBeInTheDocument(); // Total jobs badge
      const button = screen.getByRole('button');
      // Should have yellow status color for pending state
      expect(button.querySelector('.text-yellow-500')).toBeInTheDocument();
    });
  });

  it('displays correct icon based on queue state', async () => {
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
      expect(screen.getByText('1')).toBeInTheDocument(); // Total jobs badge
      // Should have loading icon for running state
      const loadingIcon = screen.getByRole('button').querySelector('.lucide-loader-circle');
      expect(loadingIcon).toBeInTheDocument();
    });
  });

  // Reconnection test would require timer simulation
  // it('handles WebSocket reconnection', async () => {
  //   // Skipped: Requires advanced timer mocking
  // });
});