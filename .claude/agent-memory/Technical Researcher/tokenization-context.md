# Tokenization & Context Management Research Notes
# Researched: 2026-02-27

## Client-Side Tokenizer Libraries (npm, as of 2026-02-27)

### For Llama-family models
| Package | Version | Downloads/month | Notes |
|---------|---------|-----------------|-------|
| `llama-tokenizer-js` | 1.2.2 | 54k | Llama 1 + 2 only, BPE in JS, 670KB bundle |
| `llama3-tokenizer-js` | 1.2.0 | 12k | Llama 3.x (3.0, 3.1, 3.2, 3.3), 3MB bundle |
| `@huggingface/transformers` | 3.8.1 | 1.5M | Covers all models via tokenizer.json; large bundle |

### For OpenAI-format models (used by some Ollama models)
| Package | Version | Downloads/month | Notes |
|---------|---------|-----------------|-------|
| `tiktoken` | 1.0.22 | 3.8M | WASM, needs vite-plugin-wasm for Vite |
| `@dqbd/tiktoken` | 1.0.22 | 631k | Same as tiktoken (legacy package name) |
| `js-tiktoken` | 1.0.21 | 13.7M | Pure JS port, no WASM, fastest option |
| `gpt-tokenizer` | 3.4.0 | 1.76M | Pure JS, fastest browser tokenizer, supports GPT-5 |

## Ollama API - No Native Tokenize Endpoint
- Ollama has NO `/api/tokenize` endpoint (routes as of 2026-02: generate, chat, embed, show, etc.)
- Token counting workaround 1: `POST /api/generate` with `options.num_predict: 0`, read `prompt_eval_count` from response
- Token counting workaround 2: Use client-side tokenizer matching the model family
- `POST /api/show` returns `model_info["llama.context_length"]` and tokenizer metadata (merges, vocab) when `verbose: true`
- `model_info["tokenizer.ggml.model"]` reveals tokenizer type (e.g., "gpt2" for Llama 3 BPE)

## transformers.js for Universal Tokenization
- Package: `@huggingface/transformers` v3.8.1 (15.5k GitHub stars, actively maintained)
- Can load ANY HuggingFace model tokenizer from just the `tokenizer.json` file (no model weights needed)
- Usage pattern:
  ```typescript
  import { AutoTokenizer } from '@huggingface/transformers';
  const tokenizer = await AutoTokenizer.from_pretrained('meta-llama/Llama-3.2-3B');
  const tokens = tokenizer.encode("Hello world");
  console.log(tokens.length);
  ```
- Downloads model tokenizer config from HF Hub on first use, caches locally
- Works browser-side but downloads ~1-3MB tokenizer.json per model family
- Supported model families: Llama, Qwen2, Gemma, Falcon, Mistral, GPT-2, etc.

## Context Window Compaction Strategies

### 1. Claude Code's /compact Approach
- Triggered: auto-compact at ~80% context usage (warning), blocks at ~98%
- Mechanism: calls Anthropic API with conversation history, gets a summary
- Summary replaces history; system prompt + summary + recent messages continue
- Key fix noted (2.x): "Fixed compaction failing when conversation contains PDF documents"
- Manual: `/compact` slash command; auto-compact can be disabled

### 2. LangChain ConversationSummaryBufferMemory Pattern (canonical reference)
- `maxTokenLimit` (default: 2000) - when buffer exceeds this, prune oldest messages
- Pruned messages get summarized via LLM into `movingSummaryBuffer`
- Buffer = [SystemMessage(summary), ...recent messages]
- Token counting uses LLM's own `getNumTokens()` method
- Full implementation: `langchain-classic/src/memory/summary_buffer.ts`

### 3. Focus Agent Pattern (arxiv:2601.07190, Jan 2026)
- Agent-controlled compression, not external
- Agent consolidates key learnings into persistent "Knowledge" block
- Actively withdraws (prunes) raw interaction history
- Results: 22.7% token reduction (14.9M -> 11.5M), 6 compressions/task avg
- Up to 57% savings on individual instances
- Uses Claude Haiku 4.5 for compression decisions

