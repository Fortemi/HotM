import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionManager } from '../useSessionManager';
import {
  saveSessions,
  createSession,
  setActiveSessionId,
  serializeMessage,
} from '../session-storage';
import type { UIMessage } from '@ai-sdk/react';

// Mock localStorage
const store = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  removeItem: vi.fn((key: string) => store.delete(key)),
  clear: vi.fn(() => store.clear()),
  get length() { return store.size; },
  key: vi.fn(),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const makeMessage = (id: string, text: string, role: 'user' | 'assistant' = 'user'): UIMessage => ({
  id,
  role,
  parts: [{ type: 'text' as const, text }],
});

describe('useSessionManager', () => {
  it('creates an initial session on mount when none exist', () => {
    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );
    expect(result.current.activeSession).not.toBeNull();
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.activeSession?.provider).toBe('fortemi');
  });

  it('restores active session on mount', () => {
    // Pre-populate storage with a session
    const session = createSession('anthropic', 'claude', 'Restored');
    session.messages = [serializeMessage(makeMessage('m1', 'Hello'))];
    session.messageCount = 1;
    saveSessions([session]);
    setActiveSessionId(session.id);

    const { result } = renderHook(() =>
      useSessionManager({ provider: 'anthropic', model: 'claude' }),
    );
    expect(result.current.activeSession?.name).toBe('Restored');
  });

  it('restoreMessages returns active session messages', () => {
    const session = createSession('fortemi', undefined, 'With Messages');
    const msg = makeMessage('m1', 'Test');
    session.messages = [serializeMessage(msg)];
    session.messageCount = 1;
    saveSessions([session]);
    setActiveSessionId(session.id);

    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );
    const restored = result.current.restoreMessages();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('m1');
  });

  it('creates a new session', () => {
    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );
    const initialId = result.current.activeSession?.id;

    act(() => {
      result.current.createSession('Custom Name');
    });

    expect(result.current.activeSession?.name).toBe('Custom Name');
    expect(result.current.activeSession?.id).not.toBe(initialId);
    expect(result.current.sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('switches between sessions', () => {
    const s1 = createSession('fortemi', undefined, 'Session A');
    s1.messages = [serializeMessage(makeMessage('a1', 'From A'))];
    s1.messageCount = 1;
    const s2 = createSession('fortemi', undefined, 'Session B');
    s2.messages = [serializeMessage(makeMessage('b1', 'From B'))];
    s2.messageCount = 1;
    saveSessions([s1, s2]);
    setActiveSessionId(s1.id);

    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );

    let messages: UIMessage[] = [];
    act(() => {
      messages = result.current.switchSession(s2.id);
    });

    expect(result.current.activeSession?.id).toBe(s2.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('b1');
  });

  it('returns empty array for non-existent session switch', () => {
    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );

    let messages: UIMessage[] = [];
    act(() => {
      messages = result.current.switchSession('nonexistent');
    });
    expect(messages).toEqual([]);
  });

  it('debounced saveMessages persists after delay', () => {
    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );

    const msgs = [makeMessage('m1', 'Hello'), makeMessage('m2', 'World')];
    act(() => {
      result.current.saveMessages(msgs);
    });

    // Before debounce fires, session should still have 0 messages
    expect(result.current.activeSession?.messageCount).toBe(0);

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.activeSession?.messageCount).toBe(2);
  });

  it('renames a session', () => {
    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );
    const id = result.current.activeSession!.id;

    act(() => {
      result.current.renameSession(id, 'Renamed');
    });

    expect(result.current.activeSession?.name).toBe('Renamed');
  });

  it('deletes non-active session without changing messages', () => {
    const s1 = createSession('fortemi', undefined, 'Active');
    const s2 = createSession('fortemi', undefined, 'Other');
    saveSessions([s1, s2]);
    setActiveSessionId(s1.id);

    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );

    act(() => {
      result.current.deleteSession(s2.id);
    });

    expect(result.current.activeSession?.id).toBe(s1.id);
    expect(result.current.sessions.find(s => s.id === s2.id)).toBeUndefined();
  });

  it('deletes active session and switches to next', () => {
    const s1 = createSession('fortemi', undefined, 'First');
    s1.messages = [serializeMessage(makeMessage('a1', 'From First'))];
    s1.messageCount = 1;
    const s2 = createSession('fortemi', undefined, 'Second');
    s2.messages = [serializeMessage(makeMessage('b1', 'From Second'))];
    s2.messageCount = 1;
    saveSessions([s1, s2]);
    setActiveSessionId(s1.id);

    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );

    let nextMessages: UIMessage[] = [];
    act(() => {
      nextMessages = result.current.deleteSession(s1.id);
    });

    // Should switch to s2
    expect(result.current.activeSession?.name).toBe('Second');
    expect(nextMessages).toHaveLength(1);
    expect(nextMessages[0].id).toBe('b1');
  });

  it('deletes last session and creates new empty one', () => {
    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );
    const onlyId = result.current.activeSession!.id;

    let nextMessages: UIMessage[] = [];
    act(() => {
      nextMessages = result.current.deleteSession(onlyId);
    });

    expect(nextMessages).toEqual([]);
    expect(result.current.activeSession).not.toBeNull();
    expect(result.current.activeSession?.id).not.toBe(onlyId);
  });

  it('newSession creates empty session', () => {
    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );
    const oldId = result.current.activeSession!.id;

    let msgs: UIMessage[] = [];
    act(() => {
      msgs = result.current.newSession();
    });

    expect(msgs).toEqual([]);
    expect(result.current.activeSession?.id).not.toBe(oldId);
    expect(result.current.activeSession?.messageCount).toBe(0);
  });

  it('showPanel toggles', () => {
    const { result } = renderHook(() =>
      useSessionManager({ provider: 'fortemi' }),
    );
    expect(result.current.showPanel).toBe(false);

    act(() => {
      result.current.setShowPanel(true);
    });
    expect(result.current.showPanel).toBe(true);
  });
});
