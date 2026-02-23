/**
 * MiniPlayer — Small floating video/audio player panel.
 *
 * Video: 280×210px with video frame, seek bar, and compact controls.
 * Audio: 280×68px with filename, controls, and seek bar.
 *
 * Controls always visible (no auto-hide — user is working, not watching).
 * Drag handle on the title bar. Snap to corners on release.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  GripHorizontal,
  Music,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaPlayer, type MediaSessionInfo } from './PlayerContext';
import { usePlayerPosition } from './usePlayerPosition';
import { api } from '@/api';

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

const VIDEO_WIDTH = 280;
const VIDEO_HEIGHT = 210;
const AUDIO_WIDTH = 280;
const AUDIO_HEIGHT = 68;

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

interface MiniPlayerProps {
  session: MediaSessionInfo;
}

export function MiniPlayer({ session }: MiniPlayerProps) {
  const { endSession, setState, initialTime } = useMediaPlayer();
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(session.blobUrl ?? null);
  const [mode, setMode] = useState<'direct' | 'blob'>(session.blobUrl ? 'blob' : 'direct');

  const isVideo = session.mediaType === 'video';
  const width = isVideo ? VIDEO_WIDTH : AUDIO_WIDTH;
  const height = isVideo ? VIDEO_HEIGHT : AUDIO_HEIGHT;

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

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = mediaRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = frac * duration;
  }, [duration]);

  const playedFrac = duration > 0 ? currentTime / duration : 0;

  // Expose mediaRef to keyboard hook via context
  // (handled by the parent PersistentPlayerOverlay)

  return (
    <div
      className={cn(
        'fixed z-[1000] shadow-2xl rounded-lg overflow-hidden bg-background border border-border',
        isSnapping && 'transition-transform duration-200 ease-out',
        isDragging && 'cursor-grabbing',
      )}
      style={{
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
        /* ─── Video Mini Player ─── */
        <>
          {/* Title bar / drag handle */}
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

          {/* Video frame */}
          <div className="relative bg-black" style={{ height: 158 }}>
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
              data-testid="mini-player-video"
            />
          </div>

          {/* Seek bar */}
          <div
            className="h-1 bg-muted/30 cursor-pointer"
            onClick={handleSeek}
            data-testid="mini-player-seek"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${playedFrac * 100}%` }}
            />
          </div>

          {/* Controls bar — 32px */}
          <div className="flex items-center h-8 px-1.5 gap-0.5 bg-muted/50">
            <button type="button" className="p-1 rounded hover:bg-accent" onClick={togglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button type="button" className="p-1 rounded hover:bg-accent" onClick={skipBack} aria-label="Skip back 10 seconds">
              <SkipBack className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground px-1 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <button type="button" className="p-1 rounded hover:bg-accent" onClick={skipForward} aria-label="Skip forward 10 seconds">
              <SkipForward className="w-3 h-3" />
            </button>
            <div className="flex-1" />
            <button type="button" className="p-1 rounded hover:bg-accent" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </button>
            <button type="button" className="p-1 rounded hover:bg-accent" onClick={() => setState('EXPANDED')} aria-label="Expand player">
              <Maximize2 className="w-3 h-3" />
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
            <button type="button" className="p-0.5 rounded hover:bg-accent" onClick={() => setState('EXPANDED')} aria-label="Expand player">
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
            className="h-1 bg-muted/30 cursor-pointer"
            onClick={handleSeek}
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
