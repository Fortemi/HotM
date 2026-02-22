/**
 * Streaming Media Components
 *
 * Video and audio players that use direct API URLs for native browser
 * streaming with Range request support. The Fortemi download endpoint
 * returns Accept-Ranges: bytes, so the browser handles progressive
 * buffering and seeking natively.
 *
 * Falls back to blob download via the API client when direct URL
 * playback fails (e.g. when memory routing headers are required).
 *
 * Features:
 * - Loading skeleton during initialization
 * - Buffering overlay when playback stalls
 * - Error recovery with exponential backoff (up to 3 retries)
 * - Playback position persistence via localStorage
 * - Keyboard shortcuts when player is focused
 * - Download fallback when playback fails
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Music, Loader2, AlertCircle, RefreshCw, Download, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { getActiveMemory } from '@/api/memory-context';
import type { TranscriptSegment } from './subtitle-utils';
import { createVttBlobUrl } from './subtitle-utils';
import { TranscriptPanel } from './TranscriptPanel';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type PlaybackMode = 'direct' | 'blob' | 'error';

const POSITION_SAVE_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Playback position persistence
// ---------------------------------------------------------------------------

function getStorageKey(attachmentId: string): string {
  return `hotm-playback-${attachmentId}`;
}

function savePlaybackPosition(attachmentId: string, time: number): void {
  try {
    localStorage.setItem(getStorageKey(attachmentId), String(time));
  } catch {
    // localStorage may be full or unavailable
  }
}

function loadPlaybackPosition(attachmentId: string): number | null {
  try {
    const saved = localStorage.getItem(getStorageKey(attachmentId));
    if (saved) {
      const parsed = parseFloat(saved);
      return isFinite(parsed) ? parsed : null;
    }
  } catch {
    // ignore
  }
  return null;
}

function clearPlaybackPosition(attachmentId: string): void {
  try {
    localStorage.removeItem(getStorageKey(attachmentId));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// StreamingVideoPlayer
// ---------------------------------------------------------------------------

interface StreamingVideoPlayerProps {
  attachmentId: string;
  className?: string;
  /** Optional poster image URL (e.g. thumbnail from API) */
  posterUrl?: string;
  /** Optional file size for download fallback display */
  sizeBytes?: number;
  /** Transcript segments for subtitle track and interactive transcript */
  transcriptSegments?: TranscriptSegment[];
  /** Attachment filename (used for subtitle download naming) */
  filename?: string;
  /** Server-side subtitle URL (e.g. from /attachments/:id/subtitles endpoint) */
  subtitleUrl?: string;
  /** Preferred media variant (e.g. 'web_compatible', 'faststart', 'preview_720p') */
  variant?: string;
}

