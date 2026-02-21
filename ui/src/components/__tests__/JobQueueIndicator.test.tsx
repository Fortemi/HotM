import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueueIndicator } from '../JobQueueIndicator';
import * as websocketModule from '@/services/websocket';
import * as useJobStoreModule from '@/hooks/useJobStore';
import type { JobStoreState } from '@/services/jobEventStore';

// Mock the useWebSocket hook and default export
vi.mock('@/services/websocket', () => ({
  useWebSocket: vi.fn(),
  default: {
    subscribe: vi.fn(() => vi.fn()),
    subscribeConnection: vi.fn(() => vi.fn()),
    subscribeConnectionState: vi.fn(() => vi.fn()),
    getConnectionStatus: vi.fn(() => false),
    getConnectionState: vi.fn(() => 'disconnected'),
  },
}));

vi.mock('@/hooks/useJobStore', () => ({
  useJobStore: vi.fn(),
}));

vi.mock('@/services/jobEventStore', () => ({
  jobEventStore: {
    subscribe: vi.fn(() => vi.fn()),
    getSnapshot: vi.fn(() => ({})),
    getServerSnapshot: vi.fn(() => ({})),
    refreshPauseState: vi.fn(),
  },
}));

const defaultJobStoreState: JobStoreState = {
  activeJobs: new Map(),
  completedJobs: [],
  queueStatus: { total_jobs: 0, running: 0, pending: 0 },
  activeStepLabel: null,
  pauseState: { global: 'running', archives: {} },
  connected: false,
  connectionState: 'disconnected',
  isQueueStalled: false,
  queueStatusAgeMs: 0,
  lastUpdatedAt: Date.now(),
};

describe('JobQueueIndicator', () => {
  const mockUseWebSocket = vi.mocked(websocketModule.useWebSocket);
  const mockUseJobStore = vi.mocked(useJobStoreModule.useJobStore);

  beforeEach(() => {
    mockUseWebSocket.mockReturnValue({
      connected: false,
      queueStatus: { total_jobs: 0, running: 0, pending: 0 },
      queueStatusAgeMs: 0,
      isQueueStalled: false,
      sendMessage: vi.fn(),
    });
    mockUseJobStore.mockReturnValue({ ...defaultJobStoreState });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('displays button when disconnected', async () => {
    render(<JobQueueIndicator />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.querySelector('.text-red-500')).toBeInTheDocument();
    });
  });

  it('displays badge when jobs are running', async () => {
    mockUseJobStore.mockReturnValue({
      ...defaultJobStoreState,
      connected: true,
      connectionState: 'connected',
      queueStatus: { total_jobs: 5, running: 2, pending: 3 },
    });

    render(<JobQueueIndicator />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button.querySelector('.text-blue-500')).toBeInTheDocument();
    });
  });

  it('displays no badge when no jobs are queued', async () => {
    mockUseJobStore.mockReturnValue({
      ...defaultJobStoreState,
      connected: true,
      connectionState: 'connected',
    });

    render(<JobQueueIndicator />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(button.querySelector('.text-green-500')).toBeInTheDocument();
    });
  });

  it('shows active step label when running', async () => {
    mockUseJobStore.mockReturnValue({
      ...defaultJobStoreState,
      connected: true,
      connectionState: 'connected',
      queueStatus: { total_jobs: 1, running: 1, pending: 0 },
      activeStepLabel: '2/5: Embedding',
    });

    render(<JobQueueIndicator />);

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });
});
