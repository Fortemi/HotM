/**
 * Shared types for the agent flow state machine.
 */

import type { agentTools } from '../tools.js';

/** Tool names keyed from the agentTools record. */
export type AgentToolName = keyof typeof agentTools;

/** Classified user intent. */
export type Intent = 'conversational' | 'exploratory' | 'knowledge-action';

/** Summary of a completed AI SDK step, fed back into the machine. */
export interface StepSummary {
  stepNumber: number;
  finishReason: string;
  hasToolCalls: boolean;
  toolNames: string[];
  textLength: number;
}

/** XState machine context — carried across states. */
export interface FlowContext {
  /** Classified intent for this request. */
  intent: Intent;
  /** Whether this is the first user message in the conversation. */
  isFirstTurn: boolean;
  /** Latest user message text (used for classification). */
  userMessage: string;
  /** Active tool names for the current intent. */
  activeTools: AgentToolName[];
  /** System prompt suffix for the current intent. */
  promptSuffix: string;
  /** Number of AI SDK steps completed in this request. */
  stepCount: number;
  /** Number of classify-configure-ready loops completed. */
  loopCount: number;
  /** Maximum AI SDK steps allowed. */
  maxSteps: number;
  /** Maximum classify loops allowed. */
  maxLoops: number;
  /** History of completed steps. */
  steps: StepSummary[];
}

/** Events consumed by the flow machine. */
export type FlowEvent =
  | { type: 'CLASSIFY'; userMessage: string; isFirstTurn: boolean; maxSteps: number }
  | { type: 'STEP_COMPLETE'; step: StepSummary }
  | { type: 'DONE' };
