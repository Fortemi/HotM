/**
 * useMediaStats — polls an HTMLMediaElement for runtime playback diagnostics.
 *
 * Returns `null` when `isActive` is false so the feature is fully inert
 * (no intervals, no listeners, zero CPU cost) until the user opts in.
 */

import { useState, useEffect, useCallback, type RefObject } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MediaStats {
  // Playback
  currentTime: number;
  duration: number;
  playbackRate: number;
  paused: boolean;
  seeking: boolean;

  // Buffer
  bufferHealthSecs: number;
  bufferPercentage: number;

  // Network
  networkState: string;
  readyState: string;

  // Video-only (null for audio elements)
  decodedWidth: number | null;
  decodedHeight: number | null;
  droppedFrames: number | null;
  totalFrames: number | null;
  droppedFrameRatio: number | null;
  corruptedFrames: number | null;

  // Volume
  volume: number;
  muted: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NETWORK_STATE_LABELS: Record<number, string> = {
  0: 'EMPTY',
  1: 'IDLE',
  2: 'LOADING',
  3: 'NO_SOURCE',
};

const READY_STATE_LABELS: Record<number, string> = {
  0: 'HAVE_NOTHING',
  1: 'HAVE_METADATA',
  2: 'HAVE_CURRENT_DATA',
  3: 'HAVE_FUTURE_DATA',
  4: 'HAVE_ENOUGH_DATA',
};

function networkStateLabel(state: number): string {
  return NETWORK_STATE_LABELS[state] ?? `UNKNOWN(${state})`;
}

function readyStateLabel(state: number): string {
  return READY_STATE_LABELS[state] ?? `UNKNOWN(${state})`;
}

/**
 * Compute how many seconds of media are buffered ahead of the current playhead.
 */
function computeBufferHealth(el: HTMLMediaElement): number {
  const { buffered, currentTime } = el;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
      return buffered.end(i) - currentTime;
    }
  }
  return 0;
}

function computeBufferPercentage(el: HTMLMediaElement): number {
  const { buffered, duration } = el;
  if (!isFinite(duration) || duration === 0) return 0;
  let total = 0;
  for (let i = 0; i < buffered.length; i++) {
    total += buffered.end(i) - buffered.start(i);
  }
  return Math.min(100, (total / duration) * 100);
}

function sampleStats(el: HTMLMediaElement): MediaStats {
  const isVideo = el instanceof HTMLVideoElement;

  let decodedWidth: number | null = null;
  let decodedHeight: number | null = null;
  let droppedFrames: number | null = null;
  let totalFrames: number | null = null;
  let droppedFrameRatio: number | null = null;
  let corruptedFrames: number | null = null;

  if (isVideo) {
    decodedWidth = el.videoWidth || null;
    decodedHeight = el.videoHeight || null;

    if ('getVideoPlaybackQuality' in el) {
      const quality = (el as HTMLVideoElement).getVideoPlaybackQuality();
      droppedFrames = quality.droppedVideoFrames;
      totalFrames = quality.totalVideoFrames;
      droppedFrameRatio =
        totalFrames > 0 ? (droppedFrames / totalFrames) * 100 : 0;
      corruptedFrames = quality.corruptedVideoFrames ?? null;
    }
  }

  return {
    currentTime: el.currentTime,
    duration: el.duration,
    playbackRate: el.playbackRate,
    paused: el.paused,
    seeking: el.seeking,

    bufferHealthSecs: computeBufferHealth(el),
    bufferPercentage: computeBufferPercentage(el),

    networkState: networkStateLabel(el.networkState),
    readyState: readyStateLabel(el.readyState),

    decodedWidth,
    decodedHeight,
    droppedFrames,
    totalFrames,
    droppedFrameRatio,
    corruptedFrames,

    volume: el.volume,
    muted: el.muted,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1000;

export function useMediaStats(
  mediaRef: RefObject<HTMLMediaElement | null>,
  isActive: boolean,
): MediaStats | null {
  const [stats, setStats] = useState<MediaStats | null>(null);

  const poll = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    setStats(sampleStats(el));
  }, [mediaRef]);

  useEffect(() => {
    if (!isActive) {
      setStats(null);
      return;
    }

    // Take an immediate sample so the overlay doesn't start blank
    poll();

    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isActive, poll]);

  return stats;
}
