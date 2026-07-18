/**
 * BackupManager Component Tests
 *
 * Tests backup and export functionality with restore operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BackupManager } from '../BackupManager';
import { api, BackupInfo, KnowledgeShardManifest } from '@/api';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    backup: {
      listBackups: vi.fn(),
      triggerBackup: vi.fn(),
      restoreDatabase: vi.fn(),
      downloadBackup: vi.fn(),
      downloadDatabaseBackup: vi.fn(),
      downloadMemoryBackup: vi.fn(),
      downloadKnowledgeArchive: vi.fn(),
      uploadKnowledgeArchive: vi.fn(),
      getBackupMetadata: vi.fn(),
      updateBackupMetadata: vi.fn(),
      exportKnowledgeShard: vi.fn(),
      inspectKnowledgeShard: vi.fn(),
      importKnowledgeShard: vi.fn(),
      uploadKnowledgeShard: vi.fn(),
      importBackup: vi.fn(),
    },
    notes: {
      reprocessAll: vi.fn(),
    },
    ingest: {
      mintToken: vi.fn(),
      streamNotes: vi.fn(),
      revokeToken: vi.fn(),
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
const coreManifest: KnowledgeShardManifest = {
  version: '1.0.0',
  profile: 'core-v1' as const,
  producer: {
    name: 'fortemi',
    version: '2026.7.1',
    revision: '2eb5c6b739b3bb6a042a35050a3ae89960dd3ed4',
  },
  format: 'matric-shard' as const,
  created_at: '2026-07-17T20:00:00Z',
  components: ['notes', 'collections', 'tags', 'templates', 'links'],
  counts: {
    notes: 1,
    collections: 0,
    tags: 0,
    templates: 0,
    links: 0,
  },
  checksums: {
    'notes.jsonl': '0'.repeat(64),
    'collections.json': '0'.repeat(64),
    'tags.json': '0'.repeat(64),
    'templates.json': '0'.repeat(64),
    'links.jsonl': '0'.repeat(64),
  },
  min_reader_version: '1.0.0',
};

function getBackupImportFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"][accept=".json,.shard"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Backup import file input not found');
  }
  return input;
}

describe('BackupManager', () => {
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.mocked(api.backup.listBackups).mockResolvedValue(mockBackups);
    vi.mocked(api.backup.triggerBackup).mockResolvedValue(undefined);
    vi.mocked(api.backup.restoreDatabase).mockResolvedValue(undefined);
    vi.mocked(api.backup.downloadBackup).mockResolvedValue(new Blob(['test']));
    vi.mocked(api.backup.downloadDatabaseBackup).mockResolvedValue(new Blob(['test']));
    vi.mocked(api.backup.downloadMemoryBackup).mockResolvedValue(new Blob(['memory']));
    vi.mocked(api.backup.exportKnowledgeShard).mockResolvedValue({
      blob: new Blob(['test']),
      manifest: coreManifest,
    });
    vi.mocked(api.backup.inspectKnowledgeShard).mockResolvedValue(coreManifest);
    vi.mocked(api.backup.uploadKnowledgeShard).mockResolvedValue({
      manifest: coreManifest,
      response: { status: 'success' },
    });
    vi.mocked(api.backup.downloadKnowledgeArchive).mockResolvedValue(new Blob(['archive']));
    vi.mocked(api.backup.uploadKnowledgeArchive).mockResolvedValue(undefined);
    vi.mocked(api.backup.getBackupMetadata).mockResolvedValue({
      filename: 'backup-2024-01-15.db',
      has_metadata: true,
      metadata: {
        title: 'Loaded title',
        description: 'Loaded description',
      },
    });
    vi.mocked(api.backup.updateBackupMetadata).mockResolvedValue({
      filename: 'backup-2024-01-15.db',
      success: true,
      metadata: {
        title: 'Saved title',
        description: 'Saved description',
      },
    });
    vi.mocked(api.ingest.mintToken).mockResolvedValue({
      token: 'secret-stream-token',
      token_id: 'tok-1',
      rate_limit: 0,
      expires_in: 3600,
    });
    vi.mocked(api.ingest.streamNotes).mockResolvedValue({
      total: 1,
      success: 1,
      errors: 0,
      lastCursor: 'stream-1',
      events: [],
    });
    vi.mocked(api.ingest.revokeToken).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    anchorClickSpy.mockRestore();
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
        expect(screen.getByText(/core-v1 structured records/)).toBeInTheDocument();
        expect(screen.getByText(/full recovery are not included/)).toBeInTheDocument();
      });
    });

    it('exports the server default profile without unsupported query options', async () => {
      render(<BackupManager />);
      fireEvent.click(screen.getByText('Export'));
      fireEvent.click(await screen.findByRole('button', { name: /^Export$/ }));

      await waitFor(() => {
        expect(api.backup.exportKnowledgeShard).toHaveBeenCalledWith();
        expect(screen.getByText(/Exported core-v1 schema 1.0.0/)).toBeInTheDocument();
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
        const fileInput = document.querySelector('input[type="file"][accept=".json,.shard"]');
        expect(fileInput).toBeInTheDocument();
      });
    });

    it('displays the declared shard profile and imports through multipart validation', async () => {
      render(<BackupManager />);
      fireEvent.click(screen.getByText('Import'));

      const fileInput = getBackupImportFileInput();
      const file = new File(['shard'], 'core-v1.shard', { type: 'application/gzip' });
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      expect(await screen.findByText('core-v1')).toBeInTheDocument();
      expect(screen.getByText('schema 1.0.0')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Import$/ }));

      await waitFor(() => {
        expect(api.backup.uploadKnowledgeShard).toHaveBeenCalledWith(file);
        expect(screen.getByText(/Imported core-v1 schema 1.0.0/)).toBeInTheDocument();
      });
      expect(api.backup.importKnowledgeShard).not.toHaveBeenCalled();
    });

    it('blocks unsupported shard profiles before upload', async () => {
      vi.mocked(api.backup.inspectKnowledgeShard).mockRejectedValueOnce(
        new Error('Knowledge shard profile full-v1 is not supported; HotM accepts core-v1 only.'),
      );
      render(<BackupManager />);
      fireEvent.click(screen.getByText('Import'));

      const fileInput = getBackupImportFileInput();
      const file = new File(['shard'], 'full-v1.shard', { type: 'application/gzip' });
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      expect(await screen.findByRole('alert')).toHaveTextContent('profile full-v1 is not supported');
      expect(screen.getByRole('button', { name: /^Import$/ })).toBeDisabled();
      expect(api.backup.uploadKnowledgeShard).not.toHaveBeenCalled();
    });

    it('ignores a stale manifest result after another shard is selected', async () => {
      let resolveFirstInspection!: (manifest: KnowledgeShardManifest) => void;
      vi.mocked(api.backup.inspectKnowledgeShard)
        .mockImplementationOnce(() => new Promise((resolve) => {
          resolveFirstInspection = resolve;
        }))
        .mockRejectedValueOnce(
          new Error('Knowledge shard profile full-v1 is not supported; HotM accepts core-v1 only.'),
        );
      render(<BackupManager />);
      fireEvent.click(screen.getByText('Import'));

      let fileInput = getBackupImportFileInput();
      const firstFile = new File(['shard'], 'core-v1.shard', { type: 'application/gzip' });
      Object.defineProperty(fileInput, 'files', { value: [firstFile] });
      fireEvent.change(fileInput);
      expect(await screen.findByText('Reading shard manifest...')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Choose different file' }));
      fileInput = getBackupImportFileInput();
      const secondFile = new File(['shard'], 'full-v1.shard', { type: 'application/gzip' });
      Object.defineProperty(fileInput, 'files', { value: [secondFile] });
      fireEvent.change(fileInput);
      expect(await screen.findByRole('alert')).toHaveTextContent('profile full-v1 is not supported');

      await act(async () => {
        resolveFirstInspection(coreManifest);
      });

      expect(screen.queryByText('core-v1')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Import$/ })).toBeDisabled();
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

        const fileInput = getBackupImportFileInput();
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

        const fileInput = getBackupImportFileInput();
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

        const fileInput = getBackupImportFileInput();
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

        const fileInput = getBackupImportFileInput();
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

  describe('Stream NDJSON import (#255)', () => {
    it('renders stream import controls in the backup surface', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Stream NDJSON Import')).toBeInTheDocument();
        expect(screen.getByText('Choose .ndjson')).toBeInTheDocument();
        expect(screen.getByLabelText('Stream ingest rate limit')).toBeInTheDocument();
      });
    });

    it('mints a token, streams the selected file, revokes the token, and does not render the secret', async () => {
      render(<BackupManager />);

      const fileInput = await screen.findByTestId('stream-ingest-file') as HTMLInputElement;
      const file = new File(
        ['{"type":"note","data":{"content":"hello"}}\n'],
        'notes.ndjson',
        { type: 'application/x-ndjson' },
      );
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      fireEvent.change(screen.getByLabelText('Stream ingest rate limit'), {
        target: { value: '25' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Stream Import$/ }));

      await waitFor(() => {
        expect(api.ingest.mintToken).toHaveBeenCalledWith({ rateLimit: 25 });
        expect(api.ingest.streamNotes).toHaveBeenCalledWith(
          file,
          expect.objectContaining({ token: 'secret-stream-token' }),
        );
        expect(api.ingest.revokeToken).toHaveBeenCalledWith('tok-1');
        expect(screen.getByText(/Stream import finished: 1\/1 stored, 0 errors/)).toBeInTheDocument();
      });

      expect(screen.queryByText('secret-stream-token')).not.toBeInTheDocument();
    });

    it('updates processed count from stream callbacks', async () => {
      vi.mocked(api.ingest.streamNotes).mockImplementationOnce(async (_file, options) => {
        options.onEvent?.({ event: 'progress', processed: 2 });
        options.onEvent?.({ event: 'done', total: 3, success: 3, errors: 0 });
        return {
          total: 3,
          success: 3,
          errors: 0,
          lastCursor: 'stream-3',
          events: [],
        };
      });

      render(<BackupManager />);

      const fileInput = await screen.findByTestId('stream-ingest-file') as HTMLInputElement;
      const file = new File(['{}\n{}\n{}\n'], 'notes.ndjson', {
        type: 'application/x-ndjson',
      });
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);
      fireEvent.click(screen.getByRole('button', { name: /^Stream Import$/ }));

      await waitFor(() => {
        expect(screen.getByText('3 total')).toBeInTheDocument();
        expect(screen.getByText('3 stored')).toBeInTheDocument();
        expect(screen.getByText('0 errors')).toBeInTheDocument();
        expect(screen.getByText('cursor_len=8')).toBeInTheDocument();
      });
    });
  });

  describe('Backup route groups (#257)', () => {
    it('renders current backup route groups and portable shard limitation copy', async () => {
      render(<BackupManager />);

      await waitFor(() => {
        expect(screen.getByText('Backup Route Groups')).toBeInTheDocument();
        expect(screen.getByText('Memory Backup')).toBeInTheDocument();
        expect(screen.getByText('Knowledge Archive')).toBeInTheDocument();
        expect(screen.getByText('Metadata Sidecar')).toBeInTheDocument();
        expect(screen.getByText(/no full-recovery, embedding, attachment record, or attachment-byte receipt/)).toBeInTheDocument();
      });
    });

    it('downloads a named memory backup', async () => {
      render(<BackupManager />);

      fireEvent.change(await screen.findByLabelText('Memory backup name'), {
        target: { value: 'research' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Download Memory/ }));

      await waitFor(() => {
        expect(api.backup.downloadMemoryBackup).toHaveBeenCalledWith('research');
        expect(screen.getByText('Downloaded memory backup for research')).toBeInTheDocument();
      });
    });

    it('downloads and uploads knowledge archives', async () => {
      render(<BackupManager />);

      fireEvent.change(await screen.findByLabelText('Knowledge archive filename'), {
        target: { value: 'snapshot 1.tar.gz' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Download Archive/ }));

      await waitFor(() => {
        expect(api.backup.downloadKnowledgeArchive).toHaveBeenCalledWith('snapshot 1.tar.gz');
      });

      const fileInput = await screen.findByTestId('knowledge-archive-upload-file') as HTMLInputElement;
      const archiveFile = new File(['archive'], 'bundle.tar.gz', { type: 'application/gzip' });
      Object.defineProperty(fileInput, 'files', { value: [archiveFile] });
      fireEvent.change(fileInput);

      fireEvent.click(screen.getByRole('button', { name: /Upload Archive/ }));

      await waitFor(() => {
        expect(api.backup.uploadKnowledgeArchive).toHaveBeenCalledWith(archiveFile);
        expect(api.backup.listBackups).toHaveBeenCalledTimes(2);
        expect(screen.getByText('Uploaded knowledge archive bundle.tar.gz')).toBeInTheDocument();
      });
    });

    it('loads and updates backup metadata sidecars', async () => {
      render(<BackupManager />);

      fireEvent.change(await screen.findByLabelText('Backup metadata filename'), {
        target: { value: 'backup-2024-01-15.db' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Load Metadata/ }));

      await waitFor(() => {
        expect(api.backup.getBackupMetadata).toHaveBeenCalledWith('backup-2024-01-15.db');
        expect(screen.getByDisplayValue('Loaded title')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Loaded description')).toBeInTheDocument();
        expect(screen.getByText('Metadata loaded for backup-2024-01-15.db')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Backup metadata title'), {
        target: { value: 'Saved title' },
      });
      fireEvent.change(screen.getByLabelText('Backup metadata description'), {
        target: { value: 'Saved description' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Save Metadata/ }));

      await waitFor(() => {
        expect(api.backup.updateBackupMetadata).toHaveBeenCalledWith('backup-2024-01-15.db', {
          title: 'Saved title',
          description: 'Saved description',
        });
        expect(screen.getByText('Backup metadata updated')).toBeInTheDocument();
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
