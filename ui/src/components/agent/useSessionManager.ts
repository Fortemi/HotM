/**
 * useSessionManager — React hook for agent chat session lifecycle.
 *
 * Manages session CRUD, debounced auto-save, and panel visibility.
 * Uses refs for the active session in debounced callbacks to avoid
 * stale closure issues.
 *
 * Safety features:
 * - Flush pending saves on unmount and beforeunload
 * - Cross-tab sync via storage event listener
 * - Deferred empty session creation (no empty sessions persisted)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import {
  loadSessions,
  createSession as createNewSession,
  upsertSession,
  deleteSessionById,
  renameSessionById,
  getActiveSessionId,
  setActiveSessionId,
  getSessionById,
  serializeMessage,
  deserializeMessage,
  SESSION_STORAGE_KEY,
  type ChatSession,
} from './session-storage';

export interface UseSessionManagerOptions {
  provider: string;
  model?: string;
}

export interface UseSessionManagerReturn {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  createSession: (name?: string) => ChatSession;
  /** Switch to a session; returns its deserialized messages. */
  switchSession: (id: string) => UIMessage[];
  /** Debounced save of current messages to the active session. */
  saveMessages: (messages: UIMessage[]) => void;
  renameSession: (id: string, name: string) => void;
  /** Delete a session; returns the messages of the next active session. */
  deleteSession: (id: string) => UIMessage[];
  /** Create a new empty session; returns empty array (the new session's messages). */
  newSession: () => UIMessage[];
  /** Restore the active session's messages (for mount). */
  restoreMessages: () => UIMessage[];
  /** Fork the current session — saves a copy with all provided messages. */
  forkSession: (messages: UIMessage[], forkName?: string) => ChatSession;
  showPanel: boolean;
  setShowPanel: (show: boolean) => void;
}

const SAVE_DEBOUNCE_MS = 1000;

/**
 * Flush a pending debounced save immediately. Used on unmount and
 * beforeunload to avoid data loss.
 */
function flushPendingSave(
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  pendingMessagesRef: React.MutableRefObject<UIMessage[] | null>,
  activeSessionRef: React.MutableRefObject<ChatSession | null>,
  setActiveSession: (s: ChatSession) => void,
  setSessions: (s: ChatSession[]) => void,
) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  const messages = pendingMessagesRef.current;
  const current = activeSessionRef.current;
  if (!messages || !current) return;
  pendingMessagesRef.current = null;

  const updated: ChatSession = {
    ...current,
    messages: messages.map(serializeMessage),
    messageCount: messages.length,
    updatedAt: new Date().toISOString(),
  };
  const allSessions = upsertSession(updated);
  // State updates won't fire during unmount/beforeunload, but the
  // localStorage write inside upsertSession has already persisted.
  try {
    setActiveSession(updated);
    setSessions(allSessions);
  } catch {
    // Swallow — React may have unmounted
  }
}

