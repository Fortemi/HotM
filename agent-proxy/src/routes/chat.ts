/**
 * POST /api/agent/chat — streaming chat completion route.
 *
 * Receives messages + provider config from the SPA, resolves the
 * language model, attaches Fortemi tools, and streams the response
 * using the AI SDK data stream protocol (consumed by DefaultChatTransport).
 */

import { Router } from 'express';
import { streamText, stepCountIs } from 'ai';
import { getModel, type ProviderName } from '../providers/index.js';
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

    const result = streamText({
      model: languageModel,
      system: systemPrompt,
      messages,
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
