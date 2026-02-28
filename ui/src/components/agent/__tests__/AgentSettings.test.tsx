import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentSettings } from '../AgentSettings';

// Mock the api module
const mockSendMessage = vi.fn();
const mockGetModels = vi.fn();
vi.mock('@/api', () => ({
  api: {
    chat: {
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
      getModels: (...args: unknown[]) => mockGetModels(...args),
    },
  },
}));

// Mock useChatModels hook
vi.mock('../useChatModels', () => ({
  useChatModels: () => ({
    models: [],
    defaultModel: undefined,
    isLoading: false,
    error: undefined,
    refresh: vi.fn(),
  }),
}));

// Mock the Select component (Radix portals crash in jsdom)
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <div data-testid="mock-select">
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid="provider-select"
      >
        <option value="fortemi">Fortemi (Native)</option>
        <option value="ollama">Ollama (Local)</option>
        <option value="anthropic">Anthropic Claude</option>
        <option value="openai">OpenAI</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <span>{children}</span>,
  SelectValue: () => null,
}));

// Mock the Slider component
vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: {
    value: number[];
    onValueChange: (v: number[]) => void;
    min: number;
    max: number;
    step: number;
  }) => (
    <input
      type="range"
      data-testid="temperature-slider"
      value={value[0]}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
    />
  ),
}));

describe('AgentSettings', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    onClose.mockClear();
    mockSendMessage.mockClear();
    vi.restoreAllMocks();
  });

  it('renders the settings header', () => {
    render(<AgentSettings onClose={onClose} />);
    expect(screen.getByText('AI Assistant Settings')).toBeInTheDocument();
  });

  it('shows provider section with selector', () => {
    render(<AgentSettings onClose={onClose} />);
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByTestId('provider-select')).toBeInTheDocument();
  });

  it('shows model section', () => {
    render(<AgentSettings onClose={onClose} />);
    expect(screen.getByText('Model')).toBeInTheDocument();
  });

  it('shows advanced settings', () => {
    render(<AgentSettings onClose={onClose} />);
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
  });

  it('shows connection test button', () => {
    render(<AgentSettings onClose={onClose} />);
    expect(screen.getByText('Test Connection')).toBeInTheDocument();
  });

  it('shows reset button', () => {
    render(<AgentSettings onClose={onClose} />);
    expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(<AgentSettings onClose={onClose} />);
    // The X button is the first ghost button
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons.find(b => b.querySelector('.lucide-x'));
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });

  it('changes provider via select', () => {
    render(<AgentSettings onClose={onClose} />);
    const select = screen.getByTestId('provider-select');
    fireEvent.change(select, { target: { value: 'anthropic' } });
    // Provider should be saved to localStorage
    const stored = JSON.parse(localStorage.getItem('hotm:agent-provider') ?? '{}');
    expect(stored.provider).toBe('anthropic');
  });

  it('shows cloud provider notice for anthropic', () => {
    // Pre-set anthropic
    localStorage.setItem('hotm:agent-provider', JSON.stringify({ provider: 'anthropic' }));
    render(<AgentSettings onClose={onClose} />);
    expect(screen.getByText(/API keys configured on the agent-proxy/)).toBeInTheDocument();
  });

  it('handles max steps input change', () => {
    render(<AgentSettings onClose={onClose} />);
    const maxStepsInput = screen.getByDisplayValue('5');
    fireEvent.change(maxStepsInput, { target: { value: '10' } });
    const stored = JSON.parse(localStorage.getItem('hotm:agent-provider') ?? '{}');
    expect(stored.maxSteps).toBe(10);
  });

  it('tests fortemi connection via api.chat.sendMessage', async () => {
    mockSendMessage.mockResolvedValueOnce({ messages: [], actions: [] });
    render(<AgentSettings onClose={onClose} />);
    fireEvent.click(screen.getByText('Test Connection'));
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('ping');
    });
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('shows error when fortemi connection test fails', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('network error'));
    render(<AgentSettings onClose={onClose} />);
    fireEvent.click(screen.getByText('Test Connection'));
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('tests non-fortemi provider via agent-proxy fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    // Switch to ollama
    localStorage.setItem('hotm:agent-provider', JSON.stringify({ provider: 'ollama' }));
    render(<AgentSettings onClose={onClose} />);
    fireEvent.click(screen.getByText('Test Connection'));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/agent/chat',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });
});
