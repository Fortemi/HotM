/**
 * useMediaStats hook tests
 *
 * Verifies:
 * - Returns null when isActive is false (zero overhead)
 * - Starts polling and returns stats when active
 * - Cleans up interval on deactivation
 * - Computes buffer health from TimeRanges
 * - Reads video playback quality when available
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaStats } from '../useMediaStats';

// ---------------------------------------------------------------------------
// Mock HTMLMediaElement
// ---------------------------------------------------------------------------

function createMockMediaElement(overrides: Partial<HTMLMediaElement> = {}): HTMLMediaElement {
  const buffered = {
    length: 1,
    start: vi.fn(() => 0),
    end: vi.fn(() => 30),
  } as unknown as TimeRanges;

  return {
    currentTime: 10,
    duration: 120,
    playbackRate: 1,
    paused: false,
    seeking: false,
    networkState: 1, // IDLE
    readyState: 4,   // HAVE_ENOUGH_DATA
    volume: 0.8,
    muted: false,
    buffered,
    ...overrides,
  } as unknown as HTMLMediaElement;
}

function createMockVideoElement(overrides: Record<string, unknown> = {}): HTMLVideoElement {
  // jsdom validates property setters on real prototypes, so we build a
  // plain object that looks like an HTMLVideoElement to the hook code.
  const buffered = {
    length: 1,
    start: vi.fn(() => 0),
    end: vi.fn(() => 30),
  } as unknown as TimeRanges;

  const quality = {
    droppedVideoFrames: 2,
    totalVideoFrames: 1000,
    corruptedVideoFrames: 0,
  };

  const el = {
    currentTime: 10,
    duration: 120,
    playbackRate: 1,
    paused: false,
    seeking: false,
    networkState: 1,
    readyState: 4,
    volume: 0.8,
    muted: false,
    buffered,
    videoWidth: 1920,
    videoHeight: 1080,
    getVideoPlaybackQuality: vi.fn(() => quality),
    ...overrides,
  };

  // The hook checks `el instanceof HTMLVideoElement` — patch the chain
  Object.setPrototypeOf(el, HTMLVideoElement.prototype);
  return el as unknown as HTMLVideoElement;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMediaStats', () => {
  it('returns null when isActive is false', () => {
    const el = createMockMediaElement();
    const ref = { current: el };

    const { result } = renderHook(() => useMediaStats(ref, false));
    expect(result.current).toBeNull();
  });

  it('returns stats immediately when activated', () => {
    const el = createMockMediaElement();
    const ref = { current: el };

    const { result } = renderHook(() => useMediaStats(ref, true));
    expect(result.current).not.toBeNull();
    expect(result.current!.currentTime).toBe(10);
    expect(result.current!.duration).toBe(120);
    expect(result.current!.paused).toBe(false);
    expect(result.current!.networkState).toBe('IDLE');
    expect(result.current!.readyState).toBe('HAVE_ENOUGH_DATA');
  });

  it('updates stats on poll interval', () => {
    const el = createMockMediaElement();
    const ref = { current: el };

    const { result } = renderHook(() => useMediaStats(ref, true));
    expect(result.current!.currentTime).toBe(10);

    // Advance time and mutate element
    (el as unknown as Record<string, unknown>).currentTime = 25;
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current!.currentTime).toBe(25);
  });

  it('clears stats and stops polling when deactivated', () => {
    const el = createMockMediaElement();
    const ref = { current: el };

    const { result, rerender } = renderHook(
      ({ active }) => useMediaStats(ref, active),
      { initialProps: { active: true } },
    );
    expect(result.current).not.toBeNull();

    rerender({ active: false });
    expect(result.current).toBeNull();

    // Should not update after deactivation
    (el as unknown as Record<string, unknown>).currentTime = 50;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBeNull();
  });

  it('computes buffer health from TimeRanges', () => {
    const buffered = {
      length: 1,
      start: vi.fn(() => 5),
      end: vi.fn(() => 45),
    } as unknown as TimeRanges;
    const el = createMockMediaElement({ currentTime: 20, buffered });
    const ref = { current: el };

    const { result } = renderHook(() => useMediaStats(ref, true));
    // 45 - 20 = 25 seconds ahead
    expect(result.current!.bufferHealthSecs).toBe(25);
  });

  it('returns zero buffer health when nothing is buffered', () => {
    const buffered = {
      length: 0,
      start: vi.fn(),
      end: vi.fn(),
    } as unknown as TimeRanges;
    const el = createMockMediaElement({ currentTime: 10, buffered });
    const ref = { current: el };

    const { result } = renderHook(() => useMediaStats(ref, true));
    expect(result.current!.bufferHealthSecs).toBe(0);
  });

  it('includes video-specific stats for video elements', () => {
    const el = createMockVideoElement();
    const ref = { current: el as HTMLMediaElement };

    const { result } = renderHook(() => useMediaStats(ref, true));
    expect(result.current!.decodedWidth).toBe(1920);
    expect(result.current!.decodedHeight).toBe(1080);
    expect(result.current!.droppedFrames).toBe(2);
    expect(result.current!.totalFrames).toBe(1000);
    expect(result.current!.droppedFrameRatio).toBeCloseTo(0.2);
  });

  it('returns null for video stats on audio elements', () => {
    const el = createMockMediaElement();
    const ref = { current: el };

    const { result } = renderHook(() => useMediaStats(ref, true));
    expect(result.current!.decodedWidth).toBeNull();
    expect(result.current!.decodedHeight).toBeNull();
    expect(result.current!.droppedFrames).toBeNull();
    expect(result.current!.totalFrames).toBeNull();
  });

  it('returns null when ref is null', () => {
    const ref = { current: null };

    const { result } = renderHook(() => useMediaStats(ref, true));
    // Cannot sample from null ref — stays null
    expect(result.current).toBeNull();
  });

  it('reads volume and muted state', () => {
    const el = createMockMediaElement({ volume: 0.5, muted: true });
    const ref = { current: el };

    const { result } = renderHook(() => useMediaStats(ref, true));
    expect(result.current!.volume).toBe(0.5);
    expect(result.current!.muted).toBe(true);
  });
});
