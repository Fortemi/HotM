/**
 * VersionHistory Component
 * Timeline view of note versions with diff comparison
 */

import { useState, useEffect, useCallback } from 'react';
import {
  History,
  Eye,
  GitCompare,
  RotateCcw,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { api } from '@/api';
import type { NoteVersion, VersionDiff, VersionContentResponse } from '@/api/types-extended';

interface VersionHistoryProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore?: (version: number) => void;
}

type ViewMode = 'timeline' | 'view' | 'diff';

interface DiffViewerProps {
  diff: VersionDiff;
  mode?: 'side-by-side' | 'unified';
}

function DiffViewer({ diff, mode = 'side-by-side' }: DiffViewerProps) {
  if (!diff.diff) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No changes between versions</p>
      </div>
    );
  }

  // Parse unified diff format
  const lines = diff.diff.split('\n');
  const addedLines: string[] = [];
  const removedLines: string[] = [];
  const contextLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines.push(line.slice(1));
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removedLines.push(line.slice(1));
    } else if (!line.startsWith('@@') && !line.startsWith('---') && !line.startsWith('+++')) {
      contextLines.push(line);
    }
  });

  if (mode === 'unified') {
    return (
      <div data-testid="unified-diff" className="font-mono text-sm overflow-x-auto">
        <pre className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
          {lines.map((line, idx) => {
            let className = '';
            if (line.startsWith('+') && !line.startsWith('+++')) {
              className = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              className = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
            } else if (line.startsWith('@@')) {
              className = 'text-blue-500';
            }
            return (
              <div key={idx} className={className}>
                {line}
              </div>
            );
          })}
        </pre>
      </div>
    );
  }

  // Side-by-side view
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <Badge variant="secondary">Version {diff.from_version}</Badge>
          <span className="text-muted-foreground">Previous</span>
        </div>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
          {removedLines.map((line, idx) => (
            <div key={idx} className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
              {line}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <Badge>Version {diff.to_version}</Badge>
          <span className="text-muted-foreground">Current</span>
        </div>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
          {addedLines.map((line, idx) => (
            <div key={idx} className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VersionHistory({ noteId, isOpen, onClose, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [versionContent, setVersionContent] = useState<VersionContentResponse | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, noteId]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        if (selectedVersion && versions.length > 1) {
          const currentIdx = versions.findIndex((v) => v.version === selectedVersion);
          if (currentIdx < versions.length - 1) {
            handleCompare(selectedVersion, versions[currentIdx + 1].version);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedVersion, versions]);

  const loadVersions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.versions.listVersions(noteId);
      setVersions(data);
    } catch (err) {
      setError('Failed to load version history');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = useCallback(async (version: number) => {
    setSelectedVersion(version);
    setIsLoadingContent(true);
    setViewMode('view');
    try {
      const content = await api.versions.getVersion(noteId, version);
      setVersionContent(content);
    } catch (err) {
      console.error('Failed to load version:', err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [noteId]);

  const handleCompare = useCallback(async (from: number, to: number) => {
    setSelectedVersion(to);
    setIsLoadingContent(true);
    setViewMode('diff');
    try {
      const diffData = await api.versions.diffVersions(noteId, from, to);
      setDiff(diffData);
    } catch (err) {
      console.error('Failed to load diff:', err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [noteId]);

  const handleRestore = useCallback(async () => {
    if (versionToRestore === null) return;
    try {
      await api.versions.restoreVersion(noteId, versionToRestore);
      onRestore?.(versionToRestore);
      setRestoreDialogOpen(false);
      onClose();
    } catch (err) {
      console.error('Failed to restore version:', err);
    }
  }, [noteId, versionToRestore, onRestore, onClose]);

  const handleBackToTimeline = () => {
    setViewMode('timeline');
    setSelectedVersion(null);
    setVersionContent(null);
    setDiff(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Version History
              {viewMode !== 'timeline' && (
                <Button variant="ghost" size="sm" onClick={handleBackToTimeline} className="ml-2">
                  <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                  Back to Timeline
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={loadVersions} className="mt-2">
                  Retry
                </Button>
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No Version History</p>
                <p className="text-xs">This note has no previous versions</p>
              </div>
            ) : viewMode === 'timeline' ? (
              /* Timeline View */
              <ul
                role="list"
                aria-label="version history timeline"
                className="space-y-3"
              >
                {versions.map((version, idx) => (
                  <li
                    key={version.version}
                    className={cn(
                      'relative pl-6 pb-3',
                      idx < versions.length - 1 && 'border-l-2 border-muted ml-2'
                    )}
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-0 -translate-x-1/2 w-3 h-3 rounded-full bg-primary" />

                    <div className="bg-card border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={idx === 0 ? 'default' : 'secondary'}>
                              Version {version.version}
                            </Badge>
                            {idx === 0 && (
                              <Badge variant="outline" className="text-xs">Current</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(version.created_at).toLocaleString()}
                          </p>
                          {version.change_summary && (
                            <p className="text-sm mt-2">{version.change_summary}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(version.version)}
                          >
                            <Eye className="w-4 h-4" />
                            <span className="ml-1 hidden sm:inline">View</span>
                          </Button>
                          {idx < versions.length - 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCompare(versions[idx + 1].version, version.version)}
                            >
                              <GitCompare className="w-4 h-4" />
                              <span className="ml-1 hidden sm:inline">Diff</span>
                            </Button>
                          )}
                          {idx > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVersionToRestore(version.version);
                                setRestoreDialogOpen(true);
                              }}
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span className="ml-1 hidden sm:inline">Restore</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : viewMode === 'view' && versionContent ? (
              /* Version Content View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge>Version {versionContent.version}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(versionContent.created_at).toLocaleString()}
                  </span>
                </div>

                {isLoadingContent ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
                    <MarkdownPreview content={versionContent.content} />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVersionToRestore(versionContent.version);
                      setRestoreDialogOpen(true);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore This Version
                  </Button>
                </div>
              </div>
            ) : viewMode === 'diff' && diff ? (
              /* Diff View */
              <div className="space-y-4">
                {isLoadingContent ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <DiffViewer diff={diff} />
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version {versionToRestore}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new version with the content from version {versionToRestore}.
              The current content will be preserved in the version history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
