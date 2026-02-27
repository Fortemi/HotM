import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentChat } from '../useAgentChat';
import type { ProviderConfig } from '../providers';

// Mock the AI SDK modules
const mockSendMessage = vi.fn();
const mockSetMessages = vi.fn();
const mockStop = vi.fn();
const mockClearError = vi.fn();

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: mockSendMessage,
    status: 'ready',
    error: undefined,
    setMessages: mockSetMessages,
    stop: mockStop,
    clearError: mockClearError,
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
    } as unknown as ReturnType<typeof useChat>);

    const { result } = renderHook(() =>
      useAgentChat({ config: defaultConfig }),
    );

    expect(result.current.isLoading).toBe(true);
  });
});
