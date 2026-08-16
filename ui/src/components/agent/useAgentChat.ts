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
 * Ollama, Anthropic, and OpenAI route through the proxy. The Fortemi provider
 * uses Fortemi's native chat stream and does not expose this proxy tool loop.
 */

import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import { getAuthorizationHeader } from '@/api/auth-context';
import { getActiveMemory, getMemoryRoutingHeaderName } from '@/api/memory-context';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '@/api';
import type { AgentContext } from './useAgent';
import type { ProviderConfig } from './providers';
import {
  DEFAULT_PRIVILEGE_SETTINGS,
  type AgentPrivilegeSettings,
} from './privileges';

export interface UseAgentChatOptions {
  config: ProviderConfig;
  context?: AgentContext;
  /** URL of the agent-proxy chat endpoint */
  proxyUrl?: string;
  privileges?: AgentPrivilegeSettings;
  privilegeSessionId?: string;
}

export interface PendingConfirmation {
  approvalId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  isResolving: boolean;
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
  pendingConfirmation: PendingConfirmation | null;
  resolveConfirmation: (
    decision: 'allow' | 'allow-remember' | 'deny',
  ) => Promise<void>;
}

const DEFAULT_PROXY_URL = '/api/agent/chat';

let nativeMessageCounter = 0;

function nextNativeMessageId(): string {
  nativeMessageCounter += 1;
  return `fortemi-native-${Date.now()}-${nativeMessageCounter}`;
}

function makeTextMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: nextNativeMessageId(),
    role,
    parts: [{ type: 'text', text }],
  } as UIMessage;
}

