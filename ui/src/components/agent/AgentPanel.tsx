/**
 * AgentPanel — main agent chat interface.
 *
 * Renders as a full-width view within HallOfMind's content area.
 * All providers route through useAgentChat (AI SDK streaming + client-side tools).
 * The agent-proxy handles LLM streaming; tool execution happens in-browser
 * against the Fortemi API.
 */

import { useEffect, useRef, useState } from "react";
import { Bot, Trash2, Shield, ShieldCheck, ShieldOff, Settings2, Shrink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentChat } from "./useAgentChat";
import { useAgentConfig } from "./useAgentConfig";
import { useAgentPrivileges } from "./useAgentPrivileges";
import { useChatModels } from "./useChatModels";
import { useContextTracking } from "./useContextTracking";
import { buildSystemPrompt } from "./system-prompt";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ConfirmationCard } from "./ConfirmationCard";
import { ContextBar } from "./ContextBar";
import { useContextCompaction } from "./useContextCompaction";
import { deriveAgentPhase, PHASE_LABELS, PHASE_INDICATOR_CLASSES } from "./agent-state";
import { SubAgentProgressPanel } from "./SubAgentProgressPanel";
import { AgentSettings } from "./AgentSettings";
import type { AgentContext } from "./useAgent";
import type { SubAgentProgress } from "./sub-agent";
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
  const { config, setConfig } = useAgentConfig();
  const { mode, setMode, pending, resolveConfirmation } = useAgentPrivileges();
  const [showSettings, setShowSettings] = useState(false);
  const { models, defaultModel } = useChatModels(config.provider);

  const { messages, isLoading, error, sendMessage, clearMessages, clearError, setMessages } =
    useAgentChat({ config, context });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve active model's context window for token tracking
  const activeModel = config.model ?? defaultModel;
  const activeModelInfo = models.find(m => m.model === activeModel);
  const contextWindow = activeModelInfo?.context_window;

  const contextBreakdown = useContextTracking({
    systemPrompt: buildSystemPrompt(context),
    messages,
    contextWindow,
  });

  const {
    compact,
    isCompacting,
    showWarning: showCompactWarning,
    wasAutoCompacted,
    dismissAutoCompacted,
    canCompact,
  } = useContextCompaction({
    messages,
    setMessages,
    utilizationPercent: contextBreakdown?.utilizationPercent,
    isLoading,
  });

  const agentPhase = deriveAgentPhase(isLoading, messages);
  // Sub-agent progress state — populated when sub-agents are dispatched
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [subAgentProgress, _setSubAgentProgress] = useState<SubAgentProgress[]>([]);

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
          {models.length > 0 ? (
            <Select
              value={config.model ?? '__default__'}
              onValueChange={(v) => setConfig({ model: v === '__default__' ? undefined : v })}
            >
              <SelectTrigger className="h-7 w-auto max-w-[180px] gap-1 border-0 bg-secondary px-2 text-xs font-normal">
                <SelectValue placeholder={defaultModel ?? config.provider} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">
                  <span className="text-muted-foreground">{defaultModel} (default)</span>
                </SelectItem>
                {models.map((m) => (
                  <SelectItem key={m.model} value={m.model}>
                    {m.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary" className="text-xs font-normal">
              {config.model ?? config.provider}
            </Badge>
          )}
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
          {contextBreakdown && <ContextBar breakdown={contextBreakdown} />}
        </div>
        <div className="flex items-center gap-1">
          {canCompact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={compact}
              disabled={isCompacting}
              className="text-muted-foreground"
              title="Compact conversation history"
            >
              <Shrink className="mr-1 h-3.5 w-3.5" />
              {isCompacting ? 'Compacting...' : 'Compact'}
            </Button>
          )}
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

              {subAgentProgress.length > 0 && (
                <SubAgentProgressPanel items={subAgentProgress} />
              )}

              {isLoading && (
                <div className="flex gap-3 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                    <span className={`h-2 w-2 rounded-full ${PHASE_INDICATOR_CLASSES[agentPhase]}`} />
                    <span className="text-xs text-muted-foreground">
                      {PHASE_LABELS[agentPhase]}...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Context compaction banners */}
          {showCompactWarning && (
            <div className="flex items-center justify-between border-t bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
              <span>Context window filling up. Consider compacting the conversation.</span>
              <Button variant="ghost" size="sm" onClick={compact} disabled={isCompacting} className="h-6 px-2 text-xs">
                Compact now
              </Button>
            </div>
          )}
          {wasAutoCompacted && (
            <div className="flex items-center justify-between border-t bg-blue-500/10 px-4 py-2 text-sm text-blue-700 dark:text-blue-400">
              <span>Conversation was automatically compacted to free context space.</span>
              <Button variant="ghost" size="sm" onClick={dismissAutoCompacted} className="h-6 px-2 text-xs">
                Dismiss
              </Button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-center justify-between border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <span>{error.message}</span>
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
