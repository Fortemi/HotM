/**
 * Chat route — streaming chat completion endpoint.
 *
 * GET  /api/agent/chat — readiness probe / endpoint metadata.
 * POST /api/agent/chat — streaming chat completion via AI SDK data stream protocol.
 *
 * The GET handler exists because the AI SDK's DefaultChatTransport or the
 * browser may probe the endpoint on initial load. Without it, the first
 * request returns 404 and logs an error in the console.
 */

import { Router } from 'express';
import { streamText, stepCountIs, convertToModelMessages } from 'ai';
import { getModel, type ProviderName, DEFAULT_MODELS } from '../providers/index.js';
import { agentTools } from '../tools.js';

const SYSTEM_PROMPT = `You are a knowledge assistant embedded in HotM (Hall of the Mind), \
a note-taking and analysis application backed by Fortemi.

You help users manage their knowledge base through natural conversation. \
You can search notes, create new notes, revise content with AI enhancement, \
manage tags and collections, and discover connections between notes.

Guidelines:
- Search before creating to avoid duplicates.
- When creating notes, suggest appropriate tags.
- Original note content is immutable — edits create new revisions.
- When the user says "this note" or "current note", use the provided context.
- Be concise and summarise tool outputs clearly.`;

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
    // The client sends UIMessage[] via DefaultChatTransport; streamText expects ModelMessage[]
    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: languageModel,
      system: systemPrompt,
      messages: modelMessages,
      tools: agentTools,
      stopWhen: stepCountIs(maxSteps),
      temperature,
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
