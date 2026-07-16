import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentChat } from '../useAgentChat';
import type { ProviderConfig } from '../providers';

// Mock the tools module
const mockSearchExecute = vi.fn().mockResolvedValue([{ note_id: 'n1', snippet: 'result', score: 0.9 }]);
vi.mock('../tools', () => ({
  agentTools: {
    search_notes: {
      execute: (...args: unknown[]) => mockSearchExecute(...args),
    },
    create_note: {
      execute: vi.fn(),
    },
  },
}));

// Mock the AI SDK modules
const mockSendMessage = vi.fn();
const mockSetMessages = vi.fn();
const mockStop = vi.fn();
const mockClearError = vi.fn();
const mockAddToolOutput = vi.fn();

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: mockSendMessage,
    status: 'ready',
    error: undefined,
    setMessages: mockSetMessages,
    stop: mockStop,
    clearError: mockClearError,
    addToolOutput: mockAddToolOutput,
  })),
}));

vi.mock('ai', () => ({
  // vitest 4: arrow-based mockImplementation is not constructable with `new`.
  DefaultChatTransport: vi.fn(function (
    this: Record<string, unknown>,
    opts: Record<string, unknown>,
  ) {
    this._type = 'DefaultChatTransport';
    this._opts = opts;
  }),
}));

const mockNativeStream = vi.fn();
const mockSyncSend = vi.fn();

vi.mock('@/api', () => ({
  api: {
    chat: {
      stream: (...args: unknown[]) => mockNativeStream(...args),
      send: (...args: unknown[]) => mockSyncSend(...args),
    },
  },
}));

const defaultConfig: ProviderConfig = {
  provider: 'ollama',
  model: 'llama3.2',
  maxSteps: 5,
  temperature: 0.7,
};

