/**
 * session-storage — pure CRUD functions for agent chat sessions in localStorage.
 *
 * Follows the same pattern as providers.ts: try/catch around localStorage
 * operations to handle private-browsing and quota errors gracefully.
 */

import type { UIMessage } from '@ai-sdk/react';

export interface ChatSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: SerializedUIMessage[];
  provider: string;
  model?: string;
  messageCount: number;
}

export interface SerializedUIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  parts: unknown[];
  createdAt?: string;
}

export const SESSION_STORAGE_KEY = 'hotm:agent-sessions';
export const ACTIVE_SESSION_KEY = 'hotm:agent-active-session';
export const MAX_SESSIONS = 50;

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function serializeMessage(msg: UIMessage): SerializedUIMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: msg.parts as unknown[],
  };
}

export function deserializeMessage(msg: SerializedUIMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: msg.parts as UIMessage['parts'],
  };
}

export function loadSessions(): ChatSession[] {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore corrupt data
  }
  return [];
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore quota / private-browsing errors
  }
}

export function getActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setActiveSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_SESSION_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {
    // noop
  }
}

export function createSession(
  provider: string,
  model?: string,
  name?: string,
): ChatSession {
  const now = new Date().toISOString();
  const d = new Date();
  return {
    id: generateSessionId(),
    name:
      name ??
      `Chat ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
    provider,
    model,
    messageCount: 0,
  };
}

export function getSessionById(id: string): ChatSession | undefined {
  return loadSessions().find((s) => s.id === id);
}

/** Prune sessions to MAX_SESSIONS, keeping most recently updated. */
export function pruneSessions(sessions: ChatSession[]): ChatSession[] {
  if (sessions.length <= MAX_SESSIONS) return sessions;
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return sorted.slice(0, MAX_SESSIONS);
}

export function upsertSession(session: ChatSession): ChatSession[] {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  const pruned = pruneSessions(sessions);
  saveSessions(pruned);
  return pruned;
}

export function deleteSessionById(id: string): ChatSession[] {
  const sessions = loadSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
  if (getActiveSessionId() === id) {
    setActiveSessionId(null);
  }
  return sessions;
}

export function renameSessionById(id: string, name: string): ChatSession[] {
  const sessions = loadSessions();
  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.name = name;
    session.updatedAt = new Date().toISOString();
    saveSessions(sessions);
  }
  return sessions;
}
