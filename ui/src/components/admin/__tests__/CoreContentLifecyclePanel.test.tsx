import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoreContentLifecyclePanel } from '../CoreContentLifecyclePanel';

const mocks = vi.hoisted(() => ({
  admission: {
    state: 'compatible' as const,
    message: null as string | null,
    retry: vi.fn(async () => undefined),
    allows: vi.fn(() => true),
    blockReason: vi.fn(() => null),
  },
  notes: {
    bulkCreate: vi.fn(async () => ({ ids: ['note-1'], count: 1 })),
    reprocessAll: vi.fn(async () => ({ message: 'queued', notes_count: 1, jobs_queued: 1 })),
    getActivity: vi.fn(async () => ({ since: '2026-08-01T00:00:00Z', activity: [], created_count: 0, updated_count: 0 })),
    getTimeline: vi.fn(async () => ({ period: 'day', since: '2026-08-01T00:00:00Z', total_notes: 0, buckets: [] })),
    exportMarkdown: vi.fn(async () => '# exported'),
    getFullDocument: vi.fn(async () => ({
      id: 'note-1', title: 'Full note', content: 'body', chunks: null, total_chunks: null,
      is_chunked: false, tags: [], created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    })),
    purge: vi.fn(async () => ({ status: 'queued', job_id: 'job-1', note_id: 'note-1' })),
    restore: vi.fn(async () => ({ restored: true, id: 'note-1' })),
    updateStatus: vi.fn(async () => undefined),
    restoreVersion: vi.fn(async () => ({ success: true, restored_from_version: 2, new_version: 3, restore_tags: true })),
    deleteVersion: vi.fn(async () => ({ success: true, deleted_version: 2 })),
  },
  provenance: {
    createDevice: vi.fn(async () => ({ id: 'device-1' })),
    createLocation: vi.fn(async () => ({ id: 'location-1' })),
    createNamedLocation: vi.fn(async () => ({ id: 'named-1' })),
    createFileProvenance: vi.fn(async () => ({ id: 'file-1' })),
    createNoteProvenance: vi.fn(async () => ({ id: 'note-prov-1' })),
  },
}));

vi.mock('@/hooks/useCoreOperationAdmission', () => ({
  useCoreOperationAdmission: () => mocks.admission,
}));

vi.mock('@/api', () => ({
  api: { notes: mocks.notes, provenance: mocks.provenance },
}));

