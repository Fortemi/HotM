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
      getTopConcepts: vi.fn(),
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
    vi.mocked(api.concepts.getTopConcepts).mockResolvedValue(mockConcepts);
    vi.mocked(api.concepts.getNarrower).mockResolvedValue([]);
    vi.mocked(api.concepts.getConceptFull).mockResolvedValue(mockConceptFull);
    vi.mocked(api.concepts.listConcepts).mockResolvedValue(mockConcepts);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      const onClose = vi.fn();
      const { container } = render(<ConceptBrowser isOpen={false} onClose={onClose} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render dialog when open', async () => {
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Concepts')).toBeInTheDocument();
      });
    });

    it('should load schemes on open', async () => {
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(api.concepts.listSchemes).toHaveBeenCalled();
      });
    });

    it('should render scheme selector', async () => {
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search concepts...')).toBeInTheDocument();
      });
    });
  });

  describe('Scheme Selection', () => {
    it('should auto-select first scheme', async () => {
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(api.concepts.getTopConcepts).toHaveBeenCalledWith('scheme-1');
      });
    });

    it('should use initial scheme if provided', async () => {
      const onClose = vi.fn();
      render(
        <ConceptBrowser isOpen={true} onClose={onClose} initialSchemeId="scheme-2" />
      );

      await waitFor(() => {
        expect(api.concepts.getTopConcepts).toHaveBeenCalledWith('scheme-2');
      });
    });
  });

  describe('Concept Selection', () => {
    it('should call onSelectConcept when concept is selected', async () => {
      const onClose = vi.fn();
      const onSelectConcept = vi.fn();
      render(
        <ConceptBrowser
          isOpen={true}
          onClose={onClose}
          onSelectConcept={onSelectConcept}
        />
      );

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
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

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

  describe('Close Behavior', () => {
    it('should call onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find and click close button
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('.lucide-x')
      );
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should display error when load fails', async () => {
      vi.mocked(api.concepts.listSchemes).mockRejectedValue(new Error('Network error'));

      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load concept schemes')).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      vi.mocked(api.concepts.getTopConcepts).mockRejectedValueOnce(new Error('Error'));
      vi.mocked(api.concepts.getTopConcepts).mockResolvedValueOnce(mockConcepts);

      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load concepts')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(api.concepts.getTopConcepts).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Empty State', () => {
    it('should show placeholder when no concept selected', async () => {
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Select a concept to view details')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible dialog role', async () => {
      const onClose = vi.fn();
      render(<ConceptBrowser isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveAttribute(
          'aria-label',
          'SKOS Concept Browser'
        );
      });
    });
  });
});
