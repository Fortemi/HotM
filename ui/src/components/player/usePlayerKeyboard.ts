/**
 * usePlayerKeyboard — Global keyboard shortcuts for the persistent media player.
 *
 * All shortcuts use Alt+Key to avoid conflicts with the Markdown editor.
 * Shortcuts are only active when a player session exists (not INACTIVE).
 */

import { useEffect } from 'react';
import type { PlayerState } from './PlayerContext';

export interface UsePlayerKeyboardOptions {
  /** Current player state — shortcuts inactive when INACTIVE */
  state: PlayerState;
  /** Reference to the active media element */
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  /** Cycle through MINI → EXPANDED → fullscreen */
  onCycleSize: () => void;
  /** Dismiss the player (INACTIVE) */
  onDismiss: () => void;
}

export function usePlayerKeyboard({
  state,
  mediaRef,
  onCycleSize,
  onDismiss,
}: UsePlayerKeyboardOptions): void {
  useEffect(() => {
    if (state === 'INACTIVE') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Alt+* combinations
      if (!e.altKey) return;

      // Don't intercept if user is in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Alt+P even in editor (it's the primary shortcut)
        if (e.key !== 'p' && e.key !== 'P') return;
      }

      const media = mediaRef.current;

      if (e.shiftKey) {
        // Alt+Shift combinations
        switch (e.key) {
          case 'P':
          case 'p':
            // Alt+Shift+P — Dismiss player
            e.preventDefault();
            onDismiss();
            break;
          case 'E':
          case 'e':
            // Alt+Shift+E — Cycle: MINI → EXPANDED → fullscreen
            e.preventDefault();
            onCycleSize();
            break;
        }
        return;
      }

      // Alt+Key (no shift)
      switch (e.key) {
        case 'p':
        case 'P':
          // Alt+P — Play/Pause
          e.preventDefault();
          if (media) {
            if (media.paused) media.play();
            else media.pause();
          }
          break;
        case 'ArrowLeft':
          // Alt+ArrowLeft — Skip back 10s
          e.preventDefault();
          if (media) {
            media.currentTime = Math.max(0, media.currentTime - 10);
          }
          break;
        case 'ArrowRight':
          // Alt+ArrowRight — Skip forward 10s
          e.preventDefault();
          if (media) {
            media.currentTime = Math.min(media.duration || 0, media.currentTime + 10);
          }
          break;
        case 'm':
        case 'M':
          // Alt+M — Mute toggle
          e.preventDefault();
          if (media) {
            media.muted = !media.muted;
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, mediaRef, onCycleSize, onDismiss]);
}