describe('CoreContentLifecyclePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.admission, {
      state: 'compatible',
      message: null,
      allows: vi.fn(() => true),
      blockReason: vi.fn(() => null),
    });
  });

  it('renders all promoted note workflows and operation state', () => {
    render(<CoreContentLifecyclePanel />);
    for (const name of [
      'Full document', 'Export markdown', 'Apply status', 'Restore note', 'Purge note',
      'Restore version', 'Delete version', 'Create notes', 'Reprocess', 'Load activity', 'Load timeline',
    ]) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(screen.getByText('No operation receipt yet.')).toBeVisible();
  });

  it('fails closed when compatibility admission is unavailable', async () => {
    Object.assign(mocks.admission, {
      state: 'incompatible',
      message: 'Pinned contract mismatch.',
      allows: vi.fn(() => false),
      blockReason: vi.fn(() => 'The server contract is incompatible with this HotM build.'),
    });
    render(<CoreContentLifecyclePanel />);

    expect(screen.getByText('Pinned contract mismatch.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Purge note' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create notes' })).toBeDisabled();
    await userEvent.click(screen.getByRole('tab', { name: 'Provenance' }));
    expect(screen.getByRole('button', { name: 'Create provenance' })).toBeDisabled();
  });

  it.each([
    ['Restore note', 'Restore', 'restore_note', 'Restored note note-1; restored=true.'],
    ['Purge note', 'Queue purge', 'purge_note', 'Purge queued; job job-1 for note note-1.'],
    ['Restore version', 'Restore version', 'restore_note_version', 'Restored version 2 as version 3; tags=true.'],
    ['Delete version', 'Delete version', 'delete_note_version', 'Deleted version 2; success=true.'],
  ])('confirms %s and records an auditable %s receipt', async (control, confirmation, operationId, receipt) => {
    const user = userEvent.setup();
    render(<CoreContentLifecyclePanel />);
    await user.type(screen.getByLabelText('Note ID'), 'note-1');
    if (control.includes('version')) {
      await user.clear(screen.getByLabelText('Version'));
      await user.type(screen.getByLabelText('Version'), '2');
    }

    await user.click(screen.getByRole('button', { name: control }));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.queryByText(receipt)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: confirmation }));

    expect(await screen.findByText(operationId)).toBeVisible();
    expect(screen.getByText(receipt)).toBeVisible();
  });

  it('reports partial bulk completion and preserves returned counts', async () => {
    mocks.notes.bulkCreate.mockResolvedValueOnce({ ids: ['note-1'], count: 1 });
    const user = userEvent.setup();
    render(<CoreContentLifecyclePanel />);
    await user.type(screen.getByLabelText('Bulk note content'), 'first\n---\nsecond');
    await user.click(screen.getByRole('button', { name: 'Create notes' }));
    await user.click(screen.getByRole('button', { name: 'Create notes' }));

    expect(await screen.findByText('bulk_create_notes')).toBeVisible();
    expect(screen.getByText('Created 1/2 notes; 1 IDs returned.')).toBeVisible();
    expect(screen.getByText('partial')).toBeVisible();
  });

  it(
    'supports every promoted provenance mutation through typed form states',
    async () => {
      const user = userEvent.setup();
      render(<CoreContentLifecyclePanel />);
      await user.click(screen.getByRole('tab', { name: 'Provenance' }));

      await user.type(screen.getByLabelText('Provenance note ID'), 'note-1');
      await user.click(screen.getByRole('button', { name: 'Create provenance' }));
      await waitFor(() => expect(mocks.provenance.createNoteProvenance).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: 'file' }));
      await user.type(screen.getByLabelText('Attachment ID'), 'attachment-1');
      await user.click(screen.getByRole('button', { name: 'Create provenance' }));
      await waitFor(() => expect(mocks.provenance.createFileProvenance).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: 'device' }));
      await user.type(screen.getByLabelText('Device make'), 'Acme');
      await user.type(screen.getByLabelText('Device model'), 'One');
      await user.click(screen.getByRole('button', { name: 'Create provenance' }));
      await waitFor(() => expect(mocks.provenance.createDevice).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: 'location' }));
      await user.type(screen.getByLabelText('Latitude'), '40');
      await user.type(screen.getByLabelText('Longitude'), '-75');
      await user.click(screen.getByRole('button', { name: 'Create provenance' }));
      await waitFor(() => expect(mocks.provenance.createLocation).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: 'named location' }));
      await user.type(screen.getByLabelText('Location name'), 'Desk');
      await user.click(screen.getByRole('button', { name: 'Create provenance' }));
      await waitFor(() => expect(mocks.provenance.createNamedLocation).toHaveBeenCalled());
      expect(screen.getByText('Created provenance record named-1.')).toBeVisible();
    },
    // This integration-style case intentionally drives five sequential form flows.
    15_000,
  );

  it.each([375, 1280])('keeps lifecycle controls reachable at %ipx', (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    window.dispatchEvent(new Event('resize'));
    const { container } = render(<CoreContentLifecyclePanel />);

    expect(screen.getByRole('button', { name: 'Purge note' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create notes' })).toBeVisible();
    const classTokens = Array.from(container.querySelectorAll('*')).flatMap((element) => Array.from(element.classList));
    expect(classTokens).toContain('sm:grid-cols-[minmax(0,1fr)_120px]');
    expect(classTokens).toContain('xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]');
  });
});
