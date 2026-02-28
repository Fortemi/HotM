import { describe, it, expect } from 'vitest';
import type { UIMessage } from '@ai-sdk/react';
import {
  deriveAgentPhase,
  PHASE_LABELS,
  PHASE_INDICATOR_CLASSES,
} from '../agent-state';

function makeMessage(
  role: 'user' | 'assistant',
  parts: Array<Record<string, unknown>>,
): UIMessage {
  return {
    id: `msg-${Date.now()}`,
    role,
    parts: parts as UIMessage['parts'],
  } as UIMessage;
}

describe('agent-state', () => {
  describe('deriveAgentPhase', () => {
    it('returns idle when not loading', () => {
      expect(deriveAgentPhase(false, [])).toBe('idle');
      expect(
        deriveAgentPhase(false, [
          makeMessage('user', [{ type: 'text', text: 'Hello' }]),
        ]),
      ).toBe('idle');
    });

    it('returns thinking when loading with no messages', () => {
      expect(deriveAgentPhase(true, [])).toBe('thinking');
    });

    it('returns thinking when loading with only user messages', () => {
      const msgs = [makeMessage('user', [{ type: 'text', text: 'Hello' }])];
      expect(deriveAgentPhase(true, msgs)).toBe('thinking');
    });

    it('returns thinking when loading with assistant text-only message', () => {
      const msgs = [
        makeMessage('user', [{ type: 'text', text: 'Hello' }]),
        makeMessage('assistant', [{ type: 'text', text: 'Thinking...' }]),
      ];
      expect(deriveAgentPhase(true, msgs)).toBe('thinking');
    });

    it('returns acting when last assistant message has pending tool calls', () => {
      const msgs = [
        makeMessage('user', [{ type: 'text', text: 'Search for ML notes' }]),
        makeMessage('assistant', [
          { type: 'tool-invocation', state: 'input-available', toolCallId: 'tc-1', toolName: 'search_notes', input: {} },
        ]),
      ];
      expect(deriveAgentPhase(true, msgs)).toBe('acting');
    });

    it('returns verifying when last assistant message has completed tools', () => {
      const msgs = [
        makeMessage('user', [{ type: 'text', text: 'Search for ML notes' }]),
        makeMessage('assistant', [
          { type: 'tool-invocation', state: 'output-available', toolCallId: 'tc-1', toolName: 'search_notes', input: {}, output: {} },
        ]),
      ];
      expect(deriveAgentPhase(true, msgs)).toBe('verifying');
    });

    it('returns verifying on tool error output', () => {
      const msgs = [
        makeMessage('user', [{ type: 'text', text: 'Search for ML notes' }]),
        makeMessage('assistant', [
          { type: 'tool-invocation', state: 'output-error', toolCallId: 'tc-1', toolName: 'search_notes', input: {} },
        ]),
      ];
      expect(deriveAgentPhase(true, msgs)).toBe('verifying');
    });
  });

  describe('constants', () => {
    it('has labels for all phases', () => {
      expect(PHASE_LABELS.idle).toBe('Ready');
      expect(PHASE_LABELS.thinking).toBe('Thinking');
      expect(PHASE_LABELS.acting).toBe('Executing');
      expect(PHASE_LABELS.verifying).toBe('Verifying');
    });

    it('has indicator classes for all phases', () => {
      expect(PHASE_INDICATOR_CLASSES.idle).toContain('bg-');
      expect(PHASE_INDICATOR_CLASSES.thinking).toContain('animate-pulse');
      expect(PHASE_INDICATOR_CLASSES.acting).toContain('animate-pulse');
      expect(PHASE_INDICATOR_CLASSES.verifying).toContain('animate-pulse');
    });
  });
});
