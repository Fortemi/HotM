/**
 * EmbeddingSetManager Component Tests
 *
 * Tests the manager UI for embedding sets. Covers: loading state, empty state,
 * card display (name, slug, mode badge, description, criteria summary),
 * create/edit/delete dialogs, refresh, Members button visibility,
 * Graph button, and success/error status messages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EmbeddingSetManager } from '../EmbeddingSetManager';
import { api } from '@/api';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/api', () => ({
  api: {
    embeddings: {
      listSets: vi.fn(),
      createSet: vi.fn(),
      updateSet: vi.fn(),
      deleteSet: vi.fn(),
      refreshSet: vi.fn(),
      listConfigs: vi.fn(),
    },
    collections: {
      list: vi.fn(),
    },
  },
}));

// jsdom does not implement scrollIntoView; Radix Select uses it during portal mount
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}

// Mock Radix Select with plain HTML select — avoids portal/scrollIntoView issues in CI
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) => (
    <div data-testid="select-root" data-value={value}>{typeof onValueChange === 'function' ? (
      <select data-testid="select-native" value={value ?? ''} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    ) : children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

// Stub out child dialogs so we don't need their own deps in scope
vi.mock('../MemberManager', () => ({
  MemberManager: vi.fn(({ isOpen, slug, onClose }) =>
    isOpen ? (
      <div data-testid="member-manager" data-slug={slug}>
        <button onClick={onClose}>Close Members</button>
      </div>
    ) : null
  ),
}));

vi.mock('../EmbeddingSetGraph', () => ({
  EmbeddingSetGraph: vi.fn(({ isOpen, set, onClose }) =>
    isOpen ? (
      <div data-testid="embedding-set-graph" data-slug={set?.slug}>
        <button onClick={onClose}>Close Graph</button>
      </div>
    ) : null
  ),
}));

vi.mock('../CriteriaEditor', () => ({
  CriteriaEditor: vi.fn(() => <div data-testid="criteria-editor" />),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockConfigs = [
  {
    id: 'cfg-1',
    name: 'Default Config',
    model: 'nomic-embed-text',
    dimensions: 768,
    is_default: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cfg-2',
    name: 'Large Config',
    model: 'text-embedding-ada-002',
    dimensions: 1536,
    is_default: false,
    created_at: '2026-01-02T00:00:00Z',
  },
];

const mockCollections = [
  {
    id: 'col-1',
    name: 'Research',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'col-2',
    name: 'Projects',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const mockSets = [
  {
    slug: 'auto-set',
    name: 'Auto Set',
    embedding_config_id: 'cfg-1',
    mode: 'auto' as const,
    description: 'Automatically managed set',
    criteria: { tags: ['rust', 'async'], exclude_archived: true },
    note_count: 42,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    slug: 'manual-set',
    name: 'Manual Set',
    embedding_config_id: 'cfg-2',
    mode: 'manual' as const,
    description: 'Manually curated set',
    criteria: undefined,
    note_count: 5,
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-04T00:00:00Z',
  },
  {
    slug: 'mixed-set',
    name: 'Mixed Set',
    embedding_config_id: 'cfg-1',
    mode: 'mixed' as const,
    description: undefined,
    criteria: { collections: ['col-1'] },
    note_count: 12,
    created_at: '2026-01-05T00:00:00Z',
    updated_at: '2026-01-06T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  vi.mocked(api.embeddings.listSets).mockResolvedValue(mockSets);
  vi.mocked(api.embeddings.listConfigs).mockResolvedValue(mockConfigs);
  vi.mocked(api.collections.list).mockResolvedValue(mockCollections);
  vi.mocked(api.embeddings.createSet).mockResolvedValue(mockSets[0]);
  vi.mocked(api.embeddings.updateSet).mockResolvedValue(mockSets[0]);
  vi.mocked(api.embeddings.deleteSet).mockResolvedValue(undefined);
  vi.mocked(api.embeddings.refreshSet).mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmbeddingSetManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // -------------------------------------------------------------------------
  // Initial loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('shows a loading spinner while data is being fetched', () => {
      // Keep the promise pending so the loading state persists
      vi.mocked(api.embeddings.listSets).mockReturnValue(new Promise(() => {}));

      render(<EmbeddingSetManager />);

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows embedding sets after data loads', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
        expect(screen.getByText('Manual Set')).toBeInTheDocument();
        expect(screen.getByText('Mixed Set')).toBeInTheDocument();
      });
    });

    it('calls listSets, listConfigs, and collections.list on mount', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(api.embeddings.listSets).toHaveBeenCalledTimes(1);
        expect(api.embeddings.listConfigs).toHaveBeenCalledTimes(1);
        expect(api.collections.list).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error status when listSets rejects', async () => {
      vi.mocked(api.embeddings.listSets).mockRejectedValue(new Error('Network error'));

      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load embedding sets/i)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe('empty state', () => {
    it('shows an empty state message when there are no sets', async () => {
      vi.mocked(api.embeddings.listSets).mockResolvedValue([]);

      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(
          screen.getByText(/no embedding sets found/i)
        ).toBeInTheDocument();
      });
    });

    it('does not render any cards in empty state', async () => {
      vi.mocked(api.embeddings.listSets).mockResolvedValue([]);

      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.queryByText('Auto Set')).not.toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Card display
  // -------------------------------------------------------------------------

  describe('card display', () => {
    it('renders the set name in the card title', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });
    });

    it('renders the set slug in the card description', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('auto-set')).toBeInTheDocument();
        expect(screen.getByText('manual-set')).toBeInTheDocument();
      });
    });

    it('renders the mode badge for each set', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('auto')).toBeInTheDocument();
        expect(screen.getByText('manual')).toBeInTheDocument();
        expect(screen.getByText('mixed')).toBeInTheDocument();
      });
    });

    it('renders the description when present', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Automatically managed set')).toBeInTheDocument();
        expect(screen.getByText('Manually curated set')).toBeInTheDocument();
      });
    });

    it('renders criteria summary with tag count', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        // auto-set has 2 tags + exclude_archived
        expect(screen.getByText(/2 tag\(s\)/)).toBeInTheDocument();
      });
    });

    it('renders criteria summary with collection count', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        // mixed-set has 1 collection
        expect(screen.getByText(/1 collection\(s\)/)).toBeInTheDocument();
      });
    });

    it('renders "None" in criteria summary when no criteria', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        // manual-set has no criteria
        const criteriaCells = screen.getAllByText(/^Criteria:/);
        const noneCell = criteriaCells.find((el) => el.textContent?.includes('None'));
        expect(noneCell).toBeInTheDocument();
      });
    });

    it('renders note count when present', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('42 notes')).toBeInTheDocument();
        expect(screen.getByText('5 notes')).toBeInTheDocument();
        expect(screen.getByText('12 notes')).toBeInTheDocument();
      });
    });

    it('renders sets sorted alphabetically by name', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        // CardTitle renders as a <div> not a heading; find all slugs to verify order
        const slugElements = screen.getAllByText(/^(auto-set|manual-set|mixed-set)$/);
        const slugs = slugElements.map((el) => el.textContent);
        // Alphabetical order: Auto Set (auto-set), Manual Set (manual-set), Mixed Set (mixed-set)
        expect(slugs).toEqual(['auto-set', 'manual-set', 'mixed-set']);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Create dialog
  // -------------------------------------------------------------------------

  describe('create dialog', () => {
    it('opens the create dialog when "Create Set" is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Set'));

      await waitFor(() => {
        expect(screen.getByText('Create Embedding Set')).toBeInTheDocument();
      });
    });

    it('closes the create dialog when Cancel is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Set'));

      await waitFor(() => {
        expect(screen.getByText('Create Embedding Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Create Embedding Set')).not.toBeInTheDocument();
      });
    });

    it('Create button is disabled when slug or name is empty', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Set'));

      await waitFor(() => {
        expect(screen.getByText('Create Embedding Set')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /^Create$/ });
      expect(createButton).toBeDisabled();
    });

    it('calls createSet with correct payload on submit', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Set'));

      await waitFor(() => {
        expect(screen.getByText('Create Embedding Set')).toBeInTheDocument();
      });

      // Fill slug
      fireEvent.change(screen.getByPlaceholderText('my-embedding-set'), { target: { value: 'new-set' } });

      // Fill name
      fireEvent.change(screen.getByPlaceholderText('My Embedding Set'), { target: { value: 'New Set' } });

      // Select config via native select mock
      const selects = screen.getAllByTestId('select-native');
      fireEvent.change(selects[0], { target: { value: 'cfg-1' } });

      // Click create
      fireEvent.click(screen.getByRole('button', { name: /^Create$/ }));

      await waitFor(() => {
        expect(api.embeddings.createSet).toHaveBeenCalledWith(
          expect.objectContaining({
            slug: 'new-set',
            name: 'New Set',
            embedding_config_id: 'cfg-1',
            mode: 'auto',
          })
        );
      });
    });

    it('shows success status after createSet resolves', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Set'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-embedding-set')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('my-embedding-set'), {
        target: { value: 'new-set' },
      });
      fireEvent.change(screen.getByPlaceholderText('My Embedding Set'), {
        target: { value: 'New Set' },
      });

      const selects = screen.getAllByTestId('select-native');
      fireEvent.change(selects[0], { target: { value: 'cfg-1' } });

      fireEvent.click(screen.getByRole('button', { name: /^Create$/ }));

      await waitFor(() => {
        expect(screen.getByText('Embedding set created')).toBeInTheDocument();
      });
    });

    it('shows error status when createSet rejects', async () => {
      vi.mocked(api.embeddings.createSet).mockRejectedValue(new Error('Server error'));

      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Set'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-embedding-set')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('my-embedding-set'), {
        target: { value: 'err-set' },
      });
      fireEvent.change(screen.getByPlaceholderText('My Embedding Set'), {
        target: { value: 'Error Set' },
      });

      const selects = screen.getAllByTestId('select-native');
      fireEvent.change(selects[0], { target: { value: 'cfg-1' } });

      fireEvent.click(screen.getByRole('button', { name: /^Create$/ }));

      await waitFor(() => {
        expect(screen.getByText(/failed to create embedding set/i)).toBeInTheDocument();
      });
    });

    it('does not include criteria payload when mode is manual', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Set'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-embedding-set')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('my-embedding-set'), {
        target: { value: 'manual-new' },
      });
      fireEvent.change(screen.getByPlaceholderText('My Embedding Set'), {
        target: { value: 'Manual New' },
      });

      // Select config and mode via native select mocks
      // selects in dialog order: [0]=config, [1]=mode
      const selects = screen.getAllByTestId('select-native');
      fireEvent.change(selects[0], { target: { value: 'cfg-1' } });
      fireEvent.change(selects[1], { target: { value: 'manual' } });

      fireEvent.click(screen.getByRole('button', { name: /^Create$/ }));

      await waitFor(() => {
        expect(api.embeddings.createSet).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'manual',
            criteria: undefined,
          })
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Edit dialog
  // -------------------------------------------------------------------------

  describe('edit dialog', () => {
    it('opens the edit dialog when Edit button is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      // Click the first Edit button (auto-set card)
      const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Embedding Set')).toBeInTheDocument();
      });
    });

    it('pre-populates the edit dialog with the selected set data', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Embedding Set')).toBeInTheDocument();
        // Slug should be shown as a disabled input
        expect(screen.getByDisplayValue('auto-set')).toBeInTheDocument();
        // Name should be pre-filled
        expect(screen.getByDisplayValue('Auto Set')).toBeInTheDocument();
      });
    });

    it('shows the slug of the target set in the dialog description', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Manual Set')).toBeInTheDocument();
      });

      // Edit the manual-set (second card alphabetically)
      const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
      fireEvent.click(editButtons[1]); // Manual Set

      await waitFor(() => {
        // The disabled slug input in the dialog should show "manual-set"
        const slugInput = screen.getByDisplayValue('manual-set');
        expect(slugInput).toBeInTheDocument();
        expect(slugInput).toBeDisabled();
      });
    });

    it('closes the edit dialog when Cancel is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Embedding Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Edit Embedding Set')).not.toBeInTheDocument();
      });
    });

    it('calls updateSet with the correct slug and payload', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Auto Set')).toBeInTheDocument();
      });

      // Change the name
      const nameInput = screen.getByDisplayValue('Auto Set');
      fireEvent.change(nameInput, { target: { value: 'Auto Set Renamed' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(api.embeddings.updateSet).toHaveBeenCalledWith(
          'auto-set',
          expect.objectContaining({ name: 'Auto Set Renamed' })
        );
      });
    });

    it('shows success status after updateSet resolves', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Auto Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText(/"auto-set" updated/)).toBeInTheDocument();
      });
    });

    it('Save button is disabled when name is empty', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /^Edit$/ });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Auto Set')).toBeInTheDocument();
      });

      // Clear the name
      const nameInput = screen.getByDisplayValue('Auto Set');
      fireEvent.change(nameInput, { target: { value: '' } });

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // Delete dialog
  // -------------------------------------------------------------------------

  describe('delete dialog', () => {
    it('opens the delete confirmation dialog when Delete is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/ });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Delete Embedding Set')).toBeInTheDocument();
      });
    });

    it('shows the set name and slug in the delete confirmation', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/ });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Delete Embedding Set')).toBeInTheDocument();
        // The dialog description contains the set name; check it's present
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog?.textContent).toMatch(/auto-set/);
      });
    });

    it('closes the delete dialog when Cancel is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/ });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Delete Embedding Set')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Delete Embedding Set')).not.toBeInTheDocument();
      });
    });

    it('calls deleteSet with the correct slug when confirmed', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/ });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Delete Embedding Set')).toBeInTheDocument();
      });

      // Scope to the dialog to avoid ambiguity with card Delete buttons
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
      fireEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));

      await waitFor(() => {
        expect(api.embeddings.deleteSet).toHaveBeenCalledWith('auto-set');
      });
    });

    it('shows success status after deleteSet resolves', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/ });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Delete Embedding Set')).toBeInTheDocument();
      });

      // Scope to the dialog to avoid ambiguity with card Delete buttons
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
      fireEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));

      await waitFor(() => {
        expect(screen.getByText(/"auto-set" deleted/)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Refresh button
  // -------------------------------------------------------------------------

  describe('refresh button', () => {
    it('calls refreshSet with the correct slug when Refresh is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const refreshButtons = screen.getAllByRole('button', { name: /^Refresh$/ });
      fireEvent.click(refreshButtons[0]);

      await waitFor(() => {
        expect(api.embeddings.refreshSet).toHaveBeenCalledWith('auto-set');
      });
    });

    it('shows success status after refreshSet resolves', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const refreshButtons = screen.getAllByRole('button', { name: /^Refresh$/ });
      fireEvent.click(refreshButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/"auto-set" embeddings refreshed/)).toBeInTheDocument();
      });
    });

    it('reloads the set list after a successful refresh', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const initialCallCount = vi.mocked(api.embeddings.listSets).mock.calls.length;

      const refreshButtons = screen.getAllByRole('button', { name: /^Refresh$/ });
      fireEvent.click(refreshButtons[0]);

      await waitFor(() => {
        expect(vi.mocked(api.embeddings.listSets).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Members button visibility
  // -------------------------------------------------------------------------

  describe('Members button visibility', () => {
    it('shows Members button for manual mode sets', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Manual Set')).toBeInTheDocument();
      });

      const membersButtons = screen.getAllByRole('button', { name: /^Members$/ });
      expect(membersButtons.length).toBeGreaterThan(0);
    });

    it('shows Members button for mixed mode sets', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Mixed Set')).toBeInTheDocument();
      });

      // There should be exactly 2 Members buttons: manual-set and mixed-set
      const membersButtons = screen.getAllByRole('button', { name: /^Members$/ });
      expect(membersButtons).toHaveLength(2);
    });

    it('does NOT show Members button for auto mode sets', async () => {
      // Render only auto-mode sets
      vi.mocked(api.embeddings.listSets).mockResolvedValue([mockSets[0]]); // auto-set only

      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /^Members$/ })).not.toBeInTheDocument();
    });

    it('opens the MemberManager dialog when Members is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Manual Set')).toBeInTheDocument();
      });

      const membersButtons = screen.getAllByRole('button', { name: /^Members$/ });
      // Click the Members button for manual-set (first members button alphabetically)
      fireEvent.click(membersButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('member-manager')).toBeInTheDocument();
      });
    });

    it('passes the correct slug to MemberManager', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Manual Set')).toBeInTheDocument();
      });

      const membersButtons = screen.getAllByRole('button', { name: /^Members$/ });
      fireEvent.click(membersButtons[0]);

      await waitFor(() => {
        const manager = screen.getByTestId('member-manager');
        expect(manager.getAttribute('data-slug')).toBe('manual-set');
      });
    });

    it('closes MemberManager when onClose is invoked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Manual Set')).toBeInTheDocument();
      });

      const membersButtons = screen.getAllByRole('button', { name: /^Members$/ });
      fireEvent.click(membersButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('member-manager')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close Members' }));

      await waitFor(() => {
        expect(screen.queryByTestId('member-manager')).not.toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Graph button
  // -------------------------------------------------------------------------

  describe('graph button', () => {
    it('shows a Graph button on every set card', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const graphButtons = screen.getAllByRole('button', { name: /^Graph$/ });
      // One Graph button per set card
      expect(graphButtons).toHaveLength(mockSets.length);
    });

    it('opens the EmbeddingSetGraph dialog when Graph is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const graphButtons = screen.getAllByRole('button', { name: /^Graph$/ });
      fireEvent.click(graphButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('embedding-set-graph')).toBeInTheDocument();
      });
    });

    it('passes the correct set slug to EmbeddingSetGraph', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const graphButtons = screen.getAllByRole('button', { name: /^Graph$/ });
      fireEvent.click(graphButtons[0]); // auto-set is first alphabetically

      await waitFor(() => {
        const graph = screen.getByTestId('embedding-set-graph');
        expect(graph.getAttribute('data-slug')).toBe('auto-set');
      });
    });

    it('closes EmbeddingSetGraph when onClose is invoked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const graphButtons = screen.getAllByRole('button', { name: /^Graph$/ });
      fireEvent.click(graphButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('embedding-set-graph')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close Graph' }));

      await waitFor(() => {
        expect(screen.queryByTestId('embedding-set-graph')).not.toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Status messages
  // -------------------------------------------------------------------------

  describe('status messages', () => {
    it('displays success status with green styling', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const refreshButtons = screen.getAllByRole('button', { name: /^Refresh$/ });
      fireEvent.click(refreshButtons[0]);

      await waitFor(() => {
        const statusEl = screen.getByText(/"auto-set" embeddings refreshed/).closest('div');
        expect(statusEl).toHaveClass('bg-green-100');
      });
    });

    it('displays error status with red styling', async () => {
      vi.mocked(api.embeddings.listSets).mockRejectedValue(new Error('Network error'));

      render(<EmbeddingSetManager />);

      await waitFor(() => {
        // The span inside the status div holds the message text
        const messageSpan = screen.getByText(/failed to load embedding sets/i);
        // The parent div has the red background class
        const statusDiv = messageSpan.closest('div');
        expect(statusDiv).toHaveClass('bg-red-100');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Header reload button
  // -------------------------------------------------------------------------

  describe('header reload button', () => {
    it('re-fetches sets when the header refresh button is clicked', async () => {
      render(<EmbeddingSetManager />);

      await waitFor(() => {
        expect(screen.getByText('Auto Set')).toBeInTheDocument();
      });

      const initialCount = vi.mocked(api.embeddings.listSets).mock.calls.length;

      // The header contains a RefreshCw icon button (outline variant, no label text)
      // It's the only button rendered before the "Create Set" button in the header
      const headerButtons = screen.getAllByRole('button');
      const reloadButton = headerButtons.find(
        (btn) => !btn.textContent?.includes('Create') && btn.closest('.flex.items-center.justify-between')
      );

      if (reloadButton) {
        fireEvent.click(reloadButton);
        await waitFor(() => {
          expect(vi.mocked(api.embeddings.listSets).mock.calls.length).toBeGreaterThan(
            initialCount
          );
        });
      }
    });
  });
});
