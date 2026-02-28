import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSessions,
  saveSessions,
  createSession,
  upsertSession,
  deleteSessionById,
  renameSessionById,
  getSessionById,
  pruneSessions,
  getActiveSessionId,
  setActiveSessionId,
  serializeMessage,
  deserializeMessage,
  SESSION_STORAGE_KEY,
  MAX_SESSIONS,
  type ChatSession,
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
});

describe('session-storage', () => {
  describe('loadSessions / saveSessions', () => {
    it('returns empty array when nothing stored', () => {
      expect(loadSessions()).toEqual([]);
    });

    it('round-trips sessions', () => {
      const sessions = [createSession('fortemi', 'llama3.2', 'Test')];
      saveSessions(sessions);
      const loaded = loadSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('Test');
    });

    it('returns empty array for corrupt JSON', () => {
      store.set(SESSION_STORAGE_KEY, 'not-json');
      expect(loadSessions()).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      store.set(SESSION_STORAGE_KEY, '{"not":"array"}');
      expect(loadSessions()).toEqual([]);
    });
  });

  describe('createSession', () => {
    it('creates session with generated id', () => {
      const s = createSession('fortemi');
      expect(s.id).toMatch(/^session-\d+-\w+$/);
      expect(s.provider).toBe('fortemi');
      expect(s.messageCount).toBe(0);
      expect(s.messages).toEqual([]);
    });

    it('uses provided name', () => {
      const s = createSession('anthropic', 'claude', 'My Chat');
      expect(s.name).toBe('My Chat');
      expect(s.model).toBe('claude');
    });

    it('generates default name with date', () => {
      const s = createSession('fortemi');
      expect(s.name).toMatch(/^Chat /);
    });
  });

  describe('upsertSession', () => {
    it('inserts new session', () => {
      const s = createSession('fortemi');
      const result = upsertSession(s);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(s.id);
    });

    it('updates existing session', () => {
      const s = createSession('fortemi', undefined, 'Original');
      upsertSession(s);
      const updated = { ...s, name: 'Updated', updatedAt: new Date().toISOString() };
      const result = upsertSession(updated);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Updated');
    });
  });

  describe('deleteSessionById', () => {
    it('removes the session', () => {
      const s = createSession('fortemi');
      upsertSession(s);
      const result = deleteSessionById(s.id);
      expect(result).toHaveLength(0);
    });

    it('clears active session if deleted was active', () => {
      const s = createSession('fortemi');
      upsertSession(s);
      setActiveSessionId(s.id);
      deleteSessionById(s.id);
      expect(getActiveSessionId()).toBeNull();
    });

    it('preserves active session if deleted was not active', () => {
      const a = createSession('fortemi', undefined, 'A');
      const b = createSession('fortemi', undefined, 'B');
      upsertSession(a);
      upsertSession(b);
      setActiveSessionId(a.id);
      deleteSessionById(b.id);
      expect(getActiveSessionId()).toBe(a.id);
    });
  });

  describe('renameSessionById', () => {
    it('renames the session', () => {
      const s = createSession('fortemi', undefined, 'Old');
      upsertSession(s);
      const result = renameSessionById(s.id, 'New Name');
      expect(result.find(x => x.id === s.id)?.name).toBe('New Name');
    });

    it('is no-op for non-existent id', () => {
      const result = renameSessionById('nonexistent', 'Name');
      expect(result).toEqual([]);
    });
  });

  describe('getSessionById', () => {
    it('returns session when found', () => {
      const s = createSession('fortemi', undefined, 'Find Me');
      upsertSession(s);
      expect(getSessionById(s.id)?.name).toBe('Find Me');
    });

    it('returns undefined when not found', () => {
      expect(getSessionById('nonexistent')).toBeUndefined();
    });
  });

  describe('active session', () => {
    it('returns null when no active session set', () => {
      expect(getActiveSessionId()).toBeNull();
    });

    it('stores and retrieves active session id', () => {
      setActiveSessionId('test-id');
      expect(getActiveSessionId()).toBe('test-id');
    });

    it('clears active session id', () => {
      setActiveSessionId('test-id');
      setActiveSessionId(null);
      expect(getActiveSessionId()).toBeNull();
    });
  });

  describe('pruneSessions', () => {
    it('keeps sessions under MAX_SESSIONS', () => {
      const sessions = Array.from({ length: 30 }, (_, i) =>
        createSession('fortemi', undefined, `Session ${i}`),
      );
      expect(pruneSessions(sessions)).toHaveLength(30);
    });

    it('prunes to MAX_SESSIONS, keeping most recent', () => {
      const sessions: ChatSession[] = Array.from({ length: MAX_SESSIONS + 5 }, (_, i) => ({
        id: `s-${i}`,
        name: `Session ${i}`,
        createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
        updatedAt: new Date(2026, 0, 1, 0, i).toISOString(),
        messages: [],
        provider: 'fortemi',
        messageCount: 0,
      }));
      const pruned = pruneSessions(sessions);
      expect(pruned).toHaveLength(MAX_SESSIONS);
      // Should have the most recent (highest index) sessions
      expect(pruned[0].id).toBe(`s-${MAX_SESSIONS + 4}`);
    });
  });

  describe('serializeMessage / deserializeMessage', () => {
    it('round-trips a UIMessage', () => {
      const msg: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      };
      const serialized = serializeMessage(msg);
      expect(serialized.parts).toEqual([{ type: 'text', text: 'Hello' }]);
      expect(serialized.id).toBe('msg-1');
      expect(serialized.role).toBe('user');

      const deserialized = deserializeMessage(serialized);
      expect(deserialized.id).toBe('msg-1');
      expect(deserialized.role).toBe('user');
      expect(deserialized.parts).toEqual([{ type: 'text', text: 'Hello' }]);
    });

    it('preserves complex parts structure', () => {
      const msg: UIMessage = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Here is the result:' },
          { type: 'text', text: 'Done.' },
        ],
      };
      const serialized = serializeMessage(msg);
      const deserialized = deserializeMessage(serialized);
      expect(deserialized.parts).toHaveLength(2);
    });
  });
});
