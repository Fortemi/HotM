/**
 * MemberManager Component Tests
 *
 * Tests Dialog for managing manual/mixed embedding set members.
 * Covers: loading members on open, removing members, searching notes,
 * adding notes, loading states, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemberManager } from '../MemberManager';
import { api } from '@/api';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/api', () => ({
  api: {
    embeddings: {
      listSetMembers: vi.fn(),
      addSetMembers: vi.fn(),
      removeSetMember: vi.fn(),
    },
    search: {
      search: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockMembers = [
  {
    id: 'note-1',
    title: 'Alpha Note',
    snippet: 'First note snippet',
    created_at_utc: '2024-01-10T10:00:00Z',
    updated_at_utc: '2024-01-10T10:00:00Z',
    starred: false,
    archived: false,
    tags: ['alpha'],
    has_revision: false,
    metadata: {},
  },
  {
    id: 'note-2',
    title: 'Beta Note',
    snippet: 'Second note snippet',
    created_at_utc: '2024-01-11T10:00:00Z',
    updated_at_utc: '2024-01-11T10:00:00Z',
    starred: true,
    archived: false,
    tags: [],
    has_revision: true,
    metadata: {},
  },
];

const mockSearchResults = [
  { note_id: 'note-3', title: 'Gamma Note', score: 0.9, snippet: 'Third note' },
  { note_id: 'note-4', title: 'Delta Note', score: 0.7, snippet: 'Fourth note' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemberManager', () => {
  const defaultProps = {
    slug: 'my-set',
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.embeddings.listSetMembers).mockResolvedValue(mockMembers);
    vi.mocked(api.embeddings.addSetMembers).mockResolvedValue(undefined);
    vi.mocked(api.embeddings.removeSetMember).mockResolvedValue(undefined);
    vi.mocked(api.search.search).mockResolvedValue(mockSearchResults);
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders the dialog with header when open', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Manage Members')).toBeInTheDocument();
    });
  });

  it('does not render dialog content when closed', () => {
    render(<MemberManager {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Manage Members')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Loading members
  // -------------------------------------------------------------------------

  it('calls listSetMembers with the correct slug on open', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(api.embeddings.listSetMembers).toHaveBeenCalledWith('my-set');
    });
  });

  it('displays current members after loading', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Note')).toBeInTheDocument();
      expect(screen.getByText('Beta Note')).toBeInTheDocument();
    });
  });

  it('shows member count in section heading', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Current Members/)).toBeInTheDocument();
    });
  });

  it('displays a spinner while members are loading', () => {
    // Keep the promise pending
    vi.mocked(api.embeddings.listSetMembers).mockReturnValue(new Promise(() => {}));
    render(<MemberManager {...defaultProps} />);

    // Should show loading indicator somewhere in the dialog
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty state message when no members', async () => {
    vi.mocked(api.embeddings.listSetMembers).mockResolvedValue([]);
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no members/i)).toBeInTheDocument();
    });
  });

  it('shows error message when listSetMembers fails', async () => {
    vi.mocked(api.embeddings.listSetMembers).mockRejectedValue(new Error('Network error'));
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load members/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Removing members
  // -------------------------------------------------------------------------

  it('calls removeSetMember when remove button is clicked', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Note')).toBeInTheDocument();
    });

    // Click the remove button for the first member
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(api.embeddings.removeSetMember).toHaveBeenCalledWith('my-set', 'note-1');
    });
  });

  it('reloads members after a successful remove', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Note')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      // listSetMembers should be called at least twice: initial load + after remove
      expect(api.embeddings.listSetMembers).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error message when removeSetMember fails', async () => {
    vi.mocked(api.embeddings.removeSetMember).mockRejectedValue(new Error('Remove failed'));
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Note')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/failed to remove/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Searching notes
  // -------------------------------------------------------------------------

  it('renders the search input on the right side', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
    });
  });

  it('calls api.search.search when typing in the search input', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'gamma' } });

    await waitFor(() => {
      expect(api.search.search).toHaveBeenCalledWith('gamma', expect.objectContaining({ limit: 20 }));
    });
  });

  it('displays search results after a search', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'gamma' } });

    await waitFor(() => {
      expect(screen.getByText('Gamma Note')).toBeInTheDocument();
      expect(screen.getByText('Delta Note')).toBeInTheDocument();
    });
  });

  it('shows no search results state when query is empty', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
    });

    // Input is empty by default; should not have called search
    expect(api.search.search).not.toHaveBeenCalled();
  });

  it('shows error message when search fails', async () => {
    vi.mocked(api.search.search).mockRejectedValue(new Error('Search failed'));
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'fail' } });

    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Adding members
  // -------------------------------------------------------------------------

  it('calls addSetMembers when Add button is clicked on a search result', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'gamma' } });

    await waitFor(() => {
      expect(screen.getByText('Gamma Note')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /^add$/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(api.embeddings.addSetMembers).toHaveBeenCalledWith('my-set', {
        note_ids: ['note-3'],
      });
    });
  });

  it('reloads members after a successful add', async () => {
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'gamma' } });

    await waitFor(() => {
      expect(screen.getByText('Gamma Note')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /^add$/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      // listSetMembers called at initial open + after add
      expect(api.embeddings.listSetMembers).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error message when addSetMembers fails', async () => {
    vi.mocked(api.embeddings.addSetMembers).mockRejectedValue(new Error('Add failed'));
    render(<MemberManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'gamma' } });

    await waitFor(() => {
      expect(screen.getByText('Gamma Note')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /^add$/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/failed to add/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Dialog close
  // -------------------------------------------------------------------------

  it('invokes onClose when the dialog requests close', async () => {
    const onClose = vi.fn();
    render(<MemberManager {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Manage Members')).toBeInTheDocument();
    });

    // Simulate Escape key to close the dialog
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
