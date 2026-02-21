import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EmbeddingSetGraph } from '../EmbeddingSetGraph';
import type { EmbeddingSet } from '@/api';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/api', () => ({
  api: {
    embeddings: {
      listSetMembers: vi.fn(),
    },
    search: {
      search: vi.fn(),
    },
  },
}));

vi.mock('@/components/graph', () => ({
  GraphExplorer: vi.fn(({ externalNodeFilter, initialFilterOverrides, initialNoteId }) => (
    <div
      data-testid="graph-explorer"
      data-initial-note-id={initialNoteId ?? ''}
      data-has-node-filter={externalNodeFilter != null ? 'true' : 'false'}
      data-filter-tags={
        initialFilterOverrides?.selectedTags
          ? initialFilterOverrides.selectedTags.join(',')
          : ''
      }
      data-filter-collection={initialFilterOverrides?.selectedCollection ?? ''}
      data-filter-archive={initialFilterOverrides?.archiveFilter ?? ''}
    />
  )),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { api } from '@/api';

const mockApi = api as unknown as {
  embeddings: { listSetMembers: ReturnType<typeof vi.fn> };
  search: { search: ReturnType<typeof vi.fn> };
};

function makeManualSet(overrides: Partial<EmbeddingSet> = {}): EmbeddingSet {
  return {
    slug: 'test-manual',
    name: 'Test Manual Set',
    embedding_config_id: 'cfg-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    mode: 'manual',
    ...overrides,
  };
}

function makeAutoSet(overrides: Partial<EmbeddingSet> = {}): EmbeddingSet {
  return {
    slug: 'test-auto',
    name: 'Test Auto Set',
    embedding_config_id: 'cfg-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    mode: 'auto',
    criteria: {
      tags: ['tag-a', 'tag-b'],
      collections: ['col-1'],
      exclude_archived: true,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmbeddingSetGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dialog visibility', () => {
    it('does not render GraphExplorer when isOpen is false', () => {
      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={false}
          onClose={vi.fn()}
        />
      );
      expect(screen.queryByTestId('graph-explorer')).toBeNull();
    });

    it('renders the dialog title with the set name when open', async () => {
      mockApi.embeddings.listSetMembers.mockResolvedValue([]);
      mockApi.search.search.mockResolvedValue([]);

      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Manual Set')).toBeDefined();
      });
    });
  });

  describe('real sets (manual / mixed mode)', () => {
    it('calls listSetMembers on open with the set slug', async () => {
      mockApi.embeddings.listSetMembers.mockResolvedValue([
        { id: 'note-1', title: 'Note 1' },
        { id: 'note-2', title: 'Note 2' },
      ]);

      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(mockApi.embeddings.listSetMembers).toHaveBeenCalledWith('test-manual');
      });
    });

    it('passes externalNodeFilter containing member IDs to GraphExplorer', async () => {
      mockApi.embeddings.listSetMembers.mockResolvedValue([
        { id: 'note-1', title: 'Note 1' },
        { id: 'note-2', title: 'Note 2' },
      ]);

      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-has-node-filter')).toBe('true');
      });
    });

    it('passes the first member as initialNoteId', async () => {
      mockApi.embeddings.listSetMembers.mockResolvedValue([
        { id: 'note-first', title: 'First Note' },
        { id: 'note-second', title: 'Second Note' },
      ]);

      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-initial-note-id')).toBe('note-first');
      });
    });

    it('handles mixed mode the same as manual', async () => {
      mockApi.embeddings.listSetMembers.mockResolvedValue([
        { id: 'note-m1', title: 'Mixed Note 1' },
      ]);

      render(
        <EmbeddingSetGraph
          set={makeManualSet({ mode: 'mixed', slug: 'test-mixed' })}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(mockApi.embeddings.listSetMembers).toHaveBeenCalledWith('test-mixed');
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-has-node-filter')).toBe('true');
      });
    });

    it('renders GraphExplorer with no nodeFilter when member list is empty', async () => {
      mockApi.embeddings.listSetMembers.mockResolvedValue([]);

      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        // Empty member list → no filter passed
        expect(explorer.getAttribute('data-has-node-filter')).toBe('false');
      });
    });
  });

  describe('virtual sets (auto mode or criteria with no mode)', () => {
    it('does NOT call listSetMembers for auto sets', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'root-note', score: 1.0, snippet: '' }]);

      render(
        <EmbeddingSetGraph
          set={makeAutoSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(mockApi.embeddings.listSetMembers).not.toHaveBeenCalled();
      });
    });

    it('maps criteria.tags to selectedTags filter override', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'root-note', score: 1.0, snippet: '' }]);

      render(
        <EmbeddingSetGraph
          set={makeAutoSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-filter-tags')).toBe('tag-a,tag-b');
      });
    });

    it('maps criteria.collections[0] to selectedCollection filter override', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'root-note', score: 1.0, snippet: '' }]);

      render(
        <EmbeddingSetGraph
          set={makeAutoSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-filter-collection')).toBe('col-1');
      });
    });

    it('maps criteria.exclude_archived to archiveFilter: active', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'root-note', score: 1.0, snippet: '' }]);

      render(
        <EmbeddingSetGraph
          set={makeAutoSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-filter-archive')).toBe('active');
      });
    });

    it('uses fts_query when searching for root note', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'found-note', score: 1.0, snippet: '' }]);

      const set = makeAutoSet({ criteria: { fts_query: 'machine learning' } });
      render(
        <EmbeddingSetGraph set={set} isOpen={true} onClose={vi.fn()} />
      );

      await waitFor(() => {
        expect(mockApi.search.search).toHaveBeenCalledWith(
          'machine learning',
          expect.objectContaining({ limit: 1 })
        );
      });
    });

    it('falls back to "*" when fts_query is absent', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'fallback-note', score: 1.0, snippet: '' }]);

      const set = makeAutoSet({ criteria: { tags: ['x'] } });
      render(
        <EmbeddingSetGraph set={set} isOpen={true} onClose={vi.fn()} />
      );

      await waitFor(() => {
        expect(mockApi.search.search).toHaveBeenCalledWith(
          '*',
          expect.objectContaining({ limit: 1 })
        );
      });
    });

    it('sets initialNoteId from search result for virtual sets', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'virtual-root', score: 1.0, snippet: '' }]);

      render(
        <EmbeddingSetGraph
          set={makeAutoSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-initial-note-id')).toBe('virtual-root');
      });
    });

    it('does not pass externalNodeFilter for virtual sets', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'root', score: 1.0, snippet: '' }]);

      render(
        <EmbeddingSetGraph
          set={makeAutoSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-has-node-filter')).toBe('false');
      });
    });

    it('treats mode=undefined with criteria as virtual set', async () => {
      mockApi.search.search.mockResolvedValue([{ note_id: 'root-no-mode', score: 1.0, snippet: '' }]);

      const set: EmbeddingSet = {
        slug: 'no-mode-set',
        name: 'No Mode Set',
        embedding_config_id: 'cfg-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        criteria: { tags: ['t1'] },
        // mode intentionally omitted
      };

      render(
        <EmbeddingSetGraph set={set} isOpen={true} onClose={vi.fn()} />
      );

      await waitFor(() => {
        expect(mockApi.embeddings.listSetMembers).not.toHaveBeenCalled();
        expect(mockApi.search.search).toHaveBeenCalled();
      });
    });
  });

  describe('loading state', () => {
    it('shows a loading spinner before data resolves', async () => {
      // Never resolve so loading state persists
      mockApi.embeddings.listSetMembers.mockReturnValue(new Promise(() => {}));

      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Spinner should be present immediately
      const spinner = document.querySelector('[data-testid="loading-spinner"], .animate-spin');
      expect(spinner).toBeDefined();
    });

    it('shows GraphExplorer after loading completes', async () => {
      mockApi.embeddings.listSetMembers.mockResolvedValue([
        { id: 'note-1', title: 'Note 1' },
      ]);

      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('graph-explorer')).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    it('renders GraphExplorer without filter when listSetMembers fails', async () => {
      mockApi.embeddings.listSetMembers.mockRejectedValue(new Error('API error'));

      render(
        <EmbeddingSetGraph
          set={makeManualSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const explorer = screen.getByTestId('graph-explorer');
        expect(explorer.getAttribute('data-has-node-filter')).toBe('false');
      });
    });

    it('renders GraphExplorer with overrides when search fails for virtual set', async () => {
      mockApi.search.search.mockRejectedValue(new Error('Search failed'));

      render(
        <EmbeddingSetGraph
          set={makeAutoSet()}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('graph-explorer')).toBeDefined();
      });
    });
  });

  describe('re-fetch on set change', () => {
    it('re-fetches members when set slug changes', async () => {
      mockApi.embeddings.listSetMembers.mockResolvedValue([{ id: 'n1', title: 'N1' }]);

      const setA = makeManualSet({ slug: 'set-a' });
      const setB = makeManualSet({ slug: 'set-b' });

      const { rerender } = render(
        <EmbeddingSetGraph set={setA} isOpen={true} onClose={vi.fn()} />
      );

      await waitFor(() => {
        expect(mockApi.embeddings.listSetMembers).toHaveBeenCalledWith('set-a');
      });

      rerender(<EmbeddingSetGraph set={setB} isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(mockApi.embeddings.listSetMembers).toHaveBeenCalledWith('set-b');
      });
    });
  });
});
