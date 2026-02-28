import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveAsNoteButton } from '../SaveAsNoteButton';
import type { UIMessage } from '@ai-sdk/react';

// Mock the API module
vi.mock('@/api', () => ({
  api: {
    notes: {
      create: vi.fn(),
    },
  },
}));

import { api } from '@/api';

const messages: UIMessage[] = [
  { id: 'u1', role: 'user', parts: [{ type: 'text' as const, text: 'Hello' }] },
  { id: 'a1', role: 'assistant', parts: [{ type: 'text' as const, text: 'Hi!' }] },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SaveAsNoteButton', () => {
  it('renders Save as Note button', () => {
    render(<SaveAsNoteButton messages={messages} />);
    expect(screen.getByTitle('Save as Fortemi note')).toBeInTheDocument();
    expect(screen.getByText('Save as Note')).toBeInTheDocument();
  });

  it('disables when no messages', () => {
    render(<SaveAsNoteButton messages={[]} />);
    expect(screen.getByTitle('Save as Fortemi note')).toBeDisabled();
  });

  it('disables when disabled prop is true', () => {
    render(<SaveAsNoteButton messages={messages} disabled />);
    expect(screen.getByTitle('Save as Fortemi note')).toBeDisabled();
  });

  it('calls API with correct payload on click', async () => {
    const user = userEvent.setup();
    const mockCreate = vi.mocked(api.notes.create);
    mockCreate.mockResolvedValue({ note_id: 'note-abc' });

    render(<SaveAsNoteButton messages={messages} sessionName="My Session" />);
    await user.click(screen.getByTitle('Save as Fortemi note'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        content: expect.stringContaining('# My Session'),
        format: 'markdown',
        source: 'agent-session',
      });
    });
  });

  it('shows success state with note ID', async () => {
    const user = userEvent.setup();
    vi.mocked(api.notes.create).mockResolvedValue({ note_id: 'note-xyz' });

    render(<SaveAsNoteButton messages={messages} />);
    await user.click(screen.getByTitle('Save as Fortemi note'));

    await waitFor(() => {
      expect(screen.getByText('Saved (note-xyz)')).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    const user = userEvent.setup();
    vi.mocked(api.notes.create).mockRejectedValue(
      new Error('Network error'),
    );

    render(<SaveAsNoteButton messages={messages} />);
    await user.click(screen.getByTitle('Save as Fortemi note'));

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows loading state during save', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: { note_id: string }) => void;
    vi.mocked(api.notes.create).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    render(<SaveAsNoteButton messages={messages} />);
    await user.click(screen.getByTitle('Save as Fortemi note'));

    expect(screen.getByText('Saving...')).toBeInTheDocument();

    // Resolve the promise to clean up
    resolvePromise!({ note_id: 'n-1' });
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });
});
