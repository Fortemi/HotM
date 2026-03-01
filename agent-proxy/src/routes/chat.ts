/**
 * Chat route — streaming chat completion endpoint.
 *
 * GET  /api/agent/chat — readiness probe / endpoint metadata.
 * POST /api/agent/chat — streaming chat completion via AI SDK data stream protocol.
 *
 * The GET handler exists because the AI SDK's DefaultChatTransport or the
 * browser may probe the endpoint on initial load. Without it, the first
 * request returns 404 and logs an error in the console.
 *
 * Tool availability is controlled by an XState flow machine that classifies
 * user intent and configures activeTools per step via AI SDK's prepareStep.
 */

import { Router } from 'express';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getModel, type ProviderName, DEFAULT_MODELS } from '../providers/index.js';
import { agentTools } from '../tools.js';
import {
  createFlowActor,
  getFlowState,
  getFlowContext,
  type FlowActor,
} from '../agent/flow-machine.js';
import type { AgentToolName, StepSummary } from '../agent/types.js';

const SYSTEM_PROMPT = `You are a knowledge assistant embedded in HotM (Hall of the Mind), \
a note-taking and analysis application backed by Fortemi.

You help users manage their knowledge base through natural conversation. \
You can search notes, create new notes, revise content with AI enhancement, \
manage tags and collections, and discover connections between notes.

## Conversation Style

You are conversational first. When a user greets you, asks a question, or makes \
a general statement, respond naturally — do NOT immediately call tools. Only use \
tools when the user's intent clearly requires an action on the knowledge base \
(searching, creating, reading, tagging, linking notes, etc.).

Examples of when NOT to use tools:
- "Hello" → Greet the user, introduce what you can help with
- "What can you do?" → Explain your capabilities
- "How do I create a note?" → Explain the process
- "Thanks" → Acknowledge and offer further help

Examples of when to use tools:
- "Find my notes about machine learning" → search_notes
- "Create a note about today's meeting" → create_note
- "Show me note abc-123" → get_note

Always end your responses with something actionable — a question, a suggestion, \
or a status update — so the user is never left hanging.

## Reasoning Approach

When a task requires tools, follow the Think-Act-Verify pattern:

1. **Think**: Before taking action, briefly reason about what you need to do. \
For multi-step tasks, outline your plan before starting.

2. **Act**: Execute your plan using the available tools. Search before creating to \
avoid duplicates. Chain tools when needed.

3. **Verify**: After tool calls, check the results and explain what happened to the user. \
If something went wrong, explain the issue and suggest an alternative.

When a tool call fails or returns unexpected results:
- Explain what went wrong in plain language
- Suggest an alternative approach or ask the user for clarification
- Try at most 2 retries with adjusted parameters before reporting the issue

For complex requests involving multiple notes or analysis:
- Break the task into clear steps
- Complete each step before moving to the next
- Summarize your progress after each step

## Guidelines

- **Be conversational**: Respond naturally. Don't use tools unless the user needs a knowledge base action.
- **Always respond**: Never leave the user with just an error or empty response. Always follow up with a message.
- **Search before creating**: Always check for existing notes before creating duplicates.
- **Suggest tags**: When creating notes, suggest appropriate tags based on the content.
- **Respect immutability**: Original note content is immutable. Edits create new revisions.
- **Use context**: When the user says "this note" or "current note", use the provided note context.
- **Be concise**: Summarize search results and tool outputs clearly. Don't repeat raw JSON.

## Available Tools

- **search_notes**: Hybrid full-text + semantic search across all notes
- **create_note**: Create a new note with optional AI revision
- **get_note**: Retrieve a specific note by ID
- **revise_note**: Trigger AI revision on an existing note
- **update_tags**: Add or remove tags on a note
- **link_notes**: Create a semantic link between two notes
- **list_collections**: Browse note collections
- **search_concepts**: Search the SKOS concept taxonomy
- **get_related**: Find notes semantically related to a given note

## Revision Modes

When creating or revising notes, these modes are available:
- **none**: No AI processing
- **light**: Formatting and cleanup only
- **standard**: Intelligent revision (default)
- **contextual**: Revision with cross-references to other notes`;

export const chatRouter = Router();

// Readiness probe — returns endpoint metadata so initial GET doesn't 404.
chatRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    endpoint: '/api/agent/chat',
    method: 'POST',
    protocol: 'ai-sdk-ui-message-stream',
    providers: {
      ollama: true,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    },
    defaultProvider: 'ollama',
    defaultModel: DEFAULT_MODELS.ollama,
    tools: Object.keys(agentTools),
  });
});

