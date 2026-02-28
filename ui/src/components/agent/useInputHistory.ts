/**
 * useInputHistory — TUI-style input history with up/down arrow navigation.
 *
 * Stores sent messages in an in-memory array (per session). Up arrow navigates
 * backward, down arrow forward. Current unsent input is preserved as a "draft".
 */

import { useCallback, useRef } from 'react';

const MAX_HISTORY = 50;

export interface UseInputHistoryReturn {
  /** Add a sent message to history. */
  push: (message: string) => void;
  /** Navigate backward (older). Returns the entry or undefined if at start. */
  navigateBack: (currentInput: string) => string | undefined;
  /** Navigate forward (newer). Returns the entry, draft, or undefined if not navigating. */
  navigateForward: () => string | undefined;
  /** Reset navigation state (call on user typing). */
  resetNavigation: () => void;
  /** Whether currently navigating through history. */
  isNavigating: boolean;
  /** Clear all history. */
  clear: () => void;
}

export function useInputHistory(): UseInputHistoryReturn {
  const historyRef = useRef<string[]>([]);
  const positionRef = useRef(-1); // -1 = not navigating
  const draftRef = useRef('');

  const push = useCallback((message: string) => {
    const history = historyRef.current;
    // Deduplicate consecutive identical entries
    if (history.length === 0 || history[history.length - 1] !== message) {
      history.push(message);
      // Cap at MAX_HISTORY
      if (history.length > MAX_HISTORY) {
        history.shift();
      }
    }
    positionRef.current = -1;
    draftRef.current = '';
  }, []);

  const navigateBack = useCallback((currentInput: string): string | undefined => {
    const history = historyRef.current;
    if (history.length === 0) return undefined;

    // Save draft on first navigation
    if (positionRef.current === -1) {
      draftRef.current = currentInput;
      positionRef.current = history.length;
    }

    if (positionRef.current <= 0) return undefined; // Already at oldest

    positionRef.current--;
    return history[positionRef.current];
  }, []);

  const navigateForward = useCallback((): string | undefined => {
    if (positionRef.current === -1) return undefined; // Not navigating

    const history = historyRef.current;
    positionRef.current++;

    if (positionRef.current >= history.length) {
      // Back to draft
      const draft = draftRef.current;
      positionRef.current = -1;
      draftRef.current = '';
      return draft;
    }

    return history[positionRef.current];
  }, []);

  const resetNavigation = useCallback(() => {
    positionRef.current = -1;
    draftRef.current = '';
  }, []);

  const clear = useCallback(() => {
    historyRef.current = [];
    positionRef.current = -1;
    draftRef.current = '';
  }, []);

  return {
    push,
    navigateBack,
    navigateForward,
    resetNavigation,
    get isNavigating() {
      return positionRef.current !== -1;
    },
    clear,
  };
}

/** Check if cursor is on the first line of a textarea. */
export function isCursorOnFirstLine(textarea: HTMLTextAreaElement): boolean {
  const { value, selectionStart } = textarea;
  return value.substring(0, selectionStart).indexOf('\n') === -1;
}

/** Check if cursor is on the last line of a textarea. */
export function isCursorOnLastLine(textarea: HTMLTextAreaElement): boolean {
  const { value, selectionStart } = textarea;
  return value.substring(selectionStart).indexOf('\n') === -1;
}
