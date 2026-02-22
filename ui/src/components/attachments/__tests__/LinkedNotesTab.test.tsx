/**
 * LinkedNotesTab Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkedNotesTab } from '../LinkedNotesTab';
import type { LinkedNote } from '../LinkedNotesTab';

const mockLinkedNotes: LinkedNote[] = [
  {
    noteId: 'note-1',
    noteTitle: 'Machine Learning Overview',
    attachmentId: 'att-1',
    createdAt: '2026-02-15T12:00:00Z',
  },
  {
    noteId: 'note-2',
    noteTitle: 'Data Analysis Notes',
    attachmentId: 'att-2',
    createdAt: '2026-02-16T12:00:00Z',
  },
  {
    noteId: 'note-3',
    noteTitle: 'Research Summary',
    attachmentId: 'att-3',
    createdAt: '2026-02-17T12:00:00Z',
  },
];

describe('LinkedNotesTab', () => {
  it('should show empty state when only one note', () => {
    render(<LinkedNotesTab linkedNotes={[mockLinkedNotes[0]]} />);

    expect(screen.getByTestId('linked-notes-empty')).toBeInTheDocument();
    expect(screen.getByText('This file is only attached to one note.')).toBeInTheDocument();
  });

  it('should show empty state when no notes', () => {
    render(<LinkedNotesTab linkedNotes={[]} />);

    expect(screen.getByTestId('linked-notes-empty')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<LinkedNotesTab linkedNotes={[]} isLoading={true} />);

    expect(screen.getByTestId('linked-notes-loading')).toBeInTheDocument();
    expect(screen.getByText('Finding linked notes...')).toBeInTheDocument();
  });

  it('should show list of linked notes', () => {
    render(<LinkedNotesTab linkedNotes={mockLinkedNotes} />);

    expect(screen.getByTestId('linked-notes-list')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning Overview')).toBeInTheDocument();
    expect(screen.getByText('Data Analysis Notes')).toBeInTheDocument();
    expect(screen.getByText('Research Summary')).toBeInTheDocument();
  });

  it('should show note count in header text', () => {
    render(<LinkedNotesTab linkedNotes={mockLinkedNotes} />);

    expect(screen.getByText('This file is attached to 3 notes:')).toBeInTheDocument();
  });

  it('should highlight current note with "(this note)" label', () => {
    render(<LinkedNotesTab linkedNotes={mockLinkedNotes} currentNoteId="note-2" />);

    expect(screen.getByText('(this note)')).toBeInTheDocument();
  });

  it('should call onNavigateToNote when clicking a non-current note', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <LinkedNotesTab
        linkedNotes={mockLinkedNotes}
        currentNoteId="note-1"
        onNavigateToNote={onNavigate}
      />
    );

    await user.click(screen.getByTestId('linked-note-note-2'));

    expect(onNavigate).toHaveBeenCalledWith('note-2');
  });

  it('should not call onNavigateToNote when clicking current note', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <LinkedNotesTab
        linkedNotes={mockLinkedNotes}
        currentNoteId="note-1"
        onNavigateToNote={onNavigate}
      />
    );

    await user.click(screen.getByTestId('linked-note-note-1'));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('should show attachment dates', () => {
    render(<LinkedNotesTab linkedNotes={mockLinkedNotes} />);

    // Check that dates are rendered (format depends on locale)
    const dateElements = screen.getAllByText(/Attached/);
    expect(dateElements.length).toBe(3);
  });
});
