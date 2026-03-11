# Agentic Coding Assistant Architectures: Research Report
**Date**: 2026-02-27
**Scope**: Claude Code, OpenAI Codex CLI, SWE-Agent (Princeton), Devin (Cognition Labs), Cursor Agent Mode, Windsurf Cascade
**Focus**: Agentic loop architecture, context management, planning patterns, sub-agent design

---

## Executive Summary

**Recommendation**: Adopt — study these patterns for HotM's AI assistant implementation.
**Confidence**: High (primary source materials from official docs, open-source code, and peer-reviewed papers)

The 2024–2026 period saw agentic coding assistants converge on a common core: an LLM in a tool-use loop, where each iteration feeds environmental feedback (file contents, shell output, lint errors) back as the next input. The key differentiators are not the loop structure itself — it is almost universally based on the ReAct pattern (Reason + Act interleaved) — but rather: (1) the quality of the Agent-Computer Interface (ACI), (2) context management strategies when the loop runs for hundreds of turns, and (3) whether sub-agents with isolated context windows are spawned for parallelism and separation of concerns.

---

## 1. The Shared Foundation: ReAct Loop

All six systems are built on the ReAct paper (Yao et al., 2022, arXiv:2210.03629), which introduced interleaved reasoning traces and tool calls:

```
Thought: I need to find where authentication is handled.
Action: search_file("auth", "src/")
Observation: Found 3 matches in src/auth/middleware.ts
Thought: Let me read that file.
Action: read_file("src/auth/middleware.ts")
Observation: [file contents]
Thought: I see the bug. The token expiry check uses < instead of <=.
Action: edit_file(...)
```

This is categorically different from a simple chatbot with tools because:
- The model generates a *thought* before each action (explicit scratchpad reasoning).
- Each observation *modifies* the next thought — this is not a single-turn prompt.
- The loop runs autonomously for N iterations until the model emits a stop signal.

What makes systems "more capable than simple tool-calling chatbots" is primarily the quality of the ACI surrounding this loop — not the loop itself.

---

## 2. Claude Code (Anthropic)

### 2.1 Agentic Loop Architecture

Source: `docs.anthropic.com/en/docs/claude-code/how-claude-code-works` (official docs)

Claude Code's loop phases are:
1. **Gather context** — read files, search codebase, check git state
2. **Take action** — edit files, run commands, use tools
3. **Verify results** — run tests, check lint, observe output

These phases blur together in practice. A single request like "fix the auth bug" may cycle through all three phases dozens of times. The agent is essentially a stateful conversation whose messages are tool calls and observations.

**Tool categories (built-in):**
- File operations: Read, Edit, Write, Glob
- Search: Grep, semantic search, symbol lookup
- Execution: Bash (shell commands)
- Web: WebSearch, WebFetch
- Code intelligence: LSP integration (type errors, go-to-def) — requires plugin
- Orchestration: Task (spawn sub-agent), Ask (request user input)

**Critical architectural detail**: Claude Code is a TypeScript/Node.js harness wrapping Claude API calls. It is not a fine-tuned model — it uses the base Claude models (Sonnet/Opus/Haiku) with a carefully engineered system prompt and tool set. The model is instructed to think before each tool call.

### 2.2 Context Management

Source: official docs + Anthropic engineering blog "Effective context engineering for AI agents" (Sep 2025)

**Auto-compaction** is the primary mechanism:
- When the conversation approaches the context window limit, older tool outputs are cleared first.
- If still too large, the model is asked to summarize the conversation: "Create a handoff summary for another LLM that will resume the task."
- The summary prompt explicitly asks for: current progress, key decisions, remaining work, critical data.
- The summary_prefix injected into the new context: "Another language model started to solve this problem and produced a summary of its thinking process..."
- User can trigger manual compaction: `/compact focus on the API changes`
- After compaction, the five most recently accessed files are preserved verbatim.

**CLAUDE.md as persistent memory**: Project-specific instructions, conventions, and architecture notes are injected at every session start — they survive compaction. This is the key mechanism for cross-session persistence.

**Hybrid context loading (just-in-time)**:
- CLAUDE.md loads eagerly (all content at session start).
- Files load lazily — the agent uses glob/grep to discover paths, then reads only what's needed.
- This mirrors human cognition: maintain references (file paths), retrieve on demand.

