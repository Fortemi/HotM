/**
 * ExpertModeOverlay — "Stats for Nerds" panel for video/audio players.
 *
 * Renders runtime playback diagnostics in a categorised 2-column grid.
 * Two visual modes:
 *  - **Video**: semi-transparent overlay positioned over the video element
 *  - **Audio**: block panel below the player controls using theme-aware colours
 */

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaStats } from './useMediaStats';
import type { MediaInfo } from './media-utils';
import { detectGpuRenderer } from './media-utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExpertModeOverlayProps {
  stats: MediaStats;
  mediaInfo: MediaInfo | null;
  playbackMode: 'direct' | 'blob' | 'error';
  contentType?: string;
  sizeBytes?: number;
  variant?: string;
  filename?: string;
  extractionStrategy?: string;
  mediaType: 'video' | 'audio';
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '--:--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function modeBadge(mode: 'direct' | 'blob' | 'error'): { label: string; color: string } {
  switch (mode) {
    case 'direct': return { label: 'Direct', color: 'text-green-400' };
    case 'blob':   return { label: 'Blob',   color: 'text-yellow-400' };
    case 'error':  return { label: 'Error',  color: 'text-red-400' };
  }
}

function droppedFrameColor(ratio: number): string {
  if (ratio < 1) return 'text-green-400';
  if (ratio < 5) return 'text-yellow-400';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// Row / Section primitives
// ---------------------------------------------------------------------------

function SectionHeader({ children, isVideo }: { children: React.ReactNode; isVideo: boolean }) {
  return (
    <div className={cn(
      'col-span-2 text-[10px] font-semibold tracking-wider uppercase mt-1 first:mt-0 border-b pb-0.5',
      isVideo ? 'border-white/20' : 'border-border',
    )}>
      {children}
    </div>
  );
}

function StatRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <>
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={cn('text-right truncate', className)}>{value}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpertModeOverlay({
  stats,
  mediaInfo,
  playbackMode,
  contentType,
  sizeBytes,
  variant,
  filename,
  extractionStrategy,
  mediaType,
  onClose,
}: ExpertModeOverlayProps) {
  const isVideo = mediaType === 'video';
  const badge = modeBadge(playbackMode);
  const gpu = useMemo(() => detectGpuRenderer(), []);

  return (
    <div
      className={cn(
        'font-mono text-[11px] leading-tight grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5',
        isVideo
          ? 'absolute top-2 left-2 z-20 bg-black/80 text-white rounded-lg p-3 max-h-[80%] overflow-y-auto'
          : 'bg-muted/50 border text-foreground rounded-lg p-3 max-h-[300px] overflow-y-auto mt-2',
      )}
      data-testid="expert-mode-overlay"
    >
      {/* Close button */}
      <button
        type="button"
        className={cn(
          'absolute top-1.5 right-1.5 p-0.5 rounded hover:bg-white/20 transition-colors',
          !isVideo && 'hover:bg-muted',
        )}
        onClick={onClose}
        aria-label="Close expert mode"
        data-testid="expert-mode-close"
      >
        <X className="w-3 h-3" />
      </button>

      {/* ── PLAYBACK ── */}
      <SectionHeader isVideo={isVideo}>Playback</SectionHeader>
      <StatRow label="Mode" value={<span className={badge.color}>{badge.label}</span>} />
      <StatRow
        label="Buffer"
        value={`${stats.bufferHealthSecs.toFixed(1)}s (${stats.bufferPercentage.toFixed(0)}%)`}
      />
      <StatRow label="Speed" value={`${stats.playbackRate}x`} />
      <StatRow
        label="Position"
        value={`${fmtTime(stats.currentTime)} / ${fmtTime(stats.duration)}`}
      />
      <StatRow label="Network" value={stats.networkState} />
      <StatRow label="Ready" value={stats.readyState} />

      {/* ── VIDEO ── */}
      {isVideo && (
        <>
          <SectionHeader isVideo={isVideo}>Video</SectionHeader>
          {mediaInfo?.width && mediaInfo?.height && stats.decodedWidth && stats.decodedHeight ? (
            <StatRow
              label="Resolution"
              value={`${mediaInfo.width}×${mediaInfo.height} → ${stats.decodedWidth}×${stats.decodedHeight}`}
            />
          ) : stats.decodedWidth && stats.decodedHeight ? (
            <StatRow label="Decoded" value={`${stats.decodedWidth}×${stats.decodedHeight}`} />
          ) : mediaInfo?.width && mediaInfo?.height ? (
            <StatRow label="Source" value={`${mediaInfo.width}×${mediaInfo.height}`} />
          ) : null}

          {(mediaInfo?.codec || mediaInfo?.frameRate) && (
            <StatRow
              label="Codec"
              value={[mediaInfo?.codec, mediaInfo?.frameRate ? `${mediaInfo.frameRate} fps` : null].filter(Boolean).join(' @ ')}
            />
          )}

          {stats.droppedFrames !== null && stats.totalFrames !== null && (
            <StatRow
              label="Dropped"
              value={`${stats.droppedFrames} / ${stats.totalFrames}`}
              className={stats.droppedFrameRatio !== null ? droppedFrameColor(stats.droppedFrameRatio) : undefined}
            />
          )}

          {stats.droppedFrameRatio !== null && (
            <StatRow
              label="Drop %"
              value={`${stats.droppedFrameRatio.toFixed(2)}%`}
              className={droppedFrameColor(stats.droppedFrameRatio)}
            />
          )}
        </>
      )}

      {/* ── AUDIO ── */}
      {(mediaInfo?.audioCodec || mediaInfo?.audioSampleRate) && (
        <>
          <SectionHeader isVideo={isVideo}>Audio</SectionHeader>
          {mediaInfo?.audioCodec && (
            <StatRow label="Codec" value={mediaInfo.audioCodec} />
          )}
          {mediaInfo?.audioSampleRate && (
            <StatRow label="Sample rate" value={`${(mediaInfo.audioSampleRate / 1000).toFixed(1)} kHz`} />
          )}
        </>
      )}

      {/* ── FILE ── */}
      <SectionHeader isVideo={isVideo}>File</SectionHeader>
      {contentType && <StatRow label="MIME" value={contentType} />}
      {sizeBytes != null && <StatRow label="Size" value={fmtSize(sizeBytes)} />}
      {mediaInfo?.bitrateKbps && (
        <StatRow label="Bitrate" value={`${mediaInfo.bitrateKbps} kbps`} />
      )}
      {variant && <StatRow label="Variant" value={variant} />}
      {filename && <StatRow label="File" value={filename} />}
      {extractionStrategy && <StatRow label="Extraction" value={extractionStrategy} />}

      {/* ── SYSTEM ── */}
      <SectionHeader isVideo={isVideo}>System</SectionHeader>
      <StatRow label="GPU" value={gpu} />
    </div>
  );
}
