/**
 * LinkedNotesTab Component
 * Shared tab content showing which notes share the same file attachment.
 * Used by both AttachmentsBrowser and AttachmentsPanel preview dialogs.
 */

import { StickyNote, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LinkedNote {
  noteId: string;
  noteTitle: string;
  attachmentId: string;
  createdAt: string;
}

interface LinkedNotesTabProps {
  linkedNotes: LinkedNote[];
  currentNoteId?: string;
  onNavigateToNote?: (noteId: string) => void;
  isLoading?: boolean;
}

export function LinkedNotesTab({ linkedNotes, currentNoteId, onNavigateToNote, isLoading }: LinkedNotesTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="linked-notes-loading">
        <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Finding linked notes...</span>
      </div>
    );
  }

  if (linkedNotes.length <= 1) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-testid="linked-notes-empty">
        <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">This file is only attached to one note.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-2" data-testid="linked-notes-list">
      <p className="text-xs text-muted-foreground mb-2">
        This file is attached to {linkedNotes.length} notes:
      </p>
      {linkedNotes.map((note) => {
        const isCurrent = note.noteId === currentNoteId;
        return (
          <button
            key={note.attachmentId}
            type="button"
            className={cn(
              'flex items-center gap-3 w-full text-left px-3 py-2 rounded-md transition-colors',
              isCurrent
                ? 'bg-muted/50 cursor-default'
                : onNavigateToNote
                  ? 'hover:bg-muted/50 cursor-pointer'
                  : 'cursor-default',
            )}
            onClick={() => !isCurrent && onNavigateToNote?.(note.noteId)}
            disabled={isCurrent || !onNavigateToNote}
            data-testid={`linked-note-${note.noteId}`}
          >
            <StickyNote className={cn('w-4 h-4 shrink-0', isCurrent ? 'text-muted-foreground' : 'text-primary')} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm truncate', isCurrent && 'text-muted-foreground')}>
                {note.noteTitle}
                {isCurrent && <span className="text-xs ml-1.5 opacity-60">(this note)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                Attached {new Date(note.createdAt).toLocaleDateString()}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