function findPendingConfirmation(
  messages: UIMessage[],
  isResolving: boolean,
): PendingConfirmation | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const parts = messages[messageIndex].parts;
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex--) {
      const part = parts[partIndex] as unknown as Record<string, unknown>;
      const approval = part.approval as Record<string, unknown> | undefined;
      if (part.state !== 'approval-requested' || typeof approval?.id !== 'string') continue;
      const type = typeof part.type === 'string' ? part.type : '';
      const toolName = type === 'dynamic-tool'
        ? part.toolName
        : type.startsWith('tool-')
          ? type.slice('tool-'.length)
          : undefined;
      if (typeof toolName !== 'string' || typeof part.toolCallId !== 'string') continue;
      const input = part.input;
      return {
        approvalId: approval.id,
        toolCallId: part.toolCallId,
        toolName,
        args: input && typeof input === 'object'
          ? input as Record<string, unknown>
          : { value: input },
        isResolving,
      };
    }
  }
  return null;
}

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const { config, context, proxyUrl = DEFAULT_PROXY_URL } = options;
  const maxSteps = config.maxSteps ?? 5;
  const useNativeFortemiStream = config.provider === 'fortemi';

  const chatId = useMemo(() => `agent-${Date.now()}`, []);
  const privilegeSessionId = options.privilegeSessionId ?? chatId;
  const privileges = options.privileges ?? DEFAULT_PRIVILEGE_SETTINGS;

  // Track steps per conversation turn (for client-side awareness only)
  const stepCountRef = useRef(0);
  const nativeAbortRef = useRef<AbortController | null>(null);
  const [nativeMessages, setNativeMessages] = useState<UIMessage[]>([]);
  const [nativeLoading, setNativeLoading] = useState(false);
  const [nativeError, setNativeError] = useState<Error | undefined>();
  const [confirmationError, setConfirmationError] = useState<Error | undefined>();
  const [isResolvingConfirmation, setIsResolvingConfirmation] = useState(false);

  // DefaultChatTransport handles the AI SDK data stream protocol.
  // The proxy backend speaks this protocol and routes to the
  // configured provider (Fortemi/Ollama, Anthropic, OpenAI).
  // Extra body params (provider, model, context) are merged into each request.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: proxyUrl,
        headers: () => {
          const headers = getAuthorizationHeader();
          const memory = getActiveMemory();
          if (memory) headers[getMemoryRoutingHeaderName()] = memory;
          return headers;
        },
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
          privilegeSessionId,
          privileges: {
            mode: privileges.mode,
            overrides: privileges.overrides,
          },
        },
      }),
    [proxyUrl, config.provider, config.model, config.temperature, maxSteps,
     context?.noteId, context?.collectionId, context?.searchQuery,
     privilegeSessionId, privileges.mode, privileges.overrides],
  );

  // The server executes tools. The client only submits approval responses and
  // lets the SDK resume after every outstanding approval has been answered.
  const {
    messages,
    sendMessage: sdkSendMessage,
    status,
    error,
    setMessages,
    stop,
    clearError,
    addToolApprovalResponse,
  } = useChat({
    id: chatId,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  const isLoading = status === 'streaming' || status === 'submitted';
  const pendingConfirmation = useMemo(
    () => useNativeFortemiStream
      ? null
      : findPendingConfirmation(messages, isResolvingConfirmation),
    [useNativeFortemiStream, messages, isResolvingConfirmation],
  );

  const resolveConfirmation = useCallback(async (
    decision: 'allow' | 'allow-remember' | 'deny',
  ) => {
    if (!pendingConfirmation || isResolvingConfirmation) return;
    setIsResolvingConfirmation(true);
    setConfirmationError(undefined);
    try {
      const response = await fetch(`${proxyUrl}/privileges/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthorizationHeader(),
          ...(getActiveMemory() ? { [getMemoryRoutingHeaderName()]: getActiveMemory()! } : {}),
        },
        body: JSON.stringify({
          sessionId: privilegeSessionId,
          toolCallId: pendingConfirmation.toolCallId,
          toolName: pendingConfirmation.toolName,
          args: pendingConfirmation.args,
          decision,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Failed to resolve tool confirmation.');
      }
      await addToolApprovalResponse({
        id: pendingConfirmation.approvalId,
        approved: decision !== 'deny',
        reason: decision,
      });
    } catch (error) {
      setConfirmationError(
        error instanceof Error ? error : new Error('Failed to resolve tool confirmation.'),
      );
    } finally {
      setIsResolvingConfirmation(false);
    }
  }, [pendingConfirmation, isResolvingConfirmation, proxyUrl, privilegeSessionId, addToolApprovalResponse]);

  const wrappedSendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;
      stepCountRef.current = 0;

      if (useNativeFortemiStream) {
        const text = input.trim();
        const userMessage = makeTextMessage('user', text);
        const assistantMessage = makeTextMessage('assistant', '');
        const controller = new AbortController();

        nativeAbortRef.current?.abort();
        nativeAbortRef.current = controller;
        setNativeError(undefined);
        setNativeLoading(true);
        setNativeMessages((prev) => [...prev, userMessage, assistantMessage]);
        let streamed = '';

        try {
          const currentMessages = [...nativeMessages, userMessage];
          await api.chat.stream(
            {
              input: text,
              model: config.model,
              context: {
                note_id: context?.noteId,
                collection_id: context?.collectionId,
                search_query: context?.searchQuery,
                conversation_history: currentMessages.map((message) => ({
                  role: message.role,
                  content: message.parts
                    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                    .map((part) => part.text)
                    .join('\n'),
                })),
              },
            },
            {
              signal: controller.signal,
              onEvent: (event) => {
                if (event.event === 'delta') {
                  streamed += event.content;
                  setNativeMessages((prev) =>
                    prev.map((message) =>
                      message.id === assistantMessage.id
                        ? { ...message, parts: [{ type: 'text', text: streamed }] as UIMessage['parts'] }
                        : message,
                    ),
                  );
                }
                if (event.event === 'done' && event.content) {
                  streamed = event.content;
                  setNativeMessages((prev) =>
                    prev.map((message) =>
                      message.id === assistantMessage.id
                        ? { ...message, parts: [{ type: 'text', text: streamed }] as UIMessage['parts'] }
                        : message,
                    ),
                  );
                }
                if (event.event === 'status' && event.content && !streamed) {
                  setNativeMessages((prev) =>
                    prev.map((message) =>
                      message.id === assistantMessage.id
                        ? { ...message, parts: [{ type: 'text', text: event.content ?? '' }] as UIMessage['parts'] }
                        : message,
                    ),
                  );
                }
              },
            },
          );
          if (!streamed) {
            setNativeMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, parts: [{ type: 'text', text: 'No response received.' }] as UIMessage['parts'] }
                  : message,
              ),
            );
          }
        } catch (err) {
          if (controller.signal.aborted) {
            setNativeMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, parts: [{ type: 'text', text: streamed ? `${streamed}\n\n[stopped]` : '[stopped]' }] as UIMessage['parts'] }
                  : message,
              ),
            );
            return;
          }

          try {
            const response = await api.chat.send({
              input: text,
              model: config.model,
              context: {
                note_id: context?.noteId,
                collection_id: context?.collectionId,
                search_query: context?.searchQuery,
              },
            });
            const fallback = response.messages.find((message) => message.role === 'assistant')
              ?? response.messages[0];
            setNativeMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessage.id
                  ? {
                      ...message,
                      parts: [{
                        type: 'text',
                        text: fallback?.content ?? 'No response received.',
                      }] as UIMessage['parts'],
                    }
                  : message,
              ),
            );
          } catch {
            const message = err instanceof Error ? err : new Error('Failed to stream message');
            setNativeError(message);
            setNativeMessages((prev) => prev.filter((messageItem) => messageItem.id !== assistantMessage.id));
          }
        } finally {
          if (nativeAbortRef.current === controller) {
            nativeAbortRef.current = null;
          }
          setNativeLoading(false);
        }
        return;
      }

      // Clear any previous error so stale error banners don't persist
      // alongside a new (potentially successful) response.
      if (error) clearError();
      await sdkSendMessage({ text: input.trim() });
    },
    [
      useNativeFortemiStream,
      nativeMessages,
      config.model,
      context?.noteId,
      context?.collectionId,
      context?.searchQuery,
      sdkSendMessage,
      error,
      clearError,
    ],
  );

  const clearMessages = useCallback(() => {
    if (useNativeFortemiStream) {
      nativeAbortRef.current?.abort();
      setNativeMessages([]);
      setNativeError(undefined);
      return;
    }
    setMessages([]);
    stepCountRef.current = 0;
  }, [useNativeFortemiStream, setMessages]);

  const stopNativeOrProxy = useCallback(() => {
    if (useNativeFortemiStream) {
      nativeAbortRef.current?.abort();
      setNativeLoading(false);
      return;
    }
    stop();
  }, [useNativeFortemiStream, stop]);

  const clearNativeOrProxyError = useCallback(() => {
    setConfirmationError(undefined);
    if (useNativeFortemiStream) {
      setNativeError(undefined);
      return;
    }
    clearError();
  }, [useNativeFortemiStream, clearError]);

  const setNativeOrProxyMessages = useCallback(
    (nextMessages: UIMessage[]) => {
      if (useNativeFortemiStream) {
        setNativeMessages(nextMessages);
        return;
      }
      setMessages(nextMessages);
    },
    [useNativeFortemiStream, setMessages],
  );

  return {
    messages: useNativeFortemiStream ? nativeMessages : messages,
    isLoading: useNativeFortemiStream ? nativeLoading : isLoading,
    error: confirmationError ?? (useNativeFortemiStream ? nativeError : error),
    sendMessage: wrappedSendMessage,
    clearMessages,
    clearError: clearNativeOrProxyError,
    stop: stopNativeOrProxy,
    setMessages: setNativeOrProxyMessages,
    pendingConfirmation,
    resolveConfirmation,
  };
}
