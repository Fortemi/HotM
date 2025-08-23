import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueueIndicator } from '../JobQueueIndicator';

describe('JobQueueIndicator', () => {
  let mockWs: any;

  beforeEach(() => {
    // Create mock WebSocket
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
      onmessage: null,
      onclose: null,
      onerror: null,
    };

    // Mock WebSocket constructor
    (global as any).WebSocket = vi.fn(() => mockWs);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('displays idle status when no jobs are queued', () => {
    render(<JobQueueIndicator />);
    
    // Should show idle status initially
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('displays processing status when jobs are running', async () => {
    render(<JobQueueIndicator />);
    
    // Simulate WebSocket message with running jobs
    const queueStatus = {
      type: 'QueueStatus',
      total_jobs: 5,
      running: 2,
      pending: 3,
      active_job: {
        job_id: 'test-job-id',
        job_type: 'AiRevision',
        progress_percent: 45,
        message: 'Processing content',
        started_at: new Date().toISOString(),
      }
    };

    // Trigger WebSocket message
    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(queueStatus) });
    }

    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Total jobs
    });
  });

  it('updates job count when jobs are queued', async () => {
    render(<JobQueueIndicator />);
    
    // Simulate JobQueued message
    const jobQueued = {
      type: 'JobQueued',
      job_id: 'new-job-id',
      job_type: 'Embedding',
      note_id: 'note-id',
      priority: 5
    };

    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(jobQueued) });
    }

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Should show 1 job
    });
  });

  it('decrements pending count when job starts', async () => {
    render(<JobQueueIndicator />);
    
    // First set up initial state with pending jobs
    const initialStatus = {
      type: 'QueueStatus',
      total_jobs: 3,
      running: 0,
      pending: 3,
      active_job: null
    };

    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(initialStatus) });
    }

    // Then simulate JobStarted
    const jobStarted = {
      type: 'JobStarted',
      job_id: 'started-job-id',
      job_type: 'AiRevision',
      note_id: 'note-id',
      estimated_duration_ms: 5000
    };

    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(jobStarted) });
    }

    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });

  it('handles job completion correctly', async () => {
    render(<JobQueueIndicator />);
    
    // Set up initial state with running job
    const initialStatus = {
      type: 'QueueStatus',
      total_jobs: 1,
      running: 1,
      pending: 0,
      active_job: {
        job_id: 'running-job-id',
        job_type: 'AiRevision',
        progress_percent: 100,
        message: 'Completing',
        started_at: new Date().toISOString(),
      }
    };

    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(initialStatus) });
    }

    // Simulate JobCompleted
    const jobCompleted = {
      type: 'JobCompleted',
      job_id: 'running-job-id',
      job_type: 'AiRevision',
      note_id: 'note-id',
      duration_ms: 5000
    };

    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(jobCompleted) });
    }

    await waitFor(() => {
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });
  });

  it('handles WebSocket reconnection', async () => {
    render(<JobQueueIndicator />);
    
    // Simulate WebSocket close
    if (mockWs.onclose) {
      mockWs.onclose();
    }

    // WebSocket should attempt to reconnect
    await waitFor(() => {
      expect(global.WebSocket).toHaveBeenCalledTimes(2); // Initial + reconnect
    });
  });
});