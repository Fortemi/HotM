/**
 * VideoControls Component Tests
 *
 * Tests custom video control bar:
 * - Play/pause toggle
 * - Skip forward/backward
 * - Time display
 * - Volume control
 * - Mute toggle
 * - Caption toggle
 * - Fullscreen toggle
 * - Auto-hide behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VideoControls } from '../VideoControls';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function createMockRefs() {
  const containerEl = document.createElement('div');
  return {
    containerRef: { current: containerEl },
  };
}

describe('VideoControls', () => {
  const defaultProps = {
    ...createMockRefs(),
    duration: 300,
    currentTime: 45,
    isPlaying: false,
    volume: 0.8,
    isMuted: false,
    isFullscreen: false,
    buffered: null,
    showCaptions: false,
    hasCaptions: true,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSeek: vi.fn(),
    onVolumeChange: vi.fn(),
    onMuteToggle: vi.fn(),
    onFullscreenToggle: vi.fn(),
    onCaptionToggle: vi.fn(),
  };

  it('renders the control bar', () => {
    render(<VideoControls {...defaultProps} />);
    expect(screen.getByTestId('video-controls')).toBeInTheDocument();
  });

  describe('play/pause', () => {
    it('shows play icon when paused', () => {
      render(<VideoControls {...defaultProps} isPlaying={false} />);
      const btn = screen.getByTestId('controls-play-pause');
      expect(btn).toHaveAttribute('aria-label', 'Play');
    });

    it('shows pause icon when playing', () => {
      render(<VideoControls {...defaultProps} isPlaying={true} />);
      const btn = screen.getByTestId('controls-play-pause');
      expect(btn).toHaveAttribute('aria-label', 'Pause');
    });

    it('calls onPlay when clicked while paused', () => {
      const onPlay = vi.fn();
      render(<VideoControls {...defaultProps} isPlaying={false} onPlay={onPlay} />);
      fireEvent.click(screen.getByTestId('controls-play-pause'));
      expect(onPlay).toHaveBeenCalled();
    });

    it('calls onPause when clicked while playing', () => {
      const onPause = vi.fn();
      render(<VideoControls {...defaultProps} isPlaying={true} onPause={onPause} />);
      fireEvent.click(screen.getByTestId('controls-play-pause'));
      expect(onPause).toHaveBeenCalled();
    });
  });

  describe('skip buttons', () => {
    it('calls onSeek with time - 10 on skip back', () => {
      const onSeek = vi.fn();
      render(<VideoControls {...defaultProps} currentTime={45} onSeek={onSeek} />);
      fireEvent.click(screen.getByTestId('controls-skip-back'));
      expect(onSeek).toHaveBeenCalledWith(35);
    });

    it('calls onSeek with time + 10 on skip forward', () => {
      const onSeek = vi.fn();
      render(<VideoControls {...defaultProps} currentTime={45} duration={300} onSeek={onSeek} />);
      fireEvent.click(screen.getByTestId('controls-skip-forward'));
      expect(onSeek).toHaveBeenCalledWith(55);
    });

    it('clamps skip back to 0', () => {
      const onSeek = vi.fn();
      render(<VideoControls {...defaultProps} currentTime={5} onSeek={onSeek} />);
      fireEvent.click(screen.getByTestId('controls-skip-back'));
      expect(onSeek).toHaveBeenCalledWith(0);
    });

    it('clamps skip forward to duration', () => {
      const onSeek = vi.fn();
      render(<VideoControls {...defaultProps} currentTime={295} duration={300} onSeek={onSeek} />);
      fireEvent.click(screen.getByTestId('controls-skip-forward'));
      expect(onSeek).toHaveBeenCalledWith(300);
    });
  });

  describe('time display', () => {
    it('shows current time and duration', () => {
      render(<VideoControls {...defaultProps} currentTime={125} duration={3661} />);
      const display = screen.getByTestId('controls-time-display');
      expect(display.textContent).toContain('2:05');
      expect(display.textContent).toContain('1:01:01');
    });

    it('shows 0:00 for zero/invalid values', () => {
      render(<VideoControls {...defaultProps} currentTime={0} duration={0} />);
      const display = screen.getByTestId('controls-time-display');
      expect(display.textContent).toContain('0:00');
    });
  });

  describe('volume controls', () => {
    it('shows volume icon when not muted', () => {
      render(<VideoControls {...defaultProps} isMuted={false} volume={0.5} />);
      const btn = screen.getByTestId('controls-mute');
      expect(btn).toHaveAttribute('aria-label', 'Mute');
    });

    it('shows muted icon when muted', () => {
      render(<VideoControls {...defaultProps} isMuted={true} />);
      const btn = screen.getByTestId('controls-mute');
      expect(btn).toHaveAttribute('aria-label', 'Unmute');
    });

    it('calls onMuteToggle on mute button click', () => {
      const onMuteToggle = vi.fn();
      render(<VideoControls {...defaultProps} onMuteToggle={onMuteToggle} />);
      fireEvent.click(screen.getByTestId('controls-mute'));
      expect(onMuteToggle).toHaveBeenCalled();
    });

    it('renders volume slider', () => {
      render(<VideoControls {...defaultProps} />);
      expect(screen.getByTestId('controls-volume-slider')).toBeInTheDocument();
    });

    it('calls onVolumeChange when slider changes', () => {
      const onVolumeChange = vi.fn();
      render(<VideoControls {...defaultProps} onVolumeChange={onVolumeChange} />);
      fireEvent.change(screen.getByTestId('controls-volume-slider'), {
        target: { value: '0.5' },
      });
      expect(onVolumeChange).toHaveBeenCalledWith(0.5);
    });
  });

  describe('captions', () => {
    it('shows caption button when captions available', () => {
      render(<VideoControls {...defaultProps} hasCaptions={true} />);
      expect(screen.getByTestId('controls-captions')).toBeInTheDocument();
    });

    it('hides caption button when no captions', () => {
      render(<VideoControls {...defaultProps} hasCaptions={false} />);
      expect(screen.queryByTestId('controls-captions')).not.toBeInTheDocument();
    });

    it('calls onCaptionToggle on click', () => {
      const onCaptionToggle = vi.fn();
      render(<VideoControls {...defaultProps} hasCaptions={true} onCaptionToggle={onCaptionToggle} />);
      fireEvent.click(screen.getByTestId('controls-captions'));
      expect(onCaptionToggle).toHaveBeenCalled();
    });

    it('highlights button when captions are showing', () => {
      render(<VideoControls {...defaultProps} hasCaptions={true} showCaptions={true} />);
      const btn = screen.getByTestId('controls-captions');
      expect(btn.className).toContain('bg-white/20');
    });
  });

  describe('fullscreen', () => {
    it('shows fullscreen button', () => {
      render(<VideoControls {...defaultProps} />);
      expect(screen.getByTestId('controls-fullscreen')).toBeInTheDocument();
    });

    it('shows correct label based on fullscreen state', () => {
      const { rerender } = render(<VideoControls {...defaultProps} isFullscreen={false} />);
      expect(screen.getByTestId('controls-fullscreen')).toHaveAttribute('aria-label', 'Fullscreen');

      rerender(<VideoControls {...defaultProps} isFullscreen={true} />);
      expect(screen.getByTestId('controls-fullscreen')).toHaveAttribute('aria-label', 'Exit fullscreen');
    });

    it('calls onFullscreenToggle on click', () => {
      const onFullscreenToggle = vi.fn();
      render(<VideoControls {...defaultProps} onFullscreenToggle={onFullscreenToggle} />);
      fireEvent.click(screen.getByTestId('controls-fullscreen'));
      expect(onFullscreenToggle).toHaveBeenCalled();
    });
  });

  describe('auto-hide', () => {
    it('is visible when paused', () => {
      render(<VideoControls {...defaultProps} isPlaying={false} />);
      const controls = screen.getByTestId('video-controls');
      expect(controls.className).toContain('opacity-100');
    });

    it('hides after timeout during playback', () => {
      render(<VideoControls {...defaultProps} isPlaying={true} />);
      const controls = screen.getByTestId('video-controls');

      act(() => {
        vi.advanceTimersByTime(3500);
      });

      expect(controls.className).toContain('opacity-0');
    });

    it('stays visible when hovering over controls', () => {
      render(<VideoControls {...defaultProps} isPlaying={true} />);
      const controls = screen.getByTestId('video-controls');

      fireEvent.mouseEnter(controls);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(controls.className).toContain('opacity-100');
    });
  });

  describe('seek bar integration', () => {
    it('renders the seek bar', () => {
      render(<VideoControls {...defaultProps} />);
      expect(screen.getByTestId('seek-bar')).toBeInTheDocument();
    });

    it('passes seekBarChildren to seek bar', () => {
      render(
        <VideoControls
          {...defaultProps}
          seekBarChildren={<div data-testid="thumbnail-preview">Preview</div>}
        />
      );
      // Children are inside SeekBar, visible when hovering
      const seekTrack = screen.getByTestId('seek-bar-track');
      fireEvent.mouseEnter(seekTrack);
      expect(screen.getByTestId('thumbnail-preview')).toBeInTheDocument();
    });
  });
});
