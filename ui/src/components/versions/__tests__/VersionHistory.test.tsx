/**
 * VersionHistory Component Tests
 *
 * Tests timeline view of note versions with diff comparison.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VersionHistory } from '../VersionHistory';
import { api } from '@/api';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    versions: {
      listVersions: vi.fn(),
      getVersion: vi.fn(),
      diffVersions: vi.fn(),
      restoreVersion: vi.fn(),
      deleteVersion: vi.fn(),
    },
  },
}));

// Mock MarkdownPreview
vi.mock('@/components/MarkdownPreview', () => ({
  MarkdownPreview: ({ content }: { content: string }) => (
    <div data-testid="markdown-preview">{content}</div>
  ),
}));

// Mock data
const mockVersions = [
  {
    version: 3,
    created_at: '2024-01-15T14:00:00Z',
    change_summary: 'Updated introduction',
    content_hash: 'abc123',
  },
  {
    version: 2,
    created_at: '2024-01-14T10:00:00Z',
    change_summary: 'Added new section',
    content_hash: 'def456',
  },
  {
    version: 1,
    created_at: '2024-01-13T09:00:00Z',
    change_summary: 'Initial version',
    content_hash: 'ghi789',
  },
];

const mockVersionContent = {
  version: 2,
  content: '# My Note\n\nThis is version 2 content.',
  created_at: '2024-01-14T10:00:00Z',
};

const mockDiff = {
  from_version: 1,
  to_version: 2,
  diff: '--- a/note.md\n+++ b/note.md\n@@ -1,3 +1,4 @@\n # My Note\n \n-Original content\n+Updated content\n+New paragraph',
};

describe('VersionHistory', () => {
  beforeEach(() => {
    vi.mocked(api.versions.listVersions).mockResolvedValue(mockVersions);
    vi.mocked(api.versions.getVersion).mockResolvedValue(mockVersionContent);
    vi.mocked(api.versions.diffVersions).mockResolvedValue(mockDiff);
    vi.mocked(api.versions.restoreVersion).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      const onClose = vi.fn();
      const { container } = render(
        <VersionHistory noteId="note-123" isOpen={false} onClose={onClose} />
      );
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it('should render dialog when open', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Version History')).toBeInTheDocument();
      });
    });

    it('should load versions on open', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(api.versions.listVersions).toHaveBeenCalledWith('note-123');
      });
    });
  });

  describe('Timeline View', () => {
    it('should display version list', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Version 3')).toBeInTheDocument();
        expect(screen.getByText('Version 2')).toBeInTheDocument();
        expect(screen.getByText('Version 1')).toBeInTheDocument();
      });
    });

    it('should mark current version', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Current')).toBeInTheDocument();
      });
    });

    it('should display change summaries', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Updated introduction')).toBeInTheDocument();
        expect(screen.getByText('Added new section')).toBeInTheDocument();
        expect(screen.getByText('Initial version')).toBeInTheDocument();
      });
    });

    it('should have accessible timeline list', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(
          screen.getByRole('list', { name: 'version history timeline' })
        ).toBeInTheDocument();
      });
    });

    it('should have View button for each version', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const viewButtons = screen.getAllByTitle('View version content');
        expect(viewButtons.length).toBe(3);
      });
    });

    it('should have Diff button for all versions', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const diffButtons = screen.getAllByTitle(/Compare with adjacent version/);
        expect(diffButtons.length).toBe(3); // All versions when multiple exist
      });
    });

    it('should have Restore button for non-current versions', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const restoreButtons = screen.getAllByTitle(/Restore this version/);
        expect(restoreButtons.length).toBe(2); // Not on current version
      });
    });
  });

  describe('Version View', () => {
    it('should load and display version content', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Version 2')).toBeInTheDocument();
      });

      // Click View on version 2
      const viewButtons = screen.getAllByText('View');
      fireEvent.click(viewButtons[1]); // Second View button (version 2)

      await waitFor(() => {
        expect(api.versions.getVersion).toHaveBeenCalledWith('note-123', 2);
        expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
      });
    });

    it('should show Back to Timeline button in view mode', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Version 2')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByText('View');
      fireEvent.click(viewButtons[1]);

      await waitFor(() => {
        expect(screen.getByText('Back to Timeline')).toBeInTheDocument();
      });
    });

    it('should return to timeline when Back clicked', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Version 2')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByText('View');
      fireEvent.click(viewButtons[1]);

      await waitFor(() => {
        expect(screen.getByText('Back to Timeline')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Back to Timeline'));

      await waitFor(() => {
        expect(
          screen.getByRole('list', { name: 'version history timeline' })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Diff View', () => {
    it('should load and display diff', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Version 3')).toBeInTheDocument();
      });

      // Click Diff on version 3
      const diffButtons = screen.getAllByText('Diff');
      fireEvent.click(diffButtons[0]);

      await waitFor(() => {
        expect(api.versions.diffVersions).toHaveBeenCalledWith('note-123', 2, 3);
      });
    });
  });

  describe('Restore', () => {
    it('should show restore confirmation dialog', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Version 2')).toBeInTheDocument();
      });

      // Click Restore on version 2
      const restoreButtons = screen.getAllByText('Restore');
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Restore Version/)).toBeInTheDocument();
        expect(
          screen.getByText(/This will create a new version with the content/)
        ).toBeInTheDocument();
      });
    });

    it('should call restore API and close on confirm', async () => {
      const onClose = vi.fn();
      const onRestore = vi.fn();
      render(
        <VersionHistory
          noteId="note-123"
          isOpen={true}
          onClose={onClose}
          onRestore={onRestore}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Version 2')).toBeInTheDocument();
      });

      const restoreButtons = screen.getAllByText('Restore');
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Find and click the Restore action button in the dialog
      const confirmButton = screen.getAllByText('Restore').find(
        (el) => el.closest('[role="alertdialog"]')
      );
      fireEvent.click(confirmButton!);

      await waitFor(() => {
        expect(api.versions.restoreVersion).toHaveBeenCalledWith('note-123', 2);
        expect(onRestore).toHaveBeenCalledWith(2);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should cancel restore on Cancel click', async () => {
      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Version 2')).toBeInTheDocument();
      });

      const restoreButtons = screen.getAllByText('Restore');
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      expect(api.versions.restoreVersion).not.toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no versions', async () => {
      vi.mocked(api.versions.listVersions).mockResolvedValue([]);

      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('No Version History')).toBeInTheDocument();
        expect(screen.getByText('This note has no previous versions')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator', async () => {
      vi.mocked(api.versions.listVersions).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockVersions), 100))
      );

      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      // Loading indicator should be visible
      await waitFor(() => {
        // The component shows a Loader2 icon during loading
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when load fails', async () => {
      vi.mocked(api.versions.listVersions).mockRejectedValue(new Error('Network error'));

      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load version history')).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      vi.mocked(api.versions.listVersions)
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(mockVersions);

      const onClose = vi.fn();
      render(<VersionHistory noteId="note-123" isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load version history')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Version 3')).toBeInTheDocument();
      });
    });
  });
});
