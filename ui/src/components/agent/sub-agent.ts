/**
 * Sub-agent orchestration — spawn focused child agents with isolated context.
 *
 * Implements the RLM (Recursive Language Model) pattern where a parent
 * orchestrator spawns focused child agents, each with isolated context
 * containing only what they need. Results are aggregated as compact
 * summaries back into the parent context.
 *
 * Supports two dispatch patterns:
 * - fanOut: run independent sub-agents in parallel
 * - chain: run sub-agents sequentially, feeding results forward
 *
 * @see Issue #125 — Phase 4: Sub-Agent Orchestration
 */

import { api } from '@/api';
import type { AgentTaskType } from './model-tiering';

/** A focused task to be executed by a sub-agent. */
export interface SubAgentTask {
  /** Unique task identifier. */
  id: string;
  /** Task type (influences model selection). */
  type: AgentTaskType;
  /** Natural language instructions for the sub-agent. */
  instructions: string;
  /** Model override (from model tiering). */
  model?: string;
  /** Maximum tokens for the sub-agent's response. */
  maxTokens?: number;
}

/** Result returned by a sub-agent. */
export interface SubAgentResult {
  /** Task ID this result corresponds to. */
  taskId: string;
  /** Compact summary of the result (for parent context). */
  summary: string;
  /** Structured data if available. */
  data?: unknown;
  /** Whether the sub-agent succeeded. */
  success: boolean;
  /** Error message if failed. */
  error?: string;
}

/** Status of a sub-agent execution. */
export type SubAgentStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Tracks sub-agent execution state for UI display. */
export interface SubAgentProgress {
  taskId: string;
  type: AgentTaskType;
  status: SubAgentStatus;
  summary?: string;
}

/**
 * Execute a single sub-agent task via the Fortemi /chat endpoint.
 *
 * Each sub-agent gets its own isolated /chat call — no conversation
 * history from the parent. The instructions are self-contained.
 */
export async function runSubAgent(task: SubAgentTask): Promise<SubAgentResult> {
  try {
    const response = await api.chat.sendMessage(task.instructions, {
      // Sub-agents don't carry conversation history — isolation by design
    });

    const summary = response.messages?.[0]?.content ?? '';

    return {
      taskId: task.id,
      summary: summary.slice(0, 2000), // Cap at ~500 tokens
      data: response,
      success: true,
    };
  } catch (err) {
    return {
      taskId: task.id,
      summary: `Sub-agent failed: ${err instanceof Error ? err.message : String(err)}`,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fan-out: run independent sub-agents in parallel.
 *
 * All tasks are dispatched simultaneously. Results are collected when
 * all complete (or fail). Use for tasks with no ordering constraints.
 *
 * Hard limit: maximum 5 concurrent sub-agents to prevent resource exhaustion.
 */
export async function fanOut(
  tasks: SubAgentTask[],
  onProgress?: (progress: SubAgentProgress) => void,
): Promise<SubAgentResult[]> {
  const MAX_CONCURRENT = 5;
  const limitedTasks = tasks.slice(0, MAX_CONCURRENT);

  // Notify start
  limitedTasks.forEach(task =>
    onProgress?.({ taskId: task.id, type: task.type, status: 'running' }),
  );

  const results = await Promise.all(
    limitedTasks.map(async (task) => {
      const result = await runSubAgent(task);
      onProgress?.({
        taskId: task.id,
        type: task.type,
        status: result.success ? 'completed' : 'failed',
        summary: result.summary,
      });
      return result;
    }),
  );

  return results;
}

/**
 * Chain: run sub-agents sequentially, feeding results forward.
 *
 * Each sub-agent receives the previous result as additional context.
 * Use for tasks that build on each other (search -> analyze -> synthesize).
 */
export async function chain(
  tasks: SubAgentTask[],
  onProgress?: (progress: SubAgentProgress) => void,
): Promise<SubAgentResult[]> {
  const results: SubAgentResult[] = [];

  for (const task of tasks) {
    onProgress?.({ taskId: task.id, type: task.type, status: 'running' });

    // Inject previous results as context
    const previousContext = results
      .filter(r => r.success)
      .map(r => `[Previous result from task ${r.taskId}]: ${r.summary}`)
      .join('\n\n');

    const enrichedTask: SubAgentTask = {
      ...task,
      instructions: previousContext
        ? `${task.instructions}\n\nContext from previous steps:\n${previousContext}`
        : task.instructions,
    };

    const result = await runSubAgent(enrichedTask);
    results.push(result);

    onProgress?.({
      taskId: task.id,
      type: task.type,
      status: result.success ? 'completed' : 'failed',
      summary: result.summary,
    });

    // Stop chain on failure (subsequent tasks depend on this result)
    if (!result.success) break;
  }

  return results;
}

/**
 * Aggregate sub-agent results into a concise summary for the parent context.
 *
 * This keeps the parent's context window clean — only the aggregated
 * summary is injected, not the raw results from each sub-agent.
 */
export function aggregateResults(results: SubAgentResult[]): string {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  const parts: string[] = [];

  if (successful.length > 0) {
    parts.push('Results:');
    for (const r of successful) {
      parts.push(`- [${r.taskId}]: ${r.summary}`);
    }
  }

  if (failed.length > 0) {
    parts.push(`\nFailed (${failed.length}/${results.length}):`);
    for (const r of failed) {
      parts.push(`- [${r.taskId}]: ${r.error ?? 'Unknown error'}`);
    }
  }

  return parts.join('\n');
}
