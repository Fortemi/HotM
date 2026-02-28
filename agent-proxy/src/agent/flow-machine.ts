/**
 * Agent flow state machine — XState v5.
 *
 * Implements a game-loop that classifies intent, configures tool availability,
 * pauses for AI SDK streaming, evaluates the result, and loops if needed.
 *
 * States:
 *   idle → classify → configure → ready → evaluate → done
 *                                    ↑        │
 *                                    └────────┘ (CONTINUE / ESCALATE)
 *
 * Integration: the caller creates an actor, sends CLASSIFY, then uses
 * `prepareStep` / `onStepFinish` from AI SDK to drive the ready↔evaluate loop.
 */

import { setup, assign, createActor } from 'xstate';
import { classifyIntent, shouldEscalateToAction } from './intent-classifier.js';
import { TOOL_SETS, INTENT_PROMPT_SUFFIXES } from './tool-sets.js';
import type { FlowContext, FlowEvent } from './types.js';

// ---------------------------------------------------------------------------
// Default context
// ---------------------------------------------------------------------------

const DEFAULT_MAX_LOOPS = 3;

const defaultContext: FlowContext = {
  intent: 'conversational',
  isFirstTurn: true,
  userMessage: '',
  activeTools: [],
  promptSuffix: INTENT_PROMPT_SUFFIXES.conversational,
  stepCount: 0,
  loopCount: 0,
  maxSteps: 5,
  maxLoops: DEFAULT_MAX_LOOPS,
  steps: [],
};

// ---------------------------------------------------------------------------
// Machine definition
// ---------------------------------------------------------------------------

export const flowMachine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvent,
  },
  guards: {
    withinStepLimit: ({ context }) => context.stepCount < context.maxSteps,
    exceededStepLimit: ({ context }) => context.stepCount >= context.maxSteps,
    withinLoopLimit: ({ context }) => context.loopCount < context.maxLoops,
    isNaturalFinish: ({ context }) => {
      const last = context.steps.at(-1);
      if (!last) return true;
      return last.finishReason === 'stop' || last.finishReason === 'length';
    },
    shouldEscalate: ({ context }) => {
      const last = context.steps.at(-1);
      if (!last) return false;
      return (
        shouldEscalateToAction(context.intent, last.toolNames) &&
        context.loopCount < context.maxLoops
      );
    },
  },
  actions: {
    storeClassifyInput: assign({
      userMessage: ({ event }) =>
        event.type === 'CLASSIFY' ? event.userMessage : '',
      isFirstTurn: ({ event }) =>
        event.type === 'CLASSIFY' ? event.isFirstTurn : true,
      maxSteps: ({ event }) =>
        event.type === 'CLASSIFY' ? event.maxSteps : 5,
    }),
    classifyMessage: assign({
      intent: ({ context }) =>
        classifyIntent(context.userMessage, context.isFirstTurn),
    }),
    configureToolsAndPrompt: assign({
      activeTools: ({ context }) => TOOL_SETS[context.intent],
      promptSuffix: ({ context }) => INTENT_PROMPT_SUFFIXES[context.intent],
    }),
    recordStep: assign({
      steps: ({ context, event }) =>
        event.type === 'STEP_COMPLETE'
          ? [...context.steps, event.step]
          : context.steps,
      stepCount: ({ event }) =>
        event.type === 'STEP_COMPLETE' ? event.step.stepNumber + 1 : 0,
    }),
    incrementLoop: assign({
      loopCount: ({ context }) => context.loopCount + 1,
    }),
  },
}).createMachine({
  id: 'agentFlow',
  initial: 'idle',
  context: defaultContext,

  states: {
    idle: {
      on: {
        CLASSIFY: {
          target: 'classify',
          actions: 'storeClassifyInput',
        },
      },
    },

    classify: {
      always: {
        target: 'configure',
        actions: 'classifyMessage',
      },
    },

    configure: {
      always: {
        target: 'ready',
        actions: 'configureToolsAndPrompt',
      },
    },

    ready: {
      // Machine pauses here. prepareStep reads context.activeTools + context.promptSuffix.
      on: {
        STEP_COMPLETE: {
          target: 'evaluate',
          actions: 'recordStep',
        },
        DONE: { target: 'done' },
      },
    },

    evaluate: {
      always: [
        // Over step limit → done
        {
          target: 'done',
          guard: 'exceededStepLimit',
        },
        // Escalation: intent shifted → reclassify with elevated permissions
        {
          target: 'classify',
          guard: 'shouldEscalate',
          actions: 'incrementLoop',
        },
        // Natural finish (stop / length) → done
        {
          target: 'done',
          guard: 'isNaturalFinish',
        },
        // Tool calls pending + within limits → loop back to ready for next step
        {
          target: 'ready',
          guard: 'withinStepLimit',
        },
        // Fallback → done
        { target: 'done' },
      ],
    },

    done: {
      type: 'final',
    },
  },
});

// ---------------------------------------------------------------------------
// Actor factory
// ---------------------------------------------------------------------------

export type FlowActor = ReturnType<typeof createFlowActor>;

/**
 * Create a fresh flow actor for a single request.
 * The actor starts immediately but sits in `idle` until CLASSIFY is sent.
 */
export function createFlowActor() {
  return createActor(flowMachine);
}

/**
 * Read the current flow snapshot's state value as a string.
 */
export function getFlowState(actor: FlowActor): string {
  const snap = actor.getSnapshot();
  return typeof snap.value === 'string' ? snap.value : JSON.stringify(snap.value);
}

/**
 * Read the current flow context from a running actor.
 */
export function getFlowContext(actor: FlowActor): FlowContext {
  return actor.getSnapshot().context;
}
