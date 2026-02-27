import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChatApi } from '../chat';
import type { ApiClient } from '../client';

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
});
