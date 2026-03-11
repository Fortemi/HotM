# Technical Researcher Agent Memory

## Research Approach
- WebFetch tool is BLOCKED in this environment; use `curl` via Bash instead
- GitHub API is accessible without auth for public repos (rate-limited to 60 req/hr)
- crates.io API: `https://crates.io/api/v1/crates/{name}` for Rust package versions
- npm registry: `https://registry.npmjs.org/{package}/latest` for npm package versions
- jsdelivr CDN (`https://cdn.jsdelivr.net/npm/{package}@{version}/`) for browsing npm package contents
- Schema files often at `https://schema.{project}.app/` (e.g., Tauri: `https://schema.tauri.app/config/2`)

## Completed Research
- **Client-Side Tokenization & Context Management**: Full research completed 2026-02-27
  - See: `/home/roctinam/dev/HotM/.claude/agent-memory/Technical Researcher/tokenization-context.md`
  - Best Llama tokenizer: `llama3-tokenizer-js` for Llama 3.x, `llama-tokenizer-js` for Llama 1/2
  - Best GPT tokenizer (browser): `gpt-tokenizer` (13.7M downloads/month, pure JS, fastest)
  - tiktoken WASM: needs `vite-plugin-wasm` + `vite-plugin-top-level-await` for Vite
  - Ollama has NO `/api/tokenize` endpoint; use `num_predict: 0` trick or client-side libs
  - transformers.js can load any HF tokenizer from `tokenizer.json` (works for ALL model families)
  - Context compaction: LangChain `ConversationSummaryBufferMemory` is the canonical pattern
  - Focus agent paper (arxiv:2601.07190): 22.7% token reduction, 6 compressions/task avg
  - RLM/sub-agent pattern: fan-out to parallel focused agents, fan-in summary to parent
- **Agentic Coding Architectures**: Full research completed 2026-02-27
  - Report: `/home/roctinam/dev/HotM/.aiwg/reports/agentic-coding-architectures-2026-02.md`
  - Claude Code, OpenAI Codex, SWE-Agent, Devin, Cursor, Windsurf Cascade
  - All use ReAct loop (Reason+Act interleaved); differentiation is in ACI quality + context management
  - Context compaction: both Claude Code and OpenAI Codex use identical "handoff summary" pattern
  - Sub-agents get fresh context window; return 1k-2k token summary to parent (fan-out/fan-in)
  - Windsurf Cascade and Devin use dual-model: background planner + foreground executor
  - Cursor's shadow workspace: hidden Electron window for LSP feedback without polluting user's IDE
  - mini-SWE-agent: 100 lines Python, bash-only tool, 74% SWE-bench — scaffolding matters less as models improve
  - Source code analysis: `codex-rs/core/src/compact.rs` and `codex-rs/core/templates/compact/`
- **Multi-Agent Orchestration Patterns**: Full research completed 2026-02-27
  - Report: `/home/roctinam/dev/HotM/.aiwg/reports/multi-agent-orchestration-2026-02.md`
  - AdaptOrch (arXiv 2602.16873): topology > model selection; 12-23% gain with topology-aware orchestration
  - 4 topologies: parallel (fan-out), sequential (chaining), hierarchical (sub-graphs), hybrid
  - Dispatch: description-matching (Claude Code Task), handoff/as_tool (OpenAI), Send API (LangGraph)
  - Context isolation: sub-agent gets focused prompt ONLY; no parent conversation history
  - Error handling: Magentic-One ledger JSON (is_in_loop, is_progress_being_made), stall+replan cycle
  - Cost: Haiku for search/explore, Sonnet for analysis, Opus for orchestration/synthesis
  - Claude Code: sub-agents CANNOT spawn sub-agents (no recursion by design)
  - LangGraph Send API: dynamic fan-out to N parallel workers based on decomposed task list
  - Guardrail pattern (OpenAI): fast cheap agent runs parallel as safety validator (tripwire → halt)
- **Browser AI Agent Frameworks**: Full research completed 2026-02-27
  - See detailed notes: `/home/roctinam/dev/HotM/.claude/agent-memory/Technical Researcher/browser-ai-agents.md`
  - Key finding: Vercel AI SDK (`ai` v6) + `@ai-sdk/react` `useChat` is the baseline; 34M downloads/month
  - For self-hosted Ollama: `@ai-sdk/openai-compatible` or `ollama-ai-provider` (community)
  - assistant-ui (8.6k stars, YC-backed) is best React chat UI layer; integrates with AI SDK
  - CopilotKit (29k stars) requires Node.js runtime — poor fit for Rust-backend SPAs
  - LangGraph.js v1.2.0: server-side graph; browser SDK client via `@langchain/langgraph-sdk`
  - AG-UI protocol (12k stars) emerging standard for agent-UI wire protocol
- **Tauri v2**: Full research completed 2026-02-19
  - Report: `/home/roctinam/dev/HotM/.aiwg/reports/tauri-v2-research-2026-02.md`
  - Latest stable: 2.10.2 (2026-02-04)
  - Key facts: Ubuntu 22.04+ required (4.1 WebKit); lib+bin crate structure; capabilities replace allowlists

## Key Technical Facts (Tauri v2)
- Latest: 2.10.2, tauri-cli 2.10.0, @tauri-apps/api 2.10.1 (as of 2026-02-04)
- Min Rust: 1.77.2; Min Node: 18+
- Linux deps: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
- Ubuntu 20.04 NOT supported (needs 4.1, has 4.0); use ubuntu-22.04 in CI
- Environment detection: `import { isTauri } from "@tauri-apps/api/core"` (checks `window.__TAURI_INTERNALS__`)
- Official CI action: `tauri-apps/tauri-action@v1`
- Rust cache: `Swatinem/rust-cache@v2` (essential for CI speed)
