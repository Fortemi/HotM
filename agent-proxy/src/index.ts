/**
 * agent-proxy — Lightweight Express sidecar for AI provider routing.
 *
 * This server handles:
 * - API key security (keys never exposed to the browser)
 * - Provider routing (Ollama, Anthropic, OpenAI)
 * - Tool execution against Fortemi API
 * - AI SDK data stream protocol for the SPA's DefaultChatTransport
 *
 * Environment variables:
 *   PORT              — Server port (default: 3001)
 *   FORTEMI_API_URL   — Fortemi API base URL (default: http://localhost:3000/api/v1)
 *   OLLAMA_URL        — Ollama API URL (default: http://localhost:11434)
 *   ANTHROPIC_API_KEY — Anthropic API key (optional, required for anthropic provider)
 *   OPENAI_API_KEY    — OpenAI API key (optional, required for openai provider)
 *   CORS_ORIGIN       — Allowed CORS origin (default: http://localhost:5173)
 */

import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = express();

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/agent/chat', chatRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'agent-proxy',
    fortemi_url: process.env.FORTEMI_API_URL ?? 'http://localhost:3000/api/v1',
    providers: {
      ollama: true,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    },
  });
});

const server = app.listen(PORT, () => {
  console.log(`[agent-proxy] Listening on port ${PORT}`);
  console.log(`[agent-proxy] CORS origin: ${CORS_ORIGIN}`);
  console.log(`[agent-proxy] Fortemi API: ${process.env.FORTEMI_API_URL ?? 'http://localhost:3000/api/v1'}`);
  console.log(`[agent-proxy] Providers: ollama${process.env.ANTHROPIC_API_KEY ? ', anthropic' : ''}${process.env.OPENAI_API_KEY ? ', openai' : ''}`);
});

// Agent tool chains can run for several minutes (multi-step LLM + Fortemi API calls).
// Express defaults to 120s which is far too short — align with nginx proxy_read_timeout.
server.timeout = 600_000;        // 10 minutes — upper bound for complex tool chains
server.keepAliveTimeout = 65_000; // 65s — safely above common proxy keepalive (60s)
