/**
 * useAgentChat — Vercel AI SDK v6 integration for streaming chat with tool use.
 *
 * The agent-proxy handles the full tool execution loop server-side:
 *   1. LLM generates tool call
 *   2. Proxy executes tool against Fortemi API
 *   3. Proxy feeds results back to LLM
 *   4. LLM generates natural language response
 *
 * All of this streams as a single response. The client just renders
 * message parts (text, tool invocations, tool results) as they arrive.
 *
 * All providers (fortemi, ollama, anthropic, openai) route through the proxy.
 */

import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { useCallback, useMemo, useRef } from 'react';
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
  /** Replace the message array (used by context compaction). */
  setMessages: (messages: UIMessage[]) => void;
}

const DEFAULT_PROXY_URL = '/api/agent/chat';

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const { config, context, proxyUrl = DEFAULT_PROXY_URL } = options;
  const maxSteps = config.maxSteps ?? 5;

  const chatId = useMemo(() => `agent-${Date.now()}`, []);

  // Track steps per conversation turn (for client-side awareness only)
  const stepCountRef = useRef(0);

  // DefaultChatTransport handles the AI SDK data stream protocol.
  // The proxy backend speaks this protocol and routes to the
  // configured provider (Fortemi/Ollama, Anthropic, OpenAI).
  // Extra body params (provider, model, context) are merged into each request.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: proxyUrl,
        body: {
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          maxSteps,
          context: {
            noteId: context?.noteId,
            collectionId: context?.collectionId,
            searchQuery: context?.searchQuery,
          },
        },
      }),
    [proxyUrl, config.provider, config.model, config.temperature, maxSteps,
     context?.noteId, context?.collectionId, context?.searchQuery],
  );

  // No onToolCall or sendAutomaticallyWhen — the server handles the full
  // tool execution loop via streamText + stopWhen. The client just renders
  // the streamed message parts (text, tool calls, tool results).
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
      stepCountRef.current = 0;
      await sdkSendMessage({ text: input.trim() });
    },
    [sdkSendMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    stepCountRef.current = 0;
  }, [setMessages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage: wrappedSendMessage,
    clearMessages,
    clearError,
    stop,
    setMessages,
  };
}
