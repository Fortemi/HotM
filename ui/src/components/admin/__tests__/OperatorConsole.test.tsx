import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OperatorDiagnosticState, OperatorSnapshot } from '@/api';
import { OperatorConsole } from '../OperatorConsole';

function snapshot(
  state: OperatorSnapshot['state'] = 'success',
  diagnosticState: OperatorDiagnosticState = 'available',
  options: { mutation?: OperatorSnapshot['mutation']; fetchedAt?: string } = {},
): OperatorSnapshot {
  return {
    state,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    mutation: options.mutation ?? { state: 'allowed', reason: 'compatible_local_operator' },
    diagnostics: [{
      id: 'health',
      domain: 'health',
      label: 'Knowledge and streaming',
      state: diagnosticState,
      metrics: diagnosticState === 'available' || diagnosticState === 'degraded'
        ? [{ label: 'notes', value: 12 }, { label: 'streaming', value: 'healthy' }]
        : [],
      operationIds: ['get_knowledge_health', 'streaming_health_check'],
    }],
  };
}

function service(loadSnapshot = vi.fn().mockResolvedValue(snapshot())) {
  return {
    loadSnapshot,
    inspect: vi.fn().mockResolvedValue({
      id: 'inspection-job_detail',
      domain: 'jobs',
      label: 'Inspection result',
      state: 'available',
      metrics: [{ label: 'progress', value: 25 }],
      operationIds: ['get_job'],
    }),
    runAction: vi.fn().mockResolvedValue({ state: 'accepted', operationId: 'pause_jobs_global' }),
  };
}