describe('useAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNativeStream.mockResolvedValue({ content: 'native response', events: [] });
    mockSyncSend.mockResolvedValue({
      messages: [{ role: 'assistant', content: 'sync fallback' }],
      actions: [],
    });
  });

  it('returns expected interface', () => {
    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('sendMessage');
    expect(result.current).toHaveProperty('clearMessages');
    expect(result.current).toHaveProperty('clearError');
    expect(result.current).toHaveProperty('stop');
  });

  it('initialises with empty messages and not loading', () => {
    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('creates DefaultChatTransport with proxy URL and body', async () => {
    const { DefaultChatTransport } = await import('ai');
    renderHook(() =>
      useAgentChat({
        config: defaultConfig,
        proxyUrl: '/custom/proxy',
        context: { noteId: 'note-1' },
      }),
    );

    expect(DefaultChatTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        api: '/custom/proxy',
        body: expect.objectContaining({
          provider: 'ollama',
          model: 'llama3.2',
          context: expect.objectContaining({ noteId: 'note-1' }),
        }),
      }),
    );
  });

  it('uses default proxy URL when not specified', async () => {
    const { DefaultChatTransport } = await import('ai');
    renderHook(() => useAgentChat({ config: defaultConfig }));

    expect(DefaultChatTransport).toHaveBeenCalledWith(
      expect.objectContaining({ api: '/api/agent/chat' }),
    );
  });

  it('calls sdkSendMessage with text on sendMessage', async () => {
    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    await act(async () => {
      await result.current.sendMessage('hello agent');
    });

    expect(mockSendMessage).toHaveBeenCalledWith({ text: 'hello agent' });
  });

  it('trims input before sending', async () => {
    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    await act(async () => {
      await result.current.sendMessage('  hello  ');
    });

    expect(mockSendMessage).toHaveBeenCalledWith({ text: 'hello' });
  });

  it('ignores empty or whitespace-only input', async () => {
    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('delegates clearMessages to setMessages([])', () => {
    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    act(() => {
      result.current.clearMessages();
    });

    expect(mockSetMessages).toHaveBeenCalledWith([]);
  });

  it('delegates stop to SDK stop', () => {
    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    act(() => {
      result.current.stop();
    });

    expect(mockStop).toHaveBeenCalled();
  });

  it('reports isLoading true when status is streaming', async () => {
    const { useChat } = await import('@ai-sdk/react');
    vi.mocked(useChat).mockReturnValue({
      id: 'test',
      messages: [],
      sendMessage: mockSendMessage,
      status: 'streaming',
      error: undefined,
      setMessages: mockSetMessages,
      stop: mockStop,
      clearError: mockClearError,
      addToolOutput: mockAddToolOutput,
    } as unknown as ReturnType<typeof useChat>);

    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('reports isLoading true when status is submitted', async () => {
    const { useChat } = await import('@ai-sdk/react');
    vi.mocked(useChat).mockReturnValue({
      id: 'test',
      messages: [],
      sendMessage: mockSendMessage,
      status: 'submitted',
      error: undefined,
      setMessages: mockSetMessages,
      stop: mockStop,
      clearError: mockClearError,
      addToolOutput: mockAddToolOutput,
    } as unknown as ReturnType<typeof useChat>);

    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('does not pass onToolCall to useChat (tools execute server-side)', async () => {
    let opts: Record<string, unknown> = {};
    const { useChat } = await import('@ai-sdk/react');
    vi.mocked(useChat).mockImplementation((o: unknown) => {
      opts = o as Record<string, unknown>;
      return {
        messages: [],
        sendMessage: mockSendMessage,
        status: 'ready',
        error: undefined,
        setMessages: mockSetMessages,
        stop: mockStop,
        clearError: mockClearError,
        addToolOutput: mockAddToolOutput,
      } as unknown as ReturnType<typeof useChat>;
    });

    renderHook(() =>
      useAgentChat({ config: { ...defaultConfig, maxSteps: 8 } }),
    );

    // Server handles tool execution — client should NOT intercept tool calls
    expect(opts).not.toHaveProperty('onToolCall');
    expect(opts).not.toHaveProperty('sendAutomaticallyWhen');
  });

  it('passes transport with id to useChat', async () => {
    let opts: Record<string, unknown> = {};
    const { useChat } = await import('@ai-sdk/react');
    vi.mocked(useChat).mockImplementation((o: unknown) => {
      opts = o as Record<string, unknown>;
      return {
        messages: [],
        sendMessage: mockSendMessage,
        status: 'ready',
        error: undefined,
        setMessages: mockSetMessages,
        stop: mockStop,
        clearError: mockClearError,
        addToolOutput: mockAddToolOutput,
      } as unknown as ReturnType<typeof useChat>;
    });

    renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    expect(opts).toHaveProperty('id');
    expect(opts).toHaveProperty('transport');
  });

  it('uses native Fortemi /chat/stream for the fortemi provider', async () => {
    mockNativeStream.mockImplementationOnce(async (_request, options) => {
      options.onEvent?.({ event: 'delta', content: 'Hel', role: 'assistant', kind: 'message' });
      options.onEvent?.({ event: 'delta', content: 'lo', role: 'assistant', kind: 'message' });
      options.onEvent?.({ event: 'done', finish_reason: 'stop', model: 'qwen3:8b' });
      return { content: 'Hello', events: [] };
    });

    const { result } = renderHook(() =>
      useAgentChat({ config: { provider: 'fortemi', model: 'qwen3:8b' } }),
    );

    await act(async () => {
      await result.current.sendMessage('hello fortemi');
    });

    expect(mockNativeStream).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'hello fortemi',
        model: 'qwen3:8b',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal), onEvent: expect.any(Function) }),
    );
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].parts).toEqual([{ type: 'text', text: 'Hello' }]);
  });

  it('falls back to synchronous Fortemi /chat when native streaming fails', async () => {
    mockNativeStream.mockRejectedValueOnce(new Error('Chat stream failed: 503 Service Unavailable'));

    const { result } = renderHook(() =>
      useAgentChat({ config: { provider: 'fortemi' } }),
    );

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(mockSyncSend).toHaveBeenCalledWith(expect.objectContaining({ input: 'hello' }));
    expect(result.current.error).toBeUndefined();
    expect(result.current.messages[1].parts).toEqual([{ type: 'text', text: 'sync fallback' }]);
  });
});
