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
import { BookmarkPlus, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { formatSessionAsMarkdown, formatSessionAsJSON } from './session-export';
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
      const savedNoteId = response.note_id;

      if (!savedNoteId) {
        console.error('[SaveAsNote] Note created but no ID returned:', response);
      }

      // Tag the note so it's discoverable via "Load from Note"
      try {
        await api.notes.updateTags(savedNoteId, { add: ['agent-session'] });
      } catch (tagErr) {
        // Tag failure is non-fatal
        console.warn('[SaveAsNote] Failed to tag note %s:', savedNoteId, tagErr);
      }

      // Attach lossless JSON so the session can be restored later
      try {
        const json = formatSessionAsJSON(messages, { sessionName });
        const filename = `session-${sessionName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()}.json`;
        const file = new File([json], filename, { type: 'application/json' });
        await api.attachments.uploadAttachment(savedNoteId, file);
      } catch (attachErr) {
        // Attachment failure is non-fatal — the note was already created
        console.warn('[SaveAsNote] Failed to attach session JSON to %s:', savedNoteId, attachErr);
      }

      setNoteId(savedNoteId);
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
