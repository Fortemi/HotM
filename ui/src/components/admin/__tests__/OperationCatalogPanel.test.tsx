import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationCatalogPanel } from '../OperationCatalogPanel';

vi.mock('@/api', () => ({
  api: { systemCompatibility: { get: vi.fn() } },
}));

import { api } from '@/api';

describe('OperationCatalogPanel', () => {
  it('renders all pinned operations and filters without implying conformance', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue({} as never);
    render(<OperationCatalogPanel />);

    expect(screen.getByText(/251 pinned operations/)).toBeInTheDocument();
    expect(screen.getByText(/does not establish request, response, auth/)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Search operations'), 'oauth_discovery');
    expect(screen.getByText('oauth_discovery')).toBeInTheDocument();
    expect(screen.queryByText('create_note')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Compatible')).toBeInTheDocument());
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
