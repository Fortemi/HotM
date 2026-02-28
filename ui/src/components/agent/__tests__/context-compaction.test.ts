import { describe, it, expect } from 'vitest';
import type { UIMessage } from '@ai-sdk/react';
import {
  extractMessageText,
  splitMessages,
  buildCompactionInput,
  createSummaryMessage,
  shouldAutoCompact,
  shouldShowCompactWarning,
  KEEP_RECENT_PAIRS,
  AUTO_COMPACT_THRESHOLD,
  COMPACT_WARNING_THRESHOLD,
  COMPACTION_PROMPT,
} from '../context-compaction';

function makeMessage(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
  } as UIMessage;
}

function makeConversation(pairCount: number): UIMessage[] {
  const msgs: UIMessage[] = [];
  for (let i = 0; i < pairCount; i++) {
    msgs.push(makeMessage(`u-${i}`, 'user', `User message ${i}`));
    msgs.push(makeMessage(`a-${i}`, 'assistant', `Assistant response ${i}`));
  }
  return msgs;
}

describe('context-compaction', () => {
  describe('extractMessageText', () => {
    it('extracts text from user message', () => {
      const msg = makeMessage('1', 'user', 'Hello world');
      expect(extractMessageText(msg)).toBe('User: Hello world');
    });

    it('extracts text from assistant message', () => {
      const msg = makeMessage('1', 'assistant', 'Hi there');
      expect(extractMessageText(msg)).toBe('Assistant: Hi there');
    });

    it('joins multiple text parts', () => {
      const msg = {
        id: '1',
        role: 'user' as const,
        parts: [
          { type: 'text' as const, text: 'Part 1' },
          { type: 'text' as const, text: 'Part 2' },
        ],
      } as UIMessage;
      expect(extractMessageText(msg)).toBe('User: Part 1\nPart 2');
    });

    it('returns empty string for messages with no text parts', () => {
      const msg = {
        id: '1',
        role: 'assistant' as const,
        parts: [{ type: 'tool-invocation' as const, toolCallId: 'tc-1', state: 'input-available', input: {} }],
      } as UIMessage;
      expect(extractMessageText(msg)).toBe('');
    });
  });

  describe('splitMessages', () => {
    it('returns all messages as recent when fewer than keepPairs', () => {
      const msgs = makeConversation(3); // 6 messages (3 pairs)
      const { older, recent } = splitMessages(msgs, KEEP_RECENT_PAIRS);
      expect(older).toHaveLength(0);
      expect(recent).toHaveLength(6);
    });

    it('splits correctly when more messages than keepPairs', () => {
      const msgs = makeConversation(12); // 24 messages (12 pairs)
      const { older, recent } = splitMessages(msgs, 8);
      expect(older.length).toBeGreaterThan(0);
      expect(recent.length).toBeGreaterThan(0);
      expect(older.length + recent.length).toBe(24);
    });

    it('keeps most recent pairs in the recent set', () => {
      const msgs = makeConversation(12);
      const { recent } = splitMessages(msgs, 8);
      // The last message should be in recent
      expect(recent[recent.length - 1].id).toBe('a-11');
    });

    it('handles empty message array', () => {
      const { older, recent } = splitMessages([], 8);
      expect(older).toHaveLength(0);
      expect(recent).toHaveLength(0);
    });

    it('handles single message', () => {
      const msgs = [makeMessage('u-0', 'user', 'Hello')];
      const { older, recent } = splitMessages(msgs, 8);
      expect(older).toHaveLength(0);
      expect(recent).toHaveLength(1);
    });
  });

  describe('buildCompactionInput', () => {
    it('prepends the compaction prompt', () => {
      const msgs = [makeMessage('u-0', 'user', 'Hello')];
      const input = buildCompactionInput(msgs);
      expect(input).toContain(COMPACTION_PROMPT);
      expect(input).toContain('User: Hello');
    });

    it('includes all message texts', () => {
      const msgs = makeConversation(3);
      const input = buildCompactionInput(msgs);
      expect(input).toContain('User message 0');
      expect(input).toContain('Assistant response 0');
      expect(input).toContain('User message 2');
      expect(input).toContain('Assistant response 2');
    });

    it('filters out empty text messages', () => {
      const msgs = [
        makeMessage('u-0', 'user', 'Hello'),
        { id: 'a-0', role: 'assistant' as const, parts: [{ type: 'tool-invocation' as const, toolCallId: 'tc-1', state: 'input-available', input: {} }] } as UIMessage,
        makeMessage('u-1', 'user', 'World'),
      ];
      const input = buildCompactionInput(msgs);
      expect(input).toContain('User: Hello');
      expect(input).toContain('User: World');
      // Should not have empty lines from the tool-only message
    });
  });

  describe('createSummaryMessage', () => {
    it('creates an assistant message with summary text', () => {
      const msg = createSummaryMessage('User asked about ML notes.');
      expect(msg.role).toBe('assistant');
      expect(msg.parts[0]).toEqual(
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('User asked about ML notes.'),
        }),
      );
    });

    it('includes context summary marker', () => {
      const msg = createSummaryMessage('test');
      const text = (msg.parts[0] as { type: string; text: string }).text;
      expect(text).toContain('[Context Summary]');
    });

    it('has a unique ID with compaction prefix', () => {
      const msg = createSummaryMessage('test');
      expect(msg.id).toMatch(/^compaction-\d+$/);
    });
  });

  describe('shouldAutoCompact', () => {
    it('returns false below threshold', () => {
      expect(shouldAutoCompact(AUTO_COMPACT_THRESHOLD - 1)).toBe(false);
      expect(shouldAutoCompact(50)).toBe(false);
      expect(shouldAutoCompact(0)).toBe(false);
    });

    it('returns true at or above threshold', () => {
      expect(shouldAutoCompact(AUTO_COMPACT_THRESHOLD)).toBe(true);
      expect(shouldAutoCompact(95)).toBe(true);
      expect(shouldAutoCompact(100)).toBe(true);
    });
  });

  describe('shouldShowCompactWarning', () => {
    it('returns false below warning threshold', () => {
      expect(shouldShowCompactWarning(COMPACT_WARNING_THRESHOLD - 1)).toBe(false);
      expect(shouldShowCompactWarning(50)).toBe(false);
    });

    it('returns true between warning and auto-compact thresholds', () => {
      expect(shouldShowCompactWarning(COMPACT_WARNING_THRESHOLD)).toBe(true);
      expect(shouldShowCompactWarning(80)).toBe(true);
      expect(shouldShowCompactWarning(AUTO_COMPACT_THRESHOLD - 1)).toBe(true);
    });

    it('returns false at or above auto-compact threshold', () => {
      expect(shouldShowCompactWarning(AUTO_COMPACT_THRESHOLD)).toBe(false);
      expect(shouldShowCompactWarning(95)).toBe(false);
    });
  });

  describe('constants', () => {
    it('has sensible defaults', () => {
      expect(KEEP_RECENT_PAIRS).toBe(8);
      expect(AUTO_COMPACT_THRESHOLD).toBe(90);
      expect(COMPACT_WARNING_THRESHOLD).toBe(75);
      expect(COMPACT_WARNING_THRESHOLD).toBeLessThan(AUTO_COMPACT_THRESHOLD);
    });
  });
});
