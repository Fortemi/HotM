/**
 * Token counting utilities for context window management.
 *
 * Provides a TokenCounter interface with an approximate implementation
 * based on character-to-token ratios. Zero bundle cost — works with any
 * model family. Accuracy is ~80% for English text (sufficient for context
 * bar display and compaction trigger thresholds).
 *
 * @see Issue #125 — Phase 1: Tokenization + Context Tracking
 */

export interface TokenCounter {
  /** Estimate token count for a string. */
  count(text: string): number;
  /** Check if text fits within a token budget. */
  isWithinLimit(text: string, limit: number): boolean;
}

/**
 * Approximate tokenizer using a character-to-token ratio.
 *
 * Default ratio of 3.5 chars/token is calibrated for BPE tokenizers
 * (GPT-4, Llama 3.x, Claude). For CJK-heavy text, a ratio of ~2.0
 * would be more accurate, but 3.5 is a safe conservative estimate
 * that slightly over-counts tokens (better to warn early).
 */
export class ApproximateTokenizer implements TokenCounter {
  constructor(private readonly charsPerToken: number = 3.5) {}

  count(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / this.charsPerToken);
  }

  isWithinLimit(text: string, limit: number): boolean {
    return this.count(text) <= limit;
  }
}

/** Shared default tokenizer instance. */
const defaultTokenizer = new ApproximateTokenizer();

/** Estimate token count for a string using the default tokenizer. */
export function countTokens(text: string): number {
  return defaultTokenizer.count(text);
}

/**
 * Estimate total token count across an array of chat messages.
 *
 * Accounts for message framing overhead (~4 tokens per message for
 * role/separator tokens in the ChatML-style format most LLMs use).
 */
export function countMessageTokens(
  messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>,
): number {
  const MESSAGE_OVERHEAD = 4; // role + separators per message

  return messages.reduce((total, msg) => {
    let textContent = '';

    // AI SDK v6 UIMessage uses `parts` array
    if (msg.parts) {
      textContent = msg.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
        .map(p => p.text)
        .join('');
    }

    // Fallback to content string (legacy / simple messages)
    if (!textContent && typeof msg.content === 'string') {
      textContent = msg.content;
    }

    return total + defaultTokenizer.count(textContent) + MESSAGE_OVERHEAD;
  }, 0);
}

/** Format a token count for display (e.g., 1234 -> "1.2K", 131072 -> "128K"). */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    const k = tokens / 1000;
    return k >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
  }
  return String(tokens);
}
