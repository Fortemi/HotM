import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageActions } from '../MessageActions';

describe('MessageActions', () => {
  it('renders delete button for user messages', () => {
    render(
      <MessageActions
        messageId="m1"
        isAssistant={false}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTitle('Delete message')).toBeInTheDocument();
    expect(screen.queryByTitle('Regenerate response')).not.toBeInTheDocument();
  });

  it('renders delete and regenerate buttons for assistant messages', () => {
    render(
      <MessageActions
        messageId="m1"
        isAssistant={true}
        onDelete={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByTitle('Delete message')).toBeInTheDocument();
    expect(screen.getByTitle('Regenerate response')).toBeInTheDocument();
  });

  it('requires double-click to delete (confirmation)', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <MessageActions
        messageId="m1"
        isAssistant={false}
        onDelete={onDelete}
      />,
    );

    // First click: shows confirmation
    await user.click(screen.getByTitle('Delete message'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTitle('Click again to confirm')).toBeInTheDocument();

    // Second click: actually deletes
    await user.click(screen.getByTitle('Click again to confirm'));
    expect(onDelete).toHaveBeenCalledWith('m1');
  });

  it('calls onRegenerate with message id', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    render(
      <MessageActions
        messageId="m-regen"
        isAssistant={true}
        onDelete={vi.fn()}
        onRegenerate={onRegenerate}
      />,
    );

    await user.click(screen.getByTitle('Regenerate response'));
    expect(onRegenerate).toHaveBeenCalledWith('m-regen');
  });

  it('does not show regenerate when onRegenerate is not provided', () => {
    render(
      <MessageActions
        messageId="m1"
        isAssistant={true}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByTitle('Regenerate response')).not.toBeInTheDocument();
  });
});
