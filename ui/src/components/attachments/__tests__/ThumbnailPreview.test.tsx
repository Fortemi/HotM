/**
 * ThumbnailPreview Component Tests
 *
 * Tests the seek bar hover thumbnail popup:
 * - Renders sprite crop correctly
 * - Shows time label
 * - Position clamping
 * - Graceful degradation (no cue / null hover)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThumbnailPreview } from '../ThumbnailPreview';
import type { ThumbnailCue } from '../thumbnail-vtt';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const sampleCue: ThumbnailCue = {
  startTime: 10,
  endTime: 20,
  imageUrl: '/sprites/1.jpg',
  x: 160,
  y: 0,
  w: 160,
  h: 90,
};

describe('ThumbnailPreview', () => {
  it('renders nothing when hoverTime is null', () => {
    const { container } = render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={null}
        hoverPositionX={100}
        seekBarWidth={800}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when hoverPositionX is null', () => {
    const { container } = render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={15}
        hoverPositionX={null}
        seekBarWidth={800}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the thumbnail preview container when hovering', () => {
    render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={15}
        hoverPositionX={400}
        seekBarWidth={800}
      />
    );
    expect(screen.getByTestId('thumbnail-preview')).toBeInTheDocument();
  });

  it('renders the sprite image with correct offset', () => {
    render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={15}
        hoverPositionX={400}
        seekBarWidth={800}
      />
    );
    const imageContainer = screen.getByTestId('thumbnail-preview-image');
    expect(imageContainer).toBeInTheDocument();
    expect(imageContainer.style.width).toBe('160px');
    expect(imageContainer.style.height).toBe('90px');

    const img = imageContainer.querySelector('img');
    expect(img).toHaveAttribute('src', '/sprites/1.jpg');
    expect(img!.style.left).toBe('-160px');
    expect(img!.style.top).toBe('0px');
  });

  it('renders the time label', () => {
    render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={75}
        hoverPositionX={400}
        seekBarWidth={800}
      />
    );
    const timeLabel = screen.getByTestId('thumbnail-preview-time');
    expect(timeLabel.textContent).toBe('1:15');
  });

  it('renders the arrow indicator', () => {
    render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={15}
        hoverPositionX={400}
        seekBarWidth={800}
      />
    );
    expect(screen.getByTestId('thumbnail-preview-arrow')).toBeInTheDocument();
  });

  it('clamps position to left edge', () => {
    render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={15}
        hoverPositionX={10}
        seekBarWidth={800}
      />
    );
    const preview = screen.getByTestId('thumbnail-preview');
    // Desired = 10 - 80 = -70, clamped to margin (8)
    expect(parseInt(preview.style.left)).toBeGreaterThanOrEqual(8);
  });

  it('clamps position to right edge', () => {
    render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={15}
        hoverPositionX={790}
        seekBarWidth={800}
      />
    );
    const preview = screen.getByTestId('thumbnail-preview');
    // Should be clamped so popup doesn't overflow right edge
    const left = parseInt(preview.style.left);
    expect(left + sampleCue.w + 8).toBeLessThanOrEqual(800);
  });

  it('renders time-only when cue is null (graceful degradation)', () => {
    render(
      <ThumbnailPreview
        cue={null}
        hoverTime={15}
        hoverPositionX={400}
        seekBarWidth={800}
      />
    );
    // Should still show time label
    expect(screen.getByTestId('thumbnail-preview-time')).toBeInTheDocument();
    // No image container
    expect(screen.queryByTestId('thumbnail-preview-image')).not.toBeInTheDocument();
  });

  it('formats hours correctly', () => {
    render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={3661}
        hoverPositionX={400}
        seekBarWidth={800}
      />
    );
    expect(screen.getByTestId('thumbnail-preview-time').textContent).toBe('1:01:01');
  });

  it('formats zero time correctly', () => {
    render(
      <ThumbnailPreview
        cue={sampleCue}
        hoverTime={0}
        hoverPositionX={400}
        seekBarWidth={800}
      />
    );
    expect(screen.getByTestId('thumbnail-preview-time').textContent).toBe('0:00');
  });
});