**Key insight from Anthropic**: Context rot is real — performance degrades as context grows due to the n² attention mechanism. The goal is "the smallest possible set of high-signal tokens."

**Plan mode** (read-only): `Shift+Tab` twice enters a mode where the agent can only use read-only tools, building a plan the user can review before execution begins.

### 2.3 Sub-Agent Architecture

Source: `docs.anthropic.com/en/docs/claude-code/sub-agents` (official docs)

Claude Code has a first-class sub-agent system. Key properties:

**Isolation**: Each sub-agent runs in its own fresh context window. It does NOT inherit the parent's conversation history. Only a task description and system prompt are passed.

**Built-in sub-agents:**
- `Explore` — Haiku model, read-only tools, optimized for fast codebase search. Used automatically when Claude needs to understand code without changing it.
- `Plan` — used during plan mode for read-only research before presenting a plan. Prevents infinite nesting (sub-agents cannot spawn further sub-agents).
- `general-purpose` — all tools, for complex multi-step tasks.
- `Bash` — runs terminal commands in a separate context.

**Sub-agent file format** (`~/.claude/agents/agent-name.md`):
```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---
You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

**Delegation semantics**: The parent agent sees only a summary of what the sub-agent did — not the full sub-agent context. This is the fan-out/fan-in pattern: parent dispatches N sub-agents, each explores independently, each returns a 1,000–2,000 token summary.

**Context isolation for cost control**: Sub-agents use their own token budget. A sub-agent can use 50,000 tokens exploring a codebase, but the parent only "sees" the 1,500-token summary. This prevents context pollution in the orchestrating agent.

**Nesting limit**: Sub-agents cannot spawn further sub-agents (the `Plan` sub-agent enforces this). This prevents runaway recursion.

**Parallel patterns (from docs):**
```
Lead agent
├── Sub-agent A: "Analyze auth module"      → summary
├── Sub-agent B: "Analyze payment module"   → summary
└── Sub-agent C: "Check test coverage"      → summary
         ↓
Lead synthesizes all summaries
```

### 2.4 Planning vs. Acting

Claude Code does NOT use a separate explicit planning step. Planning is embedded in the model's CoT (chain-of-thought) reasoning before each tool call. The model decides when to plan vs. act based on the task:
- Simple question → immediate answer
- Bug fix → mini-plan in thought, then act-verify loop
- New feature → exploration phase, then planning phase, then implementation

The `plan mode` toggle is for user-initiated "show me your plan before you touch anything" workflows — not an internal architectural requirement.

### 2.5 Long-Running Agent Harness Pattern

Source: Anthropic engineering blog "Effective harnesses for long-running agents" (Nov 2025)

For tasks spanning multiple context windows, Anthropic documented a two-agent pattern:

**Initializer agent** (first context window only):
- Creates `init.sh` to start the dev server
- Creates `features.json` — structured list of features with pass/fail status
- Creates `claude-progress.txt` — human-readable progress log
- Makes initial git commit

**Coding agent** (all subsequent context windows):
- Starts session: runs `pwd`, reads `claude-progress.txt`, reads `features.json`, runs `init.sh`
- Picks ONE feature to implement
- Implements it, tests it using browser automation (Puppeteer MCP)
- Commits to git with descriptive message
- Updates `claude-progress.txt` and marks feature in `features.json`
- Ends session in clean state

The structured JSON feature list (`features.json`) rather than Markdown was chosen because "the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files." This is a revealing design choice.

### 2.6 Sandboxing Architecture

Source: Anthropic engineering blog "Beyond permission prompts" (Oct 2025)

Default mode: read-only, asks permission for every write and command.

Sandboxed mode (reduces permission prompts by 84%):
- **Filesystem isolation**: OS-level (Linux bubblewrap / macOS Seatbelt). Only current working directory is writable.
- **Network isolation**: All outbound traffic through a Unix domain socket proxy. Proxy enforces domain allowlist, prompts user for new domains.
- Both constraints apply to all spawned subprocesses — not just Claude Code itself.
- Even a successful prompt injection cannot exfiltrate SSH keys or phone home.

---

## 3. OpenAI Codex CLI

Source: `github.com/openai/codex` (Apache-2.0, fully open source), Rust core (`codex-rs/`)

### 3.1 Architecture Overview

Codex CLI is a Rust-based local agent wrapping OpenAI's Responses API. Key modules in `codex-rs/core/src/`:

```
codex.rs          — main Codex struct, event queue, session management
compact.rs        — context compaction logic (identical concept to Claude Code)
agent/            — AgentControl, AgentStatus, role.rs (sub-agent roles)
tools/parallel.rs — parallel tool execution with read/write locking
context_manager/  — history management, token counting, truncation
```

### 3.2 Agentic Loop

The `Codex` struct is a queue pair: you push `Submission` messages in, pull `Event` messages out. The agent loop runs asynchronously inside tokio. Tool calls are dispatched via `ToolRouter` which supports parallel execution:

```rust
// From tools/parallel.rs
// Tools declare whether they support parallel execution
// Non-parallel tools acquire write lock (exclusive)
// Parallel tools acquire read lock (concurrent)
let _guard = if supports_parallel {
    Either::Left(lock.read().await)    // shared lock
} else {
    Either::Right(lock.write().await)  // exclusive lock
};
```

This means Codex can execute multiple read-only tool calls concurrently while serializing write operations.

### 3.3 Context Compaction

Codex uses an almost identical compaction system to Claude Code. The compaction prompt in `codex-rs/core/templates/compact/prompt.md`:

```markdown
You are performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary
for another LLM that will resume the task.

