/**
 * Model tiering — intelligent model selection from the Fortemi catalog.
 *
 * Selects the most appropriate model for each task type based on the
 * available models in the Fortemi catalog. Smaller/faster models handle
 * simple tasks (search, read), while larger models handle reasoning.
 *
 * Supports the dual-model architecture where a reasoning model requests
 * tools in natural language and a tool-calling model translates those
 * requests into structured tool calls.
 *
 * @see Issue #125 — Phase 4: Sub-Agent Orchestration
 */

import type { ChatModelInfo } from '@/api';

/** Task types that influence model selection. */
export type AgentTaskType =
  | 'reasoning'      // Complex reasoning, planning, synthesis
  | 'tool-calling'   // Structured tool call generation
  | 'search'         // Note search, exploration (read-only)
  | 'analysis'       // Note content analysis, theme extraction
  | 'summarization'; // Context compaction, result aggregation

/** Model selection criteria. */
interface ModelSelectionCriteria {
  /** Minimum context window required. */
  minContext?: number;
  /** Prefer models with these family names (ordered by preference). */
  preferredFamilies?: string[];
  /** Maximum parameter size (e.g., "8B" -> prefer smaller). */
  maxParameterSize?: string;
  /** Minimum speed requirement (tokens/sec). */
  minSpeed?: number;
}

/** Task-to-criteria mapping. */
const TASK_CRITERIA: Record<AgentTaskType, ModelSelectionCriteria> = {
  reasoning: {
    minContext: 8192,
    preferredFamilies: ['llama', 'qwen', 'gemma'],
  },
  'tool-calling': {
    minContext: 4096,
    preferredFamilies: ['llama', 'qwen'],
    minSpeed: 20,
  },
  search: {
    minContext: 4096,
    maxParameterSize: '8B',
    minSpeed: 30,
  },
  analysis: {
    minContext: 8192,
    preferredFamilies: ['llama', 'qwen'],
  },
  summarization: {
    minContext: 8192,
    minSpeed: 20,
  },
};

/** Parse parameter size string (e.g., "8B") into a numeric value for comparison. */
function parseParameterSize(size: string): number {
  const match = size.match(/([\d.]+)\s*([BMK])/i);
  if (!match) return Infinity;
  const [, num, unit] = match;
  const value = parseFloat(num);
  switch (unit.toUpperCase()) {
    case 'B': return value * 1e9;
    case 'M': return value * 1e6;
    case 'K': return value * 1e3;
    default: return value;
  }
}

/**
 * Select the best available model for a given task type.
 *
 * Returns the model name, or undefined if no suitable model found
 * (caller should fall back to the default model).
 */
export function selectModelForTask(
  taskType: AgentTaskType,
  availableModels: ChatModelInfo[],
  defaultModel?: string,
): string | undefined {
  if (availableModels.length === 0) return defaultModel;

  const criteria = TASK_CRITERIA[taskType];
  const candidates = availableModels.filter((m) => {
    // Filter by minimum context window
    if (criteria.minContext && m.context_window < criteria.minContext) return false;

    // Filter by maximum parameter size
    if (criteria.maxParameterSize) {
      const maxSize = parseParameterSize(criteria.maxParameterSize);
      const modelSize = parseParameterSize(m.parameter_size);
      if (modelSize > maxSize) return false;
    }

    // Filter by minimum speed
    if (criteria.minSpeed && m.speed_tok_s < criteria.minSpeed) return false;

    return true;
  });

  if (candidates.length === 0) return defaultModel;

  // Score candidates based on criteria
  const scored = candidates.map((m) => {
    let score = 0;

    // Prefer models from preferred families
    if (criteria.preferredFamilies) {
      const familyIndex = criteria.preferredFamilies.indexOf(m.family.toLowerCase());
      if (familyIndex >= 0) {
        score += (criteria.preferredFamilies.length - familyIndex) * 10;
      }
    }

    // For search tasks, prefer smaller/faster models
    if (taskType === 'search') {
      score += m.speed_tok_s / 10;
      score -= parseParameterSize(m.parameter_size) / 1e9;
    }

    // For reasoning tasks, prefer larger models
    if (taskType === 'reasoning') {
      score += parseParameterSize(m.parameter_size) / 1e9;
      score += m.context_window / 10000;
    }

    // For tool-calling, balance speed and capability
    if (taskType === 'tool-calling') {
      score += m.speed_tok_s / 5;
      score += m.context_window / 10000;
    }

    return { model: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].model.model;
}

/**
 * Build a model tier map from the available catalog.
 *
 * Returns a mapping of task types to recommended models.
 * Used by the sub-agent orchestrator to route tasks to appropriate models.
 */
export function buildModelTierMap(
  availableModels: ChatModelInfo[],
  defaultModel?: string,
): Record<AgentTaskType, string | undefined> {
  return {
    reasoning: selectModelForTask('reasoning', availableModels, defaultModel),
    'tool-calling': selectModelForTask('tool-calling', availableModels, defaultModel),
    search: selectModelForTask('search', availableModels, defaultModel),
    analysis: selectModelForTask('analysis', availableModels, defaultModel),
    summarization: selectModelForTask('summarization', availableModels, defaultModel),
  };
}
