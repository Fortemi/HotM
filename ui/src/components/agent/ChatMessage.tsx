/**
 * ChatMessage — renders a single chat message with support for
 * text content and tool invocation/result parts (UIMessage format).
 */

import { isToolUIPart, getToolName } from "ai";
import { cn } from "@/lib/utils";
import { Bot, User, Loader2 } from "lucide-react";
import { ToolResultCard } from "./ToolResultCard";
import type { UIMessage } from "@ai-sdk/react";

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
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
          "max-w-[80%] space-y-2",
          isUser && "flex flex-col items-end",
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return part.text ? (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm leading-relaxed",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{part.text}</p>
              </div>
            ) : null;
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
