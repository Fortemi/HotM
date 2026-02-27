import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentPanel } from '../AgentPanel';
import type { UIMessage } from '@ai-sdk/react';

// Mock dependencies
const mockSendMessage = vi.fn();
const mockClearMessages = vi.fn();
const mockClearError = vi.fn();
const mockStop = vi.fn();

vi.mock('../useAgentChat', () => ({
  useAgentChat: vi.fn(() => ({
    messages: [] as UIMessage[],
    isLoading: false,
    error: undefined,
    sendMessage: mockSendMessage,
    clearMessages: mockClearMessages,
    clearError: mockClearError,
    stop: mockStop,
  })),
}));

vi.mock('../useAgentConfig', () => ({
  useAgentConfig: () => ({
    config: { provider: 'ollama', model: 'llama3.2', maxSteps: 5, temperature: 0.7 },
    setConfig: vi.fn(),
    resetConfig: vi.fn(),
  }),
}));

vi.mock('../useAgentPrivileges', () => ({
  useAgentPrivileges: () => ({
    mode: 'assisted',
    setMode: vi.fn(),
    pending: null,
    resolveConfirmation: vi.fn(),
  }),
}));

vi.mock('../ChatMessage', () => ({
  ChatMessage: ({ message }: { message: UIMessage }) => (
    <div data-testid="chat-message" data-role={message.role}>
      message
    </div>
  ),
}));

vi.mock('../ChatInput', () => ({
  ChatInput: ({ onSend, isLoading }: { onSend: (msg: string) => void; isLoading: boolean }) => (
    <div data-testid="chat-input">
      <button onClick={() => onSend('test')} disabled={isLoading}>Send</button>
    </div>
  ),
}));

vi.mock('../AgentSettings', () => ({
  AgentSettings: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="agent-settings">
      <button onClick={onClose}>Close Settings</button>
    </div>
  ),
}));

vi.mock('../ConfirmationCard', () => ({
  ConfirmationCard: () => <div data-testid="confirmation-card" />,
}));

describe('AgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the header with agent title and provider badge', () => {
    render(<AgentPanel />);
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('ollama')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<AgentPanel />);
    expect(screen.getByText('Knowledge Assistant')).toBeInTheDocument();
  });

  it('shows privilege mode button', () => {
    render(<AgentPanel />);
    expect(screen.getByText('assisted')).toBeInTheDocument();
  });

  it('renders messages when present', async () => {
    const { useAgentChat } = await import('../useAgentChat');
    vi.mocked(useAgentChat).mockReturnValue({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
          createdAt: new Date(),
        } as UIMessage,
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there' }],
          createdAt: new Date(),
        } as UIMessage,
      ],
      isLoading: false,
      error: undefined,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      clearError: mockClearError,
      stop: mockStop,
    });

    render(<AgentPanel />);
    const messages = screen.getAllByTestId('chat-message');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveAttribute('data-role', 'user');
    expect(messages[1]).toHaveAttribute('data-role', 'assistant');
  });

  it('shows clear button when messages exist', async () => {
    const { useAgentChat } = await import('../useAgentChat');
    vi.mocked(useAgentChat).mockReturnValue({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
          createdAt: new Date(),
        } as UIMessage,
      ],
      isLoading: false,
      error: undefined,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      clearError: mockClearError,
      stop: mockStop,
    });

    render(<AgentPanel />);
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);
    expect(mockClearMessages).toHaveBeenCalled();
  });

  it('shows error banner with dismiss button', async () => {
    const { useAgentChat } = await import('../useAgentChat');
    vi.mocked(useAgentChat).mockReturnValue({
      messages: [],
      isLoading: false,
      error: new Error('Connection failed'),
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      clearError: mockClearError,
      stop: mockStop,
    });

    render(<AgentPanel />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Dismiss'));
    expect(mockClearError).toHaveBeenCalled();
  });

  it('shows settings panel when settings button clicked', () => {
    render(<AgentPanel />);
    const settingsBtn = screen.getByTitle('Settings');
    fireEvent.click(settingsBtn);
    expect(screen.getByTestId('agent-settings')).toBeInTheDocument();
  });

  it('passes context to useAgentChat', async () => {
    const { useAgentChat } = await import('../useAgentChat');
    render(<AgentPanel context={{ noteId: 'n-123' }} />);
    expect(useAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { noteId: 'n-123' },
      }),
    );
  });
});
