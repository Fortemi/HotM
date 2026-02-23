/**
 * PersistentPlayerOverlay — Always-mounted overlay that renders the active
 * player state (MINI, EXPANDED, DOCKED_BAR) or nothing when INACTIVE.
 *
 * Rendered at the App.tsx root level as a sibling to HallOfMind so
 * view-switching never unmounts it.
 */

import { useRef } from 'react';
import { useMediaPlayer } from './PlayerContext';
import { usePlayerKeyboard } from './usePlayerKeyboard';
import { MiniPlayer } from './MiniPlayer';

export function PersistentPlayerOverlay() {
  const { state, session, setState, endSession } = useMediaPlayer();
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  usePlayerKeyboard({
    state,
    mediaRef,
    onCycleSize: () => {
      if (state === 'MINI') setState('EXPANDED');
      else if (state === 'EXPANDED') mediaRef.current?.requestFullscreen?.();
    },
    onDismiss: endSession,
  });

  if (state === 'INACTIVE' || !session) return null;

  switch (state) {
    case 'MINI':
      return <MiniPlayer session={session} mediaRef={mediaRef} variant="mini" />;
    case 'EXPANDED':
      return <MiniPlayer session={session} mediaRef={mediaRef} variant="expanded" />;
    case 'DOCKED_BAR':
      // Docked bar — fall back to mini for now
      return <MiniPlayer session={session} mediaRef={mediaRef} variant="mini" />;
    default:
      return null;
  }
}
