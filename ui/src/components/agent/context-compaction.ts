/**
 * Context compaction — the "handoff summary" pattern.
 *
 * When the conversation exceeds a context threshold, older messages are
 * summarized into a compact rolling summary and the originals are discarded.
 * This is the same pattern independently converged upon by Claude Code and
 * OpenAI Codex, and formalized in LangChain's ConversationSummaryBufferMemory.
 *
 * The summary is generated via the Fortemi /chat endpoint (request/response),
 * not the streaming proxy, since we don't need streaming for summarization.
 *
 * @see Issue #125 — Phase 2: Context Compaction
 */

import type { UIMessage } from '@ai-sdk/react';

/** Number of recent message pairs to preserve verbatim during compaction. */
export const KEEP_RECENT_PAIRS = 8;

/** Context utilization threshold (%) that triggers auto-compaction. */
export const AUTO_COMPACT_THRESHOLD = 90;

/** Context utilization threshold (%) that shows a warning. */
export const COMPACT_WARNING_THRESHOLD = 75;

/** The prompt used to generate a handoff summary from older messages. */
export const COMPACTION_PROMPT = `Create a concise handoff summary of the following conversation between a user and a knowledge assistant. This summary will be given to another instance of the assistant to continue the conversation seamlessly.

Include:
- Key topics discussed
- Important decisions or conclusions reached
- Any pending questions or tasks
- Note IDs, collection IDs, or search queries that were referenced
- Tool actions that were performed and their outcomes

Be factual and specific. Use bullet points. Keep under 500 words.

Conversation to summarize:
`;

/**
 * Extract text content from a UIMessage for summarization.
 */
export function extractMessageText(msg: UIMessage): string {
  const role = msg.role === 'user' ? 'User' : 'Assistant';
  const texts: string[] = [];

  for (const part of msg.parts) {
    if (part.type === 'text' && part.text) {
      texts.push(part.text);
    }
  }

  if (texts.length === 0) return '';
  return `${role}: ${texts.join('\n')}`;
}

/**
 * Split messages into "older" (to be summarized) and "recent" (to keep verbatim).
 *
 * Keeps the most recent `keepPairs` user-assistant exchange pairs intact.
 * A "pair" is a user message followed by an assistant message. Unpaired trailing
 * messages are always kept in the recent set.
 */
export function splitMessages(
  messages: UIMessage[],
  keepPairs: number = KEEP_RECENT_PAIRS,
): { older: UIMessage[]; recent: UIMessage[] } {
  if (messages.length === 0) {
    return { older: [], recent: [] };
  }

  // Count message pairs from the end
  let keepCount = 0;
  let pairsFound = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    keepCount++;
    if (messages[i].role === 'user') {
      pairsFound++;
      if (pairsFound >= keepPairs) break;
    }
  }

  // If we'd keep everything, nothing to compact
  if (keepCount >= messages.length) {
    return { older: [], recent: [...messages] };
  }

  const splitIndex = messages.length - keepCount;
  return {
    older: messages.slice(0, splitIndex),
    recent: messages.slice(splitIndex),
  };
}

/**
 * Build the summarization input from older messages.
 */
export function buildCompactionInput(olderMessages: UIMessage[]): string {
  const conversationText = olderMessages
    .map(extractMessageText)
    .filter(Boolean)
    .join('\n\n');

  return COMPACTION_PROMPT + conversationText;
}

/**
 * Create a synthetic "summary" message to inject into the conversation.
 *
 * This appears as an assistant message with a special prefix so the UI can
 * render it distinctly and the LLM understands it's a context summary.
 */
export function createSummaryMessage(summary: string): UIMessage {
  return {
    id: `compaction-${Date.now()}`,
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: `[Context Summary]\n\nA previous conversation was compacted. Here is a summary of what was discussed:\n\n${summary}`,
      },
    ],
  } as UIMessage;
}

/**
 * Check whether compaction should be triggered.
 */
export function shouldAutoCompact(utilizationPercent: number): boolean {
  return utilizationPercent >= AUTO_COMPACT_THRESHOLD;
}

/**
 * Check whether a compaction warning should be shown.
 */
export function shouldShowCompactWarning(utilizationPercent: number): boolean {
  return utilizationPercent >= COMPACT_WARNING_THRESHOLD && utilizationPercent < AUTO_COMPACT_THRESHOLD;
}