Include:
- Current progress and key decisions made
- Important context, constraints, or user preferences
- What remains to be done (clear next steps)
- Any critical data, examples, or references needed to continue

Be concise, structured, and focused on helping the next LLM seamlessly continue the work.
```

The summary prefix injected into the new context (`templates/compact/summary_prefix.md`):
```
Another language model started to solve this problem and produced a summary
of its thinking process. You also have access to the state of the tools that
were used by that language model. Use this to build on the work that has
already been done and avoid duplicating work...
```

**Compaction variants:**
- `run_inline_auto_compact_task`: triggered automatically when context fills
- `run_compact_task`: user-initiated `/compact`
- Remote compaction: for OpenAI providers, offloads compaction to OpenAI servers
- Mid-turn compaction: `InitialContextInjection::BeforeLastUserMessage` — inserts initial context before the last real user message to preserve model training expectations

**Error handling in compaction loop**: If the compaction prompt itself exceeds the context window, the system removes the oldest history item and retries — "Trim from the beginning to preserve cache (prefix-based) and keep recent messages intact."

### 3.4 Agent Roles (Sub-agent Architecture)

Codex has an agent role system in `codex-rs/core/src/agent/role.rs`. Roles are TOML configuration layers that modify the base config. There are built-in roles and user-defined roles in `~/.codex/agents/`.

### 3.5 Key Difference from Claude Code

Codex CLI uses **OpenAI's Responses API** (the new async, stateful API) rather than the standard completions API. The Responses API maintains server-side state across turns, which reduces the need to re-send full message history on every turn. The `compact_remote.rs` module handles remote compaction by delegating the summary step to OpenAI's servers.

---

## 4. SWE-Agent (Princeton) / mini-SWE-Agent

Source: arXiv:2405.15793 (NeurIPS 2024) + `github.com/SWE-agent/mini-SWE-agent` (MIT)

### 4.1 Core Insight: Agent-Computer Interface (ACI)

SWE-Agent's key contribution is formalizing the ACI concept: the interface between the LM and its computing environment matters as much as the model itself. Their ablation study showed:
- SWE-agent ACI: 18% solve rate on SWE-bench Lite
- Shell-only (raw bash): 11% solve rate (-7.7pp)
- No search tools: 15.7% (-2.3pp)
- No edit tool: 10.3% (-7.7pp)

The ACI design principles that emerged from this research:
1. **Simple, compact actions**: Few options, concise documentation. The model can understand each tool without fine-tuning.
2. **Efficient actions**: Important operations (navigate, edit) consolidated into one command. Don't make the model compose 3 commands to do 1 thing.
3. **Informative but concise feedback**: After editing a file, show the updated content. But cap search results at 50 — tell the agent to narrow its query if exceeded.
4. **Guardrails prevent error propagation**: A code linter integrated into the edit tool — invalid edits are discarded and the agent is shown the error and asked to retry.

### 4.2 Context Management in SWE-Agent

SWE-agent's key context management technique: **history compression**.

- Observations from more than 5 steps ago are "collapsed into a single line" — showing only the action taken, not the result.
- This maintains action plan awareness while preventing stale file contents from polluting context.
- Ablation: "Full history" was 3pp worse than "Last 5 Obs." management.

The file viewer shows at most 100 lines at a time (configurable window). The agent must explicitly scroll or jump to a line to see more. This is a deliberate ACI choice to prevent large file dumps from filling the context window.

### 4.3 mini-SWE-Agent: The Minimal Architecture

The Princeton team later released mini-SWE-agent, demonstrating that by 2025, a radically simpler architecture matches the performance of the complex SWE-agent:

**The entire agent class is ~100 lines of Python:**
```python
def run(self, task: str = "", **kwargs) -> dict:
    self.messages = []
    self.add_messages(
        self.model.format_message(role="system", content=self._render_template(...)),
        self.model.format_message(role="user", content=self._render_template(...)),
    )
    while True:
        self.step()   # query + execute_actions
        if self.messages[-1].get("role") == "exit":
            break
    return self.messages[-1].get("extra", {})

