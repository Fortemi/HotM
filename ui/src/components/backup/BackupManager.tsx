/**
 * BackupManager Component
 * Comprehensive backup, export, and restore functionality
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Upload,
  Database,
  Archive,
  RefreshCw,
  FileJson,
  Package,
  Clock,
  HardDrive,
  AlertTriangle,
  Check,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/api';
import type { BackupInfo } from '@/api/types-extended';

interface BackupManagerProps {
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'json' | 'shard') => Promise<void>;
}

function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [format, setFormat] = useState<'json' | 'shard'>('shard');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(format);
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Knowledge Base</DialogTitle>
          <DialogDescription>
            Choose an export format for your notes and data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Export Format</label>

            <button
              type="button"
              onClick={() => setFormat('shard')}
              className={cn(
                'w-full p-4 border rounded-lg text-left transition-colors',
                format === 'shard' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              )}
            >
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Knowledge Shard</p>
                  <p className="text-sm text-muted-foreground">
                    Portable format with notes, tags, and links. Best for migration or backup.
                  </p>
                </div>
                {format === 'shard' && <Check className="w-5 h-5 text-primary ml-auto" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('json')}
              className={cn(
                'w-full p-4 border rounded-lg text-left transition-colors',
                format === 'json' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              )}
            >
              <div className="flex items-start gap-3">
                <FileJson className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium">JSON Export</p>
                  <p className="text-sm text-muted-foreground">
                    Simple JSON format for notes only. Good for data portability.
                  </p>
                </div>
                {format === 'json' && <Check className="w-5 h-5 text-primary ml-auto" />}
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, options: { deferInference: boolean }) => Promise<void>;
}

const DEFER_INFERENCE_STORAGE_KEY = 'hotm.backup.deferInference';

function readDeferInferencePreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEFER_INFERENCE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeDeferInferencePreference(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEFER_INFERENCE_STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // localStorage unavailable (private browsing, quota); preference becomes ephemeral
  }
}

function ImportDialog({ isOpen, onClose, onImport }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deferInference, setDeferInference] = useState<boolean>(readDeferInferencePreference);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.json') || droppedFile.name.endsWith('.shard'))) {
      setFile(droppedFile);
    }
  };

  // .shard imports don't currently expose defer_inference — the toggle is JSON-only.
  const isShard = file?.name.endsWith('.shard') ?? false;

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    try {
      writeDeferInferencePreference(deferInference);
      await onImport(file, { deferInference: !isShard && deferInference });
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Knowledge Base</DialogTitle>
          <DialogDescription>
            Import notes from a JSON or Knowledge Shard file.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
              file && 'border-green-500 bg-green-50 dark:bg-green-900/10'
            )}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-2">
                <Check className="w-8 h-8 mx-auto text-green-500" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Choose different file
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop a .json or .shard file here, or{' '}
                  <label className="text-primary cursor-pointer hover:underline">
                    browse
                    <input
                      type="file"
                      accept=".json,.shard"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                    />
                  </label>
                </p>
              </div>
            )}
          </div>

          {/* defer_inference toggle — JSON-only path, hidden for .shard which has its own
              skip_embedding_regen flag wired separately. Fortemi v2026.5.6 (#677). */}
          {!isShard && (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-muted bg-muted/30 p-3">
              <input
                id="defer-inference-toggle"
                type="checkbox"
                className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                checked={deferInference}
                onChange={(e) => setDeferInference(e.target.checked)}
                disabled={isImporting}
              />
              <label
                htmlFor="defer-inference-toggle"
                className="flex-1 cursor-pointer select-none text-sm"
              >
                <span className="font-medium">Defer AI processing</span>
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  faster import
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Skip embeddings, metadata, link detection, and AI titles at import time.
                  Full-text search works immediately; semantic search needs a follow-up
                  reprocess. Recommended for large archives on edge hardware.
                </p>
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReprocessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: {
    revisionMode: 'none' | 'light' | 'standard' | 'contextual' | 'full';
    limit: number;
  }) => Promise<void>;
}

