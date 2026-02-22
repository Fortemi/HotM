/**
 * ThumbnailPreview — Seek bar hover thumbnail popup.
 *
 * Shows a cropped sprite sheet region above the seek bar cursor,
 * with a time label and arrow pointer. Uses CSS background-position
 * for sprite cropping (standard approach used by Plyr, YouTube).
 *
 * Progressive enhancement: only renders when a valid cue is provided.
 * When sprites are unavailable, the seek bar still shows a time tooltip.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ThumbnailCue } from './thumbnail-vtt';

export interface ThumbnailPreviewProps {
  cue: ThumbnailCue | null;
  hoverTime: number | null;
  hoverPositionX: number | null;
  seekBarWidth: number;
}

// Preloaded sprite images to avoid flicker
const loadedImages = new Set<string>();
const loadingImages = new Set<string>();

function ensureImageLoaded(url: string): void {
  if (loadedImages.has(url) || loadingImages.has(url)) return;
  loadingImages.add(url);
  const img = new Image();
  img.onload = () => {
    loadedImages.add(url);
    loadingImages.delete(url);
  };
  img.onerror = () => {
    loadingImages.delete(url);
  };
  img.src = url;
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

export function ThumbnailPreview({
  cue,
  hoverTime,
  hoverPositionX,
  seekBarWidth,
}: ThumbnailPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isImageReady, setIsImageReady] = useState(false);

  // Preload sprite image when cue changes
  useEffect(() => {
    if (!cue) {
      setIsImageReady(false);
      return;
    }
    if (loadedImages.has(cue.imageUrl)) {
      setIsImageReady(true);
      return;
    }
    setIsImageReady(false);
    ensureImageLoaded(cue.imageUrl);
    // Poll briefly for load completion
    const timer = setInterval(() => {
      if (loadedImages.has(cue.imageUrl)) {
        setIsImageReady(true);
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [cue]);

  if (hoverTime === null || hoverPositionX === null) return null;

  // Calculate popup position, clamped to seek bar bounds
  const popupWidth = cue ? cue.w : 80;
  const halfPopup = popupWidth / 2;
  const margin = 8;
  const minX = margin;
  const maxX = seekBarWidth - popupWidth - margin;
  const desired = hoverPositionX - halfPopup;
  const clampedX = Math.max(minX, Math.min(maxX, desired));

  // Arrow offset tracks actual mouse position independent of popup clamping
  const arrowOffset = desired - clampedX;

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute bottom-full mb-2 pointer-events-none z-30',
        'transition-opacity duration-150',
        cue && isImageReady ? 'opacity-100' : 'opacity-0',
      )}
      style={{ left: clampedX }}
      data-testid="thumbnail-preview"
    >
      {/* Sprite crop container */}
      {cue && (
        <div
          className="overflow-hidden relative rounded border-2 border-white/90 shadow-lg"
          style={{ width: cue.w, height: cue.h }}
          data-testid="thumbnail-preview-image"
        >
          <img
            src={cue.imageUrl}
            alt=""
            className="absolute"
            style={{
              left: -cue.x,
              top: -cue.y,
              maxWidth: 'none',
              maxHeight: 'none',
            }}
            draggable={false}
          />
        </div>
      )}

      {/* Time label */}
      <div
        className="text-center bg-black/85 text-white text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-b"
        data-testid="thumbnail-preview-time"
      >
        {formatTime(hoverTime)}
      </div>

      {/* Arrow pointing down to seek bar */}
      <div
        className="absolute -bottom-1.5 w-0 h-0"
        style={{
          left: `calc(50% + ${arrowOffset}px)`,
          transform: 'translateX(-50%)',
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid rgba(0, 0, 0, 0.85)',
        }}
        data-testid="thumbnail-preview-arrow"
      />
    </div>
  );
}
