import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useIsMobile } from '../use-mobile';

describe('useIsMobile', () => {
  let originalInnerWidth: number;
  let mockMatchMedia: any;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    
    // Mock matchMedia
    mockMatchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: originalInnerWidth,
    });
    vi.clearAllMocks();
  });

  it('returns false for desktop widths', () => {
    // Set desktop width (>= 768px)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('returns true for mobile widths', () => {
    // Set mobile width (< 768px)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 480,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('returns true exactly at mobile breakpoint', () => {
    // Set width exactly at breakpoint boundary
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 767, // < 768
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('returns false exactly above mobile breakpoint', () => {
    // Set width exactly above breakpoint
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 768, // >= 768
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('sets up media query listener correctly', () => {
    renderHook(() => useIsMobile());

    // Should call matchMedia with correct query
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    
    // Should set up event listener
    const mockMql = mockMatchMedia.mock.results[0].value;
    expect(mockMql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() => useIsMobile());
    
    const mockMql = mockMatchMedia.mock.results[0].value;
    
    act(() => {
      unmount();
    });

    expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('responds to window resize via media query change', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024, // Desktop initially
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Simulate window resize to mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 480,
    });

    // Get the change callback and call it
    const mockMql = mockMatchMedia.mock.results[0].value;
    const changeCallback = mockMql.addEventListener.mock.calls[0][1];
    
    act(() => {
      changeCallback();
    });

    expect(result.current).toBe(true);
  });
});