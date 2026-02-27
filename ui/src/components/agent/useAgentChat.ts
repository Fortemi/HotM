/**
 * useAgentChat — Vercel AI SDK v6 integration for streaming chat with tool use.
 *
 * This hook wraps the AI SDK's useChat() for providers that support streaming
 * (Ollama, Anthropic, OpenAI via the agent-proxy backend).
 *
 * For the native Fortemi provider, the original useAgent hook is used instead.
 * The AgentPanel selects the appropriate hook based on provider config.
 *
 * NOTE: This hook requires the agent-proxy backend (#121) to be running.
 * It is not active until the proxy is deployed. The AgentPanel defaults to
 * the Fortemi-native useAgent hook for now.
 */

import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { useCallback, useMemo } from 'react';
import type { AgentContext } from './useAgent';
import type { ProviderConfig } from './providers';

export interface UseAgentChatOptions {
  config: ProviderConfig;
  context?: AgentContext;
  /** URL of the agent-proxy chat endpoint */
  proxyUrl?: string;
}

export interface UseAgentChatReturn {
  messages: UIMessage[];
  isLoading: boolean;
  error: Error | undefined;
  sendMessage: (input: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  stop: () => void;
}

const DEFAULT_PROXY_URL = '/api/agent/chat';

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const { config, context, proxyUrl = DEFAULT_PROXY_URL } = options;

  const chatId = useMemo(() => `agent-${Date.now()}`, []);

  // DefaultChatTransport handles the AI SDK data stream protocol.
  // The proxy backend (#121) will speak this protocol and route to the
  // configured provider (Ollama, Anthropic, OpenAI).
  // Extra body params (provider, model, context) are merged into each request.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: proxyUrl,
        body: {
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          maxSteps: config.maxSteps,
          context: {
            noteId: context?.noteId,
            collectionId: context?.collectionId,
            searchQuery: context?.searchQuery,
          },
        },
      }),
    [proxyUrl, config.provider, config.model, config.temperature, config.maxSteps,
     context?.noteId, context?.collectionId, context?.searchQuery],
  );

  const {
    messages,
    sendMessage: sdkSendMessage,
    status,
    error,
    setMessages,
    stop,
    clearError,
  } = useChat({
    id: chatId,
    transport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const wrappedSendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;
      await sdkSendMessage({ text: input.trim() });
    },
    [sdkSendMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage: wrappedSendMessage,
    clearMessages,
    clearError,
    stop,
  };
}
