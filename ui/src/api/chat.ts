/**
 * Chat API client.
 * Wraps Fortemi's synchronous POST /chat endpoint and native POST /chat/stream SSE endpoint.
 */

import type { ApiClient } from './client';
import type {
  ChatRequest,
  ChatResponse,
  ChatModelsResponse,
  ModelCatalogResponse,
} from './types-extended';
import { getActiveMemory, getMemoryRoutingHeaderName } from './memory-context';
import { getHostAdapter, getTauriFetch } from '@/lib/tauri';

export interface ChatStreamDeltaEvent {
  event: 'delta';
  content: string;
  role: string;
  kind: string;
  id?: string;
}

export interface ChatStreamDoneEvent {
  event: 'done';
  finish_reason: string;
  model?: string;
  content?: string;
  usage?: unknown;
  total_cost_usd?: number;
  id?: string;
}

export interface ChatStreamErrorEvent {
  event: 'error';
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  error?: string;
  code?: string;
  id?: string;
}

export interface ChatStreamBridgeEvent {
  event: 'tool_call' | 'tool_result' | 'status' | 'raw';
  role?: string;
  kind?: string;
  content?: string;
  name?: string;
  tool_id?: string;
  status?: string;
  input?: unknown;
  id?: string;
}

export type ChatStreamEvent =
  | ChatStreamDeltaEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent
  | ChatStreamBridgeEvent
  | {
      event: 'unknown';
      name: string;
      data: unknown;
      id?: string;
    };

export interface ChatStreamOptions {
  signal?: AbortSignal;
  lastEventId?: string;
  onEvent?: (event: ChatStreamEvent) => void;
}

export interface ChatStreamResult {
  content: string;
  model?: string;
  finishReason?: string;
  lastEventId?: string;
  events: ChatStreamEvent[];
}

function getMemoryHeaders(): Record<string, string> {
  const activeMemory = getActiveMemory();
  if (!activeMemory) {
    return {};
  }
  return { [getMemoryRoutingHeaderName()]: activeMemory };
}

function normalizeChatStreamEvent(event: string, data: unknown, id?: string): ChatStreamEvent {
  const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};

  if (event === 'delta') {
    return {
      event,
      content: typeof payload.content === 'string' ? payload.content : '',
      role: typeof payload.role === 'string' ? payload.role : 'assistant',
      kind: typeof payload.kind === 'string' ? payload.kind : 'message',
      id,
    };
  }

  if (event === 'done') {
    return {
      event,
      finish_reason: typeof payload.finish_reason === 'string' ? payload.finish_reason : 'stop',
      model: typeof payload.model === 'string' ? payload.model : undefined,
      content: typeof payload.content === 'string' ? payload.content : undefined,
      usage: payload.usage,
      total_cost_usd: typeof payload.total_cost_usd === 'number' ? payload.total_cost_usd : undefined,
      id,
    };
  }

  if (event === 'error') {
    return {
      event,
      type: typeof payload.type === 'string' ? payload.type : undefined,
      title: typeof payload.title === 'string' ? payload.title : undefined,
      status: typeof payload.status === 'number' ? payload.status : undefined,
      detail: typeof payload.detail === 'string' ? payload.detail : undefined,
      error: typeof payload.error === 'string' ? payload.error : undefined,
      code: typeof payload.code === 'string' ? payload.code : undefined,
      id,
    };
  }

  if (event === 'tool_call' || event === 'tool_result' || event === 'status' || event === 'raw') {
    return {
      event,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      kind: typeof payload.kind === 'string' ? payload.kind : undefined,
      content: typeof payload.content === 'string' ? payload.content : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      tool_id: typeof payload.tool_id === 'string' ? payload.tool_id : undefined,
      status: typeof payload.status === 'string' ? payload.status : undefined,
      input: payload.input,
      id,
    };
  }

  return { event: 'unknown', name: event, data, id };
}

export function parseChatSseFrame(frame: string): ChatStreamEvent | null {
  const lines = frame.split(/\r?\n/);
  let event = 'message';
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).replace(/^ /, '');

    if (field === 'event') {
      event = value || 'message';
    } else if (field === 'id') {
      id = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join('\n');
  let parsed: unknown = rawData;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    // Preserve non-JSON payloads for forward compatibility.
  }

  return normalizeChatStreamEvent(event, parsed, id);
}

export function parseChatSseChunk(
  chunk: string,
  carry = '',
): { events: ChatStreamEvent[]; carry: string } {
  const combined = carry + chunk;
  const parts = combined.split(/\r?\n\r?\n/);
  const nextCarry = parts.pop() ?? '';
  const events = parts
    .map((frame) => parseChatSseFrame(frame))
    .filter((event): event is ChatStreamEvent => event !== null);
  return { events, carry: nextCarry };
}

async function readChatEventStream(
  response: Response,
  onEvent?: (event: ChatStreamEvent) => void,
): Promise<ChatStreamResult> {
  if (!response.body) {
    throw new Error('Chat stream response body is not readable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: ChatStreamEvent[] = [];
  let content = '';
  let model: string | undefined;
  let finishReason: string | undefined;
  let lastEventId: string | undefined;
  let carry = '';

  const record = (event: ChatStreamEvent | null) => {
    if (!event) {
      return;
    }
    events.push(event);
    onEvent?.(event);
    if (event.id) {
      lastEventId = event.id;
    }
    if (event.event === 'delta') {
      content += event.content;
    }
    if (event.event === 'done') {
      if (event.content) {
        content = event.content;
      }
      model = event.model;
      finishReason = event.finish_reason;
    }
    if (event.event === 'error') {
      throw new Error(event.detail ?? event.error ?? event.title ?? 'Chat stream failed');
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    const parsed = parseChatSseChunk(decoder.decode(value, { stream: true }), carry);
    carry = parsed.carry;
    parsed.events.forEach(record);
  }

  const finalParsed = parseChatSseChunk(decoder.decode(), carry);
  finalParsed.events.forEach(record);
  record(finalParsed.carry ? parseChatSseFrame(finalParsed.carry) : null);

  return {
    content,
    model,
    finishReason,
    lastEventId,
    events,
  };
}

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

    /**
     * Stream assistant output from Fortemi's native POST /chat/stream endpoint.
     */
    async stream(
      request: ChatRequest,
      options: ChatStreamOptions = {},
    ): Promise<ChatStreamResult> {
      if (!request.input || request.input.trim() === '') {
        throw new Error('Chat input is required');
      }

      const headers: Record<string, string> = {
        ...getMemoryHeaders(),
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      };
      if (options.lastEventId) {
        headers['Last-Event-ID'] = options.lastEventId;
      }

      const httpFetch = getHostAdapter() ? globalThis.fetch : getTauriFetch();
      const response = await httpFetch(`${client.baseUrl}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`Chat stream failed: ${response.status} ${response.statusText}`);
      }

      return readChatEventStream(response, options.onEvent);
    },

    /**
     * Fetch available chat models from Fortemi.
     * Returns model list with metadata and the server's default model.
     */
    async getModels(): Promise<ChatModelsResponse> {
      return client.get<ChatModelsResponse>('/chat/models');
    },

    /**
     * Fetch the full Fortemi model catalog from GET /models.
     *
     * This endpoint includes language, embedding, vision, transcription model
     * capabilities, defaults, and provider health metadata. Agent chat model
     * selection should continue to use getModels().
     */
    async getModelCatalog(): Promise<ModelCatalogResponse> {
      return client.get<ModelCatalogResponse>('/models');
    },
  };
}

export type ChatApi = ReturnType<typeof createChatApi>;