export function useSessionManager(
  options: UseSessionManagerOptions,
): UseSessionManagerReturn {
  const { provider, model } = options;

  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [activeSession, setActiveSession] = useState<ChatSession | null>(
    () => {
      const activeId = getActiveSessionId();
      if (activeId) return getSessionById(activeId) ?? null;
      return null;
    },
  );
  const [showPanel, setShowPanel] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMessagesRef = useRef<UIMessage[] | null>(null);
  const activeSessionRef = useRef<ChatSession | null>(activeSession);

  // Keep ref in sync with state
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Ensure there's always an active session
  useEffect(() => {
    if (!activeSession) {
      const session = createNewSession(provider, model);
      const updated = upsertSession(session);
      setActiveSessionId(session.id);
      setActiveSession(session);
      setSessions(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-tab sync: reload sessions when another tab writes to localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== SESSION_STORAGE_KEY) return;
      const freshSessions = loadSessions();
      setSessions(freshSessions);
      // If active session was updated in another tab, refresh it
      const activeId = activeSessionRef.current?.id;
      if (activeId) {
        const updated = freshSessions.find((s) => s.id === activeId);
        if (updated) setActiveSession(updated);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Flush pending save on unmount + beforeunload safety net
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSave(
        saveTimerRef,
        pendingMessagesRef,
        activeSessionRef,
        setActiveSession,
        setSessions,
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Flush on unmount as well
      flushPendingSave(
        saveTimerRef,
        pendingMessagesRef,
        activeSessionRef,
        setActiveSession,
        setSessions,
      );
    };
  }, []);

  const createSession = useCallback(
    (name?: string): ChatSession => {
      const session = createNewSession(provider, model, name);
      const updated = upsertSession(session);
      setActiveSessionId(session.id);
      setActiveSession(session);
      setSessions(updated);
      return session;
    },
    [provider, model],
  );

  const switchSession = useCallback((id: string): UIMessage[] => {
    // Flush pending save so we don't lose data from the outgoing session
    flushPendingSave(
      saveTimerRef,
      pendingMessagesRef,
      activeSessionRef,
      setActiveSession,
      setSessions,
    );
    const session = getSessionById(id);
    if (!session) return [];
    setActiveSessionId(id);
    setActiveSession(session);
    return session.messages.map(deserializeMessage);
  }, []);

  const saveMessages = useCallback((messages: UIMessage[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingMessagesRef.current = messages;
    saveTimerRef.current = setTimeout(() => {
      pendingMessagesRef.current = null;
      const current = activeSessionRef.current;
      if (!current) return;
      const updated: ChatSession = {
        ...current,
        messages: messages.map(serializeMessage),
        messageCount: messages.length,
        updatedAt: new Date().toISOString(),
      };
      const allSessions = upsertSession(updated);
      setActiveSession(updated);
      setSessions(allSessions);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const renameSession = useCallback((id: string, name: string) => {
    const updated = renameSessionById(id, name);
    setSessions(updated);
    if (activeSessionRef.current?.id === id) {
      const renamed = updated.find((s) => s.id === id);
      if (renamed) setActiveSession(renamed);
    }
  }, []);

  const deleteSession = useCallback(
    (id: string): UIMessage[] => {
      const wasActive = activeSessionRef.current?.id === id;
      const updated = deleteSessionById(id);
      setSessions(updated);

      if (wasActive) {
        if (updated.length > 0) {
          // Switch to most recent remaining session
          const next = updated[0];
          setActiveSessionId(next.id);
          setActiveSession(next);
          return next.messages.map(deserializeMessage);
        } else {
          // No sessions left — create a fresh one
          const session = createNewSession(provider, model);
          const all = upsertSession(session);
          setActiveSessionId(session.id);
          setActiveSession(session);
          setSessions(all);
          return [];
        }
      }
      // Deleted a non-active session — no message change needed
      return activeSessionRef.current?.messages.map(deserializeMessage) ?? [];
    },
    [provider, model],
  );

  const newSession = useCallback((): UIMessage[] => {
    // Flush any pending save for the current session first
    flushPendingSave(
      saveTimerRef,
      pendingMessagesRef,
      activeSessionRef,
      setActiveSession,
      setSessions,
    );
    createSession();
    return [];
  }, [createSession]);

  const forkSession = useCallback(
    (messages: UIMessage[], forkName?: string): ChatSession => {
      const current = activeSessionRef.current;
      const name =
        forkName ??
        `Fork: ${current?.name ?? 'Session'} @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const session = createNewSession(provider, model, name);
      session.messages = messages.map(serializeMessage);
      session.messageCount = messages.length;
      const updated = upsertSession(session);
      setSessions(updated);
      // Don't switch to the fork — stay on the current session
      return session;
    },
    [provider, model],
  );

  const restoreMessages = useCallback((): UIMessage[] => {
    // Read fresh from localStorage to avoid stale closure over initial state
    const activeId = getActiveSessionId();
    if (!activeId) return [];
    const session = getSessionById(activeId);
    if (session && session.messageCount > 0) {
      return session.messages.map(deserializeMessage);
    }
    return [];
  }, []);

  return {
    sessions,
    activeSession,
    createSession,
    switchSession,
    saveMessages,
    renameSession,
    deleteSession,
    newSession,
    restoreMessages,
    forkSession,
    showPanel,
    setShowPanel,
  };
}
