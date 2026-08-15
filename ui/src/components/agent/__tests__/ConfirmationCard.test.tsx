import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmationCard } from '../ConfirmationCard';

describe('ConfirmationCard', () => {
  it('shows the bound write arguments and all write confirmation choices', () => {
    const onResolve = vi.fn();
    render(<ConfirmationCard
      confirmation={{
        approvalId: 'approval-1',
        toolCallId: 'call-1',
        toolName: 'create_note',
        args: { content: 'A short note', tags: ['one', 'two'] },
        isResolving: false,
      }}
      onResolve={onResolve}
    />);

    expect(screen.getByText('Agent wants to: Create Note')).toBeInTheDocument();
    expect(screen.getByText('A short note')).toBeInTheDocument();
    expect(screen.getByText('one, two')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Allow & Remember' }));
    expect(onResolve).toHaveBeenCalledWith('allow-remember');
  });

  it('fails closed in presentation for an unknown/admin tool and disables replay clicks', () => {
    const onResolve = vi.fn();
    render(<ConfirmationCard
      confirmation={{
        approvalId: 'approval-2',
        toolCallId: 'call-2',
        toolName: 'future_admin_tool',
        args: {},
        isResolving: true,
      }}
      onResolve={onResolve}
    />);

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allow & Remember' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeDisabled();
  });
});
