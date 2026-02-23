/**
 * VideoControls — Custom video player controls overlay.
 *
 * Replaces native <video controls> with a YouTube/Netflix-style control bar
 * that supports hover time tracking on the seek bar for future thumbnail
 * preview integration.
 *
 * Features:
 * - Play/pause, skip ±10s
 * - SeekBar with buffer visualization and drag-to-seek
 * - Current time / duration display
 * - Volume slider with mute toggle
 * - Caption toggle (when available)
 * - Fullscreen toggle
 * - Auto-hide during playback (reappear on mouse/keyboard activity)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Subtitles,
  PictureInPicture2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeekBar } from './SeekBar';

const AUTO_HIDE_DELAY_MS = 3000;

export interface VideoControlsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  buffered: TimeRanges | null;
  showCaptions: boolean;
  hasCaptions: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
  onCaptionToggle: () => void;
  /** Callback when hovering over seek bar — time in seconds, null on leave */
  onHoverTime?: (time: number | null) => void;
  /** Callback for hover pixel position relative to seek bar */
  onHoverPosition?: (x: number | null) => void;
  /** Content rendered inside the seek bar (e.g. ThumbnailPreview) */
  seekBarChildren?: React.ReactNode;
  /** Callback to pop out the player into the persistent mini player */
  onPopOut?: () => void;
}

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VideoControls({
  containerRef,
  duration,
  currentTime,
  isPlaying,
  volume,
  isMuted,
  isFullscreen,
  buffered,
  showCaptions,
  hasCaptions,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreenToggle,
  onCaptionToggle,
  onHoverTime,
  onHoverPosition,
  seekBarChildren,
  onPopOut,
}: VideoControlsProps) {
  const [visible, setVisible] = useState(true);
  const [volumeExpanded, setVolumeExpanded] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  // ---- Auto-hide logic ----
  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_DELAY_MS);
    }
  }, [isPlaying]);

  // Show controls when paused
  useEffect(() => {
    if (!isPlaying) {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      resetHideTimer();
    }
  }, [isPlaying, resetHideTimer]);

  // Mouse/keyboard activity on the container shows controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const show = () => resetHideTimer();
    container.addEventListener('mousemove', show);
    container.addEventListener('keydown', show);
    return () => {
      container.removeEventListener('mousemove', show);
      container.removeEventListener('keydown', show);
    };
  }, [containerRef, resetHideTimer]);

  // Keep visible while hovering over the control bar itself
  const handleControlsEnter = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setVisible(true);
  }, []);

  const handleControlsLeave = useCallback(() => {
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_DELAY_MS);
    }
  }, [isPlaying]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) onPause();
    else onPlay();
  }, [isPlaying, onPlay, onPause]);

  const handleSkipBack = useCallback(() => {
    onSeek(Math.max(0, currentTime - 10));
  }, [currentTime, onSeek]);

  const handleSkipForward = useCallback(() => {
    onSeek(Math.min(duration, currentTime + 10));
  }, [currentTime, duration, onSeek]);

  const handleVolumeInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onVolumeChange(parseFloat(e.target.value));
    },
    [onVolumeChange],
  );

  return (
    <div
      ref={controlsRef}
      className={cn(
        'absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      onMouseEnter={handleControlsEnter}
      onMouseLeave={handleControlsLeave}
      data-testid="video-controls"
    >
      {/* Gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      <div className="relative px-3 pb-2 pt-8">
        {/* Seek bar */}
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          onSeek={onSeek}
          onHoverTime={onHoverTime}
          onHoverPosition={onHoverPosition}
          className="mb-1"
        >
          {seekBarChildren}
        </SeekBar>

        {/* Button row */}
        <div className="flex items-center gap-1 text-white">
          {/* Play/Pause */}
          <button
            type="button"
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            data-testid="controls-play-pause"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          {/* Skip back */}
          <button
            type="button"
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={handleSkipBack}
            aria-label="Skip back 10 seconds"
            data-testid="controls-skip-back"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Skip forward */}
          <button
            type="button"
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={handleSkipForward}
            aria-label="Skip forward 10 seconds"
            data-testid="controls-skip-forward"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Time display */}
          <span
            className="text-xs font-mono tabular-nums px-2 select-none"
            data-testid="controls-time-display"
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Volume group */}
          <div
            className="flex items-center gap-1"
            onMouseEnter={() => setVolumeExpanded(true)}
            onMouseLeave={() => setVolumeExpanded(false)}
          >
            <button
              type="button"
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              onClick={onMuteToggle}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              data-testid="controls-mute"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeInput}
              className={cn(
                'h-1 appearance-none bg-white/30 rounded-full accent-primary transition-all',
                volumeExpanded ? 'w-16 opacity-100' : 'w-0 opacity-0',
              )}
              aria-label="Volume"
              data-testid="controls-volume-slider"
            />
          </div>

          {/* Caption toggle */}
          {hasCaptions && (
            <button
              type="button"
              className={cn(
                'p-1.5 rounded transition-colors',
                showCaptions ? 'bg-white/20 hover:bg-white/30' : 'hover:bg-white/10',
              )}
              onClick={onCaptionToggle}
              aria-label={showCaptions ? 'Hide captions' : 'Show captions'}
              data-testid="controls-captions"
            >
              <Subtitles className="w-4 h-4" />
            </button>
          )}

          {/* Pop-out to persistent player */}
          {onPopOut && (
            <button
              type="button"
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              onClick={onPopOut}
              aria-label="Pop out player"
              title="Pop out"
              data-testid="controls-pop-out"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen toggle */}
          <button
            type="button"
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={onFullscreenToggle}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            data-testid="controls-fullscreen"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
