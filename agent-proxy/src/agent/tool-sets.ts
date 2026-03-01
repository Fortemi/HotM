/**
 * Tool subsets and prompt suffixes per intent.
 *
 * Maps each classified intent to the set of tools the LLM should have
 * access to, plus a system prompt suffix that nudges the model's behavior.
 */

import type { AgentToolName, Intent } from './types.js';

// ---------------------------------------------------------------------------
// Tool sets per intent
// ---------------------------------------------------------------------------

/** Read-only tools for exploration. */
const EXPLORE_TOOLS: AgentToolName[] = [
  'search_notes',
  'get_note',
  'list_collections',
  'search_concepts',
  'get_related',
  'list_archives',
  'list_notes',
  'get_attachments',
];

/** All tools for knowledge mutations. */
const ALL_TOOLS: AgentToolName[] = [
  'search_notes',
  'create_note',
  'get_note',
  'revise_note',
  'update_tags',
  'link_notes',
  'list_collections',
  'search_concepts',
  'get_related',
  'list_archives',
  'list_notes',
  'get_attachments',
];

/** Tool availability by intent. Empty array = no tools. */
export const TOOL_SETS: Record<Intent, AgentToolName[]> = {
  conversational: [],
  exploratory: EXPLORE_TOOLS,
  'knowledge-action': ALL_TOOLS,
};

// ---------------------------------------------------------------------------
// Prompt suffixes per intent
// ---------------------------------------------------------------------------

export const INTENT_PROMPT_SUFFIXES: Record<Intent, string> = {
  conversational:
    '\n\nIMPORTANT: Respond conversationally. Do NOT call any tools. ' +
    'Answer the user naturally, and if their request implies a knowledge base action, ' +
    'confirm their intent before proceeding.',

  exploratory:
    '\n\nYou are in exploration mode. You MUST use the available read-only tools ' +
    'to answer — do NOT answer from memory or make up results. ' +
    'Available tools: search_notes, get_note, list_collections, search_concepts, ' +
    'get_related, list_archives, list_notes, get_attachments. ' +
    'Always call at least one tool before responding to the user. ' +
    'Do NOT create, modify, or delete anything.',

  'knowledge-action':
    '\n\nYou have full access to all knowledge base tools. ' +
    'The user wants to take action. Search before creating to avoid duplicates. ' +
    'Explain what you did after each action.',
};
