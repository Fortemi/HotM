import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportMenu } from '../ExportMenu';
import type { UIMessage } from '@ai-sdk/react';

// Mock the export functions so we don't need real Blob/download infrastructure
vi.mock('../session-export', async () => {
  const actual = await vi.importActual('../session-export');
  return {
    ...actual,
    downloadExport: vi.fn(),
    triggerPrint: vi.fn(),
  };
});

import { downloadExport, triggerPrint } from '../session-export';

const messages: UIMessage[] = [
  { id: 'u1', role: 'user', parts: [{ type: 'text' as const, text: 'Hello' }] },
  { id: 'a1', role: 'assistant', parts: [{ type: 'text' as const, text: 'Hi!' }] },
];

describe('ExportMenu', () => {
  it('renders export button', () => {
    render(<ExportMenu messages={messages} />);
    expect(screen.getByTitle('Export session')).toBeInTheDocument();
  });

  it('disables button when no messages', () => {
    render(<ExportMenu messages={[]} />);
    expect(screen.getByTitle('Export session')).toBeDisabled();
  });

  it('disables button when disabled prop is true', () => {
    render(<ExportMenu messages={messages} disabled />);
    expect(screen.getByTitle('Export session')).toBeDisabled();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(<ExportMenu messages={messages} />);

    await user.click(screen.getByTitle('Export session'));
    expect(screen.getByText('Markdown (.md)')).toBeInTheDocument();
    expect(screen.getByText('JSON (.json)')).toBeInTheDocument();
    expect(screen.getByText('Plain Text (.txt)')).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('triggers markdown download', async () => {
    const user = userEvent.setup();
    render(<ExportMenu messages={messages} sessionName="Test Session" />);

    await user.click(screen.getByTitle('Export session'));
    await user.click(screen.getByText('Markdown (.md)'));

    expect(downloadExport).toHaveBeenCalledWith(
      expect.stringContaining('# Test Session'),
      'Test-Session.md',
      'text/markdown',
    );
  });

  it('triggers JSON download', async () => {
    const user = userEvent.setup();
    render(<ExportMenu messages={messages} sessionName="Test" />);

    await user.click(screen.getByTitle('Export session'));
    await user.click(screen.getByText('JSON (.json)'));

    expect(downloadExport).toHaveBeenCalledWith(
      expect.stringContaining('"sessionName": "Test"'),
      'Test.json',
      'application/json',
    );
  });

  it('triggers print', async () => {
    const user = userEvent.setup();
    render(<ExportMenu messages={messages} />);

    await user.click(screen.getByTitle('Export session'));
    await user.click(screen.getByText('Print'));

    expect(triggerPrint).toHaveBeenCalled();
  });
});
