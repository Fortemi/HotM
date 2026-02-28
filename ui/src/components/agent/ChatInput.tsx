/**
 * ChatInput — text input with send button for the agent panel.
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useInputHistory, isCursorOnFirstLine, isCursorOnLastLine } from "./useInputHistory";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  /** Increment to trigger re-focus (e.g. after ConfirmationCard resolves). */
  autoFocusKey?: number;
}

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = "Ask the agent...",
  autoFocusKey = 0,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLoadingRef = useRef(isLoading);
  const history = useInputHistory();

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    history.push(trimmed);
    onSend(trimmed);
    setInput("");
    // Re-focus after clearing input
    textareaRef.current?.focus();
  }, [input, isLoading, onSend, history]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      history.resetNavigation();
    },
    [history],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
      }

      const textarea = textareaRef.current;
      if (!textarea) return;

      if (e.key === "ArrowUp" && isCursorOnFirstLine(textarea)) {
        const prev = history.navigateBack(input);
        if (prev !== undefined) {
          e.preventDefault();
          setInput(prev);
        }
        return;
      }

      if (e.key === "ArrowDown" && isCursorOnLastLine(textarea)) {
        const next = history.navigateForward();
        if (next !== undefined) {
          e.preventDefault();
          setInput(next);
        }
      }
    },
    [handleSend, input, history],
  );

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Re-focus when streaming ends (isLoading true → false)
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      textareaRef.current?.focus();
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading]);

  // Re-focus when autoFocusKey changes (e.g. ConfirmationCard resolved)
  useEffect(() => {
    if (autoFocusKey > 0) {
      textareaRef.current?.focus();
    }
  }, [autoFocusKey]);

  return (
    <div className="flex items-end gap-2 border-t bg-background p-3">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="min-h-[40px] max-h-[120px] resize-none text-sm"
        rows={1}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={!input.trim() || isLoading}
        className="shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