function ReprocessDialog({ isOpen, onClose, onConfirm }: ReprocessDialogProps) {
  const [revisionMode, setRevisionMode] =
    useState<'none' | 'light' | 'standard' | 'contextual' | 'full'>('standard');
  const [limit, setLimit] = useState<number>(500);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);

  const handleConfirm = async () => {
    setIsQueueing(true);
    try {
      await onConfirm({ revisionMode, limit });
      onClose();
    } finally {
      setIsQueueing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprocess archive</DialogTitle>
          <DialogDescription>
            Re-run the NLP pipeline (embeddings, metadata, AI revision, link
            detection, title generation) for notes in the active archive. Useful
            after a deferred import or after switching models.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="rounded-md border border-amber-300/40 bg-amber-50 p-3 text-sm dark:border-amber-700/30 dark:bg-amber-900/20">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              This pins Ollama for the duration of the run.
            </p>
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/70">
              Expect ~30–120 seconds per note for full revision mode; less for
              lighter modes. Jobs run in the background — the UI stays usable.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? '▾' : '▸'} Advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-md border border-muted bg-muted/20 p-3">
              <label className="block text-sm">
                <span className="font-medium">Revision mode</span>
                <select
                  value={revisionMode}
                  onChange={(e) =>
                    setRevisionMode(e.target.value as typeof revisionMode)
                  }
                  className="mt-1 block w-full rounded border border-input bg-background px-2 py-1 text-sm"
                  disabled={isQueueing}
                >
                  <option value="none">none — skip AI revision entirely</option>
                  <option value="light">light — formatting only</option>
                  <option value="standard">standard — default balance</option>
                  <option value="contextual">contextual — link-aware</option>
                  <option value="full">full — deep enhancement</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium">Limit</span>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 500)}
                  className="mt-1 block w-full rounded border border-input bg-background px-2 py-1 text-sm"
                  disabled={isQueueing}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Backend cap: 5000. Default 500 covers most archives.
                </span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isQueueing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isQueueing}>
            {isQueueing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Queueing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Queue reprocess
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BackupCardProps {
  backup: BackupInfo;
  onRestore: (backup: BackupInfo) => void;
  onDownload: (backup: BackupInfo) => void;
}

function BackupCard({ backup, onRestore, onDownload }: BackupCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className="p-2 bg-muted rounded-lg">
        <Database className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{backup.label || backup.filename}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(backup.created_at)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {formatBytes(backup.size_bytes)}
          </span>
          <Badge variant="outline" className="text-xs">
            {backup.type}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onDownload(backup)} title="Download">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRestore(backup)} title="Restore">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function BackupManager({ className }: BackupManagerProps) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupsExpanded, setBackupsExpanded] = useState(true);

  // Dialog states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [reprocessDialogOpen, setReprocessDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);

  // Operation states
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [operationStatus, setOperationStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    action?: {
      label: string;
      onClick: () => void | Promise<void>;
      pending?: boolean;
    };
  } | null>(null);

  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.backup.listBackups();
      setBackups(data);
    } catch (err) {
      setError('Failed to load backups');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setOperationStatus(null);
    try {
      await api.backup.triggerBackup();
      await loadBackups();
      setOperationStatus({ type: 'success', message: 'Backup created successfully' });
    } catch (err) {
      setOperationStatus({ type: 'error', message: 'Failed to create backup' });
      console.error(err);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleExport = async (format: 'json' | 'shard') => {
    try {
      let blob: Blob;
      let filename: string;

      if (format === 'shard') {
        blob = await api.backup.exportKnowledgeShard({ format: 'json' });
        filename = `knowledge-export-${new Date().toISOString().split('T')[0]}.shard`;
      } else {
        blob = await api.backup.downloadBackup();
        filename = `notes-export-${new Date().toISOString().split('T')[0]}.json`;
      }

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setOperationStatus({ type: 'success', message: `Exported to ${filename}` });
    } catch (err) {
      setOperationStatus({ type: 'error', message: 'Export failed' });
      console.error(err);
    }
  };

  const handleReprocessFromDialog = useCallback(
    async (options: {
      revisionMode: 'none' | 'light' | 'standard' | 'contextual' | 'full';
      limit: number;
    }) => {
      try {
        const result = await api.notes.reprocessAll({
          revisionMode: options.revisionMode,
          limit: options.limit,
        });
        const queued = result?.jobs_queued;
        setOperationStatus({
          type: 'success',
          message:
            typeof queued === 'number'
              ? `Reprocess queued (${queued} jobs). Track progress in the job inspector.`
              : 'Reprocess queued. Track progress in the job inspector.',
        });
      } catch (err) {
        console.error(err);
        setOperationStatus({
          type: 'error',
          message: 'Failed to queue reprocess. Check the API logs and retry.',
        });
      }
    },
    [],
  );

  const handleReprocessNow = useCallback(async () => {
    // Show pending state on the action button while the request is in flight.
    setOperationStatus((prev) =>
      prev?.action
        ? { ...prev, action: { ...prev.action, pending: true } }
        : prev,
    );
    try {
      const result = await api.notes.reprocessAll();
      const queued = result?.jobs_queued;
      setOperationStatus({
        type: 'success',
        message:
          typeof queued === 'number'
            ? `Reprocess queued (${queued} jobs). Track progress in the job inspector.`
            : 'Reprocess queued. Track progress in the job inspector.',
      });
    } catch (err) {
      console.error(err);
      setOperationStatus({
        type: 'error',
        message: 'Failed to queue reprocess. Check the API logs and retry.',
      });
    }
  }, []);

  const handleImport = async (file: File, options: { deferInference: boolean }) => {
    try {
      if (file.name.endsWith('.shard')) {
        await api.backup.importKnowledgeShard(file);
        setOperationStatus({ type: 'success', message: 'Import completed successfully' });
      } else {
        await api.backup.importBackup(file, { deferInference: options.deferInference });
        if (options.deferInference) {
          setOperationStatus({
            type: 'success',
            message:
              'Import complete. AI processing is deferred — semantic search is not populated yet. Use the Reprocess action below, or click Run inference now to queue it immediately.',
            action: {
              label: 'Run inference now',
              onClick: handleReprocessNow,
            },
          });
        } else {
          setOperationStatus({ type: 'success', message: 'Import completed successfully' });
        }
      }
    } catch (err) {
      setOperationStatus({ type: 'error', message: 'Import failed' });
      console.error(err);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    try {
      await api.backup.restoreDatabase({ filename: selectedBackup.filename });
      setOperationStatus({ type: 'success', message: 'Restore completed. Please refresh the page.' });
      setRestoreDialogOpen(false);
    } catch (err) {
      setOperationStatus({ type: 'error', message: 'Restore failed' });
      console.error(err);
    }
  };

  const handleDownload = async (backup: BackupInfo) => {
    try {
      let blob: Blob;
      if (backup.type === 'knowledge-shard' || backup.type === 'archive') {
        blob = await api.backup.downloadKnowledgeArchive(backup.filename);
      } else {
        blob = await api.backup.downloadDatabaseBackup();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setOperationStatus({ type: 'error', message: 'Download failed' });
      console.error(err);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Backup & Export
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your knowledge base backups and exports
          </p>
        </div>
      </div>

      {/* Status Message */}
      {operationStatus && (
        <div
          className={cn(
            'flex items-center gap-2 p-3 rounded-lg',
            operationStatus.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          )}
          role="status"
        >
          {operationStatus.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span className="text-sm">{operationStatus.message}</span>
          {operationStatus.action && (
            <Button
              variant="outline"
              size="sm"
              className="ml-2 h-7 px-2 text-xs"
              onClick={() => operationStatus.action?.onClick()}
              disabled={operationStatus.action.pending}
            >
              {operationStatus.action.pending ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  {operationStatus.action.label}
                </>
              ) : (
                operationStatus.action.label
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            onClick={() => setOperationStatus(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="h-auto py-4 flex-col gap-2"
          onClick={() => setExportDialogOpen(true)}
        >
          <Download className="w-5 h-5" />
          <span>Export</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex-col gap-2"
          onClick={() => setImportDialogOpen(true)}
        >
          <Upload className="w-5 h-5" />
          <span>Import</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex-col gap-2"
          onClick={handleCreateBackup}
          disabled={isCreatingBackup}
        >
          {isCreatingBackup ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Database className="w-5 h-5" />
          )}
          <span>Create Backup</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex-col gap-2"
          onClick={() => setReprocessDialogOpen(true)}
        >
          <RefreshCw className="w-5 h-5" />
          <span>Reprocess</span>
        </Button>
      </div>

      {/* Backups List - Simple Expandable Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => setBackupsExpanded(!backupsExpanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="w-4 h-4" />
            Database Backups
            <Badge variant="secondary">{backups.length}</Badge>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform',
              backupsExpanded && 'rotate-180'
            )}
          />
        </button>

        {backupsExpanded && (
          <div className="p-4 pt-0 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={loadBackups} className="mt-2">
                  Retry
                </Button>
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No backups yet</p>
                <Button variant="outline" size="sm" onClick={handleCreateBackup} className="mt-2">
                  Create your first backup
                </Button>
              </div>
            ) : (
              backups.map((backup) => (
                <BackupCard
                  key={backup.filename}
                  backup={backup}
                  onRestore={(b) => {
                    setSelectedBackup(b);
                    setRestoreDialogOpen(true);
                  }}
                  onDownload={handleDownload}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
      />

      <ImportDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImport}
      />

      <ReprocessDialog
        isOpen={reprocessDialogOpen}
        onClose={() => setReprocessDialogOpen(false)}
        onConfirm={handleReprocessFromDialog}
      />

      {/* Restore Confirmation */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current database with the backup from{' '}
              {selectedBackup && formatDate(selectedBackup.created_at)}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
