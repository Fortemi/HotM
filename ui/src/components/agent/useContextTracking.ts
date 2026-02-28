/**
 * useContextTracking — tracks token utilization across the conversation.
 *
 * Computes approximate token counts for system prompt + conversation history,
 * calculates what percentage of the model's context window is consumed, and
 * returns a severity level for the UI to render appropriately.
 *
 * @see Issue #125 — Phase 1: Tokenization + Context Tracking
 */

import { useMemo } from 'react';
import { countTokens, countMessageTokens, formatTokenCount } from './token-counter';

export type ContextSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface ContextBreakdown {
  /** Tokens consumed by the system prompt. */
  systemTokens: number;
  /** Tokens consumed by conversation history (all messages). */
  historyTokens: number;
  /** Reserved tokens for model response generation. */
  reserveTokens: number;
  /** Tokens still available for new content. */
  availableTokens: number;
  /** Total context window size (from model info). */
  contextWindow: number;
  /** Percentage of context window consumed (0-100). */
  utilizationPercent: number;
  /** Severity level for UI coloring. */
  severity: ContextSeverity;
  /** Formatted strings for display. */
  formatted: {
    system: string;
    history: string;
    available: string;
    total: string;
  };
}

/** Minimum tokens reserved for model response. */
const RESPONSE_RESERVE = 2048;

/** Severity thresholds (percentage of context window used). */
const THRESHOLDS = {
  moderate: 50,
  high: 75,
  critical: 90,
} as const;

function getSeverity(percent: number): ContextSeverity {
  if (percent >= THRESHOLDS.critical) return 'critical';
  if (percent >= THRESHOLDS.high) return 'high';
  if (percent >= THRESHOLDS.moderate) return 'moderate';
  return 'low';
}

export interface UseContextTrackingOptions {
  /** System prompt text (for token counting). */
  systemPrompt: string;
  /** Conversation messages from useAgentChat. */
  messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>;
  /** Model context window size in tokens. 0 or undefined = tracking disabled. */
  contextWindow: number | undefined;
}

/**
 * Track context window utilization for the agent conversation.
 *
 * Returns null when tracking is disabled (no context window info available).
 */
export function useContextTracking(options: UseContextTrackingOptions): ContextBreakdown | null {
  const { systemPrompt, messages, contextWindow } = options;

  return useMemo(() => {
    if (!contextWindow || contextWindow <= 0) return null;

    const systemTokens = countTokens(systemPrompt);
    const historyTokens = countMessageTokens(messages);
    const reserveTokens = RESPONSE_RESERVE;

    const usedTokens = systemTokens + historyTokens + reserveTokens;
    const availableTokens = Math.max(0, contextWindow - usedTokens);
    const utilizationPercent = Math.min(100, Math.round((usedTokens / contextWindow) * 100));

    return {
      systemTokens,
      historyTokens,
      reserveTokens,
      availableTokens,
      contextWindow,
      utilizationPercent,
      severity: getSeverity(utilizationPercent),
      formatted: {
        system: formatTokenCount(systemTokens),
        history: formatTokenCount(historyTokens),
        available: formatTokenCount(availableTokens),
        total: formatTokenCount(contextWindow),
      },
    };
  }, [systemPrompt, messages, contextWindow]);
}
