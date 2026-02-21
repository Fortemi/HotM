import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriteriaEditor } from '../CriteriaEditor';
import type { EmbeddingSetCriteria } from '@/api';

const mockCollections = [
  { id: 'col-1', name: 'Research' },
  { id: 'col-2', name: 'Projects' },
  { id: 'col-3', name: 'Archive' },
];

const emptyCriteria: EmbeddingSetCriteria = {};

describe('CriteriaEditor', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  describe('rendering', () => {
    it('renders the tags input field', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByPlaceholderText(/add tag/i)).toBeInTheDocument();
    });

    it('renders the FTS query input', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByPlaceholderText(/full.text/i)).toBeInTheDocument();
    });

    it('renders include_all checkbox', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByLabelText(/include all matching/i)).toBeInTheDocument();
    });

    it('renders exclude_archived checkbox', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByLabelText(/exclude archived/i)).toBeInTheDocument();
    });

    it('renders all available collections as checkboxes', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByLabelText('Research')).toBeInTheDocument();
      expect(screen.getByLabelText('Projects')).toBeInTheDocument();
      expect(screen.getByLabelText('Archive')).toBeInTheDocument();
    });

    it('renders existing tags as badges', () => {
      const criteria: EmbeddingSetCriteria = { tags: ['rust', 'async'] };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByText('rust')).toBeInTheDocument();
      expect(screen.getByText('async')).toBeInTheDocument();
    });

    it('renders fts_query value in input', () => {
      const criteria: EmbeddingSetCriteria = { fts_query: 'memory management' };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByDisplayValue('memory management')).toBeInTheDocument();
    });

    it('checks include_all checkbox when criteria.include_all is true', () => {
      const criteria: EmbeddingSetCriteria = { include_all: true };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByLabelText(/include all matching/i)).toBeChecked();
    });

    it('checks exclude_archived checkbox when criteria.exclude_archived is true', () => {
      const criteria: EmbeddingSetCriteria = { exclude_archived: true };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByLabelText(/exclude archived/i)).toBeChecked();
    });

    it('checks collection checkbox for each id in criteria.collections', () => {
      const criteria: EmbeddingSetCriteria = { collections: ['col-1', 'col-3'] };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      expect(screen.getByLabelText('Research')).toBeChecked();
      expect(screen.getByLabelText('Projects')).not.toBeChecked();
      expect(screen.getByLabelText('Archive')).toBeChecked();
    });
  });

  describe('tags chip input', () => {
    it('adds a tag when Enter is pressed in the tag input', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      const tagInput = screen.getByPlaceholderText(/add tag/i);
      fireEvent.change(tagInput, { target: { value: 'typescript' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith({ tags: ['typescript'] });
    });

    it('does not add an empty tag on Enter', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      const tagInput = screen.getByPlaceholderText(/add tag/i);
      fireEvent.keyDown(tagInput, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not add a duplicate tag', () => {
      const criteria: EmbeddingSetCriteria = { tags: ['rust'] };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      const tagInput = screen.getByPlaceholderText(/add tag/i);
      fireEvent.change(tagInput, { target: { value: 'rust' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('appends new tag to existing tags', () => {
      const criteria: EmbeddingSetCriteria = { tags: ['rust'] };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      const tagInput = screen.getByPlaceholderText(/add tag/i);
      fireEvent.change(tagInput, { target: { value: 'async' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith({ tags: ['rust', 'async'] });
    });

    it('removes a tag when its X button is clicked', () => {
      const criteria: EmbeddingSetCriteria = { tags: ['rust', 'async'] };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      const removeButtons = screen.getAllByRole('button', { name: /remove rust/i });
      fireEvent.click(removeButtons[0]);
      expect(onChange).toHaveBeenCalledWith({ tags: ['async'] });
    });

    it('does not trigger onChange for non-Enter keys', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      const tagInput = screen.getByPlaceholderText(/add tag/i);
      fireEvent.change(tagInput, { target: { value: 'typescript' } });
      fireEvent.keyDown(tagInput, { key: 'Tab' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('collections multi-select', () => {
    it('adds collection id to criteria when a collection checkbox is checked', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      fireEvent.click(screen.getByLabelText('Research'));
      expect(onChange).toHaveBeenCalledWith({ collections: ['col-1'] });
    });

    it('removes collection id from criteria when a collection checkbox is unchecked', () => {
      const criteria: EmbeddingSetCriteria = { collections: ['col-1', 'col-2'] };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      fireEvent.click(screen.getByLabelText('Research'));
      expect(onChange).toHaveBeenCalledWith({ collections: ['col-2'] });
    });
  });

  describe('FTS query input', () => {
    it('calls onChange with updated fts_query on input change', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      const ftsInput = screen.getByPlaceholderText(/full.text/i);
      fireEvent.change(ftsInput, { target: { value: 'knowledge graph' } });
      expect(onChange).toHaveBeenCalledWith({ fts_query: 'knowledge graph' });
    });

    it('sets fts_query to undefined when input is cleared', () => {
      const criteria: EmbeddingSetCriteria = { fts_query: 'old query' };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      const ftsInput = screen.getByDisplayValue('old query');
      fireEvent.change(ftsInput, { target: { value: '' } });
      expect(onChange).toHaveBeenCalledWith({ fts_query: undefined });
    });
  });

  describe('include_all checkbox', () => {
    it('calls onChange with include_all: true when checked', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      fireEvent.click(screen.getByLabelText(/include all matching/i));
      expect(onChange).toHaveBeenCalledWith({ include_all: true });
    });

    it('calls onChange with include_all: false when unchecked', () => {
      const criteria: EmbeddingSetCriteria = { include_all: true };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      fireEvent.click(screen.getByLabelText(/include all matching/i));
      expect(onChange).toHaveBeenCalledWith({ include_all: false });
    });
  });

  describe('exclude_archived checkbox', () => {
    it('calls onChange with exclude_archived: true when checked', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={mockCollections} />
      );
      fireEvent.click(screen.getByLabelText(/exclude archived/i));
      expect(onChange).toHaveBeenCalledWith({ exclude_archived: true });
    });

    it('calls onChange with exclude_archived: false when unchecked', () => {
      const criteria: EmbeddingSetCriteria = { exclude_archived: true };
      render(
        <CriteriaEditor criteria={criteria} onChange={onChange} collections={mockCollections} />
      );
      fireEvent.click(screen.getByLabelText(/exclude archived/i));
      expect(onChange).toHaveBeenCalledWith({ exclude_archived: false });
    });
  });

  describe('empty collections list', () => {
    it('renders gracefully with no collections', () => {
      render(
        <CriteriaEditor criteria={emptyCriteria} onChange={onChange} collections={[]} />
      );
      expect(screen.getByPlaceholderText(/add tag/i)).toBeInTheDocument();
    });
  });
});