describe('OperatorConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the loading state while the initial diagnostics are pending', () => {
    const pending = new Promise<OperatorSnapshot>(() => undefined);
    render(<OperatorConsole service={service(vi.fn(() => pending)) as never} />);
    expect(screen.getByText('Loading operator diagnostics...')).toBeInTheDocument();
  });

  it.each([
    ['empty', 'empty', 'No operational records are currently reported.'],
    ['partial', 'unavailable', 'Some diagnostics are unavailable. Available summaries remain current.'],
    ['degraded', 'degraded', 'The server reported degraded operational conditions.'],
    ['unauthorized', 'unauthorized', 'Operator diagnostics are not authorized for this session.'],
    ['incompatible', 'incompatible', 'Compatibility admission failed. Operator controls are locked.'],
  ] as const)('renders the %s state without raw server details', async (state, diagnosticState, message) => {
    render(<OperatorConsole service={service(vi.fn().mockResolvedValue(snapshot(state, diagnosticState))) as never} />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/token|tenant|private path/i)).not.toBeInTheDocument();
  });

  it('renders a successful bounded summary', async () => {
    render(<OperatorConsole service={service() as never} />);
    expect(await screen.findByText('Knowledge and streaming')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('admitted')).toBeInTheDocument();
  });

  it('marks old diagnostics stale and disables controls', async () => {
    const old = snapshot('success', 'available', { fetchedAt: '2020-01-01T00:00:00.000Z' });
    render(<OperatorConsole service={service(vi.fn().mockResolvedValue(old)) as never} staleAfterMs={1_000} />);
    expect(await screen.findByText('Diagnostics are stale. Refresh before running controls.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause jobs' })).toBeDisabled();
  });

  it('renders unauthorized and incompatible mutation admission as disabled', async () => {
    const unauthorized = snapshot('partial', 'available', {
      mutation: { state: 'unauthorized', reason: 'tenant_context_unavailable' },
    });
    const { rerender } = render(<OperatorConsole service={service(vi.fn().mockResolvedValue(unauthorized)) as never} />);
    expect(await screen.findByText('unauthorized')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run backup' })).toBeDisabled();

    const incompatible = snapshot('incompatible', 'incompatible', {
      mutation: { state: 'incompatible', reason: 'unsupported_revision' },
    });
    rerender(<OperatorConsole service={service(vi.fn().mockResolvedValue(incompatible)) as never} />);
    expect(await screen.findByText('Compatibility admission failed. Operator controls are locked.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run backup' })).toBeDisabled();
  });

  it('offers retry after a load error and recovers', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('raw secret failure'))
      .mockResolvedValueOnce(snapshot());
    render(<OperatorConsole service={service(loader) as never} />);

    expect(await screen.findByText('Operator diagnostics could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Knowledge and streaming')).toBeInTheDocument();
    expect(screen.queryByText('raw secret failure')).not.toBeInTheDocument();
  });

  it('runs a bounded targeted inspection without rendering identifiers', async () => {
    const api = service();
    render(<OperatorConsole service={api as never} />);
    await screen.findByText('Knowledge and streaming');
    await userEvent.type(screen.getByLabelText('Job ID'), 'job-123');
    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(await screen.findByTestId('inspection-result')).toHaveTextContent('progress');
    expect(api.inspect).toHaveBeenCalledWith({ inspection: 'job_detail', target: 'job-123' });
    expect(screen.queryByText('job-123')).not.toBeInTheDocument();
  });

  it('opens an explicit confirmation dialog before every promoted mutation control', async () => {
    const api = service();
    render(<OperatorConsole service={api as never} />);
    await screen.findByText('Knowledge and streaming');

    for (const input of screen.getAllByRole('textbox')) fireEvent.change(input, { target: { value: 'bounded-target' } });
    for (const input of screen.getAllByRole('spinbutton')) fireEvent.change(input, { target: { value: '768' } });

    const controls = [
      'Probe completion', 'Probe stream',
      'Pause jobs', 'Resume jobs', 'Pause archive', 'Resume archive', 'Run backup',
      'Snapshot database', 'Restore database', 'Swap database', 'Set default archive',
      'Maintain graph', 'Capture graph snapshot', 'Recompute SNN', 'Run PFNET',
      'Detect communities', 'Refresh set', 'Create embedding config', 'Update embedding config',
      'Delete embedding config', 'Create embedding set', 'Update embedding set',
      'Delete embedding set', 'Add set member', 'Remove set member', 'Create archive',
      'Update archive', 'Clone archive', 'Delete archive', 'Update backup title',
      'Delete inbound source', 'Test webhook', 'Activate webhook', 'Deactivate webhook',
      'Delete webhook',
    ];
    for (const name of controls) {
      await userEvent.click(screen.getByRole('button', { name }));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm operator control')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    }
    expect(api.runAction).not.toHaveBeenCalled();
  }, 30_000);

  it('confirms a mutation, reports success, and refreshes diagnostics', async () => {
    const api = service();
    render(<OperatorConsole service={api as never} />);
    await screen.findByText('Knowledge and streaming');
    await userEvent.click(screen.getByRole('button', { name: 'Pause jobs' }));
    expect(screen.getByText('Pause global job processing?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Control accepted. Diagnostics refreshed.', {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(api.runAction).toHaveBeenCalledWith({ action: 'pause_jobs_global' });
    expect(api.loadSnapshot).toHaveBeenCalledTimes(2);
  });

  it('renders only bounded inference receipt metrics after explicit confirmation', async () => {
    const api = service();
    api.runAction.mockResolvedValueOnce({
      state: 'accepted',
      operationId: 'complete',
      metrics: [
        { label: 'completed', value: true },
        { label: 'content characters', value: 14 },
        { label: 'provider reported', value: true },
      ],
      raw: 'server secret body',
    });
    render(<OperatorConsole service={api as never} />);
    await screen.findByText('Knowledge and streaming');
    fireEvent.change(screen.getAllByLabelText('Model')[0], { target: { value: 'model-a' } });
    await userEvent.click(screen.getByRole('button', { name: 'Probe completion' }));
    expect(api.runAction).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('fixed, eight-token inference completion probe');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    const receipt = await screen.findByTestId('action-receipt');
    expect(receipt).toHaveTextContent('content characters');
    expect(receipt).toHaveTextContent('14');
    expect(screen.queryByText(/server secret body|model-a/i)).not.toBeInTheDocument();
  });

  it('reports a fixed mutation error without exposing the thrown detail', async () => {
    const api = service();
    api.runAction.mockRejectedValueOnce(new Error('server token secret'));
    render(<OperatorConsole service={api as never} />);
    await screen.findByText('Knowledge and streaming');
    await userEvent.click(screen.getByRole('button', { name: 'Pause jobs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('The control was not accepted.')).toBeInTheDocument();
    expect(screen.queryByText('server token secret')).not.toBeInTheDocument();
  });

  it.each([375, 1280])('keeps diagnostics, inspection, and controls reachable at %ipx', async (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    window.dispatchEvent(new Event('resize'));
    const { container } = render(<OperatorConsole service={service() as never} />);
    expect(await screen.findByText('Knowledge and streaming')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Run backup' })).toBeVisible();
    expect(container.querySelector('.sm\\:grid-cols-2')).toBeInTheDocument();
    expect(container.querySelector('.xl\\:grid-cols-3')).toBeInTheDocument();
  });
});
