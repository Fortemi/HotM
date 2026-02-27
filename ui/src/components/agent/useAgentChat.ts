/**
 * useAgentChat — Vercel AI SDK v6 integration for streaming chat with tool use.
 *
 * This hook wraps the AI SDK's useChat() and handles client-side tool execution.
 * The agent-proxy streams LLM responses (with schema-only tools), and when the
 * LLM requests a tool call, onToolCall intercepts it and executes the tool
 * in-browser against the Fortemi API via the shared api client.
 *
 * All providers (fortemi, ollama, anthropic, openai) route through the proxy.
 */

import { DefaultChatTransport, isToolUIPart } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { useCallback, useMemo, useRef } from 'react';
import type { AgentContext } from './useAgent';
import type { ProviderConfig } from './providers';
import { agentTools, type AgentToolName } from './tools';

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
  const maxSteps = config.maxSteps ?? 5;

  const chatId = useMemo(() => `agent-${Date.now()}`, []);

  // Ref to hold addToolOutput — needed because onToolCall is passed to useChat
  // but addToolOutput is returned from it. The ref bridges this gap safely since
  // onToolCall fires asynchronously during streaming (after render completes).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addToolOutputRef = useRef<any>(null);

  // Track tool-call steps per conversation turn for maxSteps limiting
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

  const {
    messages,
    sendMessage: sdkSendMessage,
    status,
    error,
    setMessages,
    stop,
    clearError,
    addToolOutput,
  } = useChat({
    id: chatId,
    transport,
    onToolCall: async ({ toolCall }) => {
      const name = toolCall.toolName as AgentToolName;
      const toolDef = agentTools[name];
      if (toolDef && 'execute' in toolDef && typeof toolDef.execute === 'function') {
        try {
          const executeFn = toolDef.execute as (
            input: unknown,
            options: { toolCallId: string; messages: unknown[] },
          ) => Promise<unknown>;
          const result = await executeFn(toolCall.input, {
            toolCallId: toolCall.toolCallId,
            messages: [],
          });
          await addToolOutputRef.current?.({
            tool: name,
            toolCallId: toolCall.toolCallId,
            output: result,
          });
        } catch (err) {
          await addToolOutputRef.current?.({
            state: 'output-error',
            tool: name,
            toolCallId: toolCall.toolCallId,
            errorText: err instanceof Error ? err.message : String(err),
          });
        }
      }
    },
    // Auto-resubmit messages after tool results are added, enabling multi-step
    // tool use. Without this, addToolOutput updates message parts but doesn't
    // send the results back to the LLM.
    sendAutomaticallyWhen: ({ messages: msgs }) => {
      if (stepCountRef.current >= maxSteps) return false;
      const last = msgs[msgs.length - 1];
      if (!last || last.role !== 'assistant') return false;
      const hasToolOutputs = last.parts.some(
        p => isToolUIPart(p) && (p.state === 'output-available' || p.state === 'output-error'),
      );
      if (hasToolOutputs) {
        stepCountRef.current++;
        return true;
      }
      return false;
    },
  });

  // Keep ref updated so onToolCall can call addToolOutput
  addToolOutputRef.current = addToolOutput;

  const isLoading = status === 'streaming' || status === 'submitted';

  const wrappedSendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;
      // Reset step counter for each new user message
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
  };
}
