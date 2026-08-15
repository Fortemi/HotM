/**
 * Tests for the chat route.
 *
 * Tests the GET metadata endpoint and POST request validation.
 * The streaming behavior is tested at a structural level (mocking streamText).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { streamText } from 'ai';

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

import { agentPrivilegeStore, chatRouter } from '../routes/chat.js';
import {
  agentTools,
  deferredToolDecisions,
  nonToolBoundaries,
  toolMetadata,
} from '../tools.js';
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

const PRIVILEGE_SESSION_ID = 'agent_test_session_000001';

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

  it('returns route-family tool metadata and gated non-tool decisions', async () => {
    const res = await request(app, 'GET', '/api/agent/chat');
    expect(res.body.toolMetadata).toEqual(toolMetadata);
    expect(res.body.deferredToolDecisions).toEqual(deferredToolDecisions);
    expect(res.body.nonToolBoundaries).toEqual(nonToolBoundaries);

    const metadata = res.body.toolMetadata as typeof toolMetadata;
    expect(metadata.search_notes.routeFamilies).toContain('search');
    expect(metadata.create_note.safety).toBe('write');
    expect(metadata.create_note.privilege).toBe('write');
    expect(metadata.get_attachments.resultPolicy).toMatch(/no bytes/i);

    const deferred = res.body.deferredToolDecisions as typeof deferredToolDecisions;
    expect(deferred.map((decision) => decision.candidate)).toContain('stream_ingest');
    expect(deferred.map((decision) => decision.candidate)).toContain('inspect_call_session');

    const boundaries = res.body.nonToolBoundaries as typeof nonToolBoundaries;
    expect(boundaries.flatMap((decision) => decision.routeFamilies)).toEqual(
      expect.arrayContaining(['oauth', 'auth_api_keys', 'pke', 'rate_limit']),
    );
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
    agentPrivilegeStore.resetForTests();
    vi.mocked(streamText).mockClear();
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
      privilegeSessionId: PRIVILEGE_SESSION_ID,
    });
    // Should not be 400
    expect(res.status).not.toBe(400);
  });

  it('rejects chat without a privilege session', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_settings');
  });

  it('does not let a forged chat mode elevate a stored read-only policy', async () => {
    const policy = await request(app, 'POST', '/api/agent/chat/privileges', {
      sessionId: PRIVILEGE_SESSION_ID,
      clientRevision: 0,
      settings: { mode: 'read-only', overrides: {} },
    });
    expect(policy.status).toBe(200);

    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Create a note' }] }],
      privilegeSessionId: PRIVILEGE_SESSION_ID,
      privileges: { mode: 'full', overrides: {} },
    });
    expect(res.status).toBe(200);

    const options = vi.mocked(streamText).mock.calls.at(-1)?.[0] as unknown as {
      tools: Record<string, { execute: (args: unknown, options: { toolCallId: string }) => Promise<unknown> }>;
    };
    await expect(options.tools.create_note.execute(
      { content: 'forged' },
      { toolCallId: 'forged-call' },
    )).rejects.toMatchObject({ code: 'operation_denied' });
  });

  it('resolves a pending confirmation once through the confirmation endpoint', async () => {
    const args = { content: 'confirmed' };
    agentPrivilegeStore.registerConfirmation(
      PRIVILEGE_SESSION_ID,
      'endpoint-call',
      'create_note',
      args,
    );
    const body = {
      sessionId: PRIVILEGE_SESSION_ID,
      toolCallId: 'endpoint-call',
      toolName: 'create_note',
      args,
      decision: 'allow',
    };
    expect((await request(app, 'POST', '/api/agent/chat/privileges/confirm', body)).status).toBe(200);
    expect((await request(app, 'POST', '/api/agent/chat/privileges/confirm', body)).status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// extractMessageText (tested indirectly through POST behavior)
// ---------------------------------------------------------------------------

describe('message text extraction', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    agentPrivilegeStore.resetForTests();
  });

  it('handles parts-based messages', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [
        { role: 'user', parts: [{ type: 'text', text: 'find notes about AI' }] },
      ],
      privilegeSessionId: PRIVILEGE_SESSION_ID,
    });
    // If message extraction works, the intent classifier runs without error
    expect(res.status).not.toBe(500);
  });

  it('handles string content messages', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [
        { role: 'user', content: 'search for TypeScript notes' },
      ],
      privilegeSessionId: PRIVILEGE_SESSION_ID,
    });
    expect(res.status).not.toBe(500);
  });

  it('handles empty messages gracefully', async () => {
    const res = await request(app, 'POST', '/api/agent/chat', {
      messages: [
        { role: 'user', parts: [] },
      ],
      privilegeSessionId: PRIVILEGE_SESSION_ID,
    });
    expect(res.status).not.toBe(500);
  });
});
