/**
 * Agent state tracking for agentic flow phases.
 *
 * Tracks the current phase of the agent's execution loop:
 *   idle      -> waiting for user input
 *   thinking  -> LLM is generating a response (pre-tool-call)
 *   acting    -> executing tool calls against the Fortemi API
 *   verifying -> LLM is processing tool results
 *
 * Used by the UI to show phase-appropriate indicators.
 *
 * @see Issue #125 — Phase 3: Agentic Flow Enhancement
 */

import type { UIMessage } from '@ai-sdk/react';

export type AgentPhase = 'idle' | 'thinking' | 'acting' | 'verifying';

/**
 * Derive the current agent phase from chat state.
 *
 * This is a pure function that infers the phase from observable state
 * rather than maintaining separate stateful tracking, keeping it
 * consistent with the AI SDK's message-driven architecture.
 */
export function deriveAgentPhase(
  isLoading: boolean,
  messages: UIMessage[],
): AgentPhase {
  if (!isLoading) return 'idle';

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return 'thinking';

  // If the last message is from the assistant and has pending tool calls,
  // the agent is in the "acting" phase (executing tools).
  if (lastMessage.role === 'assistant') {
    const hasPendingTools = lastMessage.parts.some(
      (p) => 'type' in p && p.type === 'tool-invocation' && 'state' in p &&
        (p.state === 'input-streaming' || p.state === 'input-available'),
    );
    if (hasPendingTools) return 'acting';

    const hasCompletedTools = lastMessage.parts.some(
      (p) => 'type' in p && p.type === 'tool-invocation' &&
        'state' in p && (p.state === 'output-available' || p.state === 'output-error'),
    );
    if (hasCompletedTools) return 'verifying';
  }

  return 'thinking';
}

/** Human-readable label for each phase. */
export const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: 'Ready',
  thinking: 'Thinking',
  acting: 'Executing',
  verifying: 'Verifying',
};

/** Animation class for the phase indicator dot. */
export const PHASE_INDICATOR_CLASSES: Record<AgentPhase, string> = {
  idle: 'bg-muted-foreground/30',
  thinking: 'bg-blue-500 animate-pulse',
  acting: 'bg-amber-500 animate-pulse',
  verifying: 'bg-green-500 animate-pulse',
};