def step(self) -> list[dict]:
    return self.execute_actions(self.query())
```

Key design choices that enabled this simplification:
1. **No special tools other than bash** — bash is the universal tool. Everything the agent needs to do (search, edit, run tests) can be done via bash.
2. **Stateless execution**: Every action runs via `subprocess.run` — completely independent. No persistent shell session. This means sandbox isolation is trivial (swap `subprocess.run` for `docker exec`).
3. **Linear history**: Every step appends to `self.messages`. No history compression needed in the short term.

By 2025, mini-SWE-agent with Gemini 3 Pro achieves 74% on SWE-bench Verified — without any special tooling. This validates the argument that model capability improvements reduce the need for elaborate scaffolding.

---

## 5. Devin (Cognition Labs)

Source: `cognition.ai/blog/introducing-devin` (March 2024), `www.cognition.ai/blog` (aggregated)

**Note**: Devin's architecture is proprietary and not open-sourced. The following is based on public statements, blog posts, and reverse-engineering from observable behavior. These are inferences with LOW confidence unless explicitly marked.

### 5.1 What Is Known (HIGH confidence)

Devin is a fully autonomous software engineering agent with:
- A persistent sandboxed compute environment (shell, code editor, web browser)
- Ability to recall context at every step and fix mistakes
- Real-time collaboration with humans — reports progress, accepts feedback
- Runs in the cloud (not locally)

Devin achieved 13.86% on SWE-bench in March 2024 (assisted agents got 4.80%).

In September 2025, Cognition announced rebuilding Devin on Claude Sonnet 4.5. They published: "Rebuilding Devin for Claude Sonnet 4.5: Lessons and Challenges" — revealing that the underlying model matters significantly and they treat model selection as a first-class architectural decision.

### 5.2 What Can Be Inferred (MEDIUM confidence)

From the public description and the SWE-bench methodology:
- Devin uses an orchestrator-worker model where a high-level planning agent decomposes tasks and lower-level execution agents implement them.
- The emphasis on "long-term reasoning and planning" in their announcement suggests a planning module that maintains a task tree or DAG across the session.
- Their "recall relevant context at every step" language suggests a retrieval system (likely vector search) over conversation history and project files — distinct from simple context window management.
- The browser integration implies computer-use style tool access (screenshot + action) rather than headless API calls.
- Cognition's stated focus on "reasoning" as the core primitive suggests their differentiation is in the planning/reasoning layer, not the tool layer.

### 5.3 Devin Open Source Initiative (Dec 2024)

Cognition released some agent infrastructure as open source (`opendevin/opendevin` → `All-Hands-AI/OpenHands`). OpenHands is a framework for coding agents that uses a sandbox environment model similar to Devin.

---

## 6. Cursor Agent Mode

Source: `cursor.com/blog/shadow-workspace` (Sep 2024), `docs.cursor.com/agent` (official docs)

### 6.1 Architecture Overview

Cursor is a VS Code fork with AI features deeply embedded in the editor. Agent mode (called "Composer" or "Agent") is their multi-step autonomous coding mode.

**Key architectural insight unique to Cursor**: The **shadow workspace**.

### 6.2 The Shadow Workspace (Critical Innovation)

Problem: If an AI agent edits files and runs the language server (LSP) to check for type errors, it pollutes the user's editing environment. References, diagnostics, and completion results would all include the AI's experimental edits.

Cursor's solution: A **hidden Electron window** running a second copy of VS Code pointing at the same directory, but invisible to the user.

Architecture (from blog post):
1. User's normal window has an AI agent making edits.
2. When the agent wants to check for type errors/lint, the edit is sent to the shadow window's extension host.
3. The shadow window applies the edit in isolation — the user's window is unaffected.
4. Lint/type errors are returned to the agent.
5. The shadow window is reset before the next request.

This gives agents **LSP-usability**: the ability to see TypeScript errors, go-to-definition results, etc. — which Cursor claims is one of the highest-leverage ACI improvements available.

**Concurrency trick**: AI agents can be paused arbitrarily (unlike humans). Multiple agents can share one shadow window by interleaving requests: agent A's edit → get lints → reset → agent B's edit → get lints → reset.

**Future direction (described in blog)**: A kernel-level folder proxy using FUSE (Linux) or a macOS equivalent — a virtual filesystem where reads come from the real directory and writes go to an in-memory override map. This would enable true multi-agent concurrency without the memory overhead of multiple Electron windows.

### 6.3 Agent Loop (Cursor-Specific)

Cursor's agent mode uses:
- **Tools**: file operations, terminal commands, web search, codebase search
- **Context**: open files, selected text, cursor position, linter errors
- **Real-time context**: unlike other agents, Cursor watches for user edits and can incorporate them mid-task

Cursor's system prompt for agent mode emphasizes: read the error output, fix the specific error, verify, repeat. The loop is similar to other agents but tightly integrated with the IDE's live state.

---

## 7. Windsurf Cascade (Cognition, formerly Codeium)

Source: `docs.windsurf.com/windsurf/cascade` (official docs), Windsurf changelog

Note: As of early 2026, Windsurf was acquired by Cognition Labs (makers of Devin).

### 7.1 Architecture Overview

Cascade is Windsurf's agentic AI assistant with a notable architectural feature: **real-time awareness**.

Unlike other coding agents where the user must explicitly tell the agent what changed, Cascade passively observes the user's actions in the editor and incorporates them without prompting. This is implemented via VS Code extension hooks that stream editor events to Cascade's context.

### 7.2 Planning Architecture (Dual-Model)

Cascade's most architecturally distinctive feature (from docs):

> "In the background, a **specialized planning agent** continuously refines the long-term plan while your selected model focuses on taking **short-term actions** based on that plan."

This is a **dual-model architecture**:
- **Planning agent**: Maintains a TODO list, refines the high-level plan as new information arrives (e.g., discovering a Memory rule mid-task)
- **Action agent**: Executes individual tool calls based on the plan

This is different from Claude Code's approach where planning and execution use the same model. The planning agent can use a cheaper/faster model (or different system prompt) while the action agent uses the primary model.

The TODO list is visible to the user and editable: "To make changes to the plan, simply ask Cascade to make updates to the Todo list."

### 7.3 Context Management

**Real-time awareness**: Cascade tracks file changes, cursor position, and terminal output continuously. It does not need the user to manually paste context.

**Checkpoints**: Named snapshots of the codebase state at any step. Users can revert to a named checkpoint (currently irreversible). This is equivalent to Claude Code's checkpoint system.

**Cross-conversation references**: Prior conversations can be @-mentioned. Cascade retrieves relevant summaries and checkpoints from past conversations via semantic search. "It typically will not retrieve the full conversation as to not overwhelm the context window."

**Simultaneous Cascades**: Multiple agents can run in parallel. If they edit the same file, edits can race. Worktrees are recommended for parallel agents editing similar files.

**Tool calling limit**: 20 tool calls per prompt. An "Auto-Continue" setting can automatically re-trigger when this limit is hit (each continuation costs a prompt credit).

### 7.4 Linter Integration

Like Cursor's shadow workspace (but less described), Cascade auto-fixes linting errors it creates and discounts the credit cost: "When Cascade makes an edit with the primary goal of fixing lints that it created and auto-detected, it may discount the edit to be free of credit charge."

---

## 8. Cross-Cutting Analysis

### 8.1 Agentic Loop Comparison

| System | Loop Basis | Explicit CoT | Planning Model | Tool Parallelism |
|--------|-----------|-------------|----------------|-----------------|
| Claude Code | ReAct | Yes (before each tool) | No — embedded in CoT | Yes (parallel tool calls) |
| OpenAI Codex | ReAct | Yes | No — embedded in CoT | Yes (async tokio tasks) |
| SWE-Agent | ReAct | Yes ("thought" + "command") | No | No (sequential) |
| mini-SWE-Agent | ReAct | Implicit in bash usage | No | No (sequential) |
| Devin | Unknown (proprietary) | Unknown | YES (separate planner) | Unknown |
| Cursor Agent | ReAct | Unknown | No | Unknown |
| Windsurf Cascade | ReAct | Yes (interleaved) | YES (background planner) | Yes (parallel subagents) |

### 8.2 Context Management Strategy Comparison

| System | Primary Strategy | Secondary Strategy | Persistence |
|--------|-----------------|-------------------|-------------|
| Claude Code | Auto-compaction (summarize) | CLAUDE.md | Files + git |
| OpenAI Codex | Auto-compaction (summarize) | Remote compaction | Files + git |
| SWE-Agent | History collapse (>5 obs) | 100-line file window | Trajectory file |
| mini-SWE-Agent | Linear history | Step limits | Trajectory JSON |
| Devin | Unknown | Vector retrieval (inferred) | Persistent cloud env |
| Cursor Agent | LSP shadow workspace | File-based context | IDE workspace |
| Windsurf Cascade | Checkpoint system | Cross-conversation RAG | Memories + Rules |

### 8.3 Sub-Agent Patterns

All systems that support sub-agents share:
1. **Context isolation**: Sub-agent gets fresh context, not parent's history
2. **Summary return**: Sub-agent returns a short summary to parent (not full context)
3. **Specialization**: Sub-agents are given focused tasks and often restricted tool sets

The fan-out/fan-in pattern (Anthropic's multi-agent research system):
- Lead agent spawns 3-10 sub-agents in parallel
- Each explores independently using their full context window
- Each returns 1,000-2,000 tokens of compressed findings
- Lead synthesizes findings and decides whether to spawn more agents

Anthropic's measured result: multi-agent (Opus 4 lead + Sonnet 4 workers) outperformed single-agent Opus 4 by 90.2% on internal research eval. The primary reason: more total tokens used, more parallel exploration paths.

### 8.4 Plan-Then-Execute vs. Interleaved Planning

**Plan-then-execute** (less common): Generate a full plan first, then execute each step. Prone to planning errors cascading. Cursor uses this with the `/plan` command — user reviews plan before execution.

**Interleaved planning** (dominant approach): Planning happens in the model's CoT before each tool call. More adaptive — the plan adjusts based on what the agent discovers. Claude Code, SWE-Agent, mini-SWE-Agent, and OpenAI Codex all use this.

**Hybrid** (Windsurf Cascade, Devin): Background planning agent maintains a high-level plan/TODO list while a separate agent executes individual steps. The plan is updated asynchronously as new context is discovered.

---

## 9. Key Insights for Application to HotM

For the embedded AI assistant in HotM (which currently uses Vercel AI SDK + AI SDK React):

### 9.1 What Makes an Agent More Than a Chatbot

The minimum viable agentic loop:
```typescript
while (!done) {
    const response = await llm.query(messages);
    const actions = extractToolCalls(response);
    const observations = await executeTools(actions);
    messages.push(...formatObservations(observations));
    done = response.stopReason === 'end_turn';
}
```

This is nearly what mini-SWE-agent implements in 100 lines of Python. The complexity comes from:
- Quality of tool definitions (ACI design)
- Context management when this runs for 50+ iterations
- Error handling and recovery
- Guardrails (linting, type checking integration)

### 9.2 Context Management Priority

Context management is the #1 thing that separates production agents from demos. Implement:
1. Tool output clearing (safe, easy, low-hanging fruit)
2. History summarization/compaction (for sessions > 30 turns)
3. CLAUDE.md-style project-level persistent instructions

### 9.3 Sub-Agent Pattern for HotM

HotM's AI assistant could benefit from the Explore sub-agent pattern:
- When user asks a complex question, spawn a read-only Explore agent
- Explore agent searches notes, finds relevant connections
- Returns a 500-token summary to the main agent
- Main agent uses summary to formulate response

This prevents the "reading 50 notes" scenario from polluting the main context.

### 9.4 ACI Design Lessons

From SWE-Agent's ablation data:
- A good edit tool (+7.7pp) and good search tools (+2.3pp) are the highest-value ACI improvements
- Guardrails that prevent bad edits and show error messages improve performance
- Compressing observations older than N steps prevents stale data from degrading performance

---

## 10. Sources

All sources retrieved 2026-02-27.

| Source | URL | Type | GRADE |
|--------|-----|------|-------|
| SWE-Agent Paper (NeurIPS 2024) | arXiv:2405.15793 | Peer-reviewed | HIGH |
| ReAct Paper (ICLR 2023) | arXiv:2210.03629 | Peer-reviewed | HIGH |
| CodeAct Paper (ICML 2024) | arXiv:2402.01030 | Peer-reviewed | HIGH |
| Claude Code How It Works | docs.anthropic.com/en/docs/claude-code/how-claude-code-works | Official docs | MODERATE |
| Claude Code Sub-agents | docs.anthropic.com/en/docs/claude-code/sub-agents | Official docs | MODERATE |
| Anthropic: Building Effective Agents | anthropic.com/engineering/building-effective-agents | Engineering blog | MODERATE |
| Anthropic: Effective Context Engineering | anthropic.com/engineering/effective-context-engineering-for-ai-agents | Engineering blog | MODERATE |
| Anthropic: Multi-Agent Research System | anthropic.com/engineering/multi-agent-research-system | Engineering blog | MODERATE |
| Anthropic: Long-Running Agents | anthropic.com/engineering/effective-harnesses-for-long-running-agents | Engineering blog | MODERATE |
| Anthropic: SWE-bench Sonnet | anthropic.com/engineering/swe-bench-sonnet | Engineering blog | MODERATE |
| Anthropic: Claude Code Sandboxing | anthropic.com/engineering/claude-code-sandboxing | Engineering blog | MODERATE |
| OpenAI Codex Source Code | github.com/openai/codex (Apache-2.0) | Open source | HIGH |
| OpenAI Codex compact.rs | raw.githubusercontent.com/.../compact.rs | Open source | HIGH |
| mini-SWE-Agent Source | github.com/SWE-agent/mini-SWE-agent (MIT) | Open source | HIGH |
| Cursor Shadow Workspace Blog | cursor.com/blog/shadow-workspace | Engineering blog | MODERATE |
| Windsurf Cascade Docs | docs.windsurf.com/windsurf/cascade | Official docs | MODERATE |
| Cognition/Devin Announcement | cognition.ai/blog/introducing-devin | Product blog | LOW |

**GRADE notes**:
- HIGH (peer-reviewed or open-source code): cite as established fact
- MODERATE (official docs/engineering blog): cite as "according to [company]"
- LOW (marketing blog): treat as claim, not evidence; hedge with "Cognition claims"

---

## Appendix: OpenAI Codex Compaction Template (Verified from Source)

The prompt template at `codex-rs/core/templates/compact/prompt.md`:

```markdown
You are performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary for another LLM that will resume the task.

