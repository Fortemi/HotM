import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationCatalogPanel } from '../OperationCatalogPanel';
import ledger from '@/api/contracts/fortemi-operation-dispositions.json';

vi.mock('@/api', () => ({
  api: { systemCompatibility: { get: vi.fn() } },
}));

import { api } from '@/api';

describe('OperationCatalogPanel', () => {
  it('contains exactly 41 sensitive decisions and disables every continued exclusion', () => {
    const decisions = ledger.operations.filter((operation) => typeof operation.security_decision === 'string');
    expect(decisions).toHaveLength(41);
    expect(decisions.filter((operation) => operation.security_decision === 'typed_ui_workflow')).toHaveLength(5);
    expect(decisions.filter((operation) => operation.security_decision === 'external_browser_protocol_handoff')).toHaveLength(5);
    expect(decisions.filter((operation) => operation.security_decision === 'continued_exclusion')).toHaveLength(31);
    expect(decisions.filter((operation) => operation.security_decision === 'continued_exclusion')
      .every((operation) => operation.enabled === false && operation.surface === 'documented_exclusion')).toBe(true);
  });

  it('renders all pinned operations and filters without implying conformance', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue({} as never);
    render(<OperationCatalogPanel />);

    expect(screen.getByText(/253 pinned operations/)).toBeInTheDocument();
    expect(screen.getByText(/does not establish request, response, auth/)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Search operations'), 'oauth_discovery');
    expect(screen.getByText('oauth_discovery')).toBeInTheDocument();
    expect(screen.queryByText('create_note')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Compatible')).toBeInTheDocument());
  });

  it('keeps excluded credential operations visible and disabled', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue({} as never);
    render(<OperationCatalogPanel />);
    await userEvent.type(screen.getByPlaceholderText('Search operations'), 'oauth_token');
    const operation = screen.getByText('oauth_token');
    expect(operation.closest('tr')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('fails closed with a retryable compatibility state', async () => {
    vi.mocked(api.systemCompatibility.get).mockRejectedValue(new Error('token=secret tenant=private'));
    render(<OperationCatalogPanel />);

    await waitFor(() => expect(screen.getByText('Incompatible')).toBeInTheDocument());
    expect(screen.getByText(/Local workflows remain available/)).toBeInTheDocument();
    expect(screen.queryByText(/token=secret|tenant=private/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry compatibility check' })).toBeInTheDocument();
  });
});
