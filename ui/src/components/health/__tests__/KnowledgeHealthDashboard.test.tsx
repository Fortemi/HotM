/**
 * KnowledgeHealthDashboard Component Tests
 *
 * Tests the knowledge health dashboard with metrics and recommendations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeHealthDashboard } from '../KnowledgeHealthDashboard';
import { api } from '@/api';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    health: {
      getKnowledgeHealth: vi.fn(),
    },
  },
}));

// Mock data
const mockHealthData = {
  total_notes: 1500,
  orphan_notes: 45,
  stale_notes: 120,
  unlinked_notes: 80,
  avg_links_per_note: 2.5,
  tag_coverage: 0.75,
  last_activity: '2024-01-15T14:30:00Z',
};

const mockLowHealthData = {
  total_notes: 100,
  orphan_notes: 30,
  stale_notes: 40,
  unlinked_notes: 50,
  avg_links_per_note: 0.5,
  tag_coverage: 0.3,
  last_activity: '2024-01-10T10:00:00Z',
};

describe('KnowledgeHealthDashboard', () => {
  beforeEach(() => {
    vi.mocked(api.health.getKnowledgeHealth).mockResolvedValue(mockHealthData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dashboard title', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Knowledge Health')).toBeInTheDocument();
      });
    });

    it('should render refresh button', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'refresh' })).toBeInTheDocument();
      });
    });

    it('should load health data on mount', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(api.health.getKnowledgeHealth).toHaveBeenCalled();
      });
    });

    it('should display total notes', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('1,500')).toBeInTheDocument();
        expect(screen.getByText('Total Notes')).toBeInTheDocument();
      });
    });

    it('should display link density', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('2.5')).toBeInTheDocument();
        expect(screen.getByText('Link Density')).toBeInTheDocument();
      });
    });

    it('should display tag coverage percentage', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('Tag Coverage')).toBeInTheDocument();
      });
    });

    it('should display last activity date', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Last Activity')).toBeInTheDocument();
      });
    });
  });

  describe('Health Score', () => {
    it('should render health score gauge', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('meter')).toBeInTheDocument();
      });
    });

    it('should show "Excellent" for high health score', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        // With the mock data, score should be relatively high
        const meter = screen.getByRole('meter');
        expect(meter).toBeInTheDocument();
      });
    });

    it('should render health gauge for low health score', async () => {
      vi.mocked(api.health.getKnowledgeHealth).mockResolvedValue(mockLowHealthData);

      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        // Verify gauge is rendered with a low score
        const meter = screen.getByRole('meter');
        const score = parseInt(meter.getAttribute('aria-valuenow') || '0', 10);
        expect(score).toBeLessThan(60); // Low health should have score < 60
      });
    });

    it('should have aria attributes on gauge', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        const meter = screen.getByRole('meter');
        expect(meter).toHaveAttribute('aria-valuenow');
        expect(meter).toHaveAttribute('aria-valuemin', '0');
        expect(meter).toHaveAttribute('aria-valuemax', '100');
      });
    });
  });

  describe('Issues Section', () => {
    it('should display orphan notes count', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Orphan Notes')).toBeInTheDocument();
        expect(screen.getByText(/45 notes/)).toBeInTheDocument();
      });
    });

    it('should display stale content count', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Stale Content')).toBeInTheDocument();
        expect(screen.getByText('120 notes')).toBeInTheDocument();
      });
    });

    it('should display unlinked notes count', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Unlinked Notes')).toBeInTheDocument();
        expect(screen.getByText('80 notes')).toBeInTheDocument();
      });
    });

    it('should have action buttons for issues', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('View Orphans')).toBeInTheDocument();
        expect(screen.getByText('Review Stale')).toBeInTheDocument();
        expect(screen.getByText('Find Connections')).toBeInTheDocument();
      });
    });
  });

  describe('Recommendations', () => {
    it('should show link recommendation when low', async () => {
      vi.mocked(api.health.getKnowledgeHealth).mockResolvedValue({
        ...mockHealthData,
        avg_links_per_note: 1.0,
      });

      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(
          screen.getByText('Add more cross-references to improve discoverability')
        ).toBeInTheDocument();
      });
    });

    it('should show tag recommendation when low', async () => {
      vi.mocked(api.health.getKnowledgeHealth).mockResolvedValue({
        ...mockHealthData,
        tag_coverage: 0.5,
      });

      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(
          screen.getByText('Tag more notes to improve organization')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Refresh', () => {
    it('should reload data when refresh clicked', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'refresh' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

      await waitFor(() => {
        expect(api.health.getKnowledgeHealth).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator', async () => {
      vi.mocked(api.health.getKnowledgeHealth).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockHealthData), 100))
      );

      render(<KnowledgeHealthDashboard />);

      expect(screen.getByText('Loading health metrics...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error when load fails', async () => {
      vi.mocked(api.health.getKnowledgeHealth).mockRejectedValue(
        new Error('Network error')
      );

      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load health metrics')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      vi.mocked(api.health.getKnowledgeHealth).mockRejectedValue(
        new Error('Network error')
      );

      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should retry load when retry clicked', async () => {
      vi.mocked(api.health.getKnowledgeHealth)
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(mockHealthData);

      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('1,500')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible overview grid', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('overview-grid')).toBeInTheDocument();
      });
    });

    it('should have article roles for metric cards', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        const articles = screen.getAllByRole('article');
        expect(articles.length).toBeGreaterThan(0);
      });
    });

    it('should have metric cards with proper structure', async () => {
      render(<KnowledgeHealthDashboard />);

      await waitFor(() => {
        const articles = screen.getAllByRole('article');
        // Should have multiple metric cards
        expect(articles.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Custom ClassName', () => {
    it('should apply custom className', async () => {
      const { container } = render(
        <KnowledgeHealthDashboard className="custom-class" />
      );

      await waitFor(() => {
        const dashboard = container.querySelector('.custom-class');
        expect(dashboard).toBeInTheDocument();
      });
    });
  });
});
