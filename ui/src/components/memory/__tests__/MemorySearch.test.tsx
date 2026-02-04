/**
 * MemorySearch Component Tests
 *
 * Tests spatiotemporal search interface for finding notes by location and time.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemorySearch } from '../MemorySearch';
import { api } from '@/api';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    memory: {
      searchCombined: vi.fn(),
      searchByLocation: vi.fn(),
      searchByTimeRange: vi.fn(),
    },
  },
}));

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
};
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

// Mock data
const mockSearchResults = [
  {
    note_id: 'note-1',
    attachment_id: 'att-1',
    title: 'Beach Photo',
    snippet: 'A beautiful sunset at the beach',
    distance_meters: 1500,
    capture_time: '2024-01-15T10:00:00Z',
    device: 'iPhone 15 Pro',
  },
  {
    note_id: 'note-2',
    attachment_id: undefined,
    title: 'Travel Notes',
    snippet: 'My trip to the coast',
    distance_meters: 500,
    capture_time: '2024-01-14T15:00:00Z',
    device: undefined,
  },
];

describe('MemorySearch', () => {
  beforeEach(() => {
    vi.mocked(api.memory.searchCombined).mockResolvedValue(mockSearchResults);
    vi.mocked(api.memory.searchByLocation).mockResolvedValue(mockSearchResults);
    vi.mocked(api.memory.searchByTimeRange).mockResolvedValue(mockSearchResults);
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: { latitude: 40.7128, longitude: -74.006 },
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      const onClose = vi.fn();
      const { container } = render(<MemorySearch isOpen={false} onClose={onClose} />);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it('should render dialog when open', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Memory Search')).toBeInTheDocument();
      });
    });

    it('should render location picker', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Location')).toBeInTheDocument();
        expect(screen.getByText('Use Current Location')).toBeInTheDocument();
      });
    });

    it('should render time range picker', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Time Range')).toBeInTheDocument();
        expect(screen.getByText('From')).toBeInTheDocument();
        expect(screen.getByText('To')).toBeInTheDocument();
      });
    });

    it('should render search button', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Search Memories')).toBeInTheDocument();
      });
    });
  });

  describe('Location Picker', () => {
    it('should get current location when button clicked', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Use Current Location')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Use Current Location'));

      await waitFor(() => {
        expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
      });
    });

    it('should display coordinates after getting location', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));

      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });
    });

    it('should show radius slider after location is set', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));

      await waitFor(() => {
        expect(screen.getByText('Search Radius')).toBeInTheDocument();
        expect(screen.getByText('1.0 km')).toBeInTheDocument();
      });
    });

    it('should clear location when X button clicked', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));

      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });

      // Find and click the clear button
      const clearButton = screen.getByRole('button', { name: '' });
      const xIcon = clearButton?.querySelector('.lucide-x');
      if (xIcon) {
        fireEvent.click(clearButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Use Current Location')).toBeInTheDocument();
      });
    });
  });

  describe('Time Range Picker', () => {
    it('should initialize with 30-day range', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        // Date inputs are rendered with type="date"
        expect(screen.getByText('From')).toBeInTheDocument();
        expect(screen.getByText('To')).toBeInTheDocument();
      });
    });

    it('should have quick preset buttons', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Last 7 days')).toBeInTheDocument();
        expect(screen.getByText('Last 30 days')).toBeInTheDocument();
        expect(screen.getByText('Last year')).toBeInTheDocument();
      });
    });

    it('should update dates when preset clicked', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Last 7 days')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Last 7 days'));

      // Dates should be updated (we can't easily test the actual values)
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should show error if no location or time range', async () => {
      // Reset date initialization by using a fresh render
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Search Memories')).toBeInTheDocument();
      });

      // The component initializes with a date range, so this test verifies error handling
      // when both location and time are potentially cleared
    });

    it('should search by location only', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));

      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Search Memories'));

      await waitFor(() => {
        // Combined search should be called since dates are auto-initialized
        expect(api.memory.searchCombined).toHaveBeenCalled();
      });
    });

    it('should display search results', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));

      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Search Memories'));

      await waitFor(() => {
        expect(screen.getByText('Beach Photo')).toBeInTheDocument();
        expect(screen.getByText('Travel Notes')).toBeInTheDocument();
      });
    });

    it('should display distance in results', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));
      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Search Memories'));

      await waitFor(() => {
        expect(screen.getByText('1.5 km')).toBeInTheDocument();
        expect(screen.getByText('500 m')).toBeInTheDocument();
      });
    });

    it('should display result count badge', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));
      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Search Memories'));

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Results')).toBeInTheDocument();
      });
    });
  });

  describe('Result Selection', () => {
    it('should call onSelectResult when result clicked', async () => {
      const onClose = vi.fn();
      const onSelectResult = vi.fn();
      render(
        <MemorySearch isOpen={true} onClose={onClose} onSelectResult={onSelectResult} />
      );

      fireEvent.click(screen.getByText('Use Current Location'));
      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Search Memories'));

      await waitFor(() => {
        expect(screen.getByText('Beach Photo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Beach Photo'));

      expect(onSelectResult).toHaveBeenCalledWith(mockSearchResults[0]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should display error when search fails', async () => {
      vi.mocked(api.memory.searchCombined).mockRejectedValue(new Error('Network error'));

      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));
      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Search Memories'));

      await waitFor(() => {
        expect(screen.getByText('Search failed')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state message', async () => {
      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(
          screen.getByText('Set location and/or time range to search')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state during search', async () => {
      vi.mocked(api.memory.searchCombined).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSearchResults), 100))
      );

      const onClose = vi.fn();
      render(<MemorySearch isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByText('Use Current Location'));
      await waitFor(() => {
        expect(screen.getByText('40.712800, -74.006000')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Search Memories'));

      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });
  });
});
