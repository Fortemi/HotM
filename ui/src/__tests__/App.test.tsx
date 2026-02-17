/**
 * App Component Tests
 *
 * Tests the root App component rendering.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock HallOfMind component
vi.mock('../components/HallOfMind', () => ({
  HallOfMind: () => <div data-testid="hall-of-mind">HallOfMind Component</div>,
}));
vi.mock('../components/mobile/MobileReadView', () => ({
  MobileReadView: () => <div data-testid="mobile-read-view">Mobile Read View</div>,
}));

describe('App', () => {
  const originalPath = window.location.pathname;

  const setPath = (path: string) => {
    window.history.replaceState({}, '', path);
  };

  afterEach(() => {
    setPath(originalPath);
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      setPath('/');
      render(<App />);

      expect(screen.getByTestId('hall-of-mind')).toBeInTheDocument();
    });

    it('should render HallOfMind component', () => {
      setPath('/');
      render(<App />);

      expect(screen.getByText('HallOfMind Component')).toBeInTheDocument();
    });

    it('should not render TestSidebar by default', () => {
      setPath('/');
      render(<App />);

      expect(screen.queryByTestId('test-sidebar')).not.toBeInTheDocument();
    });
    it('should render mobile read view on /mobile path', () => {
      setPath('/mobile');
      render(<App />);

      expect(screen.getByTestId('mobile-read-view')).toBeInTheDocument();
      expect(screen.queryByTestId('hall-of-mind')).not.toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('should render a single root component', () => {
      setPath('/');
      const { container } = render(<App />);

      expect(container.firstChild).toBe(screen.getByTestId('hall-of-mind'));
    });

    it('should have proper component hierarchy', () => {
      setPath('/');
      const { container } = render(<App />);

      expect(container.children).toHaveLength(1);
    });
  });

  describe('Integration', () => {
    it('should pass props to HallOfMind if needed', () => {
      setPath('/');
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
