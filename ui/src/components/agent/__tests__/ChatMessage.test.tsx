import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';
import type { UIMessage } from '@ai-sdk/react';

// Mock ToolResultCard to avoid pulling in full component tree
vi.mock('../ToolResultCard', () => ({
  ToolResultCard: ({ toolName, result }: { toolName: string; result: unknown }) => (
    <div data-testid="tool-result-card" data-tool={toolName}>
      {JSON.stringify(result)}
    </div>
  ),
}));

// Mock the ai module helpers used by ChatMessage
vi.mock('ai', () => ({
  isToolUIPart: (part: { type: string }) => part.type.startsWith('tool-') || part.type === 'dynamic-tool',
  getToolName: (part: { type: string; toolName?: string }) => {
    if (part.type === 'dynamic-tool') return (part as { toolName: string }).toolName;
    return part.type.replace(/^tool-/, '');
  },
}));

function makeMessage(overrides: Partial<UIMessage>): UIMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    parts: [],
    createdAt: new Date(),
    ...overrides,
  } as UIMessage;
}

describe('ChatMessage', () => {
  it('renders user text message with user avatar', () => {
    const msg = makeMessage({
      role: 'user',
      parts: [{ type: 'text', text: 'Hello agent' }] as UIMessage['parts'],
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText('Hello agent')).toBeInTheDocument();
  });

  it('renders assistant text message with bot avatar', () => {
    const msg = makeMessage({
      role: 'assistant',
      parts: [{ type: 'text', text: 'I found 3 notes.' }] as UIMessage['parts'],
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText('I found 3 notes.')).toBeInTheDocument();
  });

  it('renders multiple text parts', () => {
    const msg = makeMessage({
      parts: [
        { type: 'text', text: 'First part' },
        { type: 'text', text: 'Second part' },
      ] as UIMessage['parts'],
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText('First part')).toBeInTheDocument();
    expect(screen.getByText('Second part')).toBeInTheDocument();
  });

  it('skips empty text parts', () => {
    const msg = makeMessage({
      parts: [
        { type: 'text', text: '' },
        { type: 'text', text: 'Visible' },
      ] as UIMessage['parts'],
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });

  it('renders tool invocation in-progress state', () => {
    const msg = makeMessage({
      parts: [
        {
          type: 'tool-search_notes',
          toolCallId: 'tc1',
          state: 'input-available',
          input: { query: 'test' },
        },
      ] as unknown as UIMessage['parts'],
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText(/Calling search_notes/)).toBeInTheDocument();
  });

  it('renders tool invocation result via ToolResultCard', () => {
    const resultData = [{ note_id: 'n1', snippet: 'found', score: 0.8 }];
    const msg = makeMessage({
      parts: [
        {
          type: 'tool-search_notes',
          toolCallId: 'tc1',
          state: 'output-available',
          input: { query: 'test' },
          output: resultData,
        },
      ] as unknown as UIMessage['parts'],
    });
    render(<ChatMessage message={msg} />);
    const card = screen.getByTestId('tool-result-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('data-tool', 'search_notes');
  });

  it('renders tool error state', () => {
    const msg = makeMessage({
      parts: [
        {
          type: 'tool-search_notes',
          toolCallId: 'tc1',
          state: 'output-error',
          input: { query: 'test' },
          errorText: 'API unavailable',
        },
      ] as unknown as UIMessage['parts'],
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText(/search_notes failed: API unavailable/)).toBeInTheDocument();
  });

  it('renders mixed text and tool parts', () => {
    const msg = makeMessage({
      parts: [
        { type: 'text', text: 'Let me search for that.' },
        {
          type: 'tool-search_notes',
          toolCallId: 'tc1',
          state: 'output-available',
          input: { query: 'test' },
          output: [],
        },
        { type: 'text', text: 'No results found.' },
      ] as unknown as UIMessage['parts'],
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText('Let me search for that.')).toBeInTheDocument();
    expect(screen.getByTestId('tool-result-card')).toBeInTheDocument();
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });
});
