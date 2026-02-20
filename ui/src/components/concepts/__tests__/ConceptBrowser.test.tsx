/**
 * ConceptBrowser Component Tests
 *
 * Tests SKOS concept browsing with tree navigation and detail view.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConceptBrowser } from '../ConceptBrowser';
import { api } from '@/api';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    concepts: {
      listSchemes: vi.fn(),
      getNarrower: vi.fn(),
      getConceptFull: vi.fn(),
      listConcepts: vi.fn(),
    },
  },
}));

// Mock data
const mockSchemes = [
  { id: 'scheme-1', title: 'Test Scheme 1', description: 'First scheme', created_at: '2024-01-10T10:00:00Z', updated_at: '2024-01-10T10:00:00Z' },
  { id: 'scheme-2', title: 'Test Scheme 2', description: 'Second scheme', created_at: '2024-01-09T10:00:00Z', updated_at: '2024-01-09T10:00:00Z' },
];

const mockConcepts = [
  { id: 'concept-1', pref_label: 'Concept A', scheme_id: 'scheme-1', created_at: '2024-01-10T10:00:00Z', updated_at: '2024-01-10T10:00:00Z' },
  { id: 'concept-2', pref_label: 'Concept B', scheme_id: 'scheme-1', created_at: '2024-01-10T10:00:00Z', updated_at: '2024-01-10T10:00:00Z' },
];

const mockConceptFull = {
  id: 'concept-1',
  pref_label: 'Concept A',
  scheme_id: 'scheme-1',
  definition: 'A test concept',
  alt_labels: ['Alt A'],
  broader: [],
  narrower: [],
  related: [],
  created_at: '2024-01-10T10:00:00Z',
  updated_at: '2024-01-10T10:00:00Z',
};

describe('ConceptBrowser', () => {
  beforeEach(() => {
    vi.mocked(api.concepts.listSchemes).mockResolvedValue(mockSchemes);
    vi.mocked(api.concepts.getNarrower).mockResolvedValue([]);
    vi.mocked(api.concepts.getConceptFull).mockResolvedValue(mockConceptFull);
    vi.mocked(api.concepts.listConcepts).mockResolvedValue(mockConcepts);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(<ConceptBrowser isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render region when open', async () => {
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toBeInTheDocument();
        expect(screen.getByText('Concepts')).toBeInTheDocument();
      });
    });

    it('should load schemes on open', async () => {
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(api.concepts.listSchemes).toHaveBeenCalled();
      });
    });

    it('should render scheme selector', async () => {
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search concepts...')).toBeInTheDocument();
      });
    });
  });

  describe('Scheme Selection', () => {
    it('should auto-select first scheme', async () => {
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(api.concepts.listConcepts).toHaveBeenCalledWith({
          schemeId: 'scheme-1',
          limit: 1000,
        });
      });

      expect(api.concepts.getNarrower).not.toHaveBeenCalled();
    });

    it('should use initial scheme if provided', async () => {
      render(<ConceptBrowser initialSchemeId="scheme-2" />);

      await waitFor(() => {
        expect(api.concepts.listConcepts).toHaveBeenCalledWith({
          schemeId: 'scheme-2',
          limit: 1000,
        });
      });
    });
  });

  describe('Concept Selection', () => {
    it('should call onSelectConcept when concept is selected', async () => {
      const onSelectConcept = vi.fn();
      render(<ConceptBrowser onSelectConcept={onSelectConcept} />);

      // Wait for concepts to load
      await waitFor(() => {
        expect(screen.getByText('Concept A')).toBeInTheDocument();
      });

      // Click on a concept
      fireEvent.click(screen.getByText('Concept A'));

      await waitFor(() => {
        expect(api.concepts.getConceptFull).toHaveBeenCalledWith('concept-1');
      });
    });
  });

  describe('Search', () => {
    it('should search concepts when typing', async () => {
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search concepts...')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search concepts...');
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      // Wait for debounced search
      await waitFor(
        () => {
          expect(api.concepts.listConcepts).toHaveBeenCalledWith(
            expect.objectContaining({
              search: 'test query',
            })
          );
        },
        { timeout: 500 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should display error when load fails', async () => {
      vi.mocked(api.concepts.listSchemes).mockRejectedValue(new Error('Network error'));

      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load concept schemes')).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      vi.mocked(api.concepts.listConcepts).mockRejectedValueOnce(new Error('Error'));
      vi.mocked(api.concepts.listConcepts).mockResolvedValueOnce(mockConcepts);

      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load concepts')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(api.concepts.listConcepts).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Empty State', () => {
    it('should show no-scheme empty state when no schemes exist', async () => {
      vi.mocked(api.concepts.listSchemes).mockResolvedValueOnce([]);
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByText('No concept schemes available')).toBeInTheDocument();
      });
    });

    it('should show placeholder when no concept selected', async () => {
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByText('Select a concept to view details')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible region role', async () => {
      render(<ConceptBrowser />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toHaveAttribute(
          'aria-label',
          'SKOS Concept Browser'
        );
      });
    });
  });
});
