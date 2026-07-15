import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import JobQueueMonitor from '../JobQueueMonitor';
import { uploadStore, type UploadFileEntry, type UploadStoreState } from '@/services/uploadStore';
import * as useJobStoreModule from '@/hooks/useJobStore';
import * as useUploadStoreModule from '@/hooks/useUploadStore';
import type { JobStoreState } from '@/services/jobEventStore';

vi.mock('@/hooks/useJobStore', () => ({
  useJobStore: vi.fn(),
}));

vi.mock('@/hooks/useUploadStore', () => ({
  useUploadStore: vi.fn(),
}));

vi.mock('@/services/uploadStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/uploadStore')>();
  return {
    ...actual,
    uploadStore: {
      retryFile: vi.fn(),
      cancelFile: vi.fn(),
      clearCompleted: vi.fn(),
    },
  };
});

const defaultJobStoreState: JobStoreState = {
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

function makeUploadState(entry: UploadFileEntry): UploadStoreState {
  return {
    entries: new Map([[entry.id, entry]]),
    isProcessing: false,
    summary: {
      queued: entry.status === 'queued' ? 1 : 0,
      uploading: entry.status === 'uploading' ? 1 : 0,
      completed: entry.status === 'completed' ? 1 : 0,
      failed: entry.status === 'failed' ? 1 : 0,
    },
  };
}

describe('JobQueueMonitor uploads', () => {
  const mockUseJobStore = vi.mocked(useJobStoreModule.useJobStore);
  const mockUseUploadStore = vi.mocked(useUploadStoreModule.useUploadStore);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJobStore.mockReturnValue({ ...defaultJobStoreState });
  });

  it('renders tus degraded-state recovery guidance with retry and cancel controls', () => {
    const failedEntry: UploadFileEntry = {
      id: 'upload-1',
      file: new File(['x'], 'large-video.mp4', { type: 'video/mp4' }),
      noteId: 'note-1',
      status: 'failed',
      bytesUploaded: 20,
      bytesTotal: 100,
      error: 'Fortemi reported a resumable upload offset mismatch.',
      degradedReason: 'tus_offset_mismatch',
      recoveryHint: 'Retry keeps the selected file and asks the server for the current resume offset.',
      retryCount: 0,
      mediaOptimize: true,
      result: null,
      enqueuedAt: Date.now(),
      completedAt: Date.now(),
    };
    mockUseUploadStore.mockReturnValue(makeUploadState(failedEntry));

    render(<JobQueueMonitor />);

    expect(screen.getByText('Fortemi reported a resumable upload offset mismatch.')).toBeInTheDocument();
    expect(screen.getByTestId('upload-recovery-upload-1')).toHaveTextContent('current resume offset');

    fireEvent.click(screen.getByRole('button', { name: 'retry upload large-video.mp4' }));

    expect(uploadStore.retryFile).toHaveBeenCalledWith('upload-1');
    expect(screen.queryByRole('button', { name: 'cancel upload large-video.mp4' })).not.toBeInTheDocument();
  });
});
