/**
 * usePlayerPosition — Drag-to-move and snap-to-corners logic for the mini player.
 *
 * Dragging is handled via pointer events on the drag handle element.
 * On release, the player snaps to the nearest viewport corner if within
 * a 120px threshold. Position persists in localStorage.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SnapCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface Position {
  x: number;
  y: number;
}

interface StoredPosition {
  corner: SnapCorner;
}

const STORAGE_KEY = 'hotm.player.miniPosition';
const MARGIN = 16;
const SNAP_THRESHOLD = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadCorner(): SnapCorner {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: StoredPosition = JSON.parse(raw);
      if (parsed.corner) return parsed.corner;
    }
  } catch {
    // ignore
  }
  return 'bottom-right';
}

function saveCorner(corner: SnapCorner): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ corner }));
  } catch {
    // ignore
  }
}

function cornerToPosition(corner: SnapCorner, playerWidth: number, playerHeight: number): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  switch (corner) {
    case 'bottom-right':
      return { x: vw - playerWidth - MARGIN, y: vh - playerHeight - MARGIN };
    case 'bottom-left':
      return { x: MARGIN, y: vh - playerHeight - MARGIN };
    case 'top-right':
      return { x: vw - playerWidth - MARGIN, y: MARGIN };
    case 'top-left':
      return { x: MARGIN, y: MARGIN };
  }
}

function nearestCorner(
  pos: Position,
  playerWidth: number,
  playerHeight: number,
): { corner: SnapCorner; shouldSnap: boolean } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centerX = pos.x + playerWidth / 2;
  const centerY = pos.y + playerHeight / 2;

  const corners: { corner: SnapCorner; cx: number; cy: number }[] = [
    { corner: 'top-left', cx: 0, cy: 0 },
    { corner: 'top-right', cx: vw, cy: 0 },
    { corner: 'bottom-left', cx: 0, cy: vh },
    { corner: 'bottom-right', cx: vw, cy: vh },
  ];

  let best = corners[0];
  let bestDist = Infinity;
  for (const c of corners) {
    const d = Math.hypot(centerX - c.cx, centerY - c.cy);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }

  // Check if within snap threshold of the corner position
  const cornerPos = cornerToPosition(best.corner, playerWidth, playerHeight);
  const distToCornerPos = Math.hypot(pos.x - cornerPos.x, pos.y - cornerPos.y);

  return { corner: best.corner, shouldSnap: distToCornerPos < SNAP_THRESHOLD * 2 };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UsePlayerPositionOptions {
  width: number;
  height: number;
  enabled: boolean;
}

export interface UsePlayerPositionReturn {
  position: Position;
  corner: SnapCorner;
  isDragging: boolean;
  isSnapping: boolean;
  handleDragStart: (e: React.PointerEvent) => void;
}

export function usePlayerPosition({
  width,
  height,
  enabled,
}: UsePlayerPositionOptions): UsePlayerPositionReturn {
  const [corner, setCorner] = useState<SnapCorner>(loadCorner);
  const [position, setPosition] = useState<Position>(() =>
    cornerToPosition(loadCorner(), width, height),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Update position on resize
  useEffect(() => {
    if (!enabled) return;
    const handleResize = () => {
      if (!isDragging) {
        setPosition(cornerToPosition(corner, width, height));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [corner, width, height, enabled, isDragging]);

  // Re-calc when dimensions change (e.g. switching between video/audio mini)
  useEffect(() => {
    if (!isDragging && enabled) {
      setPosition(cornerToPosition(corner, width, height));
    }
  }, [width, height, corner, isDragging, enabled]);

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;

      // Don't start drag if the user clicked a button (close, expand, etc.)
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;

      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: position.x,
        origY: position.y,
      };

      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture(e.pointerId);
    },
    [enabled, position],
  );

  // Global pointer move/up while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const newX = Math.max(0, Math.min(window.innerWidth - width, dragStartRef.current.origX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - height, dragStartRef.current.origY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;

      // Snap to nearest corner
      setPosition((pos) => {
        const { corner: nearest, shouldSnap } = nearestCorner(pos, width, height);
        if (shouldSnap) {
          setCorner(nearest);
          saveCorner(nearest);
          setIsSnapping(true);
          setTimeout(() => setIsSnapping(false), 250);
          return cornerToPosition(nearest, width, height);
        }
        // Even if not snapping to position, update the "logical" corner
        setCorner(nearest);
        saveCorner(nearest);
        return pos;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, width, height]);

  return {
    position,
    corner,
    isDragging,
    isSnapping,
    handleDragStart,
  };
}
