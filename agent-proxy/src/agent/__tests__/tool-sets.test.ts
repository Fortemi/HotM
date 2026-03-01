/**
 * Tests for tool-set configuration.
 *
 * Verifies that TOOL_SETS and INTENT_PROMPT_SUFFIXES are correctly
 * configured and aligned with the agentTools registry.
 */

import { describe, it, expect } from 'vitest';
import { TOOL_SETS, INTENT_PROMPT_SUFFIXES } from '../tool-sets.js';
import { agentTools } from '../../tools.js';

const ALL_TOOL_NAMES = Object.keys(agentTools);
const WRITE_TOOLS = ['create_note', 'revise_note', 'update_tags', 'link_notes'];
const READ_TOOLS = ALL_TOOL_NAMES.filter((t) => !WRITE_TOOLS.includes(t));

describe('TOOL_SETS', () => {
  it('covers all three intents', () => {
    expect(TOOL_SETS).toHaveProperty('conversational');
    expect(TOOL_SETS).toHaveProperty('exploratory');
    expect(TOOL_SETS).toHaveProperty('knowledge-action');
  });

  describe('conversational', () => {
    it('has no tools (safe default)', () => {
      expect(TOOL_SETS.conversational).toEqual([]);
    });
  });

  describe('exploratory', () => {
    it('includes only read-only tools', () => {
      for (const tool of TOOL_SETS.exploratory) {
        expect(WRITE_TOOLS, `${tool} should not be in exploratory`).not.toContain(tool);
      }
    });

    it('includes all read-only tools', () => {
      for (const tool of READ_TOOLS) {
        expect(TOOL_SETS.exploratory, `missing ${tool}`).toContain(tool);
      }
    });

    it('includes key search tools', () => {
      expect(TOOL_SETS.exploratory).toContain('search_notes');
      expect(TOOL_SETS.exploratory).toContain('get_note');
      expect(TOOL_SETS.exploratory).toContain('list_notes');
      expect(TOOL_SETS.exploratory).toContain('list_archives');
    });
  });

  describe('knowledge-action', () => {
    it('includes ALL tools', () => {
      for (const tool of ALL_TOOL_NAMES) {
        expect(TOOL_SETS['knowledge-action'], `missing ${tool}`).toContain(tool);
      }
    });

    it('includes write tools', () => {
      for (const tool of WRITE_TOOLS) {
        expect(TOOL_SETS['knowledge-action']).toContain(tool);
      }
    });
  });

  it('all tools in every set are valid agentTools keys', () => {
    for (const [intent, tools] of Object.entries(TOOL_SETS)) {
      for (const tool of tools) {
        expect(ALL_TOOL_NAMES, `${tool} in ${intent} is not a valid tool`).toContain(tool);
      }
    }
  });
});

describe('INTENT_PROMPT_SUFFIXES', () => {
  it('covers all three intents', () => {
    expect(INTENT_PROMPT_SUFFIXES).toHaveProperty('conversational');
    expect(INTENT_PROMPT_SUFFIXES).toHaveProperty('exploratory');
    expect(INTENT_PROMPT_SUFFIXES).toHaveProperty('knowledge-action');
  });

  it('conversational suffix instructs no tool usage', () => {
    expect(INTENT_PROMPT_SUFFIXES.conversational).toMatch(/do not call.*tool/i);
  });

  it('exploratory suffix instructs read-only tool usage', () => {
    const suffix = INTENT_PROMPT_SUFFIXES.exploratory;
    expect(suffix).toMatch(/read-only/i);
    expect(suffix).toMatch(/do not create/i);
  });

  it('knowledge-action suffix allows full access', () => {
    expect(INTENT_PROMPT_SUFFIXES['knowledge-action']).toMatch(/full access/i);
  });

  it('all suffixes are non-empty strings', () => {
    for (const [intent, suffix] of Object.entries(INTENT_PROMPT_SUFFIXES)) {
      expect(suffix, `${intent} suffix is empty`).toBeTruthy();
      expect(typeof suffix, `${intent} suffix is not a string`).toBe('string');
    }
  });
});