### 4. Progressive Context Compression (Stingy Context, arxiv:2601.19929)
- 18:1 compression ratio for code contexts
- Tree-based hierarchical compression
- 239k tokens -> 11k tokens while preserving task fidelity
- 94-97% success across 12 frontier models

### 5. Hierarchical Merging (arxiv:2502.00977)
- For very long texts (>100K tokens)
- Break into chunks, summarize each, merge summaries
- Problem: amplifies hallucinations
- Solution: augment with source context (replace/refine/align)
- Refinement + extractive summarization = best results

## Context Window Tracking UI Patterns

### Token Budget Allocation (typical split)
- System prompt: typically 1k-4k tokens (fixed, known)
- Chat history: variable, tracked via compaction
- Response reserve: 512-2048 tokens (depends on max_tokens setting)
- Available for user input: context_window - system - history - reserve

### Getting Token Counts
1. From API response: `usage.inputTokens`, `usage.outputTokens` (Anthropic/OpenAI format)
2. Vercel AI SDK: `result.usage.then(u => u.inputTokens + u.outputTokens)`
3. Ollama: `prompt_eval_count` + `eval_count` from response body
4. Client-side estimate: count locally with matching tokenizer

### UI Patterns
- Claude Code: "Context remaining: X%" in status bar
- Progress bar showing: [System Prompt | History | Available]
- Warning threshold: 80% used
- Block threshold: 98% used
- `context_window.used_percentage` available in Claude Code status line JSON

## Recursive Language Model (RLM) / Sub-Agent Context Pattern

### Concept
- Parent orchestrator spawns focused sub-agents for specific tasks
- Each sub-agent gets minimal, curated context window
- Prevents "context pollution" from unrelated prior work
- Sub-agents return 1k-2k token summaries to parent (fan-out/fan-in)

### Key Papers
- arxiv:2507.17061 (2025-07): "Parallelism Meets Adaptiveness" - dynamic task routing, bidirectional feedback, parallel agent evaluation
- arxiv:2507.08944 (2025-07): "Optimizing Sequential Multi-Step Tasks with Parallel LLM Agents"
- arxiv:2503.07675 (2025-03): "DynTaskMAS" - dynamic task graph for async/parallel multi-agent systems
- arxiv:2502.14563 (2025-02): "Plan-over-Graph" - parallelizable agent scheduling

### LangChain MapReduce Implementation
- `loadSummarizationChain(model, { type: "map_reduce" })` is the canonical implementation
- Split -> map (summarize chunks in parallel) -> reduce (merge summaries)
- Available in `langchain-classic/src/chains/question_answering/`

### The "Lost in the Middle" Problem (arxiv:2307.03172)
- Models perform best on info at START or END of context
- Middle content recall degrades significantly
- Motivation for sub-agent decomposition: each gets only START/END context
- Solution: hierarchical/parallel agents where each has <8K focused context

## Practical Implementation Recommendations for HotM

### For Ollama token counting in browser
1. Use `llama3-tokenizer-js` for Llama 3.x models (most popular with Ollama)
2. Fall back to character-based estimate: `Math.ceil(text.length / 3.5)` (~20% error)
3. For the most accurate, post-response: read `prompt_eval_count` from Ollama response body

### For context window tracking
1. Store rolling token count per message in chat state
2. On each message: estimate = sum of all message token counts + system prompt tokens
3. Show percentage bar: `(estimated / model_context_window) * 100`
4. Model context window: from `POST /api/show` -> `model_info["llama.context_length"]`
5. Trigger compaction warning at 75%, auto-compact at 90%

### For context compaction
1. Keep last N messages (recent = high fidelity)
2. Send all older messages to LLM with prompt: "Summarize this conversation history"
3. Replace older messages with single SystemMessage containing summary
4. Store summary persistently so it survives page refresh
