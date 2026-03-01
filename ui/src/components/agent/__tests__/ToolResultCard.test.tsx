/**
 * Tests for ToolResultCard — verifies each tool type renders correctly.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolResultCard } from '../ToolResultCard';

describe('ToolResultCard', () => {
  describe('search_notes', () => {
    it('renders search results with scores and clickable notes', async () => {
      const onClick = vi.fn();
      render(
        <ToolResultCard
          toolName="search_notes"
          result={[
            { note_id: 'n1', title: 'ML Notes', snippet: 'Deep learning intro', score: 0.92, tags: ['ai'] },
            { note_id: 'n2', title: 'Stats', snippet: 'Bayesian methods', score: 0.75, tags: [] },
          ]}
          onNoteClick={onClick}
        />,
      );

      expect(screen.getByText('2 results')).toBeInTheDocument();
      expect(screen.getByText('ML Notes')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();

      await userEvent.click(screen.getByText('ML Notes'));
      expect(onClick).toHaveBeenCalledWith('n1');
    });
  });

  describe('get_note', () => {
    it('renders note content and tags', () => {
      render(
        <ToolResultCard
          toolName="get_note"
          result={{
            note_id: 'n1',
            title: 'Test Note',
            content: 'Some content here',
            tags: ['work', 'important'],
            created_at: '2026-01-01',
          }}
        />,
      );

      expect(screen.getByText('Test Note')).toBeInTheDocument();
      expect(screen.getByText('Some content here')).toBeInTheDocument();
      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('important')).toBeInTheDocument();
    });

    it('shows attachment summary when attachments present', () => {
      render(
        <ToolResultCard
          toolName="get_note"
          result={{
            note_id: 'n1',
            title: 'Note with files',
            content: 'Has attachments',
            tags: [],
            created_at: '2026-01-01',
            attachment_count: 2,
            attachments: [
              { id: 'a1', filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 2048 },
              { id: 'a2', filename: 'doc.pdf', content_type: 'application/pdf', size_bytes: 50000 },
            ],
          }}
        />,
      );

      expect(screen.getByText('2 attachments')).toBeInTheDocument();
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    });

    it('does not show attachment section when count is 0', () => {
      render(
        <ToolResultCard
          toolName="get_note"
          result={{
            note_id: 'n1',
            title: 'No files',
            content: 'Plain note',
            tags: [],
            created_at: '2026-01-01',
            attachment_count: 0,
          }}
        />,
      );

      expect(screen.queryByText(/attachment/i)).not.toBeInTheDocument();
    });
  });

  describe('get_attachments', () => {
    it('renders attachment list with file details', () => {
      render(
        <ToolResultCard
          toolName="get_attachments"
          result={{
            note_id: 'n1',
            total: 3,
            attachments: [
              { id: 'a1', filename: 'image.png', content_type: 'image/png', size_bytes: 1024 },
              { id: 'a2', filename: 'song.mp3', content_type: 'audio/mpeg', size_bytes: 5242880 },
              { id: 'a3', filename: 'clip.mp4', content_type: 'video/mp4', size_bytes: 10485760 },
            ],
          }}
        />,
      );

      expect(screen.getByText('3 attachments')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
      expect(screen.getByText('song.mp3')).toBeInTheDocument();
      expect(screen.getByText('clip.mp4')).toBeInTheDocument();
      // File size formatting
      expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
      expect(screen.getByText(/5\.0 MB/)).toBeInTheDocument();
      expect(screen.getByText(/10\.0 MB/)).toBeInTheDocument();
    });

    it('shows empty state when no attachments', () => {
      render(
        <ToolResultCard
          toolName="get_attachments"
          result={{ note_id: 'n1', total: 0, attachments: [] }}
        />,
      );

      expect(screen.getByText('0 attachments')).toBeInTheDocument();
      expect(screen.getByText('No attachments found.')).toBeInTheDocument();
    });

    it('shows AI description when available', () => {
      render(
        <ToolResultCard
          toolName="get_attachments"
          result={{
            note_id: 'n1',
            total: 1,
            attachments: [
              {
                id: 'a1',
                filename: 'photo.jpg',
                content_type: 'image/jpeg',
                size_bytes: 2048,
                ai_description: 'A sunset over mountains',
              },
            ],
          }}
        />,
      );

      expect(screen.getByText('A sunset over mountains')).toBeInTheDocument();
    });
  });

  describe('list_archives', () => {
    it('renders archive list with metadata', () => {
      render(
        <ToolResultCard
          toolName="list_archives"
          result={{
            archives: [
              {
                name: 'default',
                description: 'Main archive',
                is_default: true,
                note_count: 42,
                size_bytes: 1048576,
                created_at: '2026-01-01',
              },
            ],
          }}
        />,
      );

      expect(screen.getByText('1 archive')).toBeInTheDocument();
      // Name "default" appears twice (name + is_default badge)
      expect(screen.getAllByText('default')).toHaveLength(2);
      expect(screen.getByText('Main archive')).toBeInTheDocument();
      expect(screen.getByText('42 notes')).toBeInTheDocument();
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
    });
  });

  describe('list_notes', () => {
    it('renders note list with click handler', async () => {
      const onClick = vi.fn();
      render(
        <ToolResultCard
          toolName="list_notes"
          result={{
            notes: [
              { note_id: 'n1', title: 'First', snippet: 'content', tags: ['a'], created_at: '2026-01-01' },
            ],
            total: 1,
          }}
          onNoteClick={onClick}
        />,
      );

      expect(screen.getByText('1 note')).toBeInTheDocument();
      await userEvent.click(screen.getByText('First'));
      expect(onClick).toHaveBeenCalledWith('n1');
    });
  });

  describe('create_note', () => {
    it('renders note creation confirmation with clickable ID', async () => {
      const onClick = vi.fn();
      render(
        <ToolResultCard
          toolName="create_note"
          result={{ note_id: 'abc-123', title: 'New Note', revision_mode: 'standard' }}
          onNoteClick={onClick}
        />,
      );

      expect(screen.getByText('Note created')).toBeInTheDocument();
      expect(screen.getByText('New Note')).toBeInTheDocument();
      await userEvent.click(screen.getByText('abc-123'));
      expect(onClick).toHaveBeenCalledWith('abc-123');
    });
  });

  describe('unknown tool', () => {
    it('falls back to generic JSON card', () => {
      render(
        <ToolResultCard
          toolName="unknown_tool"
          result={{ foo: 'bar' }}
        />,
      );

      expect(screen.getByText('unknown_tool')).toBeInTheDocument();
      expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();
    });
  });
});
