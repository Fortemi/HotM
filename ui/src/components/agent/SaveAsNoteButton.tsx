/**
 * SaveAsNoteButton — saves the current session as a Fortemi note.
 *
 * Formats the conversation as Markdown and creates a note via the API.
 * Fortemi's NLP pipeline auto-generates an AI revision that summarizes
 * the conversation content.
 */

import { useState, useCallback } from 'react';
import { BookmarkPlus, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { formatSessionAsMarkdown } from './session-export';
import type { UIMessage } from '@ai-sdk/react';

interface SaveAsNoteButtonProps {
  messages: UIMessage[];
  sessionName?: string;
  disabled?: boolean;
}

type SaveState = 'idle' | 'saving' | 'success' | 'error';

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
        format: 'markdown',
        source: 'agent-session',
      });
      setNoteId(response.note_id);
      setState('success');
      setTimeout(() => setState('idle'), 5000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save note';
      setErrorMsg(message);
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
        ) : state === 'error' ? (
          <AlertCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
        ) : (
          <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
        )}
        {state === 'saving'
          ? 'Saving...'
          : state === 'success'
            ? `Saved (${noteId})`
            : state === 'error'
              ? 'Failed'
              : 'Save as Note'}
      </Button>
      {state === 'error' && errorMsg && (
        <span className="text-xs text-destructive">{errorMsg}</span>
      )}
    </div>
  );
}
