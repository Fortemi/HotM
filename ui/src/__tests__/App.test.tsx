/**
 * App Component Tests
 *
 * Tests the root App component rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock HallOfMind component
vi.mock('../components/HallOfMind', () => ({
  HallOfMind: () => <div data-testid="hall-of-mind">HallOfMind Component</div>,
}));

describe('App', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<App />);

      expect(screen.getByTestId('hall-of-mind')).toBeInTheDocument();
    });

    it('should render HallOfMind component', () => {
      render(<App />);

      expect(screen.getByText('HallOfMind Component')).toBeInTheDocument();
    });

    it('should not render TestSidebar by default', () => {
      render(<App />);

      expect(screen.queryByTestId('test-sidebar')).not.toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('should render a single root component', () => {
      const { container } = render(<App />);

      expect(container.firstChild).toBe(screen.getByTestId('hall-of-mind'));
    });

    it('should have proper component hierarchy', () => {
      const { container } = render(<App />);

      expect(container.children).toHaveLength(1);
    });
  });

  describe('Integration', () => {
    it('should pass props to HallOfMind if needed', () => {
      render(<App />);

      // HallOfMind should be rendered
      expect(screen.getByTestId('hall-of-mind')).toBeInTheDocument();
    });

    it('should be exportable as default export', () => {
      expect(App).toBeDefined();
      expect(typeof App).toBe('function');
    });
  });
});
