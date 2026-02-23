/**
 * PlayerContext — Global media player context that persists across view navigation.
 *
 * The provider mounts at the App.tsx root level so that currentView changes
 * inside HallOfMind never unmount the active media element. When a user pops
 * out a video or audio attachment, this context captures the playback state
 * and the PersistentPlayerOverlay takes over rendering.
 *
 * State machine: INACTIVE → MINI ↔ EXPANDED ↔ DOCKED_BAR
 * Native PiP is a parallel path accessible from MINI or EXPANDED.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerState = 'INACTIVE' | 'MINI' | 'EXPANDED' | 'DOCKED_BAR';

export type MediaType = 'video' | 'audio';

export interface MediaSessionInfo {
  attachmentId: string;
  noteId?: string;
  mediaType: MediaType;
  filename: string;
  /** Direct streaming URL */
  directUrl: string;
  /** Blob URL if the media was loaded via blob fallback */
  blobUrl?: string;
  /** Poster / thumbnail URL */
  posterUrl?: string;
  /** File size in bytes */
  sizeBytes?: number;
  /** Preferred media variant */
  variant?: string;
}

export interface PlayerContextValue {
  /** Current player visual state */
  state: PlayerState;
  /** Active media session, null when INACTIVE */
  session: MediaSessionInfo | null;
  /** Start a new persistent player session (transitions to MINI) */
  startSession: (info: MediaSessionInfo, initialTime?: number) => void;
  /** End the current session (transitions to INACTIVE) */
  endSession: () => void;
  /** Change player visual state */
  setState: (state: PlayerState) => void;
  /** Initial playback time to seek to when the player mounts */
  initialTime: number;
  /** Navigate back to the originating note and close pop-out */
  returnToSource: (() => void) | null;
  /** Register a callback for "return to source" navigation */
  setReturnToSource: (cb: (() => void) | null) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function useMediaPlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('useMediaPlayer must be used within a MediaPlayerProvider');
  }
  return ctx;
}

/** Safe version that returns null outside the provider (for components that
 *  may or may not be wrapped). */
export function useMediaPlayerOptional(): PlayerContextValue | null {
  return useContext(PlayerContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface MediaPlayerProviderProps {
  children: ReactNode;
}

export function MediaPlayerProvider({ children }: MediaPlayerProviderProps) {
  const [state, setStateRaw] = useState<PlayerState>('INACTIVE');
  const [session, setSession] = useState<MediaSessionInfo | null>(null);
  const [initialTime, setInitialTime] = useState(0);
  const [returnToSource, setReturnToSourceRaw] = useState<(() => void) | null>(null);

  // Track blob URLs we own so we can revoke them on session end
  const ownedBlobUrlRef = useRef<string | null>(null);

  const startSession = useCallback(
    (info: MediaSessionInfo, seekTime = 0) => {
      // Clean up any previous blob URL we own
      if (ownedBlobUrlRef.current) {
        URL.revokeObjectURL(ownedBlobUrlRef.current);
        ownedBlobUrlRef.current = null;
      }

      // Take ownership of the blob URL if provided
      if (info.blobUrl) {
        ownedBlobUrlRef.current = info.blobUrl;
      }

      setSession(info);
      setInitialTime(seekTime);
      setStateRaw('MINI');
      setReturnToSourceRaw(null);
    },
    [],
  );

  const endSession = useCallback(() => {
    // Revoke owned blob URL
    if (ownedBlobUrlRef.current) {
      URL.revokeObjectURL(ownedBlobUrlRef.current);
      ownedBlobUrlRef.current = null;
    }

    setSession(null);
    setStateRaw('INACTIVE');
    setInitialTime(0);
    setReturnToSourceRaw(null);
  }, []);

  const setState = useCallback((next: PlayerState) => {
    setStateRaw(next);
  }, []);

  const setReturnToSource = useCallback((cb: (() => void) | null) => {
    setReturnToSourceRaw(() => cb);
  }, []);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (ownedBlobUrlRef.current) {
        URL.revokeObjectURL(ownedBlobUrlRef.current);
      }
    };
  }, []);

  const value: PlayerContextValue = {
    state,
    session,
    startSession,
    endSession,
    setState,
    initialTime,
    returnToSource,
    setReturnToSource,
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
