import { useState, useCallback, useRef } from "react";
import { api } from "@/api";
import { setActiveMemory, getActiveMemory } from "@/api/memory-context";
import type { StickySettings } from "./useStickySettings";

export interface CommitResult {
  noteId: string;
  content: string;
  tags: string[];
  collectionName: string;
  conceptLabel: string;
  timestamp: Date;
  warnings: string[];
}

export function useNoteCommit() {
  const [isCommitting, setIsCommitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const pendingRetry = useRef<(() => Promise<CommitResult>) | null>(null);

  const commit = useCallback(
    async (
      content: string,
      settings: StickySettings
    ): Promise<CommitResult> => {
      setIsCommitting(true);
      setLastError(null);

      const warnings: string[] = [];

      // Stash and restore the active memory if we need to route to a different archive
      const previousMemory = getActiveMemory();
      const archiveChanged =
        settings.archive !== null && settings.archive !== previousMemory;

      const doCommit = async (): Promise<CommitResult> => {
        try {
          // Route to the selected archive
          if (archiveChanged) {
            setActiveMemory(settings.archive);
          }

          // Step 1: Create the note
          const { note_id } = await api.notes.create({
            content,
            format: settings.format,
            source: "manual",
          });

          // Step 2: Apply tags (if any)
          if (settings.tags.length > 0) {
            try {
              await api.notes.updateTags(note_id, {
                add: settings.tags,
              });
            } catch {
              warnings.push("Note saved, but tags could not be applied");
            }
          }

          // Step 3: Assign to collection (if selected)
          if (settings.collectionId) {
            try {
              await api.collections.moveNote(note_id, {
                collection_id: settings.collectionId,
              });
            } catch {
              warnings.push(
                "Note saved, but could not assign to collection"
              );
            }
          }

          // Step 4: Tag with concept (if selected)
          if (settings.conceptId) {
            try {
              await api.concepts.tagNote(note_id, settings.conceptId);
            } catch {
              warnings.push(
                "Note saved, concept hint could not be stored"
              );
            }
          }

          return {
            noteId: note_id,
            content,
            tags: settings.tags,
            collectionName: settings.collectionName,
            conceptLabel: settings.conceptLabel,
            timestamp: new Date(),
            warnings,
          };
        } finally {
          // Restore previous memory routing
          if (archiveChanged) {
            setActiveMemory(previousMemory);
          }
        }
      };

      pendingRetry.current = doCommit;

      try {
        const result = await doCommit();
        setIsCommitting(false);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not save note";
        setLastError(message);
        setIsCommitting(false);
        throw err;
      }
    },
    []
  );

  const retry = useCallback(async (): Promise<CommitResult> => {
    if (!pendingRetry.current) {
      throw new Error("Nothing to retry");
    }
    setIsCommitting(true);
    setLastError(null);
    try {
      const result = await pendingRetry.current();
      setIsCommitting(false);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save note";
      setLastError(message);
      setIsCommitting(false);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return { commit, isCommitting, lastError, retry, clearError };
}
