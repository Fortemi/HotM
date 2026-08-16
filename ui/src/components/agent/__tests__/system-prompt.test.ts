import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT, buildSystemPrompt } from '../system-prompt';

describe('system-prompt', () => {
  describe('SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      expect(typeof SYSTEM_PROMPT).toBe('string');
      expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it('mentions HotM and Fortemi', () => {
      expect(SYSTEM_PROMPT).toContain('HotM');
      expect(SYSTEM_PROMPT).toContain('Fortemi');
    });

    it('lists all available tools', () => {
      expect(SYSTEM_PROMPT).toContain('search_notes');
      expect(SYSTEM_PROMPT).toContain('create_note');
      expect(SYSTEM_PROMPT).toContain('get_note');
      expect(SYSTEM_PROMPT).toContain('revise_note');
      expect(SYSTEM_PROMPT).toContain('update_tags');
      expect(SYSTEM_PROMPT).not.toContain('link_notes');
      expect(SYSTEM_PROMPT).toContain('list_collections');
      expect(SYSTEM_PROMPT).toContain('search_concepts');
      expect(SYSTEM_PROMPT).toContain('get_related');
    });
  });

  describe('buildSystemPrompt', () => {
    it('returns base prompt with no context', () => {
      expect(buildSystemPrompt()).toBe(SYSTEM_PROMPT);
      expect(buildSystemPrompt({})).toBe(SYSTEM_PROMPT);
    });

    it('appends note ID context', () => {
      const result = buildSystemPrompt({ noteId: 'abc-123' });
      expect(result).toContain(SYSTEM_PROMPT);
      expect(result).toContain('Active note ID: abc-123');
    });

    it('appends collection ID context', () => {
      const result = buildSystemPrompt({ collectionId: 'col-1' });
      expect(result).toContain('Active collection ID: col-1');
    });

    it('appends search query context', () => {
      const result = buildSystemPrompt({ searchQuery: 'machine learning' });
      expect(result).toContain('Last search query: "machine learning"');
    });

    it('appends multiple context fields', () => {
      const result = buildSystemPrompt({
        noteId: 'n1',
        collectionId: 'c1',
        searchQuery: 'test',
      });
      expect(result).toContain('Active note ID: n1');
      expect(result).toContain('Active collection ID: c1');
      expect(result).toContain('Last search query: "test"');
    });
  });
});
