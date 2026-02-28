/**
 * SessionPanel — right-side slide-out panel showing saved chat sessions.
 *
 * Renders a fixed-position panel that slides in from the right edge
 * with a semi-transparent backdrop. Sessions are sorted by most
 * recently updated and support rename/delete inline.
 */

import { useState, useMemo } from 'react';
import { X, Plus, MessageSquare, Trash2, Pencil, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatSession } from './session-storage';

interface SessionPanelProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, name: string) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
  open: boolean;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function SessionItem({
  session,
  isActive,
  onSwitch,
  onRename,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  return (
    <div
      className={cn(
        'group flex flex-col gap-1 rounded-md border px-3 py-2 transition-colors',
        isActive
          ? 'border-primary/30 bg-primary/5'
          : 'border-transparent hover:bg-muted/50 cursor-pointer',
      )}
      onClick={editing ? undefined : onSwitch}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !editing) onSwitch();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex flex-1 items-center gap-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setEditing(false);
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded border bg-background px-1.5 py-0.5 text-xs"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                handleRename();
              }}
              title="Confirm rename"
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <span className="truncate text-xs font-medium">
              {session.name}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditName(session.name);
                  setEditing(true);
                }}
                title="Rename"
              >
                <Pencil className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirmDelete) {
                    onDelete();
                  } else {
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 3000);
                  }
                }}
                title={confirmDelete ? 'Click again to confirm' : 'Delete'}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <MessageSquare className="h-2.5 w-2.5" />
          {session.messageCount}
        </span>
        <span>{formatRelativeDate(session.updatedAt)}</span>
        <span className="ml-auto text-muted-foreground/60">
          {session.provider}
        </span>
      </div>
    </div>
  );
}

export function SessionPanel({
  sessions,
  activeSessionId,
  onSwitchSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onClose,
  open,
}: SessionPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q),
    );
  }, [sessions, searchQuery]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
          data-testid="session-panel-backdrop"
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l bg-background shadow-lg transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-label="Session history"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h3 className="text-sm font-semibold">Sessions</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onNewSession}
              title="New session"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Search — shown when there are enough sessions to filter */}
        {sessions.length > 3 && (
          <div className="border-b px-3 py-1.5">
            <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedSessions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {searchQuery ? 'No matching sessions' : 'No sessions yet'}
            </div>
          ) : (
            sortedSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSwitch={() => onSwitchSession(session.id)}
                onRename={(name) => onRenameSession(session.id, name)}
                onDelete={() => onDeleteSession(session.id)}
              />
            ))
          )}
        </div>

        {/* Footer — session count and storage info */}
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground/60">
          {sessions.length} session{sessions.length === 1 ? '' : 's'}
          {searchQuery && ` (${sortedSessions.length} shown)`}
        </div>
      </div>
    </>
  );
}
