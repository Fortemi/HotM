# ADR-008: Agent Flow State Machine

**Status**: Accepted
**Date**: 2026-02-27
**Deciders**: Development Team
**Context**: Agent-proxy tool availability control for embedded AI assistant

---

## 1. Title

ADR-008: Agent Flow State Machine for Intent-Driven Tool Availability

---

## 2. Status

**Accepted**

---

## 3. Context

### 3.1 Problem

The agent-proxy's chat endpoint used a turn-counter heuristic (`enableTools = userMessageCount > 1`) to decide whether the LLM could call tools. This caused:

1. **First-turn blindness**: The first message was always tool-free regardless of intent — a user saying "find my notes about AI" on first message got a conversational response.
2. **All-or-nothing tools**: Every subsequent turn got all 9 tools, regardless of whether the user wanted to search, create, or just chat.
3. **Small model misbehavior**: Models like `gpt-oss:20b` ignored system prompt instructions and eagerly called tools on greetings.

### 3.2 Requirements

- Classify user intent per message (conversational, exploratory, knowledge-action)
- Control tool availability based on intent — not turn count
- First turn should always be conversational to establish rapport
- Support intent escalation when the LLM discovers write intent mid-stream
- Integrate with AI SDK v6's `prepareStep`/`onStepFinish` hooks
- No client-side changes required

---

## 4. Decision

Implement an XState v5 state machine that runs server-side per request, classifying intent and configuring `activeTools` for each AI SDK step.

### 4.1 State Machine

```
idle → classify → configure → ready → evaluate → done
                                 ↑        │
                                 └────────┘ (CONTINUE / ESCALATE)
```

| State | Purpose |
|-------|---------|
| `idle` | Awaiting CLASSIFY event |
| `classify` | Run regex/keyword classifier on user message |
| `configure` | Set `activeTools` + prompt suffix based on intent |
| `ready` | Paused — AI SDK `prepareStep` reads state here |
| `evaluate` | Post-step — check finish reason, tool calls, loop limits |
| `done` | Terminal — actor stops |

### 4.2 Intent Classification

Lightweight regex/keyword classifier — no LLM call, zero latency.

| Intent | Tool Set | Trigger Examples |
|--------|----------|------------------|
| `conversational` | None | "hello", "thanks", first turn |
| `exploratory` | 5 read-only tools | "find", "search", "show me" |
| `knowledge-action` | All 9 tools | "create", "write", "tag", "revise" |

### 4.3 AI SDK Integration

- `prepareStep()` reads the machine's `activeTools` and `promptSuffix`
- `onStepFinish()` sends `STEP_COMPLETE` back to the machine
- Machine evaluates whether to loop (tool continuation) or finish
- `onFinish()` sends `DONE` and stops the actor

---

## 5. Alternatives Considered

### 5.1 LLM-based intent classification

**Rejected**: Adds latency (extra LLM call), cost, and complexity. Regex is sufficient for the current tool vocabulary. Can be upgraded later if needed.

### 5.2 Enhanced system prompt only

**Rejected**: Small models ignore system prompt instructions. The turn-counter was itself a workaround for this problem.

### 5.3 Custom middleware state (no library)

**Rejected**: State machine logic gets complex with escalation, loop limits, and guard conditions. XState provides well-tested primitives for this.

### 5.4 Langchain / LangGraph

**Rejected**: Heavyweight dependency for a simple state machine. XState is zero-dep, TypeScript-native, and purpose-built for state management.

---

## 6. Consequences

### Positive

- Tools are intent-scoped: greetings get no tools, searches get read-only tools
- First turn is always conversational (prevents small model tool spam)
- Intent escalation handles edge cases where classification was too conservative
- Clean separation of concerns: classifier, tool sets, machine, and route wiring
- Testable: 36 unit tests covering classification and state transitions

### Negative

- Additional complexity vs. the turn-counter (justified by the problems it solves)
- Regex classifier may need tuning as usage patterns emerge
- XState is a new dependency (~50KB)

---

## 7. Implementation

| File | Purpose |
|------|---------|
| `agent-proxy/src/agent/types.ts` | Shared types |
| `agent-proxy/src/agent/intent-classifier.ts` | Regex/keyword classifier |
| `agent-proxy/src/agent/tool-sets.ts` | Tool subsets + prompt suffixes per intent |
| `agent-proxy/src/agent/flow-machine.ts` | XState v5 machine definition |
| `agent-proxy/src/routes/chat.ts` | Wiring machine into `streamText` |

---

## 8. References

- XState v5 documentation: https://stately.ai/docs/xstate-v5
- AI SDK v6 `prepareStep`: https://ai-sdk.dev/docs/ai-sdk-core/generating-text#prepare-step
- @implements ADR-008
