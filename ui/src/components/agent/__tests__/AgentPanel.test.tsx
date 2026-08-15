import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentPanel } from '../AgentPanel';
import type { UIMessage } from '@ai-sdk/react';

// Mock dependencies
const mockSendMessage = vi.fn();
const mockClearMessages = vi.fn();
const mockClearError = vi.fn();
const mockStop = vi.fn();
const mockSetMessages = vi.fn();
const mockResolveConfirmation = vi.fn();
const mockSetPrivilegeMode = vi.fn();

vi.mock('../useAgentChat', () => ({
  useAgentChat: vi.fn(() => ({
    messages: [] as UIMessage[],
    isLoading: false,
    error: undefined,
    sendMessage: mockSendMessage,
    clearMessages: mockClearMessages,
    clearError: mockClearError,
    stop: mockStop,
    setMessages: mockSetMessages,
    pendingConfirmation: null,
    resolveConfirmation: mockResolveConfirmation,
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
    setMode: mockSetPrivilegeMode,
    settings: { mode: 'assisted', overrides: {}, sessionAllowlist: [] },
    sessionId: 'agent_test_session_000001',
    policyError: null,
    clearPolicyError: vi.fn(),
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

vi.mock('../useChatModels', () => ({
  useChatModels: () => ({
    models: [],
    defaultModel: undefined,
    isLoading: false,
    error: undefined,
    refresh: vi.fn(),
  }),
}));

// Mock Select (Radix portals crash in jsdom)
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectValue: () => null,
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

  it('renders the header with agent title and model badge', () => {
    render(<AgentPanel />);
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('llama3.2')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<AgentPanel />);
    expect(screen.getByText('Knowledge Assistant')).toBeInTheDocument();
  });

  it('shows privilege mode button', () => {
    render(<AgentPanel />);
    const modeButton = screen.getByText('assisted');
    expect(modeButton).toBeInTheDocument();
    fireEvent.click(modeButton);
    expect(mockSetPrivilegeMode).toHaveBeenCalledWith('full');
  });

  it('shows a pending confirmation and disables new chat input', async () => {
    const { useAgentChat } = await import('../useAgentChat');
    vi.mocked(useAgentChat).mockReturnValue({
      messages: [],
      isLoading: false,
      error: undefined,
      sendMessage: mockSendMessage,
      clearMessages: mockClearMessages,
      clearError: mockClearError,
      stop: mockStop,
      setMessages: mockSetMessages,
      pendingConfirmation: {
        approvalId: 'approval-1',
        toolCallId: 'call-1',
        toolName: 'create_note',
        args: { content: 'test' },
        isResolving: false,
      },
      resolveConfirmation: mockResolveConfirmation,
    });

    render(<AgentPanel />);
    expect(screen.getByTestId('confirmation-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
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
      setMessages: mockSetMessages,
      pendingConfirmation: null,
      resolveConfirmation: mockResolveConfirmation,
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
      setMessages: mockSetMessages,
      pendingConfirmation: null,
      resolveConfirmation: mockResolveConfirmation,
    });

    render(<AgentPanel />);
    const newBtn = screen.getByText('New');
    fireEvent.click(newBtn);
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
      setMessages: mockSetMessages,
      pendingConfirmation: null,
      resolveConfirmation: mockResolveConfirmation,
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
