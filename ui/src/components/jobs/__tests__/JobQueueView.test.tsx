import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobQueueView } from '../JobQueueView';
import * as useJobStoreModule from '@/hooks/useJobStore';
import type { JobStoreState, ActiveJob, CompletedJob } from '@/services/jobEventStore';
import type { MemoryArchive } from '@/api';

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

vi.mock('@/api', () => ({
  api: {
    jobs: {
      pauseGlobal: vi.fn(),
      resumeGlobal: vi.fn(),
      pauseArchive: vi.fn(),
      resumeArchive: vi.fn(),
      getPauseStatus: vi.fn(() => Promise.resolve({ global: 'running', archives: {} })),
      getArchiveJobCounts: vi.fn(() =>
        Promise.resolve({ pending: 0, processing: 0, completed_last_hour: 0, failed_last_hour: 0, total: 0 }),
      ),
    },
  },
}));

vi.mock('@/services/websocket', () => ({
  useWebSocket: vi.fn(() => ({
    connected: true,
    sendMessage: vi.fn(),
    queueStatus: { total_jobs: 0, running: 0, pending: 0 },
    queueStatusAgeMs: 0,
    isQueueStalled: false,
  })),
  default: {
    subscribe: vi.fn(() => vi.fn()),
    subscribeConnection: vi.fn(() => vi.fn()),
    subscribeConnectionState: vi.fn(() => vi.fn()),
    getConnectionStatus: vi.fn(() => true),
    getConnectionState: vi.fn(() => 'connected'),
  },
}));

// Mock Radix Select to avoid jsdom scrollIntoView crash
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-select">{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

const mockArchives: MemoryArchive[] = [
  { id: '1', name: 'notes', schema_name: 'notes', created_at: '2024-01-01', is_default: true, schema_version: 1 },
  { id: '2', name: 'research', schema_name: 'research', created_at: '2024-01-01', is_default: false, schema_version: 1 },
];

const defaultState: JobStoreState = {
  activeJobs: new Map(),
  completedJobs: [],
  queueStatus: { total_jobs: 0, running: 0, pending: 0 },
  activeStepLabel: null,
  pauseState: { global: 'running', archives: {} },
  connected: true,
  connectionState: 'connected',
  isQueueStalled: false,
  queueStatusAgeMs: 0,
  lastUpdatedAt: Date.now(),
};

describe('JobQueueView', () => {
  const mockUseJobStore = vi.mocked(useJobStoreModule.useJobStore);

  beforeEach(() => {
    mockUseJobStore.mockReturnValue({ ...defaultState });
  });

  it('renders the header and queue status cards', () => {
    render(<JobQueueView archives={mockArchives} />);

    expect(screen.getByText('Job Queue')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    // Status card labels may appear multiple times — just verify they exist
    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No active jobs" when none are active', () => {
    render(<JobQueueView archives={mockArchives} />);
    expect(screen.getByText('No active jobs')).toBeInTheDocument();
  });

  it('renders active jobs with progress', () => {
    const activeJobs = new Map<string, ActiveJob>();
    activeJobs.set('j1', {
      job_id: 'j1',
      job_type: 'AiRevision',
      note_id: 'note-123',
      memory: 'notes',
      progress_percent: 65,
      message: 'Processing...',
      started_at: new Date().toISOString(),
      step_name: 'Summarize',
      step_current: 3,
      steps_total: 5,
    });

    mockUseJobStore.mockReturnValue({
      ...defaultState,
      activeJobs,
      queueStatus: { total_jobs: 1, running: 1, pending: 0 },
    });

    render(<JobQueueView archives={mockArchives} />);

    expect(screen.getByText('Ai Revision')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('Step 3/5: Summarize')).toBeInTheDocument();
    // "notes" appears as archive badge and in the filter dropdown
    expect(screen.getAllByText('notes').length).toBeGreaterThanOrEqual(1);
  });

  it('renders completed jobs', () => {
    const completedJobs: CompletedJob[] = [
      {
        job_id: 'c1',
        job_type: 'Embedding',
        status: 'completed',
        duration_ms: 2500,
        timestamp: Date.now() - 60000,
        memory: 'research',
      },
      {
        job_id: 'c2',
        job_type: 'Linking',
        status: 'failed',
        error: 'Connection refused',
        duration_ms: 100,
        timestamp: Date.now() - 120000,
      },
    ];

    mockUseJobStore.mockReturnValue({
      ...defaultState,
      completedJobs,
    });

    render(<JobQueueView archives={mockArchives} />);

    expect(screen.getByText('Embedding')).toBeInTheDocument();
    expect(screen.getByText('2.5s')).toBeInTheDocument();
    expect(screen.getByText('Linking')).toBeInTheDocument();
  });

  it('shows disconnected state', () => {
    mockUseJobStore.mockReturnValue({
      ...defaultState,
      connected: false,
      connectionState: 'disconnected',
    });

    render(<JobQueueView archives={mockArchives} />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows stalled warning', () => {
    mockUseJobStore.mockReturnValue({
      ...defaultState,
      connected: true,
      isQueueStalled: true,
      queueStatusAgeMs: 6 * 60 * 1000,
      queueStatus: { total_jobs: 1, running: 1, pending: 0 },
    });

    render(<JobQueueView archives={mockArchives} />);
    expect(screen.getByText(/Queue appears stalled/)).toBeInTheDocument();
  });

  it('shows global pause state', () => {
    mockUseJobStore.mockReturnValue({
      ...defaultState,
      pauseState: { global: 'paused', archives: {} },
    });

    render(<JobQueueView archives={mockArchives} />);
    // "paused" appears in both badge and buttons - just check at least one exists
    expect(screen.getAllByText('paused').length).toBeGreaterThanOrEqual(1);
  });
});
