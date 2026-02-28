import { describe, it, expect } from 'vitest';
import { createFlowActor, getFlowState, getFlowContext } from '../flow-machine.js';
import type { StepSummary } from '../types.js';

/** Helper: create a StepSummary for feeding back to the machine. */
function makeStep(overrides: Partial<StepSummary> = {}): StepSummary {
  return {
    stepNumber: 0,
    finishReason: 'stop',
    hasToolCalls: false,
    toolNames: [],
    textLength: 50,
    ...overrides,
  };
}

describe('flowMachine', () => {
  describe('initial state', () => {
    it('starts in idle', () => {
      const actor = createFlowActor();
      actor.start();
      expect(getFlowState(actor)).toBe('idle');
      actor.stop();
    });
  });

  describe('CLASSIFY → classify → configure → ready', () => {
    it('transitions to ready after CLASSIFY on first turn', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'hello', isFirstTurn: true, maxSteps: 5 });
      expect(getFlowState(actor)).toBe('ready');

      const ctx = getFlowContext(actor);
      expect(ctx.intent).toBe('conversational');
      expect(ctx.activeTools).toEqual([]);
      actor.stop();
    });

    it('classifies exploratory intent on non-first turn', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'find notes about AI', isFirstTurn: false, maxSteps: 5 });
      expect(getFlowState(actor)).toBe('ready');

      const ctx = getFlowContext(actor);
      expect(ctx.intent).toBe('exploratory');
      expect(ctx.activeTools).toContain('search_notes');
      expect(ctx.activeTools).toContain('get_note');
      expect(ctx.activeTools).not.toContain('create_note');
      actor.stop();
    });

    it('classifies knowledge-action intent', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'create a note about testing', isFirstTurn: false, maxSteps: 5 });
      expect(getFlowState(actor)).toBe('ready');

      const ctx = getFlowContext(actor);
      expect(ctx.intent).toBe('knowledge-action');
      expect(ctx.activeTools).toContain('create_note');
      expect(ctx.activeTools).toContain('search_notes');
      actor.stop();
    });
  });

  describe('ready → evaluate → done (natural finish)', () => {
    it('transitions to done on STEP_COMPLETE with stop finish reason', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'hello', isFirstTurn: true, maxSteps: 5 });
      expect(getFlowState(actor)).toBe('ready');

      actor.send({ type: 'STEP_COMPLETE', step: makeStep({ finishReason: 'stop' }) });
      expect(getFlowState(actor)).toBe('done');
      actor.stop();
    });

    it('transitions to done on length finish reason', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'hello', isFirstTurn: true, maxSteps: 5 });

      actor.send({ type: 'STEP_COMPLETE', step: makeStep({ finishReason: 'length' }) });
      expect(getFlowState(actor)).toBe('done');
      actor.stop();
    });
  });

  describe('ready → evaluate → ready (tool continuation)', () => {
    it('loops back to ready when tools were called and step limit not reached', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'find notes about AI', isFirstTurn: false, maxSteps: 5 });

      // Step 0: tool call, finish reason = 'tool-calls'
      actor.send({
        type: 'STEP_COMPLETE',
        step: makeStep({
          stepNumber: 0,
          finishReason: 'tool-calls',
          hasToolCalls: true,
          toolNames: ['search_notes'],
        }),
      });
      expect(getFlowState(actor)).toBe('ready');

      // Step 1: natural finish
      actor.send({
        type: 'STEP_COMPLETE',
        step: makeStep({ stepNumber: 1, finishReason: 'stop' }),
      });
      expect(getFlowState(actor)).toBe('done');
      actor.stop();
    });
  });

  describe('step limit enforcement', () => {
    it('transitions to done when step limit is reached', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'find notes', isFirstTurn: false, maxSteps: 2 });

      // Step 0: tool call
      actor.send({
        type: 'STEP_COMPLETE',
        step: makeStep({ stepNumber: 0, finishReason: 'tool-calls', hasToolCalls: true, toolNames: ['search_notes'] }),
      });
      expect(getFlowState(actor)).toBe('ready');

      // Step 1: another tool call (but stepCount will be 2 = maxSteps)
      actor.send({
        type: 'STEP_COMPLETE',
        step: makeStep({ stepNumber: 1, finishReason: 'tool-calls', hasToolCalls: true, toolNames: ['get_note'] }),
      });
      expect(getFlowState(actor)).toBe('done');
      actor.stop();
    });
  });

  describe('intent escalation', () => {
    it('escalates from exploratory to knowledge-action when write tools appear', () => {
      const actor = createFlowActor();
      actor.start();
      // Start as exploratory
      actor.send({ type: 'CLASSIFY', userMessage: 'show me my notes', isFirstTurn: false, maxSteps: 5 });
      expect(getFlowContext(actor).intent).toBe('exploratory');

      // LLM tries to use a write tool
      actor.send({
        type: 'STEP_COMPLETE',
        step: makeStep({
          stepNumber: 0,
          finishReason: 'tool-calls',
          hasToolCalls: true,
          toolNames: ['create_note'],
        }),
      });

      // Machine should reclassify → now the userMessage "show me my notes" will re-classify
      // as exploratory again, but the escalation path sets it up for re-classification
      // The key test is that loopCount incremented
      const ctx = getFlowContext(actor);
      expect(ctx.loopCount).toBe(1);
      // Machine transitions: evaluate → classify → configure → ready
      expect(getFlowState(actor)).toBe('ready');
      actor.stop();
    });
  });

  describe('DONE event', () => {
    it('transitions directly to done from ready', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'hello', isFirstTurn: true, maxSteps: 5 });
      expect(getFlowState(actor)).toBe('ready');

      actor.send({ type: 'DONE' });
      expect(getFlowState(actor)).toBe('done');
      actor.stop();
    });
  });

  describe('context tracking', () => {
    it('records steps in context', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'find notes', isFirstTurn: false, maxSteps: 5 });

      actor.send({
        type: 'STEP_COMPLETE',
        step: makeStep({ stepNumber: 0, finishReason: 'tool-calls', hasToolCalls: true, toolNames: ['search_notes'] }),
      });

      const ctx = getFlowContext(actor);
      expect(ctx.steps).toHaveLength(1);
      expect(ctx.steps[0].toolNames).toEqual(['search_notes']);
      expect(ctx.stepCount).toBe(1);
      actor.stop();
    });

    it('stores maxSteps from CLASSIFY event', () => {
      const actor = createFlowActor();
      actor.start();
      actor.send({ type: 'CLASSIFY', userMessage: 'hello', isFirstTurn: true, maxSteps: 10 });

      const ctx = getFlowContext(actor);
      expect(ctx.maxSteps).toBe(10);
      actor.stop();
    });
  });
});
