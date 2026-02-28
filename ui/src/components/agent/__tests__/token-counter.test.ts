import { describe, it, expect } from 'vitest';
import {
  ApproximateTokenizer,
  countTokens,
  countMessageTokens,
  formatTokenCount,
} from '../token-counter';

describe('token-counter', () => {
  describe('ApproximateTokenizer', () => {
    it('counts tokens using default 3.5 chars/token ratio', () => {
      const tokenizer = new ApproximateTokenizer();
      // 7 chars / 3.5 = 2 tokens
      expect(tokenizer.count('1234567')).toBe(2);
      // 10 chars / 3.5 = 2.857 -> ceil = 3
      expect(tokenizer.count('0123456789')).toBe(3);
    });

    it('returns 0 for empty strings', () => {
      const tokenizer = new ApproximateTokenizer();
      expect(tokenizer.count('')).toBe(0);
    });

    it('accepts custom chars-per-token ratio', () => {
      const tokenizer = new ApproximateTokenizer(2.0);
      // 10 chars / 2.0 = 5 tokens
      expect(tokenizer.count('0123456789')).toBe(5);
    });

    it('isWithinLimit returns true when within budget', () => {
      const tokenizer = new ApproximateTokenizer();
      expect(tokenizer.isWithinLimit('1234567', 5)).toBe(true);
      expect(tokenizer.isWithinLimit('1234567', 2)).toBe(true);
    });

    it('isWithinLimit returns false when exceeding budget', () => {
      const tokenizer = new ApproximateTokenizer();
      expect(tokenizer.isWithinLimit('1234567', 1)).toBe(false);
    });
  });

  describe('countTokens', () => {
    it('uses the default tokenizer', () => {
      expect(countTokens('')).toBe(0);
      expect(countTokens('hello world')).toBeGreaterThan(0);
    });

    it('produces consistent results', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      expect(countTokens(text)).toBe(countTokens(text));
    });
  });

  describe('countMessageTokens', () => {
    it('counts tokens across multiple messages with parts', () => {
      const messages = [
        { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', parts: [{ type: 'text', text: 'Hi there!' }] },
      ];
      const count = countMessageTokens(messages);
      // Should be text tokens + overhead (4 per message)
      expect(count).toBeGreaterThan(8); // at least 4+4 overhead
    });

    it('handles messages with content string fallback', () => {
      const messages = [
        { role: 'user', content: 'Hello world' },
      ];
      const count = countMessageTokens(messages);
      expect(count).toBeGreaterThan(4); // text + 4 overhead
    });

    it('ignores non-text parts', () => {
      const messages = [
        {
          role: 'assistant',
          parts: [
            { type: 'text', text: 'result' },
            { type: 'tool-invocation', text: undefined },
          ],
        },
      ];
      const count = countMessageTokens(messages);
      // Should only count 'result' text + 4 overhead
      expect(count).toBeGreaterThan(4);
      expect(count).toBeLessThan(20);
    });

    it('returns 0 for empty array', () => {
      expect(countMessageTokens([])).toBe(0);
    });

    it('handles messages with empty parts', () => {
      const messages = [{ role: 'user', parts: [] }];
      // Just the 4-token overhead per message
      expect(countMessageTokens(messages)).toBe(4);
    });
  });

  describe('formatTokenCount', () => {
    it('formats small numbers as-is', () => {
      expect(formatTokenCount(0)).toBe('0');
      expect(formatTokenCount(500)).toBe('500');
      expect(formatTokenCount(999)).toBe('999');
    });

    it('formats thousands with K suffix', () => {
      expect(formatTokenCount(1000)).toBe('1.0K');
      expect(formatTokenCount(1500)).toBe('1.5K');
      expect(formatTokenCount(2048)).toBe('2.0K');
    });

    it('formats large numbers without decimal', () => {
      expect(formatTokenCount(10000)).toBe('10K');
      expect(formatTokenCount(32768)).toBe('33K');
      expect(formatTokenCount(131072)).toBe('131K');
    });
  });
});
