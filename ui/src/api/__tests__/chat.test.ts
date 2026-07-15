import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChatApi } from '../chat';
import type { ApiClient } from '../client';

vi.mock('@/lib/tauri', () => ({
  getHostAdapter: vi.fn(() => null),
  getTauriFetch: () => global.fetch,
}));

vi.mock('../memory-context', () => ({
  getActiveMemory: vi.fn(() => null),
  getMemoryRoutingHeaderName: vi.fn(() => 'X-Fortemi-Memory'),
}));

describe('Chat API', () => {
  let mockClient: ApiClient;
  let chatApi: ReturnType<typeof createChatApi>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
      baseUrl: 'http://localhost:3000/api/v1',
    } as unknown as ApiClient;

    chatApi = createChatApi(mockClient);
  });

  describe('send', () => {
    it('posts to /chat and returns messages and actions', async () => {
      vi.mocked(mockClient.post).mockResolvedValueOnce({
        messages: [
          { role: 'assistant', content: 'Hello!', timestamp: '2026-02-27T00:00:00Z' },
        ],
        actions: [
          { type: 'search', payload: { query: 'test' } },
        ],
      });

      const result = await chatApi.send({ input: 'hi' });

      expect(mockClient.post).toHaveBeenCalledWith('/chat', { input: 'hi' });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('assistant');
      expect(result.messages[0].content).toBe('Hello!');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('search');
    });

    it('sends context when provided', async () => {
      vi.mocked(mockClient.post).mockResolvedValueOnce({
        messages: [{ role: 'assistant', content: 'Found it.' }],
        actions: [],
      });

      const request = {
        input: 'find related notes',
        context: {
          note_id: 'abc-123',
          collection_id: 'col-1',
        },
      };

      await chatApi.send(request);

      expect(mockClient.post).toHaveBeenCalledWith('/chat', request);
    });

    it('defaults to empty arrays when response fields are missing', async () => {
      vi.mocked(mockClient.post).mockResolvedValueOnce({});

      const result = await chatApi.send({ input: 'test' });

      expect(result.messages).toEqual([]);
      expect(result.actions).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('wraps plain text into a ChatRequest', async () => {
      vi.mocked(mockClient.post).mockResolvedValueOnce({
        messages: [{ role: 'assistant', content: 'response' }],
        actions: [],
      });

      await chatApi.sendMessage('hello');

      expect(mockClient.post).toHaveBeenCalledWith('/chat', {
        input: 'hello',
        context: undefined,
      });
    });

    it('passes context through', async () => {
      vi.mocked(mockClient.post).mockResolvedValueOnce({
        messages: [],
        actions: [],
      });

      const context = { note_id: 'n1', search_query: 'test' };
      await chatApi.sendMessage('search', context);

      expect(mockClient.post).toHaveBeenCalledWith('/chat', {
        input: 'search',
        context,
      });
    });
  });

  describe('stream', () => {
    it('parses native Fortemi chat stream delta and done events', async () => {
      const frames = [
        'id: session-1\nevent: delta\ndata: {"content":"Hel","role":"assistant","kind":"message"}\n\n',
        'id: session-2\nevent: delta\ndata: {"content":"lo","role":"assistant","kind":"message"}\n\n',
        'id: session-3\nevent: done\ndata: {"finish_reason":"stop","model":"qwen3:8b"}\n\n',
      ].join('');
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(new TextEncoder().encode(frames), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const onEvent = vi.fn();

      const result = await chatApi.stream({ input: 'hi', model: 'qwen3:8b' }, { onEvent });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/chat/stream',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ input: 'hi', model: 'qwen3:8b' }),
          headers: expect.objectContaining({
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result.content).toBe('Hello');
      expect(result.model).toBe('qwen3:8b');
      expect(result.finishReason).toBe('stop');
      expect(result.lastEventId).toBe('session-3');
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'delta', content: 'Hel' }));
    });

    it('sends Last-Event-ID when resuming a native chat stream', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response('event: done\ndata: {"finish_reason":"stop"}\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ));

      await chatApi.stream({ input: 'resume' }, { lastEventId: 'session-7' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/chat/stream',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Last-Event-ID': 'session-7' }),
        }),
      );
    });

    it('throws a safe error for native stream error events', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response('event: error\ndata: {"title":"Provider Failure","status":502,"detail":"Chat generation failed. Check server logs for diagnostics."}\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ));

      await expect(chatApi.stream({ input: 'hi' })).rejects.toThrow(
        'Chat generation failed. Check server logs for diagnostics.',
      );
    });
  });

  describe('models', () => {
    it('fetches chat model selection metadata from /chat/models', async () => {
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        models: [
          {
            model: 'qwen3:8b',
            context_window: 32768,
            max_output_tokens: 4096,
            supports_thinking: true,
            thinking_type: 'native',
            speed_tok_s: 42,
            parameter_size: '8B',
            family: 'qwen3',
          },
        ],
        default_model: 'qwen3:8b',
      });

      const result = await chatApi.getModels();

      expect(mockClient.get).toHaveBeenCalledWith('/chat/models');
      expect(result.default_model).toBe('qwen3:8b');
      expect(result.models[0].supports_thinking).toBe(true);
    });

    it('fetches full model catalog metadata from /models', async () => {
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        models: [
          {
            slug: 'qwen3:8b',
            provider: 'ollama',
            capabilities: ['language'],
            default_for: ['language'],
            parameter_size: '8B',
            quantization: 'Q4_K_M',
            size_bytes: 123,
            family: 'qwen3',
          },
          {
            slug: 'nomic-embed-text',
            provider: 'ollama',
            capabilities: ['embedding'],
            default_for: ['embedding'],
          },
        ],
        defaults: {
          language: 'qwen3:8b',
          embedding: 'nomic-embed-text',
          vision: 'llava:latest',
          transcription: 'whisper-large-v3',
        },
        providers: [
          {
            id: 'ollama',
            capabilities: ['language', 'embedding', 'vision'],
            is_default: true,
            health: 'healthy',
          },
        ],
      });

      const result = await chatApi.getModelCatalog();

      expect(mockClient.get).toHaveBeenCalledWith('/models');
      expect(result.models.map((model) => model.slug)).toEqual(['qwen3:8b', 'nomic-embed-text']);
      expect(result.defaults.embedding).toBe('nomic-embed-text');
      expect(result.providers[0].health).toBe('healthy');
    });
  });
});
