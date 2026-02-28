/**
 * MessageActions — per-message action buttons for delete and regenerate.
 *
 * Appears on hover alongside CopyButton using the group-hover pattern.
 * Delete removes the message (and paired response for user messages).
 * Regenerate re-sends the preceding user message for a new response.
 */

import { useState, useCallback } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageActionsProps {
  messageId: string;
  isAssistant: boolean;
  onDelete: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export function MessageActions({
  messageId,
  isAssistant,
  onDelete,
  onRegenerate,
}: MessageActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      onDelete(messageId);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }, [confirmDelete, messageId, onDelete]);

  return (
    <div className="flex items-center gap-0.5">
      {isAssistant && onRegenerate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 transition-opacity group-hover/message:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRegenerate(messageId);
          }}
          title="Regenerate response"
        >
          <RefreshCw className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 transition-opacity group-hover/message:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        title={confirmDelete ? 'Click again to confirm' : 'Delete message'}
      >
        <Trash2
          className={`h-3 w-3 ${confirmDelete ? 'text-destructive' : 'text-muted-foreground'}`}
        />
      </Button>
    </div>
  );
}
