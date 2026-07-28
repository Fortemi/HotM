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
import { Music, Loader2, AlertCircle, RefreshCw, Download, Video, Subtitles, Activity, PictureInPicture2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import { getAuthorizationHeader, hasApiBearerToken } from '@/api/auth-context';
import { getActiveMemory, getMemoryRoutingHeaderName } from '@/api/memory-context';
import { useBlobUrl } from '@/lib/tauri';
import type { TranscriptSegment } from './subtitle-utils';
import { createVttBlobUrl, parseVttToSegments } from './subtitle-utils';
import { TranscriptPanel } from './TranscriptPanel';
import type { MediaInfo } from './media-utils';
import { useMediaStats } from './useMediaStats';
import { ExpertModeOverlay } from './ExpertModeOverlay';
import { VideoControls } from './VideoControls';
import { ThumbnailPreview } from './ThumbnailPreview';
import type { ThumbnailCue } from './thumbnail-vtt';
import { parseThumbnailVtt, getCueForTime } from './thumbnail-vtt';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type PlaybackMode = 'direct' | 'blob' | 'error';

const POSITION_SAVE_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

function shouldFetchBinaryWithHeaders(): boolean {
  return !!getActiveMemory() || hasApiBearerToken();
}

function buildBinaryResourceHeaders(): HeadersInit {
  const headers: HeadersInit = { ...getAuthorizationHeader() };
  const mem = getActiveMemory();
  if (mem) headers[getMemoryRoutingHeaderName()] = mem;
  return headers;
}

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
  /** Preferred media variant (e.g. 'web_compatible', 'faststart', 'preview_720p') */
  variant?: string;
  /** Extracted media metadata for expert mode overlay */
  mediaInfo?: MediaInfo;
  /** MIME content type for expert mode overlay */
  contentType?: string;
  /** Extraction strategy label for expert mode overlay */
  extractionStrategy?: string;
  /** Callback to pop out the player into the persistent mini player */
  onPopOut?: () => void;
}

