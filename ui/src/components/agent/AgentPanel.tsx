/**
 * AgentPanel — main agent chat interface.
 *
 * Renders as a full-width view within HallOfMind's content area.
 * Supports two chat backends:
 * - 'fortemi': Native Fortemi /chat endpoint (default, no external deps)
 * - AI SDK mode: Ollama/Anthropic/OpenAI via agent-proxy (streaming + tools)
 *
 * The active backend is selected via the provider configuration.
 */

import { useEffect, useRef, useState } from "react";
import { Bot, Trash2, Shield, ShieldCheck, ShieldOff, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgent, type AgentContext } from "./useAgent";
import { useAgentConfig } from "./useAgentConfig";
import { useAgentPrivileges } from "./useAgentPrivileges";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ConfirmationCard } from "./ConfirmationCard";
import { AgentSettings } from "./AgentSettings";
import type { PrivilegeMode } from "./privileges";

interface AgentPanelProps {
  context?: AgentContext;
}

const PRIVILEGE_MODE_CYCLE: PrivilegeMode[] = ['assisted', 'full', 'read-only'];

const PRIVILEGE_ICONS: Record<PrivilegeMode, typeof Shield> = {
  full: ShieldCheck,
  assisted: Shield,
  'read-only': ShieldOff,
};

const PRIVILEGE_COLORS: Record<PrivilegeMode, string> = {
  full: 'text-green-600 dark:text-green-400',
  assisted: 'text-yellow-600 dark:text-yellow-400',
  'read-only': 'text-muted-foreground',
};

export function AgentPanel({ context }: AgentPanelProps) {
  const { config } = useAgentConfig();
  const { mode, setMode, pending, resolveConfirmation } = useAgentPrivileges();
  const [showSettings, setShowSettings] = useState(false);

  // Phase 1: All providers route through the Fortemi-native useAgent hook.
  // Phase 2 (after #121): AI SDK providers will use useAgentChat instead.
  const { messages, isLoading, error, sendMessage, clearMessages, clearError } =
    useAgent({ context });
  const scrollRef = useRef<HTMLDivElement>(null);

  const cycleMode = () => {
    const idx = PRIVILEGE_MODE_CYCLE.indexOf(mode);
    const next = PRIVILEGE_MODE_CYCLE[(idx + 1) % PRIVILEGE_MODE_CYCLE.length];
    setMode(next);
  };

  const ModeIcon = PRIVILEGE_ICONS[mode];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Agent</h2>
          <Badge variant="secondary" className="text-xs font-normal">
            {config.provider}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleMode}
            className={`h-7 gap-1 px-2 text-xs ${PRIVILEGE_COLORS[mode]}`}
            title={`Privilege: ${mode} (click to cycle)`}
          >
            <ModeIcon className="h-3.5 w-3.5" />
            {mode}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              className="text-muted-foreground"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="text-muted-foreground"
            title="Settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showSettings ? (
        <AgentSettings onClose={() => setShowSettings(false)} />
      ) : (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="flex flex-col">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                  <Bot className="mb-4 h-12 w-12 text-muted-foreground/40" />
                  <h3 className="text-base font-medium text-muted-foreground">
                    Knowledge Assistant
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">
                    Ask me to search your notes, create summaries, find connections,
                    or manage your knowledge base.
                  </p>
                </div>
              ) : (
                messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
              )}

              {isLoading && (
                <div className="flex gap-3 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Error banner */}
          {error && (
            <div className="flex items-center justify-between border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={clearError} className="h-6 px-2 text-xs">
                Dismiss
              </Button>
            </div>
          )}

          {/* Pending confirmation card */}
          {pending && (
            <ConfirmationCard
              confirmation={pending}
              onResolve={resolveConfirmation}
            />
          )}

          {/* Input */}
          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
