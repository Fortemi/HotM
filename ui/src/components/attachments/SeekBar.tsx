/**
 * SeekBar — Custom video/audio seek bar with buffer visualization,
 * drag-to-seek, hover time tracking, and children slot for thumbnail preview.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface SeekBarProps {
  currentTime: number;
  duration: number;
  buffered: TimeRanges | null;
  onSeek: (time: number) => void;
  onHoverTime?: (time: number | null) => void;
  onHoverPosition?: (x: number | null) => void;
  children?: React.ReactNode;
  className?: string;
}

function getBufferedEnd(buffered: TimeRanges | null, currentTime: number): number {
  if (!buffered) return 0;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
      return buffered.end(i);
    }
  }
  return 0;
}

export function SeekBar({
  currentTime,
  duration,
  buffered,
  onSeek,
  onHoverTime,
  onHoverPosition,
  children,
  className,
}: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverFraction, setHoverFraction] = useState(0);

  const safeD = duration > 0 ? duration : 1;
  const playedFraction = Math.min(1, Math.max(0, currentTime / safeD));
  const bufferedEnd = getBufferedEnd(buffered, currentTime);
  const bufferedFraction = Math.min(1, Math.max(0, bufferedEnd / safeD));

  const fractionFromEvent = useCallback(
    (clientX: number): number => {
      const bar = barRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [],
  );

  const emitHover = useCallback(
    (clientX: number) => {
      const frac = fractionFromEvent(clientX);
      setHoverFraction(frac);
      onHoverTime?.(frac * safeD);
      if (barRef.current) {
        const rect = barRef.current.getBoundingClientRect();
        onHoverPosition?.(clientX - rect.left);
      }
    },
    [fractionFromEvent, onHoverTime, onHoverPosition, safeD],
  );

  // ---- Mouse events on the bar ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const frac = fractionFromEvent(e.clientX);
      onSeek(frac * safeD);
      emitHover(e.clientX);
    },
    [fractionFromEvent, onSeek, safeD, emitHover],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      emitHover(e.clientX);
    },
    [emitHover],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setIsHovering(false);
      onHoverTime?.(null);
      onHoverPosition?.(null);
    }
  }, [isDragging, onHoverTime, onHoverPosition]);

  // ---- Global mouse events for drag ----
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMove = (e: MouseEvent) => {
      const frac = fractionFromEvent(e.clientX);
      onSeek(frac * safeD);
      emitHover(e.clientX);
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [isDragging, fractionFromEvent, onSeek, safeD, emitHover]);

  // ---- Touch events ----
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      setIsDragging(true);
      const frac = fractionFromEvent(touch.clientX);
      onSeek(frac * safeD);
    },
    [fractionFromEvent, onSeek, safeD],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const frac = fractionFromEvent(touch.clientX);
      onSeek(frac * safeD);
      emitHover(touch.clientX);
    },
    [fractionFromEvent, onSeek, safeD, emitHover],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    onHoverTime?.(null);
    onHoverPosition?.(null);
  }, [onHoverTime, onHoverPosition]);

  const showHover = isHovering || isDragging;

  return (
    <div className={cn('relative group/seek', className)} data-testid="seek-bar">
      {/* Children slot (positioned above) — for thumbnail preview */}
      {showHover && children}

      {/* Clickable / draggable track area */}
      <div
        ref={barRef}
        className="relative h-5 flex items-center cursor-pointer select-none touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        data-testid="seek-bar-track"
      >
        {/* Track background */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 group-hover/seek:h-1.5 transition-all" />

        {/* Buffered range */}
        <div
          className="absolute left-0 h-1 rounded-full bg-white/30 group-hover/seek:h-1.5 transition-all"
          style={{ width: `${bufferedFraction * 100}%` }}
          data-testid="seek-bar-buffered"
        />

        {/* Played range */}
        <div
          className="absolute left-0 h-1 rounded-full bg-primary group-hover/seek:h-1.5 transition-all"
          style={{ width: `${playedFraction * 100}%` }}
          data-testid="seek-bar-played"
        />

        {/* Thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow transition-opacity',
            showHover ? 'opacity-100' : 'opacity-0',
          )}
          style={{ left: `${playedFraction * 100}%` }}
          data-testid="seek-bar-thumb"
        />

        {/* Hover indicator line */}
        {showHover && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/50 pointer-events-none"
            style={{ left: `${hoverFraction * 100}%` }}
            data-testid="seek-bar-hover-indicator"
          />
        )}
      </div>
    </div>
  );
}
