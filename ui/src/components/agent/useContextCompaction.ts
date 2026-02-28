/**
 * useContextCompaction — manages context window compaction.
 *
 * Provides a `compact()` function that summarizes older messages via the
 * Fortemi /chat endpoint, replaces them with a rolling summary, and keeps
 * recent messages verbatim. Also monitors context utilization for auto-compact
 * and warning thresholds.
 *
 * @see Issue #125 — Phase 2: Context Compaction
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { api } from '@/api';
import {
  splitMessages,
  buildCompactionInput,
  createSummaryMessage,
  shouldAutoCompact,
  shouldShowCompactWarning,
  KEEP_RECENT_PAIRS,
} from './context-compaction';

export interface UseContextCompactionOptions {
  /** Current conversation messages. */
  messages: UIMessage[];
  /** Function to replace the message array (from useChat). */
  setMessages: (messages: UIMessage[]) => void;
  /** Current context utilization percentage (from useContextTracking). */
  utilizationPercent: number | undefined;
  /** Whether the chat is currently streaming (block compaction during streaming). */
  isLoading: boolean;
}

export interface UseContextCompactionReturn {
  /** Manually trigger compaction. */
  compact: () => Promise<void>;
  /** Whether compaction is currently in progress. */
  isCompacting: boolean;
  /** Whether the compact warning threshold is reached. */
  showWarning: boolean;
  /** Whether auto-compaction was triggered (for UI notification). */
  wasAutoCompacted: boolean;
  /** Dismiss the auto-compaction notification. */
  dismissAutoCompacted: () => void;
  /** Whether there are enough messages to compact. */
  canCompact: boolean;
}

export function useContextCompaction(
  options: UseContextCompactionOptions,
): UseContextCompactionReturn {
  const { messages, setMessages, utilizationPercent, isLoading } = options;

  const [isCompacting, setIsCompacting] = useState(false);
  const [wasAutoCompacted, setWasAutoCompacted] = useState(false);

  // Prevent auto-compact from firing repeatedly in the same threshold crossing
  const autoCompactedRef = useRef(false);

  const { older } = splitMessages(messages, KEEP_RECENT_PAIRS);
  const canCompact = older.length > 0;

  const showWarning = !!(
    utilizationPercent != null &&
    shouldShowCompactWarning(utilizationPercent) &&
    canCompact
  );

  const compact = useCallback(async () => {
    if (isCompacting || isLoading) return;

    const { older: olderMsgs, recent } = splitMessages(messages, KEEP_RECENT_PAIRS);
    if (olderMsgs.length === 0) return;

    setIsCompacting(true);
    try {
      const input = buildCompactionInput(olderMsgs);
      const response = await api.chat.sendMessage(input);

      // Extract the summary text from the response
      const summaryText =
        response.messages?.[0]?.content ??
        'Previous conversation context was compacted but summarization was unavailable.';

      const summaryMessage = createSummaryMessage(summaryText);
      setMessages([summaryMessage, ...recent]);
    } catch {
      // If summarization fails, still compact but with a fallback message
      const { recent } = splitMessages(messages, KEEP_RECENT_PAIRS);
      const fallbackSummary = createSummaryMessage(
        'Previous conversation was compacted. Summarization was unavailable — some context may be lost.',
      );
      setMessages([fallbackSummary, ...recent]);
    } finally {
      setIsCompacting(false);
    }
  }, [messages, setMessages, isCompacting, isLoading]);

  // Auto-compact when utilization exceeds threshold
  useEffect(() => {
    if (
      utilizationPercent != null &&
      shouldAutoCompact(utilizationPercent) &&
      canCompact &&
      !isCompacting &&
      !isLoading &&
      !autoCompactedRef.current
    ) {
      autoCompactedRef.current = true;
      compact().then(() => {
        setWasAutoCompacted(true);
      });
    }

    // Reset the auto-compact guard when utilization drops back below threshold
    if (utilizationPercent != null && !shouldAutoCompact(utilizationPercent)) {
      autoCompactedRef.current = false;
    }
  }, [utilizationPercent, canCompact, isCompacting, isLoading, compact]);

  const dismissAutoCompacted = useCallback(() => {
    setWasAutoCompacted(false);
  }, []);

  return {
    compact,
    isCompacting,
    showWarning,
    wasAutoCompacted,
    dismissAutoCompacted,
    canCompact,
  };
}
