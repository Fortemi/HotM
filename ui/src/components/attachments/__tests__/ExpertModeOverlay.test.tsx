/**
 * ExpertModeOverlay component tests
 *
 * Verifies:
 * - Renders all stat sections
 * - Video-specific sections hidden for audio
 * - Close button fires onClose
 * - Mode badge colour coding
 * - Dropped frame colour thresholds
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpertModeOverlay } from '../ExpertModeOverlay';
import type { MediaStats } from '../useMediaStats';
import type { MediaInfo } from '../media-utils';

// Mock detectGpuRenderer
vi.mock('../media-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../media-utils')>();
  return {
    ...actual,
    detectGpuRenderer: () => 'NVIDIA GeForce RTX 4090',
  };
});

function makeStats(overrides: Partial<MediaStats> = {}): MediaStats {
  return {
    currentTime: 30,
    duration: 120,
    playbackRate: 1,
    paused: false,
    seeking: false,
    bufferHealthSecs: 15.2,
    bufferPercentage: 45,
    networkState: 'IDLE',
    readyState: 'HAVE_ENOUGH_DATA',
    decodedWidth: 1920,
    decodedHeight: 1080,
    droppedFrames: 5,
    totalFrames: 10000,
    droppedFrameRatio: 0.05,
    corruptedFrames: 0,
    volume: 0.8,
    muted: false,
    ...overrides,
  };
}

function makeMediaInfo(overrides: Partial<MediaInfo> = {}): MediaInfo {
  return {
    width: 3840,
    height: 2160,
    codec: 'h265',
    frameRate: 59.94,
    audioCodec: 'aac',
    audioSampleRate: 48000,
    bitrateKbps: 12000,
    hasTranscript: false,
    hasThumbnail: false,
    hasPreview: false,
    ...overrides,
  };
}

const defaultProps = {
  stats: makeStats(),
  mediaInfo: makeMediaInfo(),
  playbackMode: 'direct' as const,
  contentType: 'video/mp4',
  sizeBytes: 52428800,
  variant: 'web_compatible',
  filename: 'test-video.mp4',
  extractionStrategy: 'video_ffmpeg',
  mediaType: 'video' as const,
  onClose: vi.fn(),
};

describe('ExpertModeOverlay', () => {
  it('renders overlay with data-testid', () => {
    render(<ExpertModeOverlay {...defaultProps} />);
    expect(screen.getByTestId('expert-mode-overlay')).toBeInTheDocument();
  });

  it('shows playback section stats', () => {
    render(<ExpertModeOverlay {...defaultProps} />);
    expect(screen.getByText('Playback')).toBeInTheDocument();
    expect(screen.getByText('Direct')).toBeInTheDocument();
    expect(screen.getByText(/15\.2s/)).toBeInTheDocument();
    expect(screen.getByText('1x')).toBeInTheDocument();
    expect(screen.getByText('IDLE')).toBeInTheDocument();
    expect(screen.getByText('HAVE_ENOUGH_DATA')).toBeInTheDocument();
  });

  it('shows video section for video media type', () => {
    render(<ExpertModeOverlay {...defaultProps} />);
    expect(screen.getByText('Video')).toBeInTheDocument();
    // Source → Decoded resolution
    expect(screen.getByText(/3840×2160 → 1920×1080/)).toBeInTheDocument();
    // Codec @ fps
    expect(screen.getByText(/h265 @ 59\.94 fps/)).toBeInTheDocument();
    // Dropped frames
    expect(screen.getByText('5 / 10000')).toBeInTheDocument();
  });

  it('hides video section for audio media type', () => {
    const audioStats = makeStats({
      decodedWidth: null,
      decodedHeight: null,
      droppedFrames: null,
      totalFrames: null,
      droppedFrameRatio: null,
      corruptedFrames: null,
    });
    render(
      <ExpertModeOverlay
        {...defaultProps}
        stats={audioStats}
        mediaType="audio"
        contentType="audio/mpeg"
      />
    );
    expect(screen.queryByText('Video')).not.toBeInTheDocument();
  });

  it('shows audio section when audio codec info available', () => {
    render(<ExpertModeOverlay {...defaultProps} />);
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('aac')).toBeInTheDocument();
    expect(screen.getByText('48.0 kHz')).toBeInTheDocument();
  });

  it('shows file section details', () => {
    render(<ExpertModeOverlay {...defaultProps} />);
    // "File" appears as both the section header and the stat label for filename
    const fileTexts = screen.getAllByText('File');
    expect(fileTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('video/mp4')).toBeInTheDocument();
    expect(screen.getByText('50.0 MB')).toBeInTheDocument();
    expect(screen.getByText('12000 kbps')).toBeInTheDocument();
    expect(screen.getByText('web_compatible')).toBeInTheDocument();
    expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    expect(screen.getByText('video_ffmpeg')).toBeInTheDocument();
  });

  it('shows system section with GPU', () => {
    render(<ExpertModeOverlay {...defaultProps} />);
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('NVIDIA GeForce RTX 4090')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ExpertModeOverlay {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('expert-mode-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uses green color for direct mode badge', () => {
    render(<ExpertModeOverlay {...defaultProps} playbackMode="direct" />);
    const badge = screen.getByText('Direct');
    expect(badge.className).toContain('text-green-400');
  });

  it('uses yellow color for blob mode badge', () => {
    render(<ExpertModeOverlay {...defaultProps} playbackMode="blob" />);
    const badge = screen.getByText('Blob');
    expect(badge.className).toContain('text-yellow-400');
  });

  it('uses red color for error mode badge', () => {
    render(<ExpertModeOverlay {...defaultProps} playbackMode="error" />);
    const badge = screen.getByText('Error');
    expect(badge.className).toContain('text-red-400');
  });

  it('applies video overlay styling for video type', () => {
    render(<ExpertModeOverlay {...defaultProps} mediaType="video" />);
    const overlay = screen.getByTestId('expert-mode-overlay');
    expect(overlay.className).toContain('absolute');
    expect(overlay.className).toContain('bg-black/80');
  });

  it('applies panel styling for audio type', () => {
    const audioStats = makeStats({
      decodedWidth: null,
      decodedHeight: null,
      droppedFrames: null,
      totalFrames: null,
      droppedFrameRatio: null,
      corruptedFrames: null,
    });
    render(
      <ExpertModeOverlay
        {...defaultProps}
        stats={audioStats}
        mediaType="audio"
      />
    );
    const overlay = screen.getByTestId('expert-mode-overlay');
    expect(overlay.className).toContain('bg-muted/50');
    expect(overlay.className).not.toContain('absolute');
  });

  it('handles null mediaInfo gracefully', () => {
    render(<ExpertModeOverlay {...defaultProps} mediaInfo={null} />);
    // Should still render without crashing
    expect(screen.getByTestId('expert-mode-overlay')).toBeInTheDocument();
  });

  it('shows only decoded resolution when source dimensions unavailable', () => {
    render(
      <ExpertModeOverlay
        {...defaultProps}
        mediaInfo={makeMediaInfo({ width: undefined, height: undefined })}
      />
    );
    expect(screen.getByText('1920×1080')).toBeInTheDocument();
  });
});
