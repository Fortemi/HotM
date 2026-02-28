import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionPanel } from '../SessionPanel';
import type { ChatSession } from '../session-storage';

const makeSessions = (count: number): ChatSession[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `session-${i}`,
    name: `Session ${i}`,
    createdAt: new Date(2026, 0, 1 + i).toISOString(),
    updatedAt: new Date(2026, 0, 1 + i).toISOString(),
    messages: [],
    provider: 'fortemi',
    messageCount: i * 3,
  }));

const defaultProps = {
  sessions: makeSessions(3),
  activeSessionId: 'session-0',
  onSwitchSession: vi.fn(),
  onNewSession: vi.fn(),
  onRenameSession: vi.fn(),
  onDeleteSession: vi.fn(),
  onClose: vi.fn(),
  open: true,
};

describe('SessionPanel', () => {
  it('renders session list when open', () => {
    render(<SessionPanel {...defaultProps} />);
    expect(screen.getByRole('dialog', { name: 'Session history' })).toBeInTheDocument();
    expect(screen.getByText('Session 0')).toBeInTheDocument();
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });

  it('does not render visible panel when closed', () => {
    render(<SessionPanel {...defaultProps} open={false} />);
    const panel = screen.getByRole('dialog', { name: 'Session history' });
    expect(panel.className).toContain('translate-x-full');
  });

  it('shows empty state when no sessions', () => {
    render(<SessionPanel {...defaultProps} sessions={[]} />);
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });

  it('highlights active session', () => {
    render(<SessionPanel {...defaultProps} />);
    // The active session should have the active border styling
    const activeItem = screen.getByText('Session 0').closest('[role="button"]');
    expect(activeItem?.className).toContain('border-primary');
  });

  it('calls onSwitchSession when clicking a session', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(<SessionPanel {...defaultProps} onSwitchSession={onSwitch} />);

    await user.click(screen.getByText('Session 1'));
    expect(onSwitch).toHaveBeenCalledWith('session-1');
  });

  it('calls onNewSession when clicking plus button', async () => {
    const user = userEvent.setup();
    const onNew = vi.fn();
    render(<SessionPanel {...defaultProps} onNewSession={onNew} />);

    await user.click(screen.getByTitle('New session'));
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SessionPanel {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SessionPanel {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByTestId('session-panel-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows message count for each session', () => {
    render(<SessionPanel {...defaultProps} />);
    // Session 1 has 3 messages, Session 2 has 6
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('sorts sessions by most recently updated', () => {
    const sessions = makeSessions(3);
    // Session 2 has the latest updatedAt (Jan 3), so it should appear first
    render(<SessionPanel {...defaultProps} sessions={sessions} />);
    const items = screen.getAllByRole('button');
    // First button is not a session item (New session, Close), check session order
    const sessionNames = items
      .map((el) => el.textContent)
      .filter((t) => t?.startsWith('Session '));
    // Session 2 (most recent) should come before Session 0 (oldest)
    const idx2 = sessionNames.findIndex((t) => t?.includes('Session 2'));
    const idx0 = sessionNames.findIndex((t) => t?.includes('Session 0'));
    expect(idx2).toBeLessThan(idx0);
  });
});
