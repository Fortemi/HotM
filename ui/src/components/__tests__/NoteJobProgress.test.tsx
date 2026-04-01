import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteJobProgress } from '../NoteJobProgress';
import * as useJobStoreModule from '@/hooks/useJobStore';
import type { JobStoreState, ActiveJob, CompletedJob } from '@/services/jobEventStore';

// Mock useJobStore
vi.mock('@/hooks/useJobStore', () => ({
  useJobStore: vi.fn(),
}));

// Mock jobEventStore
vi.mock('@/services/jobEventStore', () => ({
  jobEventStore: {
    subscribe: vi.fn(() => vi.fn()),
    getSnapshot: vi.fn(() => ({})),
    getServerSnapshot: vi.fn(() => ({})),
  },
}));

const mockQueueJob = vi.fn().mockResolvedValue({ job_id: 'new-1', estimated_duration_ms: 0, queue_position: 0 });
const mockGetNoteJobs = vi.fn().mockResolvedValue([]);

// Mock api
vi.mock('@/api', () => ({
  api: {
    extended: {
      queueJob: (...args: any[]) => mockQueueJob(...args),
      getNoteJobs: (...args: any[]) => mockGetNoteJobs(...args),
    },
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

describe('NoteJobProgress', () => {
  const mockUseJobStore = vi.mocked(useJobStoreModule.useJobStore);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJobStore.mockReturnValue({ ...defaultJobStoreState });
  });

  it('shows fallbackContent when no active/failed jobs for note', () => {
    mockUseJobStore.mockReturnValue({ ...defaultJobStoreState });

    render(
      <NoteJobProgress
        noteId="note-1"
        fallbackContent={<div data-testid="fallback">Loading...</div>}
      />
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('note-job-progress')).not.toBeInTheDocument();
  });

  it('shows progress bars for active jobs', () => {
    const activeJobs = new Map<string, ActiveJob>();
    activeJobs.set('job-1', {
      job_id: 'job-1',
      job_type: 'embedding',
      note_id: 'note-1',
      progress_percent: 40,
      message: 'Generating embeddings',
      started_at: new Date().toISOString(),
      step_name: 'Embedding',
      steps_total: 5,
      step_current: 2,
    });

    mockUseJobStore.mockReturnValue({
      ...defaultJobStoreState,
      activeJobs,
    });

    render(<NoteJobProgress noteId="note-1" />);

    expect(screen.getByTestId('note-job-progress')).toBeInTheDocument();
    expect(screen.getByText('Embedding')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('displays step label text', () => {
    const activeJobs = new Map<string, ActiveJob>();
    activeJobs.set('job-1', {
      job_id: 'job-1',
      job_type: 'embedding',
      note_id: 'note-1',
      progress_percent: 40,
      started_at: new Date().toISOString(),
      step_name: 'Embedding',
      steps_total: 5,
      step_current: 2,
    });

    mockUseJobStore.mockReturnValue({
      ...defaultJobStoreState,
      activeJobs,
    });

    render(<NoteJobProgress noteId="note-1" />);

    expect(screen.getByTestId('step-label-job-1')).toHaveTextContent('Step 2/5: Embedding');
  });

  it('shows error state with retry button for failed jobs', () => {
    const failedJobs: CompletedJob[] = [
      {
        job_id: 'job-2',
        job_type: 'linking',
        note_id: 'note-1',
        status: 'failed',
        error: 'Connection timeout',
        duration_ms: 5000,
        timestamp: Date.now(),
      },
    ];

    mockUseJobStore.mockReturnValue({
      ...defaultJobStoreState,
      completedJobs: failedJobs,
    });

    render(<NoteJobProgress noteId="note-1" />);

    expect(screen.getByTestId('failed-job-job-2')).toBeInTheDocument();
    expect(screen.getByText(/Linking failed/)).toBeInTheDocument();
    expect(screen.getByText(/Connection timeout/)).toBeInTheDocument();
    expect(screen.getByTestId('retry-linking')).toBeInTheDocument();
  });

  it('calls retry handler with correct jobType on retry click', async () => {
    const failedJobs: CompletedJob[] = [
      {
        job_id: 'job-2',
        job_type: 'linking',
        note_id: 'note-1',
        status: 'failed',
        error: 'Timeout',
        timestamp: Date.now(),
      },
    ];

    mockUseJobStore.mockReturnValue({
      ...defaultJobStoreState,
      completedJobs: failedJobs,
    });

    render(<NoteJobProgress noteId="note-1" />);

    fireEvent.click(screen.getByTestId('retry-linking'));

    await waitFor(() => {
      expect(mockQueueJob).toHaveBeenCalledWith('note-1', 'linking', 8);
    });
  });

  it('does not show jobs from other notes', () => {
    const activeJobs = new Map<string, ActiveJob>();
    activeJobs.set('job-1', {
      job_id: 'job-1',
      job_type: 'embedding',
      note_id: 'note-OTHER',
      progress_percent: 40,
      started_at: new Date().toISOString(),
    });

    mockUseJobStore.mockReturnValue({
      ...defaultJobStoreState,
      activeJobs,
    });

    render(
      <NoteJobProgress
        noteId="note-1"
        fallbackContent={<div data-testid="fallback">Nothing here</div>}
      />
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });
});
