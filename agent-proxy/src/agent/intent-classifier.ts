/**
 * Lightweight regex/keyword intent classifier.
 *
 * Zero-latency classification — no LLM call needed. Runs pattern matching
 * against the latest user message to determine whether the user wants to
 * chat, explore, or take action on the knowledge base.
 */

import type { Intent } from './types.js';

// ---------------------------------------------------------------------------
// Pattern tables
// ---------------------------------------------------------------------------

/** Patterns that indicate the user wants to mutate the knowledge base. */
const ACTION_PATTERNS: RegExp[] = [
  /\b(create|write|add|make|draft|compose)\b.*\b(note|entry|document)\b/i,
  /\b(tag|retag|untag|label)\b/i,
  /\b(link|connect|associate|relate)\b.*\b(note|notes)\b/i,
  /\b(revise|rewrite|edit|update|modify|change)\b/i,
  /\b(remove|delete)\b.*\b(tag|link)\b/i,
];

/** Patterns that indicate the user wants to read/search the knowledge base. */
const EXPLORE_PATTERNS: RegExp[] = [
  /\b(find|search|look\s+up|look\s+for|show\s+me|list|browse|query)\b/i,
  /\b(tell\s+me\s+(about|more)|describe|explain|summarize|overview|what('s| is| are))\b/i,
  /\b(related|similar|connections?|linked)\b.*\b(note|notes)\b/i,
  /\b(what|which)\b.*\b(note|notes|collection|collections|archive|archives)\b/i,
  /\bnote[_\s-]?[a-f0-9]{8}/i, // note ID reference
  /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i, // UUID
  /\bconcept|concepts|taxonomy\b/i,
  /\bcollection|collections|archive|archives\b/i,
  /\b(my\s+)?(notes?|knowledge\s+base|content|entries|documents?)\b/i,
];

/** Patterns that strongly signal a conversational message (no tools). */
const CONVERSATIONAL_PATTERNS: RegExp[] = [
  /^(hi|hey|hello|greetings|good\s+(morning|afternoon|evening)|howdy|yo)\b/i,
  /^(thanks|thank\s+you|thx|ty|cheers)\b/i,
  /\b(what\s+can\s+you\s+do|help\s+me|how\s+do\s+(i|you)|what\s+are\s+you)\b/i,
  /^(yes|no|ok|okay|sure|got\s+it|makes\s+sense)\b/i,
];

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * Classify user intent from the latest message text.
 *
 * @param message - The latest user message.
 * @param isFirstTurn - If true, always returns 'conversational' to establish
 *   rapport before using tools.
 * @returns The classified intent.
 */
export function classifyIntent(message: string, isFirstTurn: boolean): Intent {
  // First turn: always conversational regardless of content.
  if (isFirstTurn) {
    return 'conversational';
  }

  const trimmed = message.trim();

  // Empty or very short messages → conversational
  if (trimmed.length < 3) {
    return 'conversational';
  }

  // Check action patterns first (higher specificity)
  if (ACTION_PATTERNS.some((p) => p.test(trimmed))) {
    return 'knowledge-action';
  }

  // Check exploratory patterns
  if (EXPLORE_PATTERNS.some((p) => p.test(trimmed))) {
    return 'exploratory';
  }

  // Check explicit conversational patterns
  if (CONVERSATIONAL_PATTERNS.some((p) => p.test(trimmed))) {
    return 'conversational';
  }

  // Default: conversational (safe — no tools)
  return 'conversational';
}

/**
 * Detect if streaming text reveals write intent that the initial
 * classification missed (e.g., user asked "can you help me create..."
 * which classified as conversational, but the LLM's response is trying
 * to call write tools).
 *
 * Used for intent escalation in the evaluate state.
 */
export function shouldEscalateToAction(
  currentIntent: Intent,
  toolNames: string[],
): boolean {
  if (currentIntent === 'knowledge-action') return false;

  const writeTool = toolNames.some((t) =>
    ['create_note', 'revise_note', 'update_tags'].includes(t),
  );
  return writeTool;
}