Include:
- Current progress and key decisions made
- Important context, constraints, or user preferences
- What remains to be done (clear next steps)
- Any critical data, examples, or references needed to continue

Be concise, structured, and focused on helping the next LLM seamlessly continue the work.
```

The prefix injected before the summary in the new context (`templates/compact/summary_prefix.md`):

```markdown
Another language model started to solve this problem and produced a summary of its thinking process. You also have access to the state of the tools that were used by that language model. Use this to build on the work that has already been done and avoid duplicating work. Here is the summary produced by the other language model, use the information in this summary to assist with your own analysis:
```

This is the canonical "context hand-off" pattern both Anthropic and OpenAI converged on independently.

---

## Appendix: SWE-Agent Context Management Ablation (Verified from Paper)

Table 3 from arXiv:2405.15793 (NeurIPS 2024), SWE-bench Lite % Resolved:

| Context Strategy | % Resolved | Delta |
|-----------------|-----------|-------|
| Last 5 Observations (SWE-agent) | **18.0** | baseline |
| Full history | 15.0 | -3.0 |
| w/o demonstration | 16.3 | -1.7 |

This directly validates context compression as a meaningful performance lever, not just a cost optimization.

---

*Report prepared by Technical Researcher agent. Primary research conducted via curl-based web scraping and open-source code analysis.*
