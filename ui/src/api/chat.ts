/**
 * Chat API client
 * Wraps Fortemi's POST /chat endpoint for agent conversation
 */

import type { ApiClient } from './client';
import type { ChatRequest, ChatResponse } from './types-extended';

export function createChatApi(client: ApiClient) {
  return {
    /**
     * Send a message to the chat/command interface.
     * Returns assistant messages and any actions the agent performed.
     */
    async send(request: ChatRequest): Promise<ChatResponse> {
      const response = await client.post<ChatResponse>('/chat', request);
      return {
        messages: response.messages ?? [],
        actions: response.actions ?? [],
      };
    },

    /**
     * Convenience: send a plain text message with optional context.
     */
    async sendMessage(
      input: string,
      context?: ChatRequest['context'],
    ): Promise<ChatResponse> {
      return this.send({ input, context });
    },
  };
}

export type ChatApi = ReturnType<typeof createChatApi>;
