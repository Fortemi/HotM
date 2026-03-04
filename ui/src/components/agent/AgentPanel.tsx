/**
 * AgentPanel — main agent chat interface.
 *
 * Renders as a full-width view within HallOfMind's content area.
 * All providers route through useAgentChat (AI SDK streaming + client-side tools).
 * The agent-proxy handles LLM streaming; tool execution happens in-browser
 * against the Fortemi API.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Bot, Plus, Shield, ShieldCheck, ShieldOff, Settings2, Shrink, History } from "lucide-react";
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
import { useSessionManager } from "./useSessionManager";
import { SessionPanel } from "./SessionPanel";
import { ExportMenu } from "./ExportMenu";
import { SaveAsNoteButton } from "./SaveAsNoteButton";
import { LoadFromNoteButton } from "./LoadFromNoteButton";
import { useJobStore } from "@/hooks/useJobStore";
import "./print-styles.css";
import "./agent-busy.css";
import type { AgentContext } from "./useAgent";
import type { SubAgentProgress } from "./sub-agent";
import type { PrivilegeMode } from "./privileges";

interface AgentPanelProps {
  context?: AgentContext;
  onNoteClick?: (noteId: string) => void;
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

export function AgentPanel({ context, onNoteClick }: AgentPanelProps) {
  const { config, setConfig } = useAgentConfig();
  const { queueStatus } = useJobStore();
  const isSystemBusy = queueStatus.pending > 0;
  const { mode, setMode, pending, resolveConfirmation } = useAgentPrivileges();
  const [showSettings, setShowSettings] = useState(false);
  const [autoFocusKey, setAutoFocusKey] = useState(0);

  const handleResolveConfirmation = useCallback(
    (decision: 'allow' | 'allow-remember' | 'deny') => {
      resolveConfirmation(decision);
      setAutoFocusKey((k) => k + 1);
    },
    [resolveConfirmation],
  );
  const { models, defaultModel } = useChatModels(config.provider);

  const sessionManager = useSessionManager({
    provider: config.provider,
    model: config.model,
  });

  const { messages, isLoading, error, sendMessage, clearMessages, clearError, setMessages } =
    useAgentChat({ config, context });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore last active session messages on mount
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      const restored = sessionManager.restoreMessages();
      if (restored.length > 0) {
        setMessages(restored);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save messages to active session (debounced inside hook)
  useEffect(() => {
    if (messages.length > 0) {
      sessionManager.saveMessages(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleSwitchSession = useCallback(
    (id: string) => {
      const msgs = sessionManager.switchSession(id);
      setMessages(msgs);
      sessionManager.setShowPanel(false);
    },
    [sessionManager, setMessages],
  );

  const handleNewSession = useCallback(() => {
    sessionManager.newSession();
    clearMessages();
    sessionManager.setShowPanel(false);
  }, [sessionManager, clearMessages]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      const nextMsgs = sessionManager.deleteSession(id);
      setMessages(nextMsgs);
    },
    [sessionManager, setMessages],
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const msg = messages[idx];
      let filtered: typeof messages;
      if (msg.role === 'user') {
        // Delete user message and its paired assistant response (next message)
        const nextIsAssistant =
          idx + 1 < messages.length && messages[idx + 1].role === 'assistant';
        filtered = messages.filter(
          (_, i) => i !== idx && !(nextIsAssistant && i === idx + 1),
        );
      } else {
        filtered = messages.filter((_, i) => i !== idx);
      }
      setMessages(filtered);
    },
    [messages, setMessages],
  );

  const handleRegenerateMessage = useCallback(
    async (assistantMessageId: string) => {
      const idx = messages.findIndex((m) => m.id === assistantMessageId);
      if (idx < 0) return;
      // Find the preceding user message
      let userIdx = idx - 1;
      while (userIdx >= 0 && messages[userIdx].role !== 'user') {
        userIdx--;
      }
      if (userIdx < 0) return;
      const userText = messages[userIdx].parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join('\n');
      if (!userText) return;

      // Fork the current session (preserves all messages)
      sessionManager.forkSession(messages);

      // Truncate messages to everything before the assistant message
      const truncated = messages.slice(0, idx);
      setMessages(truncated);

      // Re-send the user message
      await sendMessage(userText);
    },
    [messages, setMessages, sendMessage, sessionManager],
  );

  const handleLoadFromNote = useCallback(
    (restoredMessages: import('@ai-sdk/react').UIMessage[], sessionName: string) => {
      // Create a new named session and populate it with restored messages
      sessionManager.createSession(sessionName);
      setMessages(restoredMessages);
    },
    [sessionManager, setMessages],
  );

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
              onClick={() => {
                // Start a new session (preserving the old one in storage)
                sessionManager.newSession();
                clearMessages();
              }}
              className="text-muted-foreground"
              title="Start a new session (current session is saved)"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          )}
          <SaveAsNoteButton
            messages={messages}
            sessionName={sessionManager.activeSession?.name}
          />
          <ExportMenu
            messages={messages}
            sessionName={sessionManager.activeSession?.name}
          />
          <LoadFromNoteButton
            onLoad={handleLoadFromNote}
            disabled={isLoading}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => sessionManager.setShowPanel(true)}
            className="relative text-muted-foreground"
            title="Session history"
          >
            <History className="h-4 w-4" />
            {sessionManager.sessions.length > 1 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-medium text-primary-foreground">
                {sessionManager.sessions.length}
              </span>
            )}
          </Button>
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
              {messages.length === 0 && isSystemBusy ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="agent-busy-icon mb-4">
                    <Bot className="h-12 w-12 text-amber-500/70" />
                  </div>
                  <h3 className="text-base font-medium text-muted-foreground">
                    Working on your notes...
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">
                    Processing {queueStatus.running} job{queueStatus.running !== 1 ? 's' : ''}{queueStatus.pending > 0 ? `, ${queueStatus.pending} waiting` : ''}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground/50">
                    Chat is disabled while threads are in use
                  </p>
                </div>
              ) : messages.length === 0 ? (
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
                messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onDelete={handleDeleteMessage}
                    onRegenerate={handleRegenerateMessage}
                    onNoteClick={onNoteClick}
                  />
                ))
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
              onResolve={handleResolveConfirmation}
            />
          )}

          {/* Input */}
          <ChatInput onSend={sendMessage} isLoading={isLoading} autoFocusKey={autoFocusKey} isSystemBusy={isSystemBusy} />
        </>
      )}

      {/* Session history panel */}
      <SessionPanel
        sessions={sessionManager.sessions}
        activeSessionId={sessionManager.activeSession?.id ?? null}
        onSwitchSession={handleSwitchSession}
        onNewSession={handleNewSession}
        onRenameSession={sessionManager.renameSession}
        onDeleteSession={handleDeleteSession}
        onClose={() => sessionManager.setShowPanel(false)}
        open={sessionManager.showPanel}
      />
    </div>
  );
}
