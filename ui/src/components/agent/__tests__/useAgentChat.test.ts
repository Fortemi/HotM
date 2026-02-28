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
  DefaultChatTransport: vi.fn().mockImplementation((opts: Record<string, unknown>) => ({
    _type: 'DefaultChatTransport',
    _opts: opts,
  })),
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

  it('passes onToolCall and sendAutomaticallyWhen to useChat options', async () => {
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

    expect(opts).toHaveProperty('onToolCall');
    expect(typeof opts.onToolCall).toBe('function');
    expect(opts).toHaveProperty('sendAutomaticallyWhen');
    expect(typeof opts.sendAutomaticallyWhen).toBe('function');
  });

  it('dispatches tool calls to agentTools execute functions', async () => {
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

    const onToolCall = opts.onToolCall as (args: {
      toolCall: { toolCallId: string; toolName: string; input: unknown };
    }) => Promise<void>;

    await onToolCall({
      toolCall: {
        toolCallId: 'tc1',
        toolName: 'search_notes',
        input: { query: 'test', limit: 10, mode: 'hybrid' },
      },
    });

    expect(mockSearchExecute).toHaveBeenCalledWith(
      { query: 'test', limit: 10, mode: 'hybrid' },
      { toolCallId: 'tc1', messages: [] },
    );
    expect(mockAddToolOutput).toHaveBeenCalledWith({
      tool: 'search_notes',
      toolCallId: 'tc1',
      output: [{ note_id: 'n1', snippet: 'result', score: 0.9 }],
    });
  });

  it('submits error output when tool execution fails', async () => {
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

    mockSearchExecute.mockRejectedValueOnce(new Error('API down'));

    renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    const onToolCall = opts.onToolCall as (args: {
      toolCall: { toolCallId: string; toolName: string; input: unknown };
    }) => Promise<void>;

    await onToolCall({
      toolCall: {
        toolCallId: 'tc1',
        toolName: 'search_notes',
        input: { query: 'test' },
      },
    });

    expect(mockAddToolOutput).toHaveBeenCalledWith({
      tool: 'search_notes',
      toolCallId: 'tc1',
      output: { error: true, message: 'Tool "search_notes" failed: API down' },
    });
  });

  it('ignores unknown tool names', async () => {
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

    const onToolCall = opts.onToolCall as (args: {
      toolCall: { toolCallId: string; toolName: string; input: unknown };
    }) => Promise<void>;

    await onToolCall({
      toolCall: {
        toolCallId: 'tc2',
        toolName: 'nonexistent_tool',
        input: {},
      },
    });

    // Should not call execute or addToolOutput for unknown tools
    expect(mockSearchExecute).not.toHaveBeenCalled();
    expect(mockAddToolOutput).not.toHaveBeenCalled();
  });
});
