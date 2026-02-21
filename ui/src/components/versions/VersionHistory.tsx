/**
 * VersionHistory Component
 * Timeline view of note versions with diff comparison, delete, and keyboard navigation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  History,
  Eye,
  GitCompare,
  RotateCcw,
  Loader2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trash2,
  Bot,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
type ConfirmAction = 'restore' | 'delete';

// ─── Diff Viewer ─────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'context' | 'added' | 'removed';
  content: string;
}

/** Parse unified diff into aligned line pairs for side-by-side display */
function parseUnifiedDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
    if (line.startsWith('+')) {
      result.push({ type: 'added', content: line.slice(1) });
    } else if (line.startsWith('-')) {
      result.push({ type: 'removed', content: line.slice(1) });
    } else {
      result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
    }
  }
  return result;
}

/** Group consecutive changes into aligned pairs for side-by-side */
function alignDiffLines(lines: DiffLine[]): Array<{ left: DiffLine | null; right: DiffLine | null }> {
  const aligned: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'context') {
      aligned.push({ left: line, right: line });
      i++;
    } else {
      // Collect consecutive removed then added lines
      const removed: DiffLine[] = [];
      const added: DiffLine[] = [];
      while (i < lines.length && lines[i].type === 'removed') {
        removed.push(lines[i]);
        i++;
      }
      while (i < lines.length && lines[i].type === 'added') {
        added.push(lines[i]);
        i++;
      }
      const maxLen = Math.max(removed.length, added.length);
      for (let j = 0; j < maxLen; j++) {
        aligned.push({
          left: j < removed.length ? removed[j] : null,
          right: j < added.length ? added[j] : null,
        });
      }
    }
  }
  return aligned;
}

/** Find indices of changed lines (non-context) for navigation */
function findChangeIndices(aligned: Array<{ left: DiffLine | null; right: DiffLine | null }>): number[] {
  const indices: number[] = [];
  for (let i = 0; i < aligned.length; i++) {
    const { left, right } = aligned[i];
    if ((left && left.type !== 'context') || (right && right.type !== 'context')) {
      // Only record the first line of a consecutive change block
      if (indices.length === 0 || indices[indices.length - 1] !== i - 1) {
        indices.push(i);
      } else {
        // Extend block — don't add
      }
    }
  }
  return indices;
}

interface DiffViewerProps {
  diff: VersionDiff;
  mode?: 'side-by-side' | 'unified';
}

