/**
 * SaveAsNoteButton — saves the current session as a Fortemi note.
 *
 * Formats the conversation as Markdown and creates a note via the API.
 * Fortemi's NLP pipeline auto-generates an AI revision that summarizes
 * the conversation content.
 *
 * Additionally attaches a lossless JSON file containing the full session
 * data (including UIMessage parts) so the session can be restored later.
 */

import { useState, useCallback } from 'react';
import { BookmarkPlus, Check, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { formatSessionAsMarkdown, formatSessionAsJSON } from './session-export';
import { startTusUpload } from '@/services/tusUploader';
import type { UIMessage } from '@ai-sdk/react';

interface SaveAsNoteButtonProps {
  messages: UIMessage[];
  sessionName?: string;
  disabled?: boolean;
}

type SaveState = 'idle' | 'saving' | 'success' | 'partial' | 'error';

export function SaveAsNoteButton({
  messages,
  sessionName = 'Agent Session',
  disabled = false,
}: SaveAsNoteButtonProps) {
  const [state, setState] = useState<SaveState>('idle');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDisabled = disabled || messages.length === 0 || state === 'saving';

  const handleSave = useCallback(async () => {
    setState('saving');
    setErrorMsg(null);
    try {
      const markdown = formatSessionAsMarkdown(messages, { sessionName });
      const response = await api.notes.create({
        content: markdown,
        title: sessionName,
        format: 'markdown',
        source: 'agent-session',
      });
      const savedNoteId = response.note_id;

      if (!savedNoteId) {
        throw new Error('Note created but no ID returned — cannot attach session data');
      }

      // Tag the note so it's discoverable via "Load from Note"
      try {
        await api.notes.updateTags(savedNoteId, { add: ['agent-session'] });
      } catch {
        // Tag failure is non-fatal
        console.warn('[SaveAsNote] Failed to tag note');
      }

      // Attach lossless JSON so the session can be restored later
      let attachmentFailed = false;
      try {
        const json = formatSessionAsJSON(messages, { sessionName });
        const filename = `session-${sessionName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()}.json`;
        const file = new File([json], filename, { type: 'application/json' });
        await startTusUpload({
          noteId: savedNoteId,
          file,
          mediaOptimize: false,
        }).promise;
      } catch {
        attachmentFailed = true;
        console.error('[SaveAsNote] Session JSON attachment failed');
        setErrorMsg('Note saved but session JSON attachment failed.');
      }

      setNoteId(savedNoteId);
      if (attachmentFailed) {
        setState('partial');
        setTimeout(() => setState('idle'), 8000);
      } else {
        setState('success');
        setTimeout(() => setState('idle'), 5000);
      }
    } catch {
      setErrorMsg('Failed to save note.');
      setState('error');
      setTimeout(() => setState('idle'), 5000);
    }
  }, [messages, sessionName]);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSave}
        disabled={isDisabled}
        className="text-muted-foreground"
        title="Save as Fortemi note"
      >
        {state === 'saving' ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : state === 'success' ? (
          <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
        ) : state === 'partial' ? (
          <AlertTriangle className="mr-1 h-3.5 w-3.5 text-yellow-500" />
        ) : state === 'error' ? (
          <AlertCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
        ) : (
          <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
        )}
        {state === 'saving'
          ? 'Saving...'
          : state === 'success'
            ? `Saved (${noteId})`
            : state === 'partial'
              ? 'Saved (no JSON)'
              : state === 'error'
                ? 'Failed'
                : 'Save as Note'}
      </Button>
      {(state === 'error' || state === 'partial') && errorMsg && (
        <span className={`text-xs ${state === 'partial' ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive'}`}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}
