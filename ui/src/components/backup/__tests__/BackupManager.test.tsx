/**
 * BackupManager Component Tests
 *
 * Tests backup and export functionality with restore operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BackupManager } from '../BackupManager';
import { api, BackupInfo } from '@/api';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    backup: {
      listBackups: vi.fn(),
      triggerBackup: vi.fn(),
      restoreDatabase: vi.fn(),
      downloadBackup: vi.fn(),
      downloadDatabaseBackup: vi.fn(),
      downloadKnowledgeArchive: vi.fn(),
      exportKnowledgeShard: vi.fn(),
      importKnowledgeShard: vi.fn(),
      importBackup: vi.fn(),
    },
    notes: {
      reprocessAll: vi.fn(),
    },
  },
}));

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:test');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock data
const mockBackups: BackupInfo[] = [
  {
    filename: 'backup-2024-01-15.db',
    label: 'Backup Jan 15',
    created_at: '2024-01-15T14:00:00Z',
    size_bytes: 52428800, // 50MB
    type: 'database',
  },
  {
    filename: 'backup-2024-01-14.db',
    label: 'Backup Jan 14',
    created_at: '2024-01-14T10:00:00Z',
    size_bytes: 51380224, // 49MB
    type: 'database',
  },
];

describe('BackupManager', () => {
  beforeEach(() => {
    vi.mocked(api.backup.listBackups).mockResolvedValue(mockBackups);
    vi.mocked(api.backup.triggerBackup).mockResolvedValue(undefined);
    vi.mocked(api.backup.restoreDatabase).mockResolvedValue(undefined);
    vi.mocked(api.backup.downloadBackup).mockResolvedValue(new Blob(['test']));
    vi.mocked(api.backup.downloadDatabaseBackup).mockResolvedValue(new Blob(['test']));
    vi.mocked(api.backup.exportKnowledgeShard).mockResolvedValue(new Blob(['test']));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render backup manager title', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup & Export')).toBeInTheDocument();
      });
    });

    it('should render quick action buttons', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
        expect(screen.getByText('Import')).toBeInTheDocument();
        expect(screen.getByText('Create Backup')).toBeInTheDocument();
      });
    });

    it('should load backups on mount', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(api.backup.listBackups).toHaveBeenCalled();
      });
    });

    it('should display backup count badge', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Database Backups')).toBeInTheDocument();
      });
    });

    it('should display backup list when expanded', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
        expect(screen.getByText('Backup Jan 14')).toBeInTheDocument();
      });
    });

    it('should display backup sizes', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('50.0 MB')).toBeInTheDocument();
      });
    });
  });

  describe('Create Backup', () => {
    it('should trigger backup when Create Backup clicked', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Backup')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Backup'));

      await waitFor(() => {
        expect(api.backup.triggerBackup).toHaveBeenCalled();
      });
    });

    it('should show success message after backup creation', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Backup')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Backup'));

      await waitFor(() => {
        expect(screen.getByText('Backup created successfully')).toBeInTheDocument();
      });
    });

    it('should refresh backup list after creation', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Backup')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Backup'));

      await waitFor(() => {
        // listBackups should be called twice - once on mount, once after backup
        expect(api.backup.listBackups).toHaveBeenCalledTimes(2);
      });
    });

    it('should show error message on backup failure', async () => {
      vi.mocked(api.backup.triggerBackup).mockRejectedValue(new Error('Backup failed'));

      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Backup')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Backup'));

      await waitFor(() => {
        expect(screen.getByText('Failed to create backup')).toBeInTheDocument();
      });
    });
  });

  describe('Export Dialog', () => {
    it('should open export dialog when Export clicked', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Export'));

      await waitFor(() => {
        expect(screen.getByText('Export Knowledge Base')).toBeInTheDocument();
      });
    });

    it('should have export format options', async () => {
      render(<BackupManager />);

      fireEvent.click(screen.getByText('Export'));

      await waitFor(() => {
        expect(screen.getByText('Knowledge Shard')).toBeInTheDocument();
        expect(screen.getByText('JSON Export')).toBeInTheDocument();
      });
    });

    it('should close dialog on Cancel', async () => {
      render(<BackupManager />);

      fireEvent.click(screen.getByText('Export'));

      await waitFor(() => {
        expect(screen.getByText('Export Knowledge Base')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Export Knowledge Base')).not.toBeInTheDocument();
      });
    });
  });

  describe('Import Dialog', () => {
    it('should open import dialog when Import clicked', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Import')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Import'));

      await waitFor(() => {
        expect(screen.getByText('Import Knowledge Base')).toBeInTheDocument();
      });
    });

    it('should have file upload area', async () => {
      render(<BackupManager />);

      fireEvent.click(screen.getByText('Import'));

      await waitFor(() => {
        expect(screen.getByText(/Drop a .json or .shard file/)).toBeInTheDocument();
        expect(screen.getByText('browse')).toBeInTheDocument();
      });
    });

    it('should have file input', async () => {
      render(<BackupManager />);

      fireEvent.click(screen.getByText('Import'));

      await waitFor(() => {
        const fileInput = document.querySelector('input[type="file"]');
        expect(fileInput).toBeInTheDocument();
      });
    });

    describe('Defer AI processing toggle (Fortemi v2026.5.6 #677)', () => {
      beforeEach(() => {
        window.localStorage.removeItem('hotm.backup.deferInference');
      });

      it('shows the toggle when no file is selected (JSON path default)', async () => {
        render(<BackupManager />);
        fireEvent.click(screen.getByText('Import'));

        await waitFor(() => {
          expect(screen.getByLabelText(/Defer AI processing/)).toBeInTheDocument();
        });
      });

      it('passes deferInference=false to importBackup by default', async () => {
        vi.mocked(api.backup.importBackup).mockResolvedValueOnce(undefined);
        render(<BackupManager />);
        fireEvent.click(screen.getByText('Import'));

        await waitFor(() => {
          expect(screen.getByText('Import Knowledge Base')).toBeInTheDocument();
        });

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['{"backup": {"notes": []}}'], 'test.json', { type: 'application/json' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);

        // Confirm the import button is enabled, then click it.
        const importBtn = await screen.findByRole('button', { name: /^Import$/ });
        fireEvent.click(importBtn);

        await waitFor(() => {
          expect(api.backup.importBackup).toHaveBeenCalledWith(
            expect.any(File),
            { deferInference: false },
          );
        });
      });

      it('passes deferInference=true when the user enables the toggle', async () => {
        vi.mocked(api.backup.importBackup).mockResolvedValueOnce(undefined);
        render(<BackupManager />);
        fireEvent.click(screen.getByText('Import'));

        const toggle = await screen.findByLabelText(/Defer AI processing/);
        fireEvent.click(toggle);

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['{"backup": {"notes": []}}'], 'test.json', { type: 'application/json' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);

        const importBtn = await screen.findByRole('button', { name: /^Import$/ });
        fireEvent.click(importBtn);

        await waitFor(() => {
          expect(api.backup.importBackup).toHaveBeenCalledWith(
            expect.any(File),
            { deferInference: true },
          );
        });

        // Preference persisted to localStorage for next time
        expect(window.localStorage.getItem('hotm.backup.deferInference')).toBe('true');
      });

      it('restores toggle state from localStorage on next open', async () => {
        window.localStorage.setItem('hotm.backup.deferInference', 'true');
        render(<BackupManager />);
        fireEvent.click(screen.getByText('Import'));

        const toggle = (await screen.findByLabelText(/Defer AI processing/)) as HTMLInputElement;
        expect(toggle.checked).toBe(true);
      });

      it('surfaces an actionable "Run inference now" CTA after a deferred import', async () => {
        vi.mocked(api.backup.importBackup).mockResolvedValueOnce(undefined);
        render(<BackupManager />);
        fireEvent.click(screen.getByText('Import'));

        const toggle = await screen.findByLabelText(/Defer AI processing/);
        fireEvent.click(toggle);

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['{"backup": {"notes": []}}'], 'test.json', { type: 'application/json' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);

        const importBtn = await screen.findByRole('button', { name: /^Import$/ });
        fireEvent.click(importBtn);

        await waitFor(() => {
          expect(screen.getByText(/AI processing is deferred/)).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /Run inference now/ })).toBeInTheDocument();
        });
      });

      it('calls api.notes.reprocessAll when the toast CTA is clicked', async () => {
        vi.mocked(api.backup.importBackup).mockResolvedValueOnce(undefined);
        vi.mocked(api.notes.reprocessAll).mockResolvedValueOnce({ jobs_queued: 8 });

        render(<BackupManager />);
        fireEvent.click(screen.getByText('Import'));

        const toggle = await screen.findByLabelText(/Defer AI processing/);
        fireEvent.click(toggle);

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['{"backup": {"notes": []}}'], 'test.json', { type: 'application/json' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);

        const importBtn = await screen.findByRole('button', { name: /^Import$/ });
        fireEvent.click(importBtn);

        const reprocessBtn = await screen.findByRole('button', { name: /Run inference now/ });
        fireEvent.click(reprocessBtn);

        await waitFor(() => {
          expect(api.notes.reprocessAll).toHaveBeenCalled();
          expect(screen.getByText(/Reprocess queued \(8 jobs\)/)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Reprocess action (#211 Tools surface)', () => {
    it('renders a Reprocess button in Quick Actions', async () => {
      render(<BackupManager />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Reprocess$/ })).toBeInTheDocument();
      });
    });

    it('opens the Reprocess dialog when the button is clicked', async () => {
      render(<BackupManager />);
      fireEvent.click(await screen.findByRole('button', { name: /Reprocess$/ }));

      await waitFor(() => {
        expect(screen.getByText('Reprocess archive')).toBeInTheDocument();
        expect(screen.getByText(/pins Ollama for the duration/)).toBeInTheDocument();
      });
    });

    it('exposes an Advanced section with revision mode and limit', async () => {
      render(<BackupManager />);
      fireEvent.click(await screen.findByRole('button', { name: /Reprocess$/ }));
      fireEvent.click(await screen.findByText(/Advanced options/));

      await waitFor(() => {
        expect(screen.getByText(/Revision mode/)).toBeInTheDocument();
        expect(screen.getByText(/^Limit$/)).toBeInTheDocument();
      });
    });

    it('fires api.notes.reprocessAll with default options when confirmed', async () => {
      vi.mocked(api.notes.reprocessAll).mockResolvedValueOnce({ jobs_queued: 23 });
      render(<BackupManager />);
      fireEvent.click(await screen.findByRole('button', { name: /Reprocess$/ }));

      const confirmBtn = await screen.findByRole('button', { name: /Queue reprocess/ });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(api.notes.reprocessAll).toHaveBeenCalledWith({
          revisionMode: 'standard',
          limit: 500,
        });
        expect(screen.getByText(/Reprocess queued \(23 jobs\)/)).toBeInTheDocument();
      });
    });

    it('passes advanced options through when changed by the user', async () => {
      vi.mocked(api.notes.reprocessAll).mockResolvedValueOnce({ jobs_queued: 50 });
      render(<BackupManager />);
      fireEvent.click(await screen.findByRole('button', { name: /Reprocess$/ }));
      fireEvent.click(await screen.findByText(/Advanced options/));

      const revisionSelect = (await screen.findByDisplayValue(
        /standard/i,
      )) as HTMLSelectElement;
      fireEvent.change(revisionSelect, { target: { value: 'contextual' } });

      const limitInput = screen.getByDisplayValue('500') as HTMLInputElement;
      fireEvent.change(limitInput, { target: { value: '100' } });

      fireEvent.click(screen.getByRole('button', { name: /Queue reprocess/ }));

      await waitFor(() => {
        expect(api.notes.reprocessAll).toHaveBeenCalledWith({
          revisionMode: 'contextual',
          limit: 100,
        });
      });
    });

    it('surfaces an error toast when the reprocess call fails', async () => {
      vi.mocked(api.notes.reprocessAll).mockRejectedValueOnce(new Error('API down'));
      render(<BackupManager />);
      fireEvent.click(await screen.findByRole('button', { name: /Reprocess$/ }));
      fireEvent.click(await screen.findByRole('button', { name: /Queue reprocess/ }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to queue reprocess/)).toBeInTheDocument();
      });
    });
  });

  describe('Restore', () => {
    it('should show restore confirmation when restore clicked', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
      });

      // Find restore button (refresh icon)
      const restoreButtons = screen.getAllByTitle('Restore');
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Restore from Backup?')).toBeInTheDocument();
        expect(
          screen.getByText(/This will replace your current database/)
        ).toBeInTheDocument();
      });
    });

    it('should call restore API on confirm', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
      });

      const restoreButtons = screen.getAllByTitle('Restore');
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Find Restore button in dialog
      const confirmRestore = screen.getAllByText('Restore').find(
        (el) => el.closest('[role="alertdialog"]')
      );
      fireEvent.click(confirmRestore!);

      await waitFor(() => {
        expect(api.backup.restoreDatabase).toHaveBeenCalledWith({
          filename: 'backup-2024-01-15.db',
        });
      });
    });

    it('should cancel restore on Cancel click', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
      });

      const restoreButtons = screen.getAllByTitle('Restore');
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      expect(api.backup.restoreDatabase).not.toHaveBeenCalled();
    });
  });

  describe('Download', () => {
    it('should have download button for each backup', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        const downloadButtons = screen.getAllByTitle('Download');
        expect(downloadButtons.length).toBe(2);
      });
    });

    it('should trigger download when clicked', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
      });

      const downloadButtons = screen.getAllByTitle('Download');
      fireEvent.click(downloadButtons[0]);

      await waitFor(() => {
        expect(api.backup.downloadDatabaseBackup).toHaveBeenCalled();
      });
    });
  });

  describe('Collapsible Section', () => {
    it('should collapse backup list when header clicked', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
      });

      // Click the collapsible header
      fireEvent.click(screen.getByText('Database Backups'));

      await waitFor(() => {
        // Backups should be hidden
        expect(screen.queryByText('Backup Jan 15')).not.toBeInTheDocument();
      });
    });

    it('should expand backup list when header clicked again', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(screen.getByText('Database Backups'));

      await waitFor(() => {
        expect(screen.queryByText('Backup Jan 15')).not.toBeInTheDocument();
      });

      // Expand
      fireEvent.click(screen.getByText('Database Backups'));

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no backups', async () => {
      vi.mocked(api.backup.listBackups).mockResolvedValue([]);

      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('No backups yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first backup')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while loading', async () => {
      vi.mocked(api.backup.listBackups).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockBackups), 100))
      );

      render(<BackupManager />);

      // Loading should be shown initially
      await waitFor(() => {
        expect(screen.getByText('Backup & Export')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when load fails', async () => {
      vi.mocked(api.backup.listBackups).mockRejectedValue(new Error('Network error'));

      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load backups')).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      vi.mocked(api.backup.listBackups)
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(mockBackups);

      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load backups')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Backup Jan 15')).toBeInTheDocument();
      });
    });
  });

  describe('Status Messages', () => {
    it('should dismiss status message when Dismiss clicked', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Create Backup')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Backup'));

      await waitFor(() => {
        expect(screen.getByText('Backup created successfully')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(screen.queryByText('Backup created successfully')).not.toBeInTheDocument();
      });
    });
  });

  describe('Custom ClassName', () => {
    it('should apply custom className', async () => {
      const { container } = render(<BackupManager className="custom-class" />);

      await waitFor(() => {
        const manager = container.querySelector('.custom-class');
        expect(manager).toBeInTheDocument();
      });
    });
  });
});