function DiffViewer({ diff, mode = 'side-by-side' }: DiffViewerProps) {
  const [currentChangeIdx, setCurrentChangeIdx] = useState(0);
  const changeRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!diff.diff) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No changes between versions</p>
      </div>
    );
  }

  const parsed = parseUnifiedDiff(diff.diff);
  const rawLines = diff.diff.split('\n');

  if (mode === 'unified') {
    return (
      <div data-testid="unified-diff" className="font-mono text-sm overflow-x-auto">
        <pre className="p-4 bg-muted rounded-lg whitespace-pre-wrap">
          {rawLines.map((line, idx) => {
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

  // Side-by-side view with aligned lines
  const aligned = alignDiffLines(parsed);
  const changeIndices = findChangeIndices(aligned);

  const navigateChange = (direction: 'next' | 'prev') => {
    if (changeIndices.length === 0) return;
    let newIdx: number;
    if (direction === 'next') {
      newIdx = currentChangeIdx < changeIndices.length - 1 ? currentChangeIdx + 1 : 0;
    } else {
      newIdx = currentChangeIdx > 0 ? currentChangeIdx - 1 : changeIndices.length - 1;
    }
    setCurrentChangeIdx(newIdx);
    changeRefs.current[changeIndices[newIdx]]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const lineClass = (line: DiffLine | null) => {
    if (!line) return 'bg-muted/30';
    if (line.type === 'added') return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
    if (line.type === 'removed') return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
    return '';
  };

  return (
    <div className="space-y-2">
      {/* Change navigation */}
      {changeIndices.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            {changeIndices.length} change{changeIndices.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => navigateChange('prev')}
              title="Previous Change (P)"
            >
              <ChevronUp className="w-3 h-3 mr-1" /> Prev
            </Button>
            <span>{currentChangeIdx + 1}/{changeIndices.length}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => navigateChange('next')}
              title="Next Change (N)"
            >
              Next <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-0 border rounded-lg overflow-hidden">
        {/* Headers */}
        <div className="text-sm font-medium p-2 flex items-center gap-2 bg-muted/40 border-b border-r">
          <Badge variant="secondary">v{diff.from_version}</Badge>
          <span className="text-muted-foreground text-xs">Previous</span>
        </div>
        <div className="text-sm font-medium p-2 flex items-center gap-2 bg-muted/40 border-b">
          <Badge>v{diff.to_version}</Badge>
          <span className="text-muted-foreground text-xs">Current</span>
        </div>

        {/* Lines */}
        <div className="col-span-2 max-h-80 overflow-y-auto font-mono text-sm">
          {aligned.map((pair, idx) => (
            <div
              key={idx}
              ref={(el) => { changeRefs.current[idx] = el; }}
              className="grid grid-cols-2"
            >
              <div className={cn('px-3 py-0.5 border-r border-b border-border/30 min-h-[24px]', lineClass(pair.left))}>
                {pair.left?.content ?? ''}
              </div>
              <div className={cn('px-3 py-0.5 border-b border-border/30 min-h-[24px]', lineClass(pair.right))}>
                {pair.right?.content ?? ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Dot Color ──────────────────────────────────────────────────────

function getTimelineDotClass(version: NoteVersion, isCurrent: boolean): string {
  if (isCurrent) return 'bg-blue-500';
  if (version.author_type === 'ai') return 'bg-purple-500';
  if (version.author_type === 'user') return 'bg-green-500';
  return 'bg-primary';
}

function AuthorBadge({ version }: { version: NoteVersion }) {
  if (!version.author_type) return null;
  if (version.author_type === 'ai') {
    return (
      <Badge variant="outline" className="text-[10px] gap-0.5 text-purple-600 dark:text-purple-400 border-purple-300">
        <Bot className="w-2.5 h-2.5" />
        {version.author_model ? `AI (${version.author_model})` : 'AI'}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-0.5 text-green-600 dark:text-green-400 border-green-300">
      <User className="w-2.5 h-2.5" />
      You
    </Badge>
  );
}

function CharDelta({ version }: { version: NoteVersion }) {
  if (version.chars_added == null && version.chars_removed == null) return null;
  return (
    <span className="text-[10px] text-muted-foreground">
      {version.chars_added != null && version.chars_added > 0 && (
        <span className="text-green-600 dark:text-green-400">+{version.chars_added}</span>
      )}
      {version.chars_added != null && version.chars_removed != null && ' / '}
      {version.chars_removed != null && version.chars_removed > 0 && (
        <span className="text-red-600 dark:text-red-400">-{version.chars_removed}</span>
      )}
      {' chars'}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VersionHistory({ noteId, isOpen, onClose, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [versionContent, setVersionContent] = useState<VersionContentResponse | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm dialog state (shared for restore and delete)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>('restore');
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);

  // Arbitrary version picker for diff
  const [diffFromVersion, setDiffFromVersion] = useState<number | null>(null);
  const [diffToVersion, setDiffToVersion] = useState<number | null>(null);

  // Timeline focus index for keyboard nav
  const [focusedIdx, setFocusedIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
      setFocusedIdx(0);
    }
  }, [isOpen, noteId]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'd':
        case 'D':
          if (viewMode === 'timeline' && versions.length > 1) {
            const v = versions[focusedIdx];
            if (v && focusedIdx < versions.length - 1) {
              handleCompare(versions[focusedIdx + 1].version, v.version);
            }
          }
          break;

        case 'r':
        case 'R':
          if (viewMode === 'timeline' && focusedIdx > 0) {
            openConfirm('restore', versions[focusedIdx].version);
          }
          break;

        case 'n':
        case 'N':
          // In diff mode, next change is handled inside DiffViewer
          break;

        case 'p':
        case 'P':
          // In diff mode, prev change is handled inside DiffViewer
          break;

        case 'ArrowDown':
          if (viewMode === 'timeline') {
            e.preventDefault();
            setFocusedIdx((prev) => Math.min(prev + 1, versions.length - 1));
          }
          break;

        case 'ArrowUp':
          if (viewMode === 'timeline') {
            e.preventDefault();
            setFocusedIdx((prev) => Math.max(prev - 1, 0));
          }
          break;

        case 'Enter':
          if (viewMode === 'timeline' && versions[focusedIdx]) {
            handleView(versions[focusedIdx].version);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, versions, focusedIdx]);

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
    setDiffFromVersion(from);
    setDiffToVersion(to);
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

  const openConfirm = (action: ConfirmAction, version: number) => {
    setConfirmAction(action);
    setConfirmVersion(version);
    setConfirmOpen(true);
  };

  const handleConfirmAction = useCallback(async () => {
    if (confirmVersion === null) return;
    try {
      if (confirmAction === 'restore') {
        await api.versions.restoreVersion(noteId, confirmVersion);
        onRestore?.(confirmVersion);
        setConfirmOpen(false);
        onClose();
      } else if (confirmAction === 'delete') {
        await api.versions.deleteVersion(noteId, confirmVersion);
        setConfirmOpen(false);
        // Reload versions after delete
        await loadVersions();
        if (viewMode !== 'timeline') {
          handleBackToTimeline();
        }
      }
    } catch (err) {
      console.error(`Failed to ${confirmAction} version:`, err);
    }
  }, [noteId, confirmVersion, confirmAction, onRestore, onClose, viewMode]);

  const handleBackToTimeline = () => {
    setViewMode('timeline');
    setVersionContent(null);
    setDiff(null);
  };

  // Arbitrary version picker change handler
  const handleDiffPickerChange = useCallback(
    (which: 'from' | 'to', version: number) => {
      const from = which === 'from' ? version : (diffFromVersion ?? versions[1]?.version ?? 1);
      const to = which === 'to' ? version : (diffToVersion ?? versions[0]?.version ?? 2);
      if (from !== to) {
        handleCompare(Math.min(from, to), Math.max(from, to));
      }
    },
    [diffFromVersion, diffToVersion, versions, handleCompare]
  );

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
                {versions.map((version, idx) => {
                  const isCurrent = idx === 0;
                  const isFocused = idx === focusedIdx;

                  return (
                    <li
                      key={version.version}
                      className={cn(
                        'relative pl-6 pb-3',
                        idx < versions.length - 1 && 'border-l-2 border-muted ml-2'
                      )}
                    >
                      {/* Timeline dot with author color */}
                      <div
                        className={cn(
                          'absolute left-0 -translate-x-1/2 w-3 h-3 rounded-full',
                          getTimelineDotClass(version, isCurrent)
                        )}
                      />

                      <div
                        className={cn(
                          'bg-card border rounded-lg p-3 transition-colors',
                          isFocused && 'ring-2 ring-primary/50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={isCurrent ? 'default' : 'secondary'}>
                                Version {version.version}
                              </Badge>
                              {isCurrent && (
                                <Badge variant="outline" className="text-xs">Current</Badge>
                              )}
                              <AuthorBadge version={version} />
                              <CharDelta version={version} />
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
                              title="View version content"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="ml-1 hidden sm:inline">View</span>
                            </Button>
                            {versions.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const other = idx < versions.length - 1
                                    ? versions[idx + 1].version
                                    : versions[idx - 1].version;
                                  handleCompare(Math.min(other, version.version), Math.max(other, version.version));
                                }}
                                title="Compare with adjacent version (D)"
                              >
                                <GitCompare className="w-4 h-4" />
                                <span className="ml-1 hidden sm:inline">Diff</span>
                              </Button>
                            )}
                            {!isCurrent && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openConfirm('restore', version.version)}
                                  title="Restore this version (R)"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  <span className="ml-1 hidden sm:inline">Restore</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openConfirm('delete', version.version)}
                                  title="Delete this version"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
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
                    onClick={() => openConfirm('restore', versionContent.version)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore This Version
                  </Button>
                </div>
              </div>
            ) : viewMode === 'diff' && diff ? (
              /* Diff View with version pickers */
              <div className="space-y-4">
                {/* Arbitrary version picker */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={String(diffFromVersion ?? diff.from_version)}
                    onValueChange={(v) => handleDiffPickerChange('from', Number(v))}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs" aria-label="Compare from version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.version} value={String(v.version)}>
                          v{v.version} — {new Date(v.created_at).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-sm">⇄</span>
                  <Select
                    value={String(diffToVersion ?? diff.to_version)}
                    onValueChange={(v) => handleDiffPickerChange('to', Number(v))}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs" aria-label="Compare to version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.version} value={String(v.version)}>
                          v{v.version} — {new Date(v.created_at).toLocaleDateString()}
                          {v.version === versions[0]?.version ? ' (Current)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

          {/* Keyboard shortcut hints (footer) */}
          {viewMode === 'timeline' && versions.length > 0 && (
            <div className="border-t pt-2 text-[10px] text-muted-foreground flex items-center gap-3 flex-wrap">
              <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Enter</kbd> View</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">D</kbd> Diff</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">R</kbd> Restore</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog (restore or delete) */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'restore'
                ? `Restore Version ${confirmVersion}?`
                : `Delete Version ${confirmVersion}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'restore'
                ? `This will create a new version with the content from version ${confirmVersion}. The current content will be preserved in the version history.`
                : `This will permanently delete version ${confirmVersion}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmAction === 'restore' ? 'Restore' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
