/**
 * StreamingMedia Component Tests
 *
 * Tests enhanced video/audio player features:
 * - Loading/buffering/error states
 * - Error recovery with retry
 * - Playback position persistence
 * - Keyboard shortcuts
 * - Download fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StreamingVideoPlayer, StreamingAudioPlayer, formatFileSize, formatDuration } from '../StreamingMedia';

// Mock API
vi.mock('@/api', () => ({
  api: {
    attachments: {
      getDownloadUrl: vi.fn((id: string) => `http://test/api/v1/attachments/${id}/download`),
      getThumbnailUrl: vi.fn((id: string) => `http://test/api/v1/attachments/${id}/thumbnail`),
      getSubtitleUrl: vi.fn((id: string, fmt = 'vtt') => `http://test/api/v1/attachments/${id}/subtitles?format=${fmt}`),
      downloadAttachment: vi.fn(),
    },
  },
}));

vi.mock('@/api/memory-context', () => ({
  getActiveMemory: vi.fn(() => null),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock HTMLMediaElement methods (jsdom doesn't implement them)
Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: vi.fn(),
});
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
});
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
});

// URL.createObjectURL / revokeObjectURL mock (jsdom doesn't implement)
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-vtt-url');
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}

// Fullscreen API mock
Object.defineProperty(document, 'fullscreenElement', {
  configurable: true,
  get: () => null,
});
Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Format helpers ----

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });
  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });
  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('formats gigabytes', () => {
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('0:45');
  });
  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2:05');
  });
  it('formats hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});

// ---- StreamingVideoPlayer ----

describe('StreamingVideoPlayer', () => {
  it('renders video element with direct URL', () => {
    render(<StreamingVideoPlayer attachmentId="vid-1" />);
    const video = screen.getByTestId('attachment-video-preview');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'http://test/api/v1/attachments/vid-1/download');
    expect(video).toHaveAttribute('preload', 'metadata');
  });

  it('renders with poster URL when provided', () => {
    render(<StreamingVideoPlayer attachmentId="vid-1" posterUrl="http://test/poster.jpg" />);
    const video = screen.getByTestId('attachment-video-preview');
    expect(video).toHaveAttribute('poster', 'http://test/poster.jpg');
  });

  it('renders container with keyboard focus support', () => {
    render(<StreamingVideoPlayer attachmentId="vid-1" />);
    const container = screen.getByTestId('video-player-container');
    expect(container).toHaveAttribute('tabindex', '0');
  });

  it('shows error state with retry and download buttons on error', async () => {
    const { api: mockApi } = await import('@/api');
    (mockApi.attachments.downloadAttachment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    render(<StreamingVideoPlayer attachmentId="vid-1" sizeBytes={1048576} />);
    const video = screen.getByTestId('attachment-video-preview');

    // Direct URL error -> triggers blob mode -> blob fails -> error state
    fireEvent.error(video);

    await waitFor(() => {
      expect(screen.getByText('Failed to load video')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText(/Download/)).toBeInTheDocument();
  });

  it('shows download fallback with file size in error state', async () => {
    // Render and trigger errors to reach error state
    const { api: mockApi } = await import('@/api');
    (mockApi.attachments.downloadAttachment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    render(<StreamingVideoPlayer attachmentId="vid-1" sizeBytes={1048576} />);
    const video = screen.getByTestId('attachment-video-preview');

    // Direct error -> triggers blob mode
    fireEvent.error(video);

    // Wait for blob download to fail -> error mode
    await waitFor(() => {
      expect(screen.getByText('Failed to load video')).toBeInTheDocument();
    });

    expect(screen.getByText(/Download/)).toBeInTheDocument();
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StreamingVideoPlayer attachmentId="vid-1" className="custom-class" />);
    const video = screen.getByTestId('attachment-video-preview');
    expect(video).toHaveClass('custom-class');
  });

  describe('keyboard shortcuts', () => {
    it('responds to space key for play/pause', () => {
      render(<StreamingVideoPlayer attachmentId="vid-1" />);
      const container = screen.getByTestId('video-player-container');

      fireEvent.keyDown(container, { key: ' ' });
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    it('responds to k key for play/pause', () => {
      render(<StreamingVideoPlayer attachmentId="vid-1" />);
      const container = screen.getByTestId('video-player-container');

      fireEvent.keyDown(container, { key: 'k' });
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    it('responds to m key for mute toggle', () => {
      render(<StreamingVideoPlayer attachmentId="vid-1" />);
      const container = screen.getByTestId('video-player-container');
      const video = screen.getByTestId('attachment-video-preview') as HTMLVideoElement;

      expect(video.muted).toBe(false);
      fireEvent.keyDown(container, { key: 'm' });
      expect(video.muted).toBe(true);
    });

    it('responds to f key for fullscreen', () => {
      render(<StreamingVideoPlayer attachmentId="vid-1" />);
      const container = screen.getByTestId('video-player-container');

      fireEvent.keyDown(container, { key: 'f' });
      expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalled();
    });
  });

  describe('subtitle track', () => {
    it('renders track with VTT blob URL from transcript segments', () => {
      render(
        <StreamingVideoPlayer
          attachmentId="vid-1"
          transcriptSegments={[{ start_secs: 0, end_secs: 5, text: 'Hello world' }]}
        />
      );
      const track = screen.getByTestId('subtitle-track');
      expect(track).toBeInTheDocument();
      expect(track.getAttribute('src')).toMatch(/^blob:/);
    });

    it('uses same-origin VTT blob URL for subtitles (avoids CORS)', () => {
      render(
        <StreamingVideoPlayer
          attachmentId="vid-1"
          transcriptSegments={[{ start_secs: 0, end_secs: 5, text: 'Hello' }]}
        />
      );
      const track = screen.getByTestId('subtitle-track');
      expect(track.getAttribute('src')).toMatch(/^blob:/);
    });

    it('renders no track when no segments provided', () => {
      render(<StreamingVideoPlayer attachmentId="vid-1" />);
      expect(screen.queryByTestId('subtitle-track')).not.toBeInTheDocument();
    });

    it('does not set crossOrigin on video element (prevents CORS blocking)', () => {
      render(
        <StreamingVideoPlayer
          attachmentId="vid-1"
          transcriptSegments={[{ start_secs: 0, end_secs: 5, text: 'Hello' }]}
        />
      );
      const video = screen.getByTestId('attachment-video-preview');
      expect(video).not.toHaveAttribute('crossOrigin');
    });
  });

  describe('playback position persistence', () => {
    it('saves position on pause', () => {
      render(<StreamingVideoPlayer attachmentId="vid-1" />);
      const video = screen.getByTestId('attachment-video-preview') as HTMLVideoElement;

      // Set currentTime
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        writable: true,
        value: 42.5,
      });

      fireEvent.pause(video);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hotm-playback-vid-1',
        '42.5'
      );
    });

    it('clears position on ended', () => {
      render(<StreamingVideoPlayer attachmentId="vid-1" />);
      const video = screen.getByTestId('attachment-video-preview') as HTMLVideoElement;

      fireEvent.ended(video);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('hotm-playback-vid-1');
    });

    it('restores position on loadedmetadata', () => {
      localStorageMock.setItem('hotm-playback-vid-1', '30');
      render(<StreamingVideoPlayer attachmentId="vid-1" />);
      const video = screen.getByTestId('attachment-video-preview') as HTMLVideoElement;

      // Define duration so restore threshold check works
      Object.defineProperty(video, 'duration', {
        configurable: true,
        writable: true,
        value: 120,
      });

      fireEvent.loadedMetadata(video);

      expect(video.currentTime).toBe(30);
    });
  });
});

// ---- StreamingAudioPlayer ----

describe('StreamingAudioPlayer', () => {
  it('renders audio element with direct URL', () => {
    render(<StreamingAudioPlayer attachmentId="aud-1" />);
    const container = screen.getByTestId('attachment-audio-preview');
    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute('src', 'http://test/api/v1/attachments/aud-1/download');
  });

  it('shows error state with download fallback', async () => {
    const { api: mockApi } = await import('@/api');
    (mockApi.attachments.downloadAttachment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    render(<StreamingAudioPlayer attachmentId="aud-1" sizeBytes={5242880} />);
    const container = screen.getByTestId('attachment-audio-preview');
    const audio = container.querySelector('audio')!;

    // Trigger error chain: direct -> blob -> error
    fireEvent.error(audio);

    await waitFor(() => {
      expect(screen.getByText('Failed to load audio')).toBeInTheDocument();
    });

    expect(screen.getByText(/Download/)).toBeInTheDocument();
    expect(screen.getByText(/5\.0 MB/)).toBeInTheDocument();
  });

  it('shows music icon when no poster', () => {
    render(<StreamingAudioPlayer attachmentId="aud-1" />);
    const container = screen.getByTestId('attachment-audio-preview');
    // Music icon is rendered as an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByTestId('audio-waveform')).not.toBeInTheDocument();
  });

  it('shows waveform image when posterUrl is provided', () => {
    render(<StreamingAudioPlayer attachmentId="aud-1" posterUrl="http://test/api/v1/attachments/aud-1/thumbnail" />);
    const waveform = screen.getByTestId('audio-waveform');
    expect(waveform).toBeInTheDocument();
    expect(waveform).toHaveAttribute('src', 'http://test/api/v1/attachments/aud-1/thumbnail');
    // Music icon should not be shown
    const container = screen.getByTestId('attachment-audio-preview');
    expect(container.querySelector('svg.lucide-music')).not.toBeInTheDocument();
  });

  it('saves playback position on pause', () => {
    render(<StreamingAudioPlayer attachmentId="aud-1" />);
    const container = screen.getByTestId('attachment-audio-preview');
    const audio = container.querySelector('audio')! as HTMLAudioElement;

    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      writable: true,
      value: 15.3,
    });

    fireEvent.pause(audio);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'hotm-playback-aud-1',
      '15.3'
    );
  });
});
