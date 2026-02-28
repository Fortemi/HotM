import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea and send button', () => {
    render(<ChatInput onSend={mockOnSend} />);
    expect(screen.getByPlaceholderText('Ask the agent...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('auto-focuses textarea on mount', () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText('Ask the agent...');
    expect(document.activeElement).toBe(textarea);
  });

  it('calls onSend and re-focuses on Enter key', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText('Ask the agent...');

    await user.type(textarea, 'hello');
    await user.keyboard('{Enter}');

    expect(mockOnSend).toHaveBeenCalledWith('hello');
    expect(document.activeElement).toBe(textarea);
  });

  it('re-focuses after send clears input', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText('Ask the agent...');

    await user.type(textarea, 'test message');
    fireEvent.click(screen.getByRole('button'));

    expect(mockOnSend).toHaveBeenCalledWith('test message');
    expect(document.activeElement).toBe(textarea);
  });

  it('re-focuses when isLoading transitions true → false', () => {
    const { rerender } = render(
      <ChatInput onSend={mockOnSend} isLoading={true} />,
    );
    const textarea = screen.getByPlaceholderText('Ask the agent...');

    // Blur to simulate focus being elsewhere
    textarea.blur();
    expect(document.activeElement).not.toBe(textarea);

    // Transition loading → not loading
    rerender(<ChatInput onSend={mockOnSend} isLoading={false} />);
    expect(document.activeElement).toBe(textarea);
  });

  it('does NOT re-focus when isLoading stays false', () => {
    const { rerender } = render(
      <ChatInput onSend={mockOnSend} isLoading={false} />,
    );
    const textarea = screen.getByPlaceholderText('Ask the agent...');

    textarea.blur();
    // Re-render with same isLoading=false — should not re-focus
    rerender(<ChatInput onSend={mockOnSend} isLoading={false} />);
    // The mount effect already focused, but blur happened after.
    // Since isLoading didn't transition, no re-focus should occur.
    expect(document.activeElement).not.toBe(textarea);
  });

  it('re-focuses when autoFocusKey increments', () => {
    const { rerender } = render(
      <ChatInput onSend={mockOnSend} autoFocusKey={0} />,
    );
    const textarea = screen.getByPlaceholderText('Ask the agent...');

    textarea.blur();
    expect(document.activeElement).not.toBe(textarea);

    rerender(<ChatInput onSend={mockOnSend} autoFocusKey={1} />);
    expect(document.activeElement).toBe(textarea);
  });

  it('does not send empty input', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText('Ask the agent...');

    await user.type(textarea, '   ');
    await user.keyboard('{Enter}');

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('allows Shift+Enter for newlines without sending', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText('Ask the agent...');

    await user.type(textarea, 'line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'line 2');

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('disables input when isLoading is true', () => {
    render(<ChatInput onSend={mockOnSend} isLoading={true} />);
    const textarea = screen.getByPlaceholderText('Ask the agent...');
    expect(textarea).toBeDisabled();
  });
});
