import { describe, it, expect } from 'vitest';
import { classifyIntent, shouldEscalateToAction } from '../intent-classifier.js';

describe('classifyIntent', () => {
  describe('first turn override', () => {
    it('returns conversational on first turn regardless of content', () => {
      expect(classifyIntent('search for notes about AI', true)).toBe('conversational');
      expect(classifyIntent('create a note about today', true)).toBe('conversational');
      expect(classifyIntent('find my notes', true)).toBe('conversational');
    });
  });

  describe('conversational intent', () => {
    it('classifies greetings', () => {
      expect(classifyIntent('hello', false)).toBe('conversational');
      expect(classifyIntent('hi there', false)).toBe('conversational');
      expect(classifyIntent('hey', false)).toBe('conversational');
      expect(classifyIntent('good morning', false)).toBe('conversational');
      expect(classifyIntent('howdy', false)).toBe('conversational');
    });

    it('classifies gratitude', () => {
      expect(classifyIntent('thanks', false)).toBe('conversational');
      expect(classifyIntent('thank you!', false)).toBe('conversational');
      expect(classifyIntent('thx', false)).toBe('conversational');
    });

    it('classifies capability questions', () => {
      expect(classifyIntent('what can you do?', false)).toBe('conversational');
      expect(classifyIntent('help me understand your features', false)).toBe('conversational');
      expect(classifyIntent('how do I use this?', false)).toBe('conversational');
    });

    it('classifies short affirmations', () => {
      expect(classifyIntent('yes', false)).toBe('conversational');
      expect(classifyIntent('ok', false)).toBe('conversational');
      expect(classifyIntent('sure', false)).toBe('conversational');
      expect(classifyIntent('got it', false)).toBe('conversational');
    });

    it('classifies empty or very short messages', () => {
      expect(classifyIntent('', false)).toBe('conversational');
      expect(classifyIntent('  ', false)).toBe('conversational');
      expect(classifyIntent('ok', false)).toBe('conversational');
    });

    it('defaults to conversational for unrecognized messages', () => {
      expect(classifyIntent('the weather is nice today', false)).toBe('conversational');
      expect(classifyIntent('I like pizza', false)).toBe('conversational');
    });
  });

  describe('exploratory intent', () => {
    it('classifies search queries', () => {
      expect(classifyIntent('find my notes about machine learning', false)).toBe('exploratory');
      expect(classifyIntent('search for notes on TypeScript', false)).toBe('exploratory');
      expect(classifyIntent('look up my meeting notes', false)).toBe('exploratory');
      expect(classifyIntent('show me all notes about React', false)).toBe('exploratory');
    });

    it('classifies browsing requests', () => {
      expect(classifyIntent('list my collections', false)).toBe('exploratory');
      expect(classifyIntent('browse my notes', false)).toBe('exploratory');
    });

    it('classifies related/similar queries', () => {
      expect(classifyIntent('related notes to this one', false)).toBe('exploratory');
      expect(classifyIntent('find similar notes', false)).toBe('exploratory');
    });

    it('classifies UUID references', () => {
      expect(classifyIntent('show me 550e8400-e29b-41d4-a716-446655440000', false)).toBe('exploratory');
    });

    it('classifies concept/taxonomy queries', () => {
      expect(classifyIntent('what concepts are in my knowledge base?', false)).toBe('exploratory');
      expect(classifyIntent('search concepts related to AI', false)).toBe('exploratory');
    });

    it('classifies collection queries', () => {
      expect(classifyIntent('what collections do I have?', false)).toBe('exploratory');
    });
  });

  describe('knowledge-action intent', () => {
    it('classifies note creation', () => {
      expect(classifyIntent('create a note about today\'s meeting', false)).toBe('knowledge-action');
      expect(classifyIntent('write a note about project ideas', false)).toBe('knowledge-action');
      expect(classifyIntent('add a note on design patterns', false)).toBe('knowledge-action');
      expect(classifyIntent('draft a note about the discussion', false)).toBe('knowledge-action');
    });

    it('classifies tag operations', () => {
      expect(classifyIntent('tag this note as important', false)).toBe('knowledge-action');
      expect(classifyIntent('retag with machine-learning', false)).toBe('knowledge-action');
    });

    it('classifies linking operations', () => {
      expect(classifyIntent('link these notes together', false)).toBe('knowledge-action');
      expect(classifyIntent('connect this note to the other one', false)).toBe('knowledge-action');
    });

    it('classifies revision operations', () => {
      expect(classifyIntent('revise this note', false)).toBe('knowledge-action');
      expect(classifyIntent('rewrite the note to be clearer', false)).toBe('knowledge-action');
      expect(classifyIntent('edit the note content', false)).toBe('knowledge-action');
      expect(classifyIntent('update the note with new information', false)).toBe('knowledge-action');
    });

    it('classifies tag/link removal', () => {
      expect(classifyIntent('remove the tag from this note', false)).toBe('knowledge-action');
    });
  });

  describe('action patterns take priority over explore patterns', () => {
    it('create + note → knowledge-action even though "note" matches explore', () => {
      expect(classifyIntent('create a note and search for related content', false)).toBe('knowledge-action');
    });
  });
});

describe('shouldEscalateToAction', () => {
  it('returns false when already in knowledge-action mode', () => {
    expect(shouldEscalateToAction('knowledge-action', ['create_note'])).toBe(false);
  });

  it('returns true when conversational mode sees write tools', () => {
    expect(shouldEscalateToAction('conversational', ['create_note'])).toBe(true);
    expect(shouldEscalateToAction('conversational', ['revise_note'])).toBe(true);
    expect(shouldEscalateToAction('conversational', ['update_tags'])).toBe(true);
    expect(shouldEscalateToAction('conversational', ['link_notes'])).toBe(false);
  });

  it('returns true when exploratory mode sees write tools', () => {
    expect(shouldEscalateToAction('exploratory', ['create_note'])).toBe(true);
  });

  it('returns false for read-only tools', () => {
    expect(shouldEscalateToAction('conversational', ['search_notes'])).toBe(false);
    expect(shouldEscalateToAction('exploratory', ['search_notes', 'get_note'])).toBe(false);
  });

  it('returns false when no tools called', () => {
    expect(shouldEscalateToAction('conversational', [])).toBe(false);
  });
});
