/**
 * BackupManager Component
 * Comprehensive backup, export, and restore functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { BackupInfo, KnowledgeShardManifest } from '@/api/types-extended';
import type { IngestStreamEvent, StreamIngestSummary } from '@/api';

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
                    core-v1 structured records. Attachments, embeddings, and full recovery are
                    not included in this profile.
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
                    Legacy notes-only JSON export.
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
  const [isInspecting, setIsInspecting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [shardManifest, setShardManifest] = useState<KnowledgeShardManifest | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [deferInference, setDeferInference] = useState<boolean>(readDeferInferencePreference);
  const inspectionId = useRef(0);

  const selectFile = async (selected: File) => {
    const selectedInspectionId = ++inspectionId.current;
    setFile(selected);
    setShardManifest(null);
    setFileError(null);
    if (!selected.name.endsWith('.shard')) {
      setIsInspecting(false);
      return;
    }

    setIsInspecting(true);
    try {
      const manifest = await api.backup.inspectKnowledgeShard(selected);
      if (selectedInspectionId === inspectionId.current) {
        setShardManifest(manifest);
      }
    } catch (error) {
      if (selectedInspectionId === inspectionId.current) {
        setFileError(error instanceof Error ? error.message : 'Knowledge shard validation failed.');
      }
    } finally {
      if (selectedInspectionId === inspectionId.current) {
        setIsInspecting(false);
      }
    }
  };

  const clearFile = () => {
    inspectionId.current += 1;
    setFile(null);
    setShardManifest(null);
    setFileError(null);
    setIsInspecting(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.json') || droppedFile.name.endsWith('.shard'))) {
      void selectFile(droppedFile);
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
                {isInspecting && (
                  <p className="text-xs text-muted-foreground">Reading shard manifest...</p>
                )}
                {shardManifest && (
                  <div className="flex justify-center gap-2 text-xs">
                    <Badge variant="outline">{shardManifest.profile}</Badge>
                    <Badge variant="outline">schema {shardManifest.version}</Badge>
                  </div>
                )}
                {fileError && (
                  <p className="text-sm text-red-700 dark:text-red-300" role="alert">
                    {fileError}
                  </p>
                )}
                <Button variant="ghost" size="sm" onClick={clearFile}>
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
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        if (selected) void selectFile(selected);
                      }}
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
          <Button
            onClick={handleImport}
            disabled={!file || isImporting || isInspecting || (isShard && !shardManifest)}
          >
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
          {backup.manifest && (
            <Badge variant="outline" className="text-xs">
              {backup.manifest.profile} / {backup.manifest.version}
            </Badge>
          )}
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
  const [streamFile, setStreamFile] = useState<File | null>(null);
  const [streamRateLimit, setStreamRateLimit] = useState<number>(0);
  const [isStreamingIngest, setIsStreamingIngest] = useState(false);
  const [streamSummary, setStreamSummary] = useState<StreamIngestSummary | null>(null);
  const [streamProcessed, setStreamProcessed] = useState(0);
  const [memoryBackupName, setMemoryBackupName] = useState('');
  const [archiveFilename, setArchiveFilename] = useState('');
  const [archiveUploadFile, setArchiveUploadFile] = useState<File | null>(null);
  const [metadataFilename, setMetadataFilename] = useState('');
  const [metadataTitle, setMetadataTitle] = useState('');
  const [metadataDescription, setMetadataDescription] = useState('');
  const [metadataPreview, setMetadataPreview] = useState<string | null>(null);
  const [backupOperation, setBackupOperation] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    action?: {
      label: string;
      onClick: () => void | Promise<void>;
      pending?: boolean;
    };
  } | null>(null);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

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
        const exported = await api.backup.exportKnowledgeShard();
        blob = exported.blob;
        filename = `knowledge-export-${new Date().toISOString().split('T')[0]}.shard`;
        setOperationStatus({
          type: 'success',
          message: `Exported ${exported.manifest.profile} schema ${exported.manifest.version} to ${filename}`,
        });
      } else {
        blob = await api.backup.downloadBackup();
        filename = `notes-export-${new Date().toISOString().split('T')[0]}.json`;
        setOperationStatus({ type: 'success', message: `Exported to ${filename}` });
      }

      downloadBlob(blob, filename);
    } catch (err) {
      setOperationStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Export failed',
      });
      console.error(err);
    }
  };

  const handleStreamEvent = useCallback((event: IngestStreamEvent) => {
    if (event.event === 'ack') {
      setStreamProcessed((value) => Math.max(value, event.line));
    }
    if (event.event === 'progress') {
      setStreamProcessed(event.processed);
    }
    if (event.event === 'done') {
      setStreamProcessed(event.total);
    }
  }, []);

  const handleStreamImport = async () => {
    if (!streamFile) {
      setOperationStatus({ type: 'error', message: 'Choose an NDJSON file to stream' });
      return;
    }

    let tokenId: string | undefined;
    setIsStreamingIngest(true);
    setStreamSummary(null);
    setStreamProcessed(0);
    setOperationStatus(null);
    try {
      const minted = await api.ingest.mintToken({
        rateLimit: streamRateLimit > 0 ? streamRateLimit : undefined,
      });
      tokenId = minted.token_id;
      const summary = await api.ingest.streamNotes(streamFile, {
        token: minted.token,
        onEvent: handleStreamEvent,
      });
      setStreamSummary(summary);
      setOperationStatus({
        type: summary.errors > 0 ? 'error' : 'success',
        message: `Stream import finished: ${summary.success}/${summary.total} stored, ${summary.errors} errors`,
      });
    } catch (err) {
      setOperationStatus({ type: 'error', message: 'Stream import failed' });
      console.error(err);
    } finally {
      if (tokenId) {
        try {
          await api.ingest.revokeToken(tokenId);
        } catch (err) {
          console.error(err);
        }
      }
      setIsStreamingIngest(false);
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
        const result = await api.backup.uploadKnowledgeShard(file, {
          skipEmbeddingRegen: true,
        });
        setOperationStatus({
          type: 'success',
          message: `Imported ${result.manifest.profile} schema ${result.manifest.version}; server validation passed.`,
        });
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
      setOperationStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Import failed',
      });
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
      downloadBlob(blob, backup.filename);
    } catch (err) {
      setOperationStatus({ type: 'error', message: 'Download failed' });
      console.error(err);
    }
  };

  const runBackupOperation = async (name: string, operation: () => Promise<void>) => {
    setBackupOperation(name);
    setOperationStatus(null);
    try {
      await operation();
    } catch (err) {
      setOperationStatus({ type: 'error', message: 'Backup operation failed' });
      console.error(err);
    } finally {
      setBackupOperation(null);
    }
  };

  const handleMemoryDownload = async () => {
    const memoryName = memoryBackupName.trim();
    if (!memoryName) {
      setOperationStatus({ type: 'error', message: 'Enter a memory archive name' });
      return;
    }
    await runBackupOperation('memory-download', async () => {
      const blob = await api.backup.downloadMemoryBackup(memoryName);
      downloadBlob(blob, `${memoryName}.backup`);
      setOperationStatus({ type: 'success', message: `Downloaded memory backup for ${memoryName}` });
    });
  };

  const handleArchiveDownload = async () => {
    const filename = archiveFilename.trim();
    if (!filename) {
      setOperationStatus({ type: 'error', message: 'Enter a knowledge archive filename' });
      return;
    }
    await runBackupOperation('archive-download', async () => {
      const blob = await api.backup.downloadKnowledgeArchive(filename);
      downloadBlob(blob, filename);
      setOperationStatus({ type: 'success', message: `Downloaded knowledge archive ${filename}` });
    });
  };

  const handleArchiveUpload = async () => {
    if (!archiveUploadFile) {
      setOperationStatus({ type: 'error', message: 'Choose a knowledge archive file' });
      return;
    }
    await runBackupOperation('archive-upload', async () => {
      await api.backup.uploadKnowledgeArchive(archiveUploadFile);
      await loadBackups();
      setOperationStatus({ type: 'success', message: `Uploaded knowledge archive ${archiveUploadFile.name}` });
    });
  };

  const handleMetadataLoad = async () => {
    const filename = metadataFilename.trim();
    if (!filename) {
      setOperationStatus({ type: 'error', message: 'Enter a backup filename for metadata' });
      return;
    }
    await runBackupOperation('metadata-load', async () => {
      const response = await api.backup.getBackupMetadata(filename);
      const metadata = response.metadata;
      setMetadataTitle(metadata?.title ?? metadata?.label ?? '');
      setMetadataDescription(metadata?.description ?? '');
      setMetadataPreview(
        response.has_metadata
          ? `Metadata loaded for ${response.filename}`
          : `No metadata sidecar found for ${response.filename}`,
      );
      setOperationStatus({ type: 'success', message: 'Backup metadata loaded' });
    });
  };

  const handleMetadataSave = async () => {
    const filename = metadataFilename.trim();
    if (!filename) {
      setOperationStatus({ type: 'error', message: 'Enter a backup filename for metadata' });
      return;
    }
    await runBackupOperation('metadata-save', async () => {
      const response = await api.backup.updateBackupMetadata(filename, {
        title: metadataTitle.trim() || undefined,
        description: metadataDescription.trim() || undefined,
      });
      setMetadataPreview(`Metadata saved for ${response.filename}`);
      setOperationStatus({ type: 'success', message: 'Backup metadata updated' });
    });
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

      <div className="rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="w-4 h-4" />
              Stream NDJSON Import
              {isStreamingIngest && (
                <Badge variant="outline" className="text-xs">
                  {streamProcessed} processed
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                <FileJson className="w-4 h-4" />
                {streamFile ? streamFile.name : 'Choose .ndjson'}
                <input
                  data-testid="stream-ingest-file"
                  type="file"
                  accept=".ndjson,application/x-ndjson"
                  className="hidden"
                  onChange={(e) => setStreamFile(e.target.files?.[0] ?? null)}
                  disabled={isStreamingIngest}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">rate</span>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={streamRateLimit}
                  onChange={(e) => setStreamRateLimit(Number(e.target.value) || 0)}
                  className="h-9 w-24 rounded border border-input bg-background px-2 text-sm"
                  disabled={isStreamingIngest}
                  aria-label="Stream ingest rate limit"
                />
              </label>
            </div>
            {streamSummary && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{streamSummary.total} total</span>
                <span>{streamSummary.success} stored</span>
                <span>{streamSummary.errors} errors</span>
                {streamSummary.lastCursor && <span>cursor_len={streamSummary.lastCursor.length}</span>}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleStreamImport}
            disabled={!streamFile || isStreamingIngest}
          >
            {isStreamingIngest ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Streaming...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Stream Import
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="w-4 h-4" />
              Backup Route Groups
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Current Fortemi archive operations by route family. core-v1 restores only its
              declared structured records; this UI has no full-recovery, embedding, attachment
              record, or attachment-byte receipt.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Memory Backup</p>
                <p className="text-xs text-muted-foreground">Download a specific memory archive backup.</p>
              </div>
              <input
                value={memoryBackupName}
                onChange={(e) => setMemoryBackupName(e.target.value)}
                placeholder="memory name"
                aria-label="Memory backup name"
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleMemoryDownload}
                disabled={backupOperation === 'memory-download'}
              >
                {backupOperation === 'memory-download' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Download Memory
              </Button>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Knowledge Archive</p>
                <p className="text-xs text-muted-foreground">Download by filename or upload an archive bundle.</p>
              </div>
              <input
                value={archiveFilename}
                onChange={(e) => setArchiveFilename(e.target.value)}
                placeholder="archive filename"
                aria-label="Knowledge archive filename"
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchiveDownload}
                  disabled={backupOperation === 'archive-download'}
                >
                  {backupOperation === 'archive-download' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Download Archive
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                  <Upload className="w-4 h-4" />
                  {archiveUploadFile ? archiveUploadFile.name : 'Choose archive'}
                  <input
                    data-testid="knowledge-archive-upload-file"
                    type="file"
                    className="hidden"
                    onChange={(e) => setArchiveUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchiveUpload}
                  disabled={!archiveUploadFile || backupOperation === 'archive-upload'}
                >
                  {backupOperation === 'archive-upload' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload Archive
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Metadata Sidecar</p>
                <p className="text-xs text-muted-foreground">Read or update title and description sidecars.</p>
              </div>
              <input
                value={metadataFilename}
                onChange={(e) => setMetadataFilename(e.target.value)}
                placeholder="backup filename"
                aria-label="Backup metadata filename"
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
              />
              <input
                value={metadataTitle}
                onChange={(e) => setMetadataTitle(e.target.value)}
                placeholder="title"
                aria-label="Backup metadata title"
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
              />
              <textarea
                value={metadataDescription}
                onChange={(e) => setMetadataDescription(e.target.value)}
                placeholder="description"
                aria-label="Backup metadata description"
                className="min-h-16 w-full rounded border border-input bg-background px-2 py-1 text-sm"
              />
              {metadataPreview && (
                <p className="text-xs text-muted-foreground">{metadataPreview}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMetadataLoad}
                  disabled={backupOperation === 'metadata-load'}
                >
                  Load Metadata
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMetadataSave}
                  disabled={backupOperation === 'metadata-save'}
                >
                  Save Metadata
                </Button>
              </div>
            </div>
          </div>
        </div>
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
