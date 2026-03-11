# Debugger Agent Memory — HotM Project

## Key Patterns Found

### 1. isFirstTurn Off-by-One (agent-proxy)
- **File**: `agent-proxy/src/routes/chat.ts`
- **Pattern**: `userMessageCount <= 1` means the user's FIRST real query gets `isFirstTurn=true`, disabling all tools
- **Fix**: Change to `userMessageCount < 1`
- **Symptom**: Agent answers conversationally without tools even for clear search/explore queries
- **Log signature**: `intent=conversational state=ready tools=[] firstTurn=true` followed immediately by `reason=stop tools=[]`

### 2. Ollama llama3.2 Tool Compliance
- Small models (llama3.2) sometimes ignore available tools and answer from parametric memory
- Log signature: `intent=exploratory ... prepareStep #0` then `reason=stop tools=[]` (no tool calls)
- Fix: Strengthen exploratory prompt suffix with "You MUST use tools" instruction
- For more reliable tool use, prefer `llama3.1:8b`, `qwen2.5:7b`, or cloud models

## Architecture Notes (agent-proxy)
- Intent classifier is regex-only (zero-latency), in `agent-proxy/src/agent/intent-classifier.ts`
- XState flow machine controls `activeTools[]` per request, in `agent-proxy/src/agent/flow-machine.ts`
- Tool sets per intent in `agent-proxy/src/agent/tool-sets.ts`
- Tools execute server-side via `fortemi()` fetch wrapper, NOT via the client-side `api` singleton
- Nginx in `hotm-ui` container proxies `/api/agent/` to `agent-proxy:3001`
- `FORTEMI_API_URL` set to `https://memory.integrolabs.net/api/v1` in `.env`
