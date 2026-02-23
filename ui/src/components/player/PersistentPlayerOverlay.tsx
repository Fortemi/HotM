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
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

  usePlayerKeyboard({
    state,
    mediaRef,
    onToggleSize: () => {
      if (state === 'MINI') setState('EXPANDED');
      else if (state === 'EXPANDED') setState('MINI');
    },
    onDismiss: endSession,
  });

  if (state === 'INACTIVE' || !session) return null;

  // For now, MINI is the primary implementation. EXPANDED and DOCKED_BAR
  // will be added in future iterations.
  switch (state) {
    case 'MINI':
      return <MiniPlayer session={session} />;
    case 'EXPANDED':
      // Expanded player — fall back to mini for now, will be a separate component
      return <MiniPlayer session={session} />;
    case 'DOCKED_BAR':
      // Docked bar — fall back to mini for now
      return <MiniPlayer session={session} />;
    default:
      return null;
  }
}
