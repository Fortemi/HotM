/**
 * SeekBar Component Tests
 *
 * Tests seek bar functionality:
 * - Progress visualization
 * - Buffer visualization
 * - Click-to-seek
 * - Hover time tracking
 * - Drag behavior
 * - Accessibility attributes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeekBar } from '../SeekBar';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockTimeRanges(ranges: [number, number][]): TimeRanges {
  return {
    length: ranges.length,
    start: (i: number) => ranges[i][0],
    end: (i: number) => ranges[i][1],
  };
}

describe('SeekBar', () => {
  const defaultProps = {
    currentTime: 30,
    duration: 120,
    buffered: null,
    onSeek: vi.fn(),
  };

  it('renders the seek bar with correct ARIA attributes', () => {
    render(<SeekBar {...defaultProps} />);
    const track = screen.getByTestId('seek-bar-track');
    expect(track).toHaveAttribute('role', 'slider');
    expect(track).toHaveAttribute('aria-label', 'Seek');
    expect(track).toHaveAttribute('aria-valuemin', '0');
    expect(track).toHaveAttribute('aria-valuemax', '120');
    expect(track).toHaveAttribute('aria-valuenow', '30');
  });

  it('shows played progress at correct percentage', () => {
    render(<SeekBar {...defaultProps} />);
    const played = screen.getByTestId('seek-bar-played');
    // 30/120 = 25%
    expect(played.style.width).toBe('25%');
  });

  it('shows buffered range when provided', () => {
    const buffered = mockTimeRanges([[0, 60]]);
    render(<SeekBar {...defaultProps} buffered={buffered} />);
    const bufferedBar = screen.getByTestId('seek-bar-buffered');
    // 60/120 = 50%
    expect(bufferedBar.style.width).toBe('50%');
  });

  it('shows 0% buffered when no ranges cover current time', () => {
    const buffered = mockTimeRanges([[80, 120]]);
    render(<SeekBar {...defaultProps} currentTime={30} buffered={buffered} />);
    const bufferedBar = screen.getByTestId('seek-bar-buffered');
    expect(bufferedBar.style.width).toBe('0%');
  });

  it('calls onSeek on mousedown with correct time', () => {
    const onSeek = vi.fn();
    render(<SeekBar {...defaultProps} onSeek={onSeek} />);
    const track = screen.getByTestId('seek-bar-track');

    // Mock getBoundingClientRect
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 200,
      width: 200,
      top: 0,
      bottom: 20,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.mouseDown(track, { clientX: 100 });
    // 100/200 * 120 = 60
    expect(onSeek).toHaveBeenCalledWith(60);
  });

  it('calls onHoverTime during mousemove', () => {
    const onHoverTime = vi.fn();
    render(<SeekBar {...defaultProps} onHoverTime={onHoverTime} />);
    const track = screen.getByTestId('seek-bar-track');

    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 200,
      width: 200,
      top: 0,
      bottom: 20,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.mouseEnter(track);
    fireEvent.mouseMove(track, { clientX: 50 });
    // 50/200 * 120 = 30
    expect(onHoverTime).toHaveBeenCalledWith(30);
  });

  it('clears hover state on mouse leave', () => {
    const onHoverTime = vi.fn();
    const onHoverPosition = vi.fn();
    render(
      <SeekBar
        {...defaultProps}
        onHoverTime={onHoverTime}
        onHoverPosition={onHoverPosition}
      />
    );
    const track = screen.getByTestId('seek-bar-track');

    fireEvent.mouseLeave(track);
    expect(onHoverTime).toHaveBeenCalledWith(null);
    expect(onHoverPosition).toHaveBeenCalledWith(null);
  });

  it('calls onHoverPosition with pixel offset', () => {
    const onHoverPosition = vi.fn();
    render(<SeekBar {...defaultProps} onHoverPosition={onHoverPosition} />);
    const track = screen.getByTestId('seek-bar-track');

    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 300,
      width: 200,
      top: 0,
      bottom: 20,
      height: 20,
      x: 100,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.mouseEnter(track);
    fireEvent.mouseMove(track, { clientX: 180 });
    // 180 - 100 = 80 pixels from left
    expect(onHoverPosition).toHaveBeenCalledWith(80);
  });

  it('renders children slot when hovering', () => {
    render(
      <SeekBar {...defaultProps}>
        <div data-testid="child-content">Thumbnail</div>
      </SeekBar>
    );

    const track = screen.getByTestId('seek-bar-track');
    // Children not visible before hover
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

    // Hover to show children
    fireEvent.mouseEnter(track);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('handles zero duration gracefully', () => {
    render(<SeekBar {...defaultProps} currentTime={0} duration={0} />);
    const played = screen.getByTestId('seek-bar-played');
    // Should not produce NaN or Infinity
    expect(played.style.width).toBe('0%');
  });

  it('clamps progress to 0-100%', () => {
    render(<SeekBar {...defaultProps} currentTime={200} duration={100} />);
    const played = screen.getByTestId('seek-bar-played');
    expect(played.style.width).toBe('100%');
  });

  it('handles touch events', () => {
    const onSeek = vi.fn();
    render(<SeekBar {...defaultProps} onSeek={onSeek} />);
    const track = screen.getByTestId('seek-bar-track');

    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 200,
      width: 200,
      top: 0,
      bottom: 20,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.touchStart(track, {
      touches: [{ clientX: 100 }],
    });
    expect(onSeek).toHaveBeenCalledWith(60);
  });

  it('shows thumb on hover', () => {
    render(<SeekBar {...defaultProps} />);
    const track = screen.getByTestId('seek-bar-track');
    const thumb = screen.getByTestId('seek-bar-thumb');

    // Initially hidden
    expect(thumb.className).toContain('opacity-0');

    // Hover shows thumb
    fireEvent.mouseEnter(track);
    expect(thumb.className).toContain('opacity-100');
  });
});
