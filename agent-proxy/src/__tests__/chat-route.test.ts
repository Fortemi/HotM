/**
 * Tests for the chat route.
 *
 * Tests the GET metadata endpoint and POST request validation.
 * The streaming behavior is tested at a structural level (mocking streamText).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';

// Mock streamText and related AI SDK functions before imports
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual,
    streamText: vi.fn(() => ({
      pipeUIMessageStreamToResponse: vi.fn((res: express.Response) => {
        res.status(200).json({ mocked: true });
      }),
    })),
    convertToModelMessages: vi.fn((msgs: unknown) => msgs),
    stepCountIs: vi.fn((n: number) => ({ type: 'stepCount', value: n })),
  };
});

// Mock providers to avoid real API key requirements
vi.mock('../providers/index.js', () => ({
  getModel: vi.fn(() => ({ modelId: 'mock-model' })),
  DEFAULT_MODELS: {
    ollama: 'qwen3:8b',
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-4o',
    fortemi: 'qwen3:8b',
  },
}));

import { chatRouter } from '../routes/chat.js';
import { agentTools } from '../tools.js';
import { DEFAULT_MODELS } from '../providers/index.js';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/agent/chat', chatRouter);
  return app;
}

/** Simple supertest-free request helper using Node fetch against an Express app. */
async function request(
  app: express.Express,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Failed to get server address'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}${path}`;
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }
      fetch(url, options)
        .then(async (res) => {
          const json = await res.json().catch(() => ({}));
          server.close();
          resolve({ status: res.status, body: json as Record<string, unknown> });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

// ---------------------------------------------------------------------------
// GET /api/agent/chat — metadata endpoint
// ---------------------------------------------------------------------------

describe('GET /api/agent/chat', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('returns status ok', async () => {
    const res = await request(app, 'GET', '/api/agent/chat');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns endpoint metadata', async () => {
    const res = await request(app, 'GET', '/api/agent/chat');
    expect(res.body.endpoint).toBe('/api/agent/chat');
    expect(res.body.method).toBe('POST');
    expect(res.body.protocol).toBe('ai-sdk-ui-message-stream');
  });

  it('returns available tool names', async () => {
    const res = await request(app, 'GET', '/api/agent/chat');
    const tools = res.body.tools as string[];
    expect(tools).toEqual(Object.keys(agentTools));
  });

  it('returns provider availability', async () => {
    const res = await request(app, 'GET', '/api/agent/chat');
    const providers = res.body.providers as Record<string, boolean>;
    expect(providers.ollama).toBe(true);
  });

  it('reports anthropic as available when API key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    // Need fresh app to pick up env change
    app = createTestApp();
    const res = await request(app, 'GET', '/api/agent/chat');
    const providers = res.body.providers as Record<string, boolean>;
    expect(providers.anthropic).toBe(true);
  });

  it('returns default model', async () => {
    const res = await request(app, 'GET', '/api/agent/chat');
    expect(res.body.defaultModel).toBe(DEFAULT_MODELS.ollama);
  });
});

// ---------------------------------------------------------------------------
// POST /api/agent/chat — validation
// ---------------------------------------------------------------------------

describe('POST /api/agent/chat', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('returns 400 when messages is missing', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/messages/i);
  });

  it('returns 400 when messages is not an array', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', { messages: 'not-array' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/messages/i);
  });

  it('accepts valid message payload', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [
        { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ],
    });
    // Should not be 400
    expect(res.status).not.toBe(400);
  });
});

// ---------------------------------------------------------------------------
// extractMessageText (tested indirectly through POST behavior)
// ---------------------------------------------------------------------------

describe('message text extraction', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('handles parts-based messages', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [
        { role: 'user', parts: [{ type: 'text', text: 'find notes about AI' }] },
      ],
    });
    // If message extraction works, the intent classifier runs without error
    expect(res.status).not.toBe(500);
  });

  it('handles string content messages', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [
        { role: 'user', content: 'search for TypeScript notes' },
      ],
    });
    expect(res.status).not.toBe(500);
  });

  it('handles empty messages gracefully', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [
        { role: 'user', parts: [] },
      ],
    });
    expect(res.status).not.toBe(500);
  });
});
