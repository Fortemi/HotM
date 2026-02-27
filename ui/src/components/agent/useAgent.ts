/**
 * useAgent hook — manages chat state, message history, and API communication
 * for the embedded AI agent panel.
 *
 * Phase 1: Uses Fortemi's native /chat endpoint directly.
 * Phase 2: Will migrate to Vercel AI SDK useChat() for streaming + tool use.
 */

import { useState, useCallback, useRef } from 'react';
import { api } from '@/api';
import type { ChatMessage, ChatAction, ChatRequest } from '@/api';

export interface AgentMessage {
  id: string;
  role: ChatMessage['role'];
  content: string;
  timestamp: string;
  actions?: ChatAction[];
}

export interface AgentContext {
  noteId?: string;
  collectionId?: string;
  searchQuery?: string;
}

export interface UseAgentOptions {
  context?: AgentContext;
}

export interface UseAgentReturn {
  messages: AgentMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (input: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

let messageCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++messageCounter}`;
}

export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isLoading) return;

    setError(null);

    // Add user message
    const userMsg: AgentMessage = {
      id: nextId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history: ChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      history.push({ role: 'user', content: input.trim() });

      const request: ChatRequest = {
        input: input.trim(),
        context: {
          note_id: options.context?.noteId,
          collection_id: options.context?.collectionId,
          search_query: options.context?.searchQuery,
          conversation_history: history,
        },
      };

      const response = await api.chat.send(request);

      // Add assistant messages
      if (response.messages.length > 0) {
        const assistantMessages: AgentMessage[] = response.messages
          .filter(m => m.role === 'assistant')
          .map(m => ({
            id: nextId(),
            role: m.role,
            content: m.content,
            timestamp: m.timestamp ?? new Date().toISOString(),
            actions: response.actions.length > 0 ? response.actions : undefined,
          }));

        if (assistantMessages.length > 0) {
          setMessages(prev => [...prev, ...assistantMessages]);
        } else {
          // If no assistant messages, wrap the first message regardless of role
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'assistant',
            content: response.messages[0].content,
            timestamp: response.messages[0].timestamp ?? new Date().toISOString(),
            actions: response.actions.length > 0 ? response.actions : undefined,
          }]);
        }
      } else {
        // Empty response — add a fallback
        setMessages(prev => [...prev, {
          id: nextId(),
          role: 'assistant',
          content: 'No response received.',
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, options.context]);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearError,
  };
}
