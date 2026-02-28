/**
 * LoadFromNoteButton — loads a previously saved agent session from a Fortemi note.
 *
 * Discovers notes tagged 'agent-session', lists them in a dialog, and
 * restores the session from the attached lossless JSON file.
 *
 * Flow:
 * 1. User clicks "Load from Note"
 * 2. Dialog fetches notes with tag 'agent-session'
 * 3. User selects a note
 * 4. Component fetches note attachments, finds the session JSON
 * 5. Downloads and parses the JSON, calls onLoad with restored messages
 */

import { useState, useCallback } from 'react';
import {
  FolderOpen,
  Loader2,
  FileJson,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api } from '@/api';
import type { UIMessage } from '@ai-sdk/react';
import type { NoteSummary } from '@/api/types';
import type { Attachment } from '@/api/types-extended';

interface LoadFromNoteButtonProps {
  onLoad: (messages: UIMessage[], sessionName: string) => void;
  disabled?: boolean;
}

type LoadState = 'idle' | 'browsing' | 'loading' | 'error';

interface SessionNote {
  id: string;
  title: string;
  createdAt: string;
  hasAttachment: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LoadFromNoteButton({
  onLoad,
  disabled = false,
}: LoadFromNoteButtonProps) {
  const [state, setState] = useState<LoadState>('idle');
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingNoteId, setLoadingNoteId] = useState<string | null>(null);

  const handleOpen = useCallback(async () => {
    setState('browsing');
    setErrorMsg(null);
    setNotes([]);
    try {
      // Search for notes tagged 'agent-session'
      const results = await api.notes.list({
        tags: ['agent-session'],
        sortBy: 'created_at',
        sortOrder: 'desc',
        limit: 50,
      });
      const sessionNotes: SessionNote[] = (results as NoteSummary[]).map((n) => ({
        id: n.id,
        title: n.title ?? `Session ${formatDate(n.created_at_utc)}`,
        createdAt: n.created_at_utc,
        hasAttachment: true, // We assume tagged notes have the attachment
      }));
      setNotes(sessionNotes);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch sessions';
      setErrorMsg(message);
      setState('error');
    }
  }, []);

  const handleClose = useCallback(() => {
    setState('idle');
    setNotes([]);
    setErrorMsg(null);
    setLoadingNoteId(null);
  }, []);

  const handleSelect = useCallback(
    async (note: SessionNote) => {
      setLoadingNoteId(note.id);
      setErrorMsg(null);
      try {
        // Fetch attachments for this note
        const attachments: Attachment[] =
          await api.attachments.listAttachments(note.id);

        // Find the session JSON attachment
        const jsonAttachment = attachments.find(
          (a) =>
            a.content_type === 'application/json' &&
            a.filename.startsWith('session-'),
        );

        if (!jsonAttachment) {
          setErrorMsg('No session data found on this note');
          setLoadingNoteId(null);
          return;
        }

        // Download the JSON
        const blob = await api.attachments.downloadAttachment(
          jsonAttachment.id,
        );
        const text = await blob.text();
        const data = JSON.parse(text);

        // Parse into UIMessage format
        if (!data.messages || !Array.isArray(data.messages)) {
          setErrorMsg('Invalid session data format');
          setLoadingNoteId(null);
          return;
        }

        const messages: UIMessage[] = data.messages.map(
          (msg: { role: string; parts: unknown[] }, idx: number) => ({
            id: `restored-${idx}-${Date.now()}`,
            role: msg.role as 'user' | 'assistant',
            parts: msg.parts as UIMessage['parts'],
          }),
        );

        const sessionName =
          data.sessionName ?? note.title ?? 'Restored Session';
        onLoad(messages, sessionName);
        handleClose();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load session';
        setErrorMsg(message);
        setLoadingNoteId(null);
      }
    },
    [onLoad, handleClose],
  );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        disabled={disabled}
        className="text-muted-foreground"
        title="Load session from saved note"
      >
        <FolderOpen className="h-4 w-4" />
      </Button>

      <Dialog
        open={state === 'browsing' || state === 'loading' || state === 'error'}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Load Session from Note</DialogTitle>
            <DialogDescription>
              Select a previously saved agent session to restore.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {notes.length === 0 && !errorMsg ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading saved sessions...
            </div>
          ) : notes.length === 0 && errorMsg ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No saved sessions found.
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleSelect(note)}
                  disabled={loadingNoteId !== null}
                  className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  {loadingNoteId === note.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <FileJson className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {note.title}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-2.5 w-2.5" />
                      {formatDate(note.createdAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