chatRouter.post('/', async (req, res) => {
  try {
    const {
      messages,
      provider = 'ollama',
      model,
      temperature = 0.7,
      maxSteps = 5,
      context,
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;
    if (context?.noteId || context?.collectionId || context?.searchQuery) {
      const parts = [systemPrompt, '\nCurrent Context:'];
      if (context.noteId) parts.push(`- Active note ID: ${context.noteId}`);
      if (context.collectionId) parts.push(`- Active collection ID: ${context.collectionId}`);
      if (context.searchQuery) parts.push(`- Last search query: "${context.searchQuery}"`);
      systemPrompt = parts.join('\n');
    }

    const languageModel = getModel(provider as ProviderName, model);

    // Convert UI messages (parts-based) to model messages (content-based)
    const modelMessages = await convertToModelMessages(messages);

    // Determine if this is the first user turn.
    // A count of 0 means the array arrived empty (shouldn't happen in practice).
    // A count of 1 is the user's real first message — treat it as actionable,
    // not as a greeting-only warmup. The classifier's CONVERSATIONAL_PATTERNS
    // already handle actual greetings like "Hello" / "What can you do?"
    const userMessageCount = messages.filter(
      (m: { role: string }) => m.role === 'user',
    ).length;
    const isFirstTurn = userMessageCount < 1;

    // Extract latest user message text for classification
    const latestUserMsg = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === 'user');
    const userMessageText = extractMessageText(latestUserMsg);

    // --- Flow machine setup ---
    const actor = createFlowActor();
    actor.start();
    actor.send({
      type: 'CLASSIFY',
      userMessage: userMessageText,
      isFirstTurn,
      maxSteps,
    });

    // After CLASSIFY, the machine auto-transitions through classify→configure→ready.
    // At this point we can read the configured state.
    const flowCtx = getFlowContext(actor);
    const flowState = getFlowState(actor);

    console.log(
      `[agent-flow] intent=${flowCtx.intent} state=${flowState} ` +
        `tools=[${flowCtx.activeTools.join(',')}] firstTurn=${isFirstTurn}`,
    );

    // Determine if we need tools at all
    const hasTools = flowCtx.activeTools.length > 0;

    const result = streamText({
      model: languageModel,
      system: systemPrompt + flowCtx.promptSuffix,
      messages: modelMessages,
      // Only pass tools if the intent requires them
      ...(hasTools
        ? {
            tools: agentTools,
            activeTools: flowCtx.activeTools as (keyof typeof agentTools)[],
            stopWhen: stepCountIs(maxSteps),
          }
        : {}),
      temperature,

      // Per-step hook: read the flow machine's current activeTools + system prompt
      prepareStep: hasTools
        ? ({ stepNumber }) => {
            const ctx = getFlowContext(actor);
            const state = getFlowState(actor);

            console.log(
              `[agent-flow] prepareStep #${stepNumber} state=${state} ` +
                `intent=${ctx.intent} tools=[${ctx.activeTools.join(',')}]`,
            );

            return {
              activeTools: ctx.activeTools as (keyof typeof agentTools)[],
              system: systemPrompt + ctx.promptSuffix,
            };
          }
        : undefined,

      // Post-step hook: feed results back to the machine
      onStepFinish: (event) => {
        const step: StepSummary = {
          stepNumber: event.stepNumber,
          finishReason: event.finishReason,
          hasToolCalls: event.toolCalls.length > 0,
          toolNames: event.toolCalls.map(
            (tc: { toolName: string }) => tc.toolName,
          ),
          textLength: event.text.length,
        };

        actor.send({ type: 'STEP_COMPLETE', step });

        const state = getFlowState(actor);
        console.log(
          `[agent-flow] onStepFinish #${event.stepNumber} ` +
            `reason=${event.finishReason} tools=[${step.toolNames.join(',')}] ` +
            `→ state=${state}`,
        );
      },

      onFinish: () => {
        // Signal the machine that streaming is complete
        const state = getFlowState(actor);
        if (state !== 'done') {
          actor.send({ type: 'DONE' });
        }
        actor.stop();
      },

      onError: (event) => {
        console.error(`[agent-flow] onError:`, event.error);
      },
    });

    // Stream the response using AI SDK UI message stream protocol
    result.pipeUIMessageStreamToResponse(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[agent-proxy] Chat error:', message);

    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * Extract plain text from a UI message object.
 * Handles both string content and parts-based content.
 */
function extractMessageText(msg: unknown): string {
  if (!msg || typeof msg !== 'object') return '';
  const m = msg as Record<string, unknown>;

  // String content (simple format)
  if (typeof m.content === 'string') return m.content;

  // Parts-based content (AI SDK UIMessage format)
  if (Array.isArray(m.parts)) {
    return (m.parts as Array<Record<string, unknown>>)
      .filter((p) => p.type === 'text')
      .map((p) => String(p.text ?? ''))
      .join(' ');
  }

  // Content array format
  if (Array.isArray(m.content)) {
    return (m.content as Array<Record<string, unknown>>)
      .filter((c) => c.type === 'text')
      .map((c) => String(c.text ?? ''))
      .join(' ');
  }

  return '';
}