export function StreamingVideoPlayer({
  attachmentId,
  className,
  posterUrl,
  sizeBytes,
  transcriptSegments,
  filename,
  variant,
  mediaInfo,
  contentType,
  extractionStrategy,
  onPopOut,
}: StreamingVideoPlayerProps) {
  const [mode, setMode] = useState<PlaybackMode>(() => shouldFetchBinaryWithHeaders() ? 'blob' : 'direct');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<
    'loading' | 'ready' | 'buffering' | 'error'
  >('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffered, setBuffered] = useState<TimeRanges | null>(null);

  // Expert mode stats overlay (fully inert until toggled)
  const [showExpertMode, setShowExpertMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownPositionRef = useRef(0);

  const expertStats = useMediaStats(videoRef, showExpertMode);

  const directUrl = api.attachments.getDownloadUrl(attachmentId, variant);
  const downloadUrl = api.attachments.getDownloadUrl(attachmentId);

  const startWithBlob = shouldFetchBinaryWithHeaders();
  const binaryResourceHeaders = useMemo(() => buildBinaryResourceHeaders(), [startWithBlob]);
  const resolvedPosterUrl = useBlobUrl(posterUrl, {
    forceFetch: startWithBlob,
    headers: binaryResourceHeaders,
  });

  // ---- Transcript: metadata segments or server subtitle fallback ----
  const [fetchedSegments, setFetchedSegments] = useState<TranscriptSegment[] | null>(null);
  const effectiveSegments = transcriptSegments && transcriptSegments.length > 0
    ? transcriptSegments
    : fetchedSegments;
  const hasTranscript = !!effectiveSegments && effectiveSegments.length > 0;
  const [showCaptions, setShowCaptions] = useState(true);

  useEffect(() => {
    if (transcriptSegments && transcriptSegments.length > 0) return;
    let cancelled = false;
    const subtitleUrl = api.attachments.getSubtitleUrl(attachmentId, 'vtt');
    const headers = buildBinaryResourceHeaders();

    fetch(subtitleUrl, { headers })
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const parsed = parseVttToSegments(text);
        if (parsed.length > 0) setFetchedSegments(parsed);
      })
      .catch(() => {/* subtitle endpoint not available */});
    return () => { cancelled = true; };
  }, [attachmentId, transcriptSegments]);

  // ---- VTT blob URL for subtitle track ----
  const vttBlobUrl = useMemo(() => {
    if (!effectiveSegments || effectiveSegments.length === 0) return null;
    return createVttBlobUrl(effectiveSegments);
  }, [effectiveSegments]);

  useEffect(() => {
    return () => {
      if (vttBlobUrl) URL.revokeObjectURL(vttBlobUrl);
    };
  }, [vttBlobUrl]);

  // Sync text track mode with showCaptions toggle
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = showCaptions ? 'showing' : 'hidden';
    }
  }, [showCaptions]);

  // ---- Time tracking for transcript sync ----
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
      setBuffered(video.buffered);
    }
  }, []);

  const handleTranscriptSeek = useCallback((timeSecs: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = timeSecs;
      setCurrentTime(timeSecs);
    }
  }, []);

  // ---- Custom controls handlers ----
  const handleControlPlay = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const handleControlPause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const handleControlSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleControlVolumeChange = useCallback((v: number) => {
    const video = videoRef.current;
    if (video) {
      video.volume = v;
      setVolume(v);
      if (v > 0 && isMuted) {
        video.muted = false;
        setIsMuted(false);
      }
    }
  }, [isMuted]);

  const handleControlMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  }, []);

  const handleControlFullscreenToggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }, []);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ---- Thumbnail sprite preview for seek bar ----
  const [thumbnailCues, setThumbnailCues] = useState<ThumbnailCue[] | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPositionX, setHoverPositionX] = useState<number | null>(null);
  const [seekBarWidth, setSeekBarWidth] = useState(0);

  // Fetch thumbnail VTT when player initializes
  useEffect(() => {
    let cancelled = false;
    const vttUrl = api.attachments.getThumbnailVttUrl(attachmentId);
    const headers = buildBinaryResourceHeaders();

    fetch(vttUrl, { headers })
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const cues = parseThumbnailVtt(text);
        if (cues.length > 0) setThumbnailCues(cues);
      })
      .catch(() => {/* thumbnail VTT not available — graceful degradation */});
    return () => { cancelled = true; };
  }, [attachmentId]);

  // Track seek bar width for thumbnail position clamping
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSeekBarWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const activeThumbnailCue = thumbnailCues && hoverTime !== null
    ? getCueForTime(thumbnailCues, hoverTime) ?? null
    : null;

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

    // Try variant first (web-compatible transcoded version), fall back to original
    const tryDownload = (v?: string): Promise<Blob> =>
      api.attachments.downloadAttachment(attachmentId, v).catch((err) => {
        if (v) return api.attachments.downloadAttachment(attachmentId);
        throw err;
      });

    tryDownload(variant)
      .then((blob) => {
        if (revoked) return;
        // Ensure video MIME type so the browser selects the right decoder
        const typed = blob.type.startsWith('video/')
          ? blob
          : new Blob([blob], { type: 'video/mp4' });
        currentUrl = URL.createObjectURL(typed);
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
  }, [attachmentId, mode, variant]);

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
    setIsPlaying(true);
    startPositionSaving();
  }, [startPositionSaving]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    stopPositionSaving();
    // Save position on pause
    const video = videoRef.current;
    if (video && isFinite(video.currentTime)) {
      savePlaybackPosition(attachmentId, video.currentTime);
    }
  }, [attachmentId, stopPositionSaving]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
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
        setIsMuted(video.muted);
        break;
      case 'c':
        e.preventDefault();
        setShowCaptions((prev) => !prev);
        break;
      case 'i':
        e.preventDefault();
        setShowExpertMode((prev) => !prev);
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
    <>
      <div
        ref={containerRef}
        className={cn(
          'relative group overflow-hidden',
          isFullscreen
            ? 'fixed inset-0 z-50 bg-black flex items-center justify-center'
            : 'rounded border bg-black'
        )}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        data-testid="video-player-container"
      >
        {/* Buffering overlay */}
        {playbackState === 'buffering' && (
          <div className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/30 z-10 pointer-events-none',
            !isFullscreen && 'rounded'
          )}>
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
        )}

        {/* Loading skeleton before metadata loads */}
        {playbackState === 'loading' && (
          <div className={cn(
            'absolute inset-0 flex items-center justify-center bg-muted/30 z-10 pointer-events-none',
            !isFullscreen && 'rounded'
          )}>
            <div className="flex flex-col items-center gap-2">
              <Video className="h-8 w-8 text-muted-foreground animate-pulse" />
              <p className="text-xs text-muted-foreground">Loading video...</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          src={mode === 'direct' ? directUrl : (blobUrl ?? undefined)}
          preload="metadata"
          poster={resolvedPosterUrl}
          className={className ?? cn(
            'w-full bg-black',
            isFullscreen ? 'max-h-full max-w-full object-contain' : 'max-h-[500px]'
          )}
          data-testid="attachment-video-preview"
          onClick={isPlaying ? handleControlPause : handleControlPlay}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={handleVideoError}
          onTimeUpdate={handleTimeUpdate}
        >
          {vttBlobUrl && (
            <track
              kind="subtitles"
              src={vttBlobUrl}
              srcLang="en"
              label="English"
              default={showCaptions}
              data-testid="subtitle-track"
            />
          )}
          Your browser does not support video playback.
        </video>

        {/* Custom video controls overlay */}
        <VideoControls
          containerRef={containerRef}
          duration={duration ?? 0}
          currentTime={currentTime}
          isPlaying={isPlaying}
          volume={volume}
          isMuted={isMuted}
          isFullscreen={isFullscreen}
          buffered={buffered}
          showCaptions={showCaptions}
          hasCaptions={hasTranscript}
          onPlay={handleControlPlay}
          onPause={handleControlPause}
          onSeek={handleControlSeek}
          onVolumeChange={handleControlVolumeChange}
          onMuteToggle={handleControlMuteToggle}
          onFullscreenToggle={handleControlFullscreenToggle}
          onCaptionToggle={() => setShowCaptions((prev) => !prev)}
          onHoverTime={setHoverTime}
          onHoverPosition={setHoverPositionX}
          seekBarChildren={
            <ThumbnailPreview
              cue={activeThumbnailCue}
              hoverTime={hoverTime}
              hoverPositionX={hoverPositionX}
              seekBarWidth={seekBarWidth}
            />
          }
          onPopOut={onPopOut}
        />

        {/* Expert mode toggle button (top-left, shown on hover) */}
        <button
          type="button"
          className={cn(
            'absolute top-2 left-2 flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-opacity z-10',
            showExpertMode
              ? 'bg-primary text-primary-foreground opacity-80 hover:opacity-100'
              : 'bg-black/70 text-white opacity-0 group-hover:opacity-80 hover:!opacity-100',
          )}
          onClick={() => setShowExpertMode((prev) => !prev)}
          title={showExpertMode ? 'Hide stats (I)' : 'Show stats (I)'}
          data-testid="expert-mode-toggle"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>

        {/* Expert mode overlay */}
        {showExpertMode && expertStats && (
          <ExpertModeOverlay
            stats={expertStats}
            mediaInfo={mediaInfo ?? null}
            playbackMode={mode}
            contentType={contentType}
            sizeBytes={sizeBytes}
            variant={variant}
            filename={filename}
            extractionStrategy={extractionStrategy}
            mediaType="video"
            onClose={() => setShowExpertMode(false)}
          />
        )}
      </div>

      {/* Interactive transcript panel — outside fullscreen container */}
      {hasTranscript && showCaptions && (
        <TranscriptPanel
          segments={effectiveSegments!}
          currentTime={currentTime}
          onSeek={handleTranscriptSeek}
          filename={filename}
          className="mt-2"
        />
      )}
    </>
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
  /** Transcript segments for interactive transcript panel */
  transcriptSegments?: TranscriptSegment[];
  /** Attachment filename (used for transcript download naming) */
  filename?: string;
  /** Extracted media metadata for expert mode overlay */
  mediaInfo?: MediaInfo;
  /** MIME content type for expert mode overlay */
  contentType?: string;
  /** Extraction strategy label for expert mode overlay */
  extractionStrategy?: string;
  /** Callback to pop out the player into the persistent mini player */
  onPopOut?: () => void;
}

export function StreamingAudioPlayer({
  attachmentId,
  className,
  sizeBytes,
  posterUrl,
  variant,
  transcriptSegments,
  filename,
  mediaInfo,
  contentType,
  extractionStrategy,
  onPopOut,
}: StreamingAudioPlayerProps) {
  const [mode, setMode] = useState<PlaybackMode>(() => shouldFetchBinaryWithHeaders() ? 'blob' : 'direct');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showExpertMode, setShowExpertMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownPositionRef = useRef(0);

  const expertStats = useMediaStats(audioRef, showExpertMode);

  const directUrl = api.attachments.getDownloadUrl(attachmentId, variant);
  const downloadUrl = api.attachments.getDownloadUrl(attachmentId);
  const startWithBlob = shouldFetchBinaryWithHeaders();
  const binaryResourceHeaders = useMemo(() => buildBinaryResourceHeaders(), [startWithBlob]);
  const resolvedPosterUrl = useBlobUrl(posterUrl, {
    forceFetch: startWithBlob,
    headers: binaryResourceHeaders,
  });

  // Transcript: prefer metadata segments, fall back to server subtitle endpoint
  const [fetchedSegments, setFetchedSegments] = useState<TranscriptSegment[] | null>(null);
  const effectiveSegments = transcriptSegments && transcriptSegments.length > 0
    ? transcriptSegments
    : fetchedSegments;
  const hasTranscript = !!effectiveSegments && effectiveSegments.length > 0;
  const [showCaptions, setShowCaptions] = useState(true);

  // Fetch transcript from subtitle endpoint when metadata doesn't include segments
  useEffect(() => {
    if (transcriptSegments && transcriptSegments.length > 0) return;
    let cancelled = false;
    const subtitleUrl = api.attachments.getSubtitleUrl(attachmentId, 'vtt');
    const headers = buildBinaryResourceHeaders();

    fetch(subtitleUrl, { headers })
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const parsed = parseVttToSegments(text);
        if (parsed.length > 0) setFetchedSegments(parsed);
      })
      .catch(() => {/* subtitle endpoint not available */});
    return () => { cancelled = true; };
  }, [attachmentId, transcriptSegments]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  }, []);

  const handleTranscriptSeek = useCallback((timeSecs: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = timeSecs;
      setCurrentTime(timeSecs);
    }
  }, []);

  useEffect(() => {
    if (startWithBlob) {
      setMode('blob');
    }
  }, [startWithBlob]);

  useEffect(() => {
    if (mode !== 'blob') return;
    let revoked = false;
    let currentUrl: string | null = null;

    const tryDownload = (v?: string): Promise<Blob> =>
      api.attachments.downloadAttachment(attachmentId, v).catch((err) => {
        if (v) return api.attachments.downloadAttachment(attachmentId);
        throw err;
      });

    tryDownload(variant)
      .then((blob) => {
        if (revoked) return;
        const typed = blob.type.startsWith('audio/')
          ? blob
          : new Blob([blob], { type: 'audio/mpeg' });
        currentUrl = URL.createObjectURL(typed);
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
  }, [attachmentId, mode, variant]);

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
      {resolvedPosterUrl ? (
        <img
          src={resolvedPosterUrl}
          alt="Audio waveform"
          className="w-full max-w-md h-[120px] object-contain rounded border bg-muted/10"
          loading="lazy"
          data-testid="audio-waveform"
        />
      ) : (
        <Music className="w-16 h-16 text-muted-foreground" />
      )}
      <div className="flex items-center gap-2 w-full max-w-md">
        <audio
          ref={audioRef}
          src={mode === 'direct' ? directUrl : (blobUrl ?? undefined)}
          controls
          preload="metadata"
          className="flex-1 min-w-0"
          onLoadedMetadata={handleLoadedMetadata}
          onPlaying={handlePlaying}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={handleAudioError}
          onTimeUpdate={handleTimeUpdate}
        >
          Your browser does not support audio playback.
        </audio>
        {hasTranscript && (
          <button
            type="button"
            className={cn(
              'shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
              showCaptions
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
            onClick={() => setShowCaptions((prev) => !prev)}
            title={showCaptions ? 'Hide transcript' : 'Show transcript'}
            data-testid="cc-toggle"
          >
            <Subtitles className="w-3.5 h-3.5" />
            CC
          </button>
        )}
        {onPopOut && (
          <button
            type="button"
            className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors bg-muted text-muted-foreground hover:bg-muted/80"
            onClick={onPopOut}
            title="Pop out player"
            data-testid="audio-pop-out"
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          className={cn(
            'shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
            showExpertMode
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
          onClick={() => setShowExpertMode((prev) => !prev)}
          title={showExpertMode ? 'Hide stats' : 'Show stats'}
          data-testid="expert-mode-toggle"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>
      </div>
      {hasTranscript && showCaptions && (
        <TranscriptPanel
          segments={effectiveSegments!}
          currentTime={currentTime}
          onSeek={handleTranscriptSeek}
          filename={filename}
          className="w-full max-w-md mt-2"
        />
      )}
      {showExpertMode && expertStats && (
        <ExpertModeOverlay
          stats={expertStats}
          mediaInfo={mediaInfo ?? null}
          playbackMode={mode}
          contentType={contentType}
          sizeBytes={sizeBytes}
          variant={variant}
          filename={filename}
          extractionStrategy={extractionStrategy}
          mediaType="audio"
          onClose={() => setShowExpertMode(false)}
        />
      )}
    </div>
  );
}

// Re-export format helpers for use by other components
export { formatFileSize, formatDuration };
