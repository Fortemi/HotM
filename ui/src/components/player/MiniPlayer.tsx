/**
 * MiniPlayer — Small floating video/audio player panel.
 *
 * Video: 280×210px with video frame, seek bar, and compact controls.
 * Audio: 280×68px with filename, controls, and seek bar.
 *
 * Controls always visible (no auto-hide — user is working, not watching).
 * Drag handle on the title bar. Snap to corners on release.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  GripHorizontal,
  Music,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaPlayer, type MediaSessionInfo } from './PlayerContext';
import { usePlayerPosition } from './usePlayerPosition';
import { api } from '@/api';
import { ThumbnailPreview } from '@/components/attachments/ThumbnailPreview';
import { parseThumbnailVtt, getCueForTime, type ThumbnailCue } from '@/components/attachments/thumbnail-vtt';
import { getActiveMemory, getMemoryRoutingHeaderName } from '@/api/memory-context';

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

const VIDEO_WIDTH = 280;
const VIDEO_HEIGHT = 210;
const AUDIO_WIDTH = 280;
const AUDIO_HEIGHT = 68;

const EXPANDED_VIDEO_WIDTH = 480;
const EXPANDED_VIDEO_HEIGHT = 398;
const EXPANDED_AUDIO_WIDTH = 400;
const EXPANDED_AUDIO_HEIGHT = 80;

// ---------------------------------------------------------------------------
// Time formatter
// ---------------------------------------------------------------------------

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type PlayerVariant = 'mini' | 'expanded';

interface MiniPlayerProps {
  session: MediaSessionInfo;
  mediaRef: React.RefObject<HTMLVideoElement & HTMLAudioElement | null>;
  variant?: PlayerVariant;
}

export function MiniPlayer({ session, mediaRef, variant = 'mini' }: MiniPlayerProps) {
  const { endSession, setState, initialTime } = useMediaPlayer();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(session.blobUrl ?? null);
  const [mode, setMode] = useState<'direct' | 'blob'>(session.blobUrl ? 'blob' : 'direct');

  // Container ref for fullscreen on the whole player (not just <video>)
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Thumbnail preview state
  const seekBarRef = useRef<HTMLDivElement>(null);
  const [thumbnailCues, setThumbnailCues] = useState<ThumbnailCue[] | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPositionX, setHoverPositionX] = useState<number | null>(null);
  const [seekBarWidth, setSeekBarWidth] = useState(0);

  const isVideo = session.mediaType === 'video';
  const isMini = variant === 'mini';
  const width = isVideo
    ? (isMini ? VIDEO_WIDTH : EXPANDED_VIDEO_WIDTH)
    : (isMini ? AUDIO_WIDTH : EXPANDED_AUDIO_WIDTH);
  const height = isVideo
    ? (isMini ? VIDEO_HEIGHT : EXPANDED_VIDEO_HEIGHT)
    : (isMini ? AUDIO_HEIGHT : EXPANDED_AUDIO_HEIGHT);

  const { position, isDragging, isSnapping, handleDragStart } = usePlayerPosition({
    width,
    height,
    enabled: true,
  });

  // Compute media URL
  const directUrl = session.directUrl;
  const mediaSrc = mode === 'blob' ? (blobUrl ?? undefined) : directUrl;

  // Blob fallback if direct fails
  const handleMediaError = useCallback(() => {
    if (mode === 'direct') {
      // Try blob fallback
      setMode('blob');
    }
  }, [mode]);

  // Download blob when entering blob mode (if we don't already have one)
  useEffect(() => {
    if (mode !== 'blob' || blobUrl) return;
    let revoked = false;
    let url: string | null = null;

    api.attachments
      .downloadAttachment(session.attachmentId, session.variant)
      .catch(() => api.attachments.downloadAttachment(session.attachmentId))
      .then((blob) => {
        if (revoked) return;
        const mimePrefix = isVideo ? 'video/' : 'audio/';
        const typed = blob.type.startsWith(mimePrefix)
          ? blob
          : new Blob([blob], { type: isVideo ? 'video/mp4' : 'audio/mpeg' });
        url = URL.createObjectURL(typed);
        setBlobUrl(url);
      })
      .catch(() => {
        // Give up silently — player will show no source
      });

    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mode, blobUrl, session.attachmentId, session.variant, isVideo]);

  // Fetch thumbnail VTT for seek preview (video only)
  useEffect(() => {
    if (!isVideo) return;
    let cancelled = false;
    const vttUrl = api.attachments.getThumbnailVttUrl(session.attachmentId);
    const headers: HeadersInit = {};
    const mem = getActiveMemory();
    if (mem) headers[getMemoryRoutingHeaderName()] = mem;

    fetch(vttUrl, { headers })
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const cues = parseThumbnailVtt(text);
        if (cues.length > 0) setThumbnailCues(cues);
      })
      .catch(() => {/* thumbnail VTT not available */});
    return () => { cancelled = true; };
  }, [session.attachmentId, isVideo]);

  // Track seek bar width for thumbnail clamping
  useEffect(() => {
    const el = seekBarRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setSeekBarWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activeThumbnailCue = thumbnailCues && hoverTime !== null
    ? getCueForTime(thumbnailCues, hoverTime) ?? null
    : null;

  // Seek to initial time once metadata loads
  const handleLoadedMetadata = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    setDuration(el.duration);
    if (initialTime > 0 && initialTime < el.duration - 1) {
      el.currentTime = initialTime;
    }
    // Auto-play after pop-out
    el.play().catch(() => {/* autoplay may be blocked */});
  }, [initialTime]);

  const handleTimeUpdate = useCallback(() => {
    const el = mediaRef.current;
    if (el) setCurrentTime(el.currentTime);
  }, []);

  const togglePlayPause = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  }, []);

  const skipBack = useCallback(() => {
    const el = mediaRef.current;
    if (el) el.currentTime = Math.max(0, el.currentTime - 10);
  }, []);

  const skipForward = useCallback(() => {
    const el = mediaRef.current;
    if (el) el.currentTime = Math.min(el.duration || 0, el.currentTime + 10);
  }, []);

  const toggleMute = useCallback(() => {
    const el = mediaRef.current;
    if (el) {
      el.muted = !el.muted;
      setIsMuted(el.muted);
    }
  }, []);

  const goFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const handleExpand = useCallback(() => {
    if (isMini) setState('EXPANDED');
    else goFullscreen();
  }, [isMini, setState, goFullscreen]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = mediaRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = frac * duration;
  }, [duration]);

  const handleSeekHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(frac * duration);
    setHoverPositionX(e.clientX - rect.left);
  }, [duration]);

  const handleSeekLeave = useCallback(() => {
    setHoverTime(null);
    setHoverPositionX(null);
  }, []);

  const playedFrac = duration > 0 ? currentTime / duration : 0;

  // Expose mediaRef to keyboard hook via context
  // (handled by the parent PersistentPlayerOverlay)

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-hidden bg-background',
        isFullscreen
          ? 'w-screen h-screen flex flex-col bg-black'
          : 'fixed z-[1000] shadow-2xl rounded-lg border border-border',
        !isFullscreen && isSnapping && 'transition-transform duration-200 ease-out',
        !isFullscreen && isDragging && 'cursor-grabbing',
      )}
      style={isFullscreen ? undefined : {
        width,
        height,
        left: position.x,
        top: position.y,
        ...(isSnapping && !isDragging
          ? { transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1), top 200ms cubic-bezier(0.4, 0, 0.2, 1)' }
          : {}),
      }}
      role="region"
      aria-label={`Media player: ${session.filename}`}
      data-testid="mini-player"
    >
      {isVideo ? (
        /* ─── Video Player ─── */
        <>
          {/* Title bar / drag handle — hidden in fullscreen */}
          {!isFullscreen && (
            <div
              className="flex items-center h-5 px-2 bg-muted/80 cursor-grab select-none"
              onPointerDown={handleDragStart}
            >
              <GripHorizontal className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="flex-1 text-[10px] text-muted-foreground truncate ml-1">
                {session.filename}
              </span>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                onClick={endSession}
                aria-label="Close player"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Video frame */}
          <div
            className={cn('relative bg-black', isFullscreen && 'flex-1')}
            style={isFullscreen ? undefined : { height: isMini ? 158 : 346 }}
          >
            <video
              ref={mediaRef}
              src={mediaSrc}
              poster={session.posterUrl}
              className="w-full h-full object-contain bg-black"
              preload="metadata"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlaying={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={endSession}
              onError={handleMediaError}
              onClick={togglePlayPause}
              onDoubleClick={isFullscreen ? exitFullscreen : goFullscreen}
              data-testid="mini-player-video"
            />
          </div>

          {/* Seek bar with thumbnail preview */}
          <div
            ref={seekBarRef}
            className={cn(
              'relative bg-muted/30 cursor-pointer group/miniSeek',
              isFullscreen ? 'h-1.5' : 'h-1',
            )}
            onClick={handleSeek}
            onMouseMove={handleSeekHover}
            onMouseLeave={handleSeekLeave}
            data-testid="mini-player-seek"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${playedFrac * 100}%` }}
            />
            {isVideo && hoverTime !== null && (
              <ThumbnailPreview
                cue={activeThumbnailCue}
                hoverTime={hoverTime}
                hoverPositionX={hoverPositionX}
                seekBarWidth={seekBarWidth}
              />
            )}
          </div>

          {/* Controls bar */}
          <div className={cn(
            'flex items-center gap-0.5',
            isFullscreen
              ? 'h-10 px-4 gap-1 bg-black/80 text-white'
              : 'h-8 px-1.5 bg-muted/50',
          )}>
            <button type="button" className={cn('rounded hover:bg-accent', isFullscreen ? 'p-2 hover:bg-white/10' : 'p-1')} onClick={togglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause className={isFullscreen ? 'w-5 h-5' : 'w-3.5 h-3.5'} /> : <Play className={isFullscreen ? 'w-5 h-5' : 'w-3.5 h-3.5'} />}
            </button>
            <button type="button" className={cn('rounded hover:bg-accent', isFullscreen ? 'p-2 hover:bg-white/10' : 'p-1')} onClick={skipBack} aria-label="Skip back 10 seconds">
              <SkipBack className={isFullscreen ? 'w-4 h-4' : 'w-3 h-3'} />
            </button>
            <span className={cn(
              'font-mono tabular-nums select-none px-1',
              isFullscreen ? 'text-xs text-white/80' : 'text-[10px] text-muted-foreground',
            )}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <button type="button" className={cn('rounded hover:bg-accent', isFullscreen ? 'p-2 hover:bg-white/10' : 'p-1')} onClick={skipForward} aria-label="Skip forward 10 seconds">
              <SkipForward className={isFullscreen ? 'w-4 h-4' : 'w-3 h-3'} />
            </button>
            <div className="flex-1" />
            <button type="button" className={cn('rounded hover:bg-accent', isFullscreen ? 'p-2 hover:bg-white/10' : 'p-1')} onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX className={isFullscreen ? 'w-4 h-4' : 'w-3 h-3'} /> : <Volume2 className={isFullscreen ? 'w-4 h-4' : 'w-3 h-3'} />}
            </button>
            {!isMini && !isFullscreen && (
              <button type="button" className="p-1 rounded hover:bg-accent" onClick={() => setState('MINI')} aria-label="Minimize">
                <Minimize2 className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              className={cn('rounded hover:bg-accent', isFullscreen ? 'p-2 hover:bg-white/10' : 'p-1')}
              onClick={isFullscreen ? exitFullscreen : handleExpand}
              aria-label={isFullscreen ? 'Exit fullscreen' : (isMini ? 'Expand player' : 'Fullscreen')}
            >
              {isFullscreen
                ? <Minimize2 className="w-4 h-4" />
                : <Maximize2 className={isFullscreen ? 'w-4 h-4' : 'w-3 h-3'} />
              }
            </button>
          </div>
        </>
      ) : (
        /* ─── Audio Mini Player ─── */
        <>
          {/* Row 1: icon + title + expand + close */}
          <div
            className="flex items-center h-11 px-2 gap-1.5 bg-muted/50 cursor-grab select-none"
            onPointerDown={handleDragStart}
          >
            <Music className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-xs font-medium truncate">
              {session.filename}
            </span>
            {!isMini && (
              <button type="button" className="p-0.5 rounded hover:bg-accent" onClick={() => setState('MINI')} aria-label="Minimize">
                <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
            <button type="button" className="p-0.5 rounded hover:bg-accent" onClick={handleExpand} aria-label={isMini ? 'Expand player' : 'Fullscreen'}>
              <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
              onClick={endSession}
              aria-label="Close player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 2: controls */}
          <div className="flex items-center h-5 px-2 gap-0.5">
            <button type="button" className="p-0.5 rounded hover:bg-accent" onClick={togglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button type="button" className="p-0.5 rounded hover:bg-accent" onClick={skipBack} aria-label="Skip back 10 seconds">
              <SkipBack className="w-2.5 h-2.5" />
            </button>
            <span className="text-[9px] font-mono tabular-nums text-muted-foreground px-0.5 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <button type="button" className="p-0.5 rounded hover:bg-accent" onClick={skipForward} aria-label="Skip forward 10 seconds">
              <SkipForward className="w-2.5 h-2.5" />
            </button>
            <div className="flex-1" />
            <button type="button" className="p-0.5 rounded hover:bg-accent" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
            </button>
          </div>

          {/* Seek bar */}
          <div
            className="relative h-1 bg-muted/30 cursor-pointer"
            onClick={handleSeek}
            onMouseMove={handleSeekHover}
            onMouseLeave={handleSeekLeave}
            data-testid="mini-player-seek"
          >
            <div className="h-full bg-primary" style={{ width: `${playedFrac * 100}%` }} />
          </div>

          {/* Hidden audio element */}
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={mediaSrc}
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlaying={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={endSession}
            onError={handleMediaError}
            data-testid="mini-player-audio"
          />
        </>
      )}
    </div>
  );
}

// Export dimensions for use by the overlay and position hook
export { VIDEO_WIDTH, VIDEO_HEIGHT, AUDIO_WIDTH, AUDIO_HEIGHT };
