/**
 * AttachmentsBrowser Component Tests
 * Tests for the global attachment browser view
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentsBrowser } from '../AttachmentsBrowser';
import type { Attachment } from '@/api/types-extended';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    client: {
      baseUrl: 'http://localhost:3000',
      get: vi.fn(),
    },
    notes: {
      list: vi.fn(),
    },
    attachments: {
      listAttachments: vi.fn(),
      getDownloadUrl: vi.fn((id: string) => `http://localhost:3000/api/v1/attachments/${id}/download`),
      downloadAttachment: vi.fn(),
      getMetadata: vi.fn(),
      deleteAttachment: vi.fn(),
    },
  },
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

// Mock tauri utilities
vi.mock('@/lib/tauri', () => ({
  getCachedConfig: vi.fn(() => null),
  useBlobUrl: vi.fn(() => undefined),
}));

import { api, ApiError } from '@/api';

const mockAttachments: Attachment[] = [
  {
    id: 'att-1',
    note_id: 'note-1',
    filename: 'research-paper.pdf',
    content_type: 'application/pdf',
    size_bytes: 1048576,
    created_at: '2026-02-15T12:00:00Z',
    storage_path: '/data/att-1',
    status: 'completed' as const,
    has_exif: false,
    has_location: false,
  },
  {
    id: 'att-2',
    note_id: 'note-1',
    filename: 'photo.jpg',
    content_type: 'image/jpeg',
    size_bytes: 524288,
    created_at: '2026-02-16T12:00:00Z',
    storage_path: '/data/att-2',
    status: 'completed' as const,
    has_exif: true,
    has_location: true,
  },
  {
    id: 'att-3',
    note_id: 'note-2',
    filename: 'data.csv',
    content_type: 'text/csv',
    size_bytes: 2048,
    created_at: '2026-02-17T12:00:00Z',
    storage_path: '/data/att-3',
    status: 'completed' as const,
    has_exif: false,
    has_location: false,
  },
];

const mockNotes = [
  { id: 'note-1', title: 'Machine Learning Overview', snippet: '', created_at_utc: '2026-02-10T00:00:00Z', updated_at_utc: '2026-02-15T00:00:00Z', starred: false, archived: false, tags: [], has_revision: false, metadata: {} },
  { id: 'note-2', title: 'Data Analysis Notes', snippet: '', created_at_utc: '2026-02-11T00:00:00Z', updated_at_utc: '2026-02-17T00:00:00Z', starred: false, archived: false, tags: [], has_revision: false, metadata: {} },
  { id: 'note-3', title: 'Empty Note', snippet: '', created_at_utc: '2026-02-12T00:00:00Z', updated_at_utc: '2026-02-12T00:00:00Z', starred: false, archived: false, tags: [], has_revision: false, metadata: {} },
];

describe('AttachmentsBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Global endpoint available', () => {
    beforeEach(() => {
      (api.client.get as any).mockResolvedValue({
        attachments: mockAttachments.map((att) => ({
          ...att,
          note_title: att.note_id === 'note-1' ? 'Machine Learning Overview' : 'Data Analysis Notes',
        })),
        total: 3,
      });
    });

    it('should render attachments from global endpoint', async () => {
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
        expect(screen.getByText('data.csv')).toBeInTheDocument();
      });
    });

    it('should show note titles as secondary context', async () => {
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getAllByText('Machine Learning Overview').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Data Analysis Notes').length).toBeGreaterThan(0);
      });
    });

    it('should show attachment count badge', async () => {
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('Fallback to per-note fetching', () => {
    beforeEach(() => {
      // Global endpoint returns 404
      (api.client.get as any).mockRejectedValue(new ApiError('Not Found', 404));
      (api.notes.list as any).mockResolvedValue(mockNotes);
      (api.attachments.listAttachments as any).mockImplementation((noteId: string) => {
        if (noteId === 'note-1') return Promise.resolve([mockAttachments[0], mockAttachments[1]]);
        if (noteId === 'note-2') return Promise.resolve([mockAttachments[2]]);
        return Promise.resolve([]);
      });
    });

    it('should fall back to per-note fetching when global endpoint is 404', async () => {
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
        expect(screen.getByText('data.csv')).toBeInTheDocument();
      });
    });

    it('should eventually show all results from fallback', async () => {
      render(<AttachmentsBrowser />);

      // Should show all results after scanning completes
      await waitFor(() => {
        expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
        expect(screen.getByText('data.csv')).toBeInTheDocument();
      });
    });

    it('should show note titles from fetched notes', async () => {
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getAllByText('Machine Learning Overview').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no attachments exist', async () => {
      (api.client.get as any).mockRejectedValue(new ApiError('Not Found', 404));
      (api.notes.list as any).mockResolvedValue([]);

      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByText('No attachments found')).toBeInTheDocument();
      });
    });
  });

  describe('Error state', () => {
    it('should show error when both endpoints fail', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (api.client.get as any).mockRejectedValue(new Error('Network error'));
      (api.notes.list as any).mockRejectedValue(new Error('Network error'));

      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load attachments')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should have a retry button on error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (api.client.get as any).mockRejectedValue(new Error('Network error'));
      (api.notes.list as any).mockRejectedValue(new Error('Network error'));

      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Filtering and sorting', () => {
    beforeEach(() => {
      (api.client.get as any).mockResolvedValue({
        attachments: mockAttachments.map((att) => ({
          ...att,
          note_title: att.note_id === 'note-1' ? 'Machine Learning Overview' : 'Data Analysis Notes',
        })),
        total: 3,
      });
    });

    it('should filter by search query', async () => {
      const user = userEvent.setup();
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search files or notes...');
      await user.type(searchInput, 'research');

      expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
      expect(screen.queryByText('data.csv')).not.toBeInTheDocument();
    });

    it('should search by note title', async () => {
      const user = userEvent.setup();
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByText('data.csv')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search files or notes...');
      await user.type(searchInput, 'Data Analysis');

      expect(screen.getByText('data.csv')).toBeInTheDocument();
      expect(screen.queryByText('research-paper.pdf')).not.toBeInTheDocument();
    });

    it('should show "no matches" when filters exclude everything', async () => {
      const user = userEvent.setup();
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByText('research-paper.pdf')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search files or notes...');
      await user.type(searchInput, 'nonexistent-file');

      expect(screen.getByText('No attachments match your filters')).toBeInTheDocument();
    });
  });

  describe('View modes', () => {
    beforeEach(() => {
      (api.client.get as any).mockResolvedValue({
        attachments: mockAttachments.map((att) => ({
          ...att,
          note_title: 'Test Note',
        })),
        total: 3,
      });
    });

    it('should default to grid view', async () => {
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByTestId('attachment-grid')).toBeInTheDocument();
      });
    });

    it('should switch to list view', async () => {
      const user = userEvent.setup();
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByTestId('attachment-grid')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'list view' }));

      expect(screen.getByTestId('attachment-list')).toBeInTheDocument();
    });
  });

  describe('Stats bar', () => {
    beforeEach(() => {
      (api.client.get as any).mockResolvedValue({
        attachments: mockAttachments.map((att) => ({
          ...att,
          note_title: 'Test Note',
        })),
        total: 3,
      });
    });

    it('should show total size and type counts', async () => {
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        // 1048576 + 524288 + 2048 = 1574912 bytes ≈ 1.5 MB
        expect(screen.getByText('1.5 MB total')).toBeInTheDocument();
        expect(screen.getByText('1 images')).toBeInTheDocument();
        expect(screen.getByText('1 PDFs')).toBeInTheDocument();
        expect(screen.getByText('1 other')).toBeInTheDocument();
      });
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate attachments with same blob_id across notes', async () => {
      const duplicateAttachments = [
        {
          id: 'att-1',
          note_id: 'note-1',
          filename: 'shared-file.pdf',
          content_type: 'application/pdf',
          size_bytes: 1048576,
          created_at: '2026-02-15T12:00:00Z',
          storage_path: '/data/att-1',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          blob_id: 'blob-abc123',
          note_title: 'Note A',
        },
        {
          id: 'att-2',
          note_id: 'note-2',
          filename: 'shared-file.pdf',
          content_type: 'application/pdf',
          size_bytes: 1048576,
          created_at: '2026-02-16T12:00:00Z',
          storage_path: '/data/att-2',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          blob_id: 'blob-abc123',
          note_title: 'Note B',
        },
        {
          id: 'att-3',
          note_id: 'note-3',
          filename: 'unique-file.jpg',
          content_type: 'image/jpeg',
          size_bytes: 524288,
          created_at: '2026-02-17T12:00:00Z',
          storage_path: '/data/att-3',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          note_title: 'Note C',
        },
      ];

      (api.client.get as any).mockResolvedValue({
        attachments: duplicateAttachments,
        total: 3,
      });

      render(<AttachmentsBrowser />);

      await waitFor(() => {
        // Should show only 2 unique cards, not 3
        expect(screen.getByText('unique-file.jpg')).toBeInTheDocument();
        // shared-file.pdf should appear once (the newer one, att-2)
        expect(screen.getAllByText('shared-file.pdf').length).toBe(1);
      });
    });

    it('should show note count badge for duplicated files', async () => {
      const duplicateAttachments = [
        {
          id: 'att-1',
          note_id: 'note-1',
          filename: 'shared-file.pdf',
          content_type: 'application/pdf',
          size_bytes: 1048576,
          created_at: '2026-02-15T12:00:00Z',
          storage_path: '/data/att-1',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          blob_id: 'blob-abc123',
          note_title: 'Note A',
        },
        {
          id: 'att-2',
          note_id: 'note-2',
          filename: 'shared-file.pdf',
          content_type: 'application/pdf',
          size_bytes: 1048576,
          created_at: '2026-02-16T12:00:00Z',
          storage_path: '/data/att-2',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          blob_id: 'blob-abc123',
          note_title: 'Note B',
        },
        {
          id: 'att-3',
          note_id: 'note-3',
          filename: 'unique-file.jpg',
          content_type: 'image/jpeg',
          size_bytes: 524288,
          created_at: '2026-02-17T12:00:00Z',
          storage_path: '/data/att-3',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          note_title: 'Note C',
        },
      ];

      (api.client.get as any).mockResolvedValue({
        attachments: duplicateAttachments,
        total: 3,
      });

      render(<AttachmentsBrowser />);

      await waitFor(() => {
        // The shared file should show "2 notes" instead of a single note title
        expect(screen.getByText('2 notes')).toBeInTheDocument();
        // The unique file should show its note title
        expect(screen.getByText('Note C')).toBeInTheDocument();
      });
    });

    it('should deduplicate by composite key when blob_id is absent', async () => {
      const duplicateAttachments = [
        {
          id: 'att-1',
          note_id: 'note-1',
          filename: 'report.pdf',
          content_type: 'application/pdf',
          size_bytes: 2048,
          created_at: '2026-02-15T12:00:00Z',
          storage_path: '/data/att-1',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          note_title: 'Note A',
        },
        {
          id: 'att-2',
          note_id: 'note-2',
          filename: 'report.pdf',
          content_type: 'application/pdf',
          size_bytes: 2048,
          created_at: '2026-02-16T12:00:00Z',
          storage_path: '/data/att-2',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          note_title: 'Note B',
        },
      ];

      (api.client.get as any).mockResolvedValue({
        attachments: duplicateAttachments,
        total: 2,
      });

      render(<AttachmentsBrowser />);

      await waitFor(() => {
        // Should show only 1 card with "2 notes"
        expect(screen.getAllByText('report.pdf').length).toBe(1);
        expect(screen.getByText('2 notes')).toBeInTheDocument();
      });
    });

    it('should compute stats from unique files, not raw attachments', async () => {
      const duplicateAttachments = [
        {
          id: 'att-1',
          note_id: 'note-1',
          filename: 'shared.pdf',
          content_type: 'application/pdf',
          size_bytes: 1048576,
          created_at: '2026-02-15T12:00:00Z',
          storage_path: '/data/att-1',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          blob_id: 'blob-abc',
          note_title: 'Note A',
        },
        {
          id: 'att-2',
          note_id: 'note-2',
          filename: 'shared.pdf',
          content_type: 'application/pdf',
          size_bytes: 1048576,
          created_at: '2026-02-16T12:00:00Z',
          storage_path: '/data/att-2',
          status: 'completed' as const,
          has_exif: false,
          has_location: false,
          blob_id: 'blob-abc',
          note_title: 'Note B',
        },
      ];

      (api.client.get as any).mockResolvedValue({
        attachments: duplicateAttachments,
        total: 2,
      });

      render(<AttachmentsBrowser />);

      await waitFor(() => {
        // Stats should show 1 PDF (unique), not 2
        expect(screen.getByText('1 PDFs')).toBeInTheDocument();
        // Total size should be for 1 file, not 2
        expect(screen.getByText('1.0 MB total')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper region role', async () => {
      (api.client.get as any).mockResolvedValue({ attachments: [], total: 0 });
      render(<AttachmentsBrowser />);

      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'All Attachments' })).toBeInTheDocument();
      });
    });
  });
});
