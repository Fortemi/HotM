import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from '../SearchPage';
import { api } from '@/api';

vi.mock('@/api/memory-context', () => ({
  MEMORY_CHANGED_EVENT: 'hotm-memory-changed',
  getActiveMemory: vi.fn(() => null),
}));

vi.mock('@/api', () => ({
  api: {
    tags: { list: vi.fn() },
    archives: { list: vi.fn() },
    concepts: { autocompleteConcepts: vi.fn() },
    search: {
      search: vi.fn(),
      federatedSearch: vi.fn(),
    },
    memory: {
      searchCombined: vi.fn(),
      searchByLocation: vi.fn(),
    },
    notes: { get: vi.fn() },
    systemCompatibility: { get: vi.fn() },
  },
}));

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.tags.list).mockResolvedValue([]);
    vi.mocked(api.archives.list).mockResolvedValue([]);
    vi.mocked(api.concepts.autocompleteConcepts).mockResolvedValue({ suggestions: [] });
    vi.mocked(api.systemCompatibility.get).mockRejectedValue(new Error('compatibility discovery unavailable'));
  });

  it('HUX-REQ-004 keeps local note search usable when enterprise compatibility discovery is absent', async () => {
    const onSelectResult = vi.fn();
    vi.mocked(api.search.search).mockResolvedValue([
      {
        note_id: 'note-local-1',
        score: 0.92,
        title: 'Local Workflow Note',
        snippet: 'local private workflow result',
      } as any,
    ]);

    render(<SearchPage onSelectResult={onSelectResult} />);

    await userEvent.type(screen.getByPlaceholderText('Search notes...'), 'local private');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(api.search.search).toHaveBeenCalledWith('local private', expect.objectContaining({
        mode: 'hybrid',
        limit: 50,
      }));
    });
    const result = await screen.findByText('Local Workflow Note');
    expect(screen.getByText('local private workflow result')).toBeInTheDocument();
    await userEvent.click(result);
    expect(onSelectResult).toHaveBeenCalledWith('note-local-1');
    expect(api.systemCompatibility.get).not.toHaveBeenCalled();
  });
});