export function StreamingVideoPlayer({
  attachmentId,
  className,
  posterUrl,
  sizeBytes,
  transcriptSegments,
  filename,
  subtitleUrl,
  variant,
}: StreamingVideoPlayerProps) {
  const [mode, setMode] = useState<PlaybackMode>('direct');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<
    'loading' | 'ready' | 'buffering' | 'error'
  >('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownPositionRef = useRef(0);

  const directUrl = api.attachments.getDownloadUrl(attachmentId, variant);
  const downloadUrl = api.attachments.getDownloadUrl(attachmentId);

  const activeMemory = getActiveMemory();
  const startWithBlob = !!activeMemory;

  // ---- VTT blob URL for subtitle track ----
  const vttBlobUrl = useMemo(() => {
    if (!transcriptSegments || transcriptSegments.length === 0) return null;
    return createVttBlobUrl(transcriptSegments);
  }, [transcriptSegments]);

  useEffect(() => {
    return () => {
      if (vttBlobUrl) URL.revokeObjectURL(vttBlobUrl);
    };
  }, [vttBlobUrl]);

  const hasTranscript = !!transcriptSegments && transcriptSegments.length > 0;

  // ---- Time tracking for transcript sync ----
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  }, []);

  const handleTranscriptSeek = useCallback((timeSecs: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = timeSecs;
      setCurrentTime(timeSecs);
    }
  }, []);

  // ---- Memory routing: skip direct URL if memory headers needed ----
  useEffect(() => {
    if (startWithBlob) {
      setMode('blob');
    }
  }, [startWithBlob]);

  // ---- Blob fallback download ----
  useEffect(() => {
    if (mode !== 'blob') return;
    let revoked = false;
    let currentUrl: string | null = null;

    api.attachments
      .downloadAttachment(attachmentId)
      .then((blob) => {
        if (revoked) return;
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      })
      .catch((err) => {
        if (revoked) return;
        console.error('Video blob download failed:', err);
        setPlaybackState('error');
        setMode('error');
      });

    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachmentId, mode]);

  // ---- Playback position persistence ----
  useEffect(() => {
    // Start periodic save when video is playing
    return () => {
      if (positionTimerRef.current) {
        clearInterval(positionTimerRef.current);
      }
    };
  }, []);

  const startPositionSaving = useCallback(() => {
    if (positionTimerRef.current) return;
    positionTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && isFinite(video.currentTime)) {
        lastKnownPositionRef.current = video.currentTime;
        savePlaybackPosition(attachmentId, video.currentTime);
      }
    }, POSITION_SAVE_INTERVAL_MS);
  }, [attachmentId]);

  const stopPositionSaving = useCallback(() => {
    if (positionTimerRef.current) {
      clearInterval(positionTimerRef.current);
      positionTimerRef.current = null;
    }
  }, []);

  // ---- Restore position on load ----
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration);

    const savedPosition = loadPlaybackPosition(attachmentId);
    if (savedPosition && savedPosition > 1 && savedPosition < video.duration - 2) {
      video.currentTime = savedPosition;
    }
  }, [attachmentId]);

  // ---- Video event handlers ----
  const handleCanPlay = useCallback(() => {
    setPlaybackState('ready');
    setRetryCount(0);
  }, []);

  const handleWaiting = useCallback(() => {
    setPlaybackState('buffering');
  }, []);

  const handlePlaying = useCallback(() => {
    setPlaybackState('ready');
    startPositionSaving();
  }, [startPositionSaving]);

  const handlePause = useCallback(() => {
    stopPositionSaving();
    // Save position on pause
    const video = videoRef.current;
    if (video && isFinite(video.currentTime)) {
      savePlaybackPosition(attachmentId, video.currentTime);
    }
  }, [attachmentId, stopPositionSaving]);

  const handleEnded = useCallback(() => {
    stopPositionSaving();
    clearPlaybackPosition(attachmentId);
  }, [attachmentId, stopPositionSaving]);

  // ---- Error recovery with exponential backoff ----
  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const error = video?.error;

    // Save last known position for recovery
    if (video && isFinite(video.currentTime) && video.currentTime > 0) {
      lastKnownPositionRef.current = video.currentTime;
      savePlaybackPosition(attachmentId, video.currentTime);
    }

    if (mode === 'direct') {
      // Direct URL failed — try blob fallback
      console.warn('Direct video URL failed, falling back to blob download');
      setMode('blob');
      return;
    }

    // Network error with retries remaining
    if (error?.code === MediaError.MEDIA_ERR_NETWORK && retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.warn(`Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      setPlaybackState('buffering');

      retryTimerRef.current = setTimeout(() => {
        if (video) {
          video.load();
          // Restore position after reload
          const savedPos = lastKnownPositionRef.current;
          if (savedPos > 0) {
            video.addEventListener('loadedmetadata', () => {
              video.currentTime = savedPos;
            }, { once: true });
          }
        }
        setRetryCount((c) => c + 1);
      }, delay);
      return;
    }

    // Non-recoverable error or retries exhausted
    setPlaybackState('error');
    setMode('error');
  }, [attachmentId, mode, retryCount]);

  // Cleanup retry timer
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // ---- Manual retry ----
  const handleRetry = useCallback(() => {
    setBlobUrl(null);
    setRetryCount(0);
    setPlaybackState('loading');
    setMode(startWithBlob ? 'blob' : 'direct');
  }, [startWithBlob]);

  // ---- Keyboard shortcuts ----
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;

    // Don't intercept if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        if (video.paused) video.play();
        else video.pause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 5);
        break;
      case 'j':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case 'l':
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;
      case 'f':
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          containerRef.current?.requestFullscreen();
        }
        break;
      case 'm':
        e.preventDefault();
        video.muted = !video.muted;
        break;
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        e.preventDefault();
        if (isFinite(video.duration)) {
          video.currentTime = video.duration * (parseInt(e.key) / 10);
        }
        break;
    }
  }, []);

  // ---- Error state with download fallback ----
  if (mode === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-[400px] rounded border bg-muted/20 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Failed to load video</p>
        {retryCount >= MAX_RETRIES && (
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            Network error after {MAX_RETRIES} retries. Try downloading the file directly.
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
          <a href={downloadUrl} download>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download{sizeBytes ? ` (${formatFileSize(sizeBytes)})` : ''}
            </Button>
          </a>
        </div>
      </div>
    );
  }

  // ---- Blob loading state ----
  if (mode === 'blob' && !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-[400px] rounded border bg-muted/10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading video...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative group"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="video-player-container"
    >
      {/* Buffering overlay */}
      {playbackState === 'buffering' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 pointer-events-none rounded">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}

      {/* Loading skeleton before metadata loads */}
      {playbackState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10 pointer-events-none rounded">
          <div className="flex flex-col items-center gap-2">
            <Video className="h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-xs text-muted-foreground">Loading video...</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={mode === 'direct' ? directUrl : (blobUrl ?? undefined)}
        controls
        preload="metadata"
        poster={posterUrl}
        crossOrigin={posterUrl || subtitleUrl ? 'anonymous' : undefined}
        className={className ?? 'w-full max-h-[500px] rounded border bg-black'}
        data-testid="attachment-video-preview"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleVideoError}
        onTimeUpdate={handleTimeUpdate}
      >
        {(subtitleUrl || vttBlobUrl) && (
          <track
            kind="subtitles"
            src={subtitleUrl ?? vttBlobUrl!}
            srcLang="en"
            label="English"
            default
            data-testid="subtitle-track"
          />
        )}
        Your browser does not support video playback.
      </video>

      {/* Duration badge (top-right, shown on hover when ready) */}
      {duration && playbackState === 'ready' && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {formatDuration(duration)}
        </div>
      )}

      {/* Keyboard hints (bottom, shown briefly on focus) */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[10px] px-2 py-1 rounded opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        Space: play/pause &middot; J/L: &plusmn;10s &middot; F: fullscreen &middot; M: mute
      </div>

      {/* Interactive transcript panel */}
      {hasTranscript && (
        <TranscriptPanel
          segments={transcriptSegments!}
          currentTime={currentTime}
          onSeek={handleTranscriptSeek}
          filename={filename}
          className="mt-2"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StreamingAudioPlayer
// ---------------------------------------------------------------------------

interface StreamingAudioPlayerProps {
  attachmentId: string;
  className?: string;
  /** Optional file size for download fallback display */
  sizeBytes?: number;
  /** Optional waveform/poster image URL (e.g. from thumbnail API) */
  posterUrl?: string;
  /** Preferred media variant (e.g. 'web_audio', 'audio_preview') */
  variant?: string;
}

export function StreamingAudioPlayer({
  attachmentId,
  className,
  sizeBytes,
  posterUrl,
  variant,
}: StreamingAudioPlayerProps) {
  const [mode, setMode] = useState<PlaybackMode>('direct');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownPositionRef = useRef(0);

  const directUrl = api.attachments.getDownloadUrl(attachmentId, variant);
  const downloadUrl = api.attachments.getDownloadUrl(attachmentId);

  const activeMemory = getActiveMemory();
  const startWithBlob = !!activeMemory;

  useEffect(() => {
    if (startWithBlob) {
      setMode('blob');
    }
  }, [startWithBlob]);

  useEffect(() => {
    if (mode !== 'blob') return;
    let revoked = false;
    let currentUrl: string | null = null;

    api.attachments
      .downloadAttachment(attachmentId)
      .then((blob) => {
        if (revoked) return;
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      })
      .catch((err) => {
        if (revoked) return;
        console.error('Audio blob download failed:', err);
        setMode('error');
      });

    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachmentId, mode]);

  // ---- Playback position persistence ----
  useEffect(() => {
    return () => {
      if (positionTimerRef.current) clearInterval(positionTimerRef.current);
    };
  }, []);

  const handlePlaying = useCallback(() => {
    if (positionTimerRef.current) return;
    positionTimerRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (audio && !audio.paused && isFinite(audio.currentTime)) {
        lastKnownPositionRef.current = audio.currentTime;
        savePlaybackPosition(attachmentId, audio.currentTime);
      }
    }, POSITION_SAVE_INTERVAL_MS);
  }, [attachmentId]);

  const handlePause = useCallback(() => {
    if (positionTimerRef.current) {
      clearInterval(positionTimerRef.current);
      positionTimerRef.current = null;
    }
    const audio = audioRef.current;
    if (audio && isFinite(audio.currentTime)) {
      savePlaybackPosition(attachmentId, audio.currentTime);
    }
  }, [attachmentId]);

  const handleEnded = useCallback(() => {
    if (positionTimerRef.current) {
      clearInterval(positionTimerRef.current);
      positionTimerRef.current = null;
    }
    clearPlaybackPosition(attachmentId);
  }, [attachmentId]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const savedPosition = loadPlaybackPosition(attachmentId);
    if (savedPosition && savedPosition > 1 && savedPosition < audio.duration - 2) {
      audio.currentTime = savedPosition;
    }
  }, [attachmentId]);

  // ---- Error recovery ----
  const handleAudioError = useCallback(() => {
    const audio = audioRef.current;

    if (audio && isFinite(audio.currentTime) && audio.currentTime > 0) {
      lastKnownPositionRef.current = audio.currentTime;
      savePlaybackPosition(attachmentId, audio.currentTime);
    }

    if (mode === 'direct') {
      console.warn('Direct audio URL failed, falling back to blob download');
      setMode('blob');
      return;
    }

    if (audio?.error?.code === MediaError.MEDIA_ERR_NETWORK && retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      retryTimerRef.current = setTimeout(() => {
        if (audio) {
          audio.load();
          const savedPos = lastKnownPositionRef.current;
          if (savedPos > 0) {
            audio.addEventListener('loadedmetadata', () => {
              audio.currentTime = savedPos;
            }, { once: true });
          }
        }
        setRetryCount((c) => c + 1);
      }, delay);
      return;
    }

    setMode('error');
  }, [attachmentId, mode, retryCount]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const handleRetry = useCallback(() => {
    setBlobUrl(null);
    setRetryCount(0);
    setMode(startWithBlob ? 'blob' : 'direct');
  }, [startWithBlob]);

  if (mode === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-[120px] rounded border bg-muted/20 text-muted-foreground">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium">Failed to load audio</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
          <a href={downloadUrl} download>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download{sizeBytes ? ` (${formatFileSize(sizeBytes)})` : ''}
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (mode === 'blob' && !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-[120px] rounded border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading audio...</p>
      </div>
    );
  }

  return (
    <div className={className ?? 'flex flex-col items-center gap-4 py-8'} data-testid="attachment-audio-preview">
      {posterUrl ? (
        <img
          src={posterUrl}
          alt="Audio waveform"
          className="w-full max-w-md h-[120px] object-contain rounded border bg-muted/10"
          loading="lazy"
          data-testid="audio-waveform"
        />
      ) : (
        <Music className="w-16 h-16 text-muted-foreground" />
      )}
      <audio
        ref={audioRef}
        src={mode === 'direct' ? directUrl : (blobUrl ?? undefined)}
        controls
        preload="metadata"
        className="w-full max-w-md"
        onLoadedMetadata={handleLoadedMetadata}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleAudioError}
      >
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}

// Re-export format helpers for use by other components
export { formatFileSize, formatDuration };
