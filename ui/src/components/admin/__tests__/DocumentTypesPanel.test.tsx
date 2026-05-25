import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentTypesPanel } from '../DocumentTypesPanel';
import { api } from '@/api';
import type { DocumentType } from '@/api/types-extended';

vi.mock('@/api', () => ({
  api: {
    documents: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockTypes: DocumentType[] = [
  {
    name: 'markdown',
    display_name: 'Markdown',
    category: 'text',
    description: 'Markdown documents',
    file_extensions: ['.md'],
    filename_patterns: [],
    content_magic: [],
    chunking_strategy: 'heading',
    syntax_language: 'markdown',
    embedding_model_hint: null,
    is_system: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    name: 'research_note',
    display_name: 'Research Note',
    category: 'research',
    description: 'Research notes',
    file_extensions: ['.md', '.txt'],
    filename_patterns: ['*_notes.md'],
    content_magic: [],
    chunking_strategy: 'semantic',
    syntax_language: 'markdown',
    embedding_model_hint: 'nomic-embed-text',
    is_system: false,
    created_at: '2026-01-02T00:00:00Z',
  },
];

describe('DocumentTypesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.documents.list).mockResolvedValue(mockTypes);
    vi.mocked(api.documents.create).mockResolvedValue({
      ...mockTypes[1],
      name: 'meeting_note',
      display_name: 'Meeting Note',
    });
    vi.mocked(api.documents.delete).mockResolvedValue(undefined);
  });

  it('lists system and custom document types', async () => {
    render(<DocumentTypesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Markdown')).toBeInTheDocument();
      expect(screen.getByText('Research Note')).toBeInTheDocument();
      expect(screen.getByText('2 document types')).toBeInTheDocument();
    });

    expect(screen.getByText('heading')).toBeInTheDocument();
    expect(screen.getByText('.md, .txt')).toBeInTheDocument();
  });

  it('creates a custom document type', async () => {
    const user = userEvent.setup();
    render(<DocumentTypesPanel />);

    await screen.findByText('Research Note');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'meeting_note' } });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Meeting Note' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'meeting' } });
    fireEvent.change(screen.getByLabelText('Chunking strategy'), { target: { value: 'semantic' } });
    fireEvent.change(screen.getByLabelText('File extensions'), { target: { value: '.md, .txt' } });
    fireEvent.change(screen.getByLabelText('Filename patterns'), { target: { value: '*meeting*.md' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Meeting notes and action items' } });
    await user.click(screen.getByRole('button', { name: /Create Document Type/i }));

    await waitFor(() => {
      expect(api.documents.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'meeting_note',
        display_name: 'Meeting Note',
        category: 'meeting',
        chunking_strategy: 'semantic',
        file_extensions: ['.md', '.txt'],
        filename_patterns: ['*meeting*.md'],
      }));
      expect(screen.getByText('Document type created')).toBeInTheDocument();
    });
  });

  it('deletes custom document types but disables system type delete', async () => {
    const user = userEvent.setup();
    render(<DocumentTypesPanel />);

    await screen.findByText('Research Note');
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).not.toBeDisabled();

    await user.click(deleteButtons[1]);

    await waitFor(() => {
      expect(api.documents.delete).toHaveBeenCalledWith('research_note');
      expect(screen.getByText('Document type deleted')).toBeInTheDocument();
    });
  });
});
