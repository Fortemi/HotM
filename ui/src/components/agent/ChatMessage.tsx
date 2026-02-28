/**
 * ChatMessage — renders a single chat message with support for
 * text content and tool invocation/result parts (UIMessage format).
 */

import { isToolUIPart, getToolName } from "ai";
import { cn } from "@/lib/utils";
import { Bot, User, Loader2 } from "lucide-react";
import { ToolResultCard } from "./ToolResultCard";
import { CopyButton } from "./CopyButton";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { MessageActions } from "./MessageActions";
import { extractMessageText } from "./context-compaction";
import type { UIMessage } from "@ai-sdk/react";

interface ChatMessageProps {
  message: UIMessage;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export function ChatMessage({ message, onDelete, onRegenerate }: ChatMessageProps) {
  const isUser = message.role === "user";

  const messageText = extractMessageText(message);

  return (
    <div
      className={cn(
        "group/message relative flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "absolute top-2 flex items-center gap-0.5",
          isUser ? "left-2" : "right-2",
        )}
      >
        {messageText && <CopyButton text={messageText} />}
        {onDelete && (
          <MessageActions
            messageId={message.id}
            isAssistant={!isUser}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
          />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] space-y-2",
          isUser && "flex flex-col items-end",
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (!part.text) return null;
            if (isUser) {
              return (
                <div
                  key={i}
                  className="rounded-lg bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground"
                >
                  <p className="whitespace-pre-wrap break-words">{part.text}</p>
                </div>
              );
            }
            return (
              <div
                key={i}
                className="rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed text-foreground"
              >
                <MarkdownRenderer content={part.text} />
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part);
            if (part.state === "output-available") {
              return (
                <ToolResultCard
                  key={i}
                  toolName={toolName}
                  result={part.output}
                />
              );
            }
            if (part.state === "output-error") {
              return (
                <div
                  key={i}
                  className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {toolName} failed: {part.errorText}
                </div>
              );
            }
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Calling {toolName}...
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
