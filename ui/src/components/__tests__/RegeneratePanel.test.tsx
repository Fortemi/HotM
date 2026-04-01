import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegeneratePanel } from '../RegeneratePanel';
import * as useJobStoreModule from '@/hooks/useJobStore';
import type { JobStoreState } from '@/services/jobEventStore';

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

// Mock api
vi.mock('@/api', () => ({
  api: {
    collections: {
      list: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock Radix Select (jsdom compat)
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select data-testid="collection-select" value={value} onChange={(e: any) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
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

const defaultProps = {
  noteId: 'note-1',
  isProcessing: false,
  onRegenerate: vi.fn().mockResolvedValue(undefined),
  onQueueJob: vi.fn().mockResolvedValue(undefined),
  disabled: false,
};

describe('RegeneratePanel', () => {
  const mockUseJobStore = vi.mocked(useJobStoreModule.useJobStore);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJobStore.mockReturnValue({ ...defaultJobStoreState });
  });

  it('renders trigger button with correct text', () => {
    render(<RegeneratePanel {...defaultProps} />);
    expect(screen.getByText('Regenerate AI')).toBeInTheDocument();
  });

  it('opens popover on click', () => {
    render(<RegeneratePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Regenerate AI'));
    expect(screen.getByText('Revision Mode')).toBeInTheDocument();
    expect(screen.getByText('Individual Jobs')).toBeInTheDocument();
  });

  it('calls onRegenerate with standard mode when Standard clicked', async () => {
    const onRegenerate = vi.fn().mockResolvedValue(undefined);
    render(<RegeneratePanel {...defaultProps} onRegenerate={onRegenerate} />);

    fireEvent.click(screen.getByText('Regenerate AI'));
    fireEvent.click(screen.getByTestId('mode-standard'));

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledWith({ revision_mode: 'standard' });
    });
  });

  it('calls onRegenerate with light mode when Light clicked', async () => {
    const onRegenerate = vi.fn().mockResolvedValue(undefined);
    render(<RegeneratePanel {...defaultProps} onRegenerate={onRegenerate} />);

    fireEvent.click(screen.getByText('Regenerate AI'));
    fireEvent.click(screen.getByTestId('mode-light'));

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledWith({ revision_mode: 'light' });
    });
  });

  it('shows ContextFilterInputs when contextual_filtered selected', () => {
    render(<RegeneratePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Regenerate AI'));
    fireEvent.click(screen.getByTestId('mode-contextual_filtered'));

    expect(screen.getByText('Context Filters')).toBeInTheDocument();
    expect(screen.getByText('Apply Filtered Revision')).toBeInTheDocument();
  });

  it('calls onQueueJob with embedding when Re-embed clicked', async () => {
    const onQueueJob = vi.fn().mockResolvedValue(undefined);
    render(<RegeneratePanel {...defaultProps} onQueueJob={onQueueJob} />);

    fireEvent.click(screen.getByText('Regenerate AI'));
    fireEvent.click(screen.getByTestId('job-embedding'));

    await waitFor(() => {
      expect(onQueueJob).toHaveBeenCalledWith('embedding');
    });
  });

  it('calls onQueueJob with linking when Re-link clicked', async () => {
    const onQueueJob = vi.fn().mockResolvedValue(undefined);
    render(<RegeneratePanel {...defaultProps} onQueueJob={onQueueJob} />);

    fireEvent.click(screen.getByText('Regenerate AI'));
    fireEvent.click(screen.getByTestId('job-linking'));

    await waitFor(() => {
      expect(onQueueJob).toHaveBeenCalledWith('linking');
    });
  });

  it('shows confirmation AlertDialog when Reset to Original clicked', () => {
    render(<RegeneratePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Regenerate AI'));
    fireEvent.click(screen.getByTestId('mode-none'));

    expect(screen.getByText('Reset to Original?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('calls onRegenerate with none mode on reset confirm', async () => {
    const onRegenerate = vi.fn().mockResolvedValue(undefined);
    render(<RegeneratePanel {...defaultProps} onRegenerate={onRegenerate} />);

    fireEvent.click(screen.getByText('Regenerate AI'));
    fireEvent.click(screen.getByTestId('mode-none'));
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledWith({ revision_mode: 'none' });
    });
  });

  it('disables all buttons when isProcessing=true', () => {
    render(<RegeneratePanel {...defaultProps} isProcessing={true} />);
    const trigger = screen.getByLabelText('Regenerate AI options');
    expect(trigger).toBeDisabled();
  });

  it('disables all buttons when disabled=true', () => {
    render(<RegeneratePanel {...defaultProps} disabled={true} />);
    const trigger = screen.getByLabelText('Regenerate AI options');
    expect(trigger).toBeDisabled();
  });

  it('queues all 5 job types on Full Reprocess', async () => {
    const onQueueJob = vi.fn().mockResolvedValue(undefined);
    render(<RegeneratePanel {...defaultProps} onQueueJob={onQueueJob} />);

    fireEvent.click(screen.getByText('Regenerate AI'));
    fireEvent.click(screen.getByTestId('full-reprocess'));

    await waitFor(() => {
      expect(onQueueJob).toHaveBeenCalledTimes(5);
      expect(onQueueJob).toHaveBeenCalledWith('ai_revision');
      expect(onQueueJob).toHaveBeenCalledWith('embedding');
      expect(onQueueJob).toHaveBeenCalledWith('linking');
      expect(onQueueJob).toHaveBeenCalledWith('context_update');
      expect(onQueueJob).toHaveBeenCalledWith('title_generation');
    });
  });
});
