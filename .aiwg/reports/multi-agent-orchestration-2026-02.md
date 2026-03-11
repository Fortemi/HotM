# Multi-Agent Orchestration: Sub-Agent Dispatch Patterns (2024-2026)

**Research Date**: 2026-02-27
**Researcher**: Technical Researcher Agent
**Scope**: Production patterns for hierarchical agent systems with sub-agent dispatch

---

## Executive Summary

Multi-agent orchestration has matured significantly from 2024 to early 2026. The dominant architectural finding is that **orchestration topology now dominates system-level performance more than individual model capability** (AdaptOrch, arXiv 2602.16873). Across all major frameworks — Claude Code sub-agents, OpenAI Agents SDK, LangGraph, CrewAI, AutoGen/Magentic-One, and AWS Strands — five canonical patterns have emerged: sequential chaining, routing/handoff, parallel fan-out, orchestrator-workers, and hierarchical sub-graphs. The critical engineering decisions are context isolation (what does a sub-agent see?), result aggregation (how do results fold back?), error handling (stall detection and replanning), and cost optimization (model selection per task tier).

**Key recommendation**: For a research agent application, the **orchestrator-workers with parallel fan-out** pattern is the best fit: one Sonnet/Opus orchestrator plans the decomposition, N Haiku workers search different sources in parallel, and the orchestrator synthesizes results. Context isolation is enforced by giving each worker a self-contained, extractable prompt rather than the full conversation.

---

## 1. Dispatch Decision Framework

### When to spawn a sub-agent vs. do work inline

All major frameworks converge on a similar dispatch heuristic. Anthropic's production guidance ("Building effective agents", December 2024) identifies four triggers:

| Condition | Pattern | Sub-agent? |
|-----------|---------|-----------|
| Task is well-defined, short, single-step | Inline tool call | No |
| Task needs a different tool set than the parent has | Handoff / sub-agent | Yes |
| Task is expensive to run and can dirty the parent context window | Sub-agent (isolated context) | Yes |
| Multiple independent subtasks can run concurrently | Parallel fan-out | Yes |
| The number and nature of subtasks cannot be predicted in advance | Orchestrator-workers | Yes |
| Work requires discussion and debate between multiple agents | Agent team | Yes (peer agents) |

From the Claude Code docs (2026):
> "Subagents help you preserve context by keeping exploration and implementation out of your main conversation, enforce constraints by limiting which tools a subagent can use, control costs by routing tasks to faster, cheaper models like Haiku."

The **Explore** built-in sub-agent is the clearest example: spawned automatically when the parent needs to search a codebase without making changes, using Haiku (fast, cheap, read-only).

### LLM-directed vs. code-directed dispatch

OpenAI Agents SDK explicitly distinguishes two orchestration modes:

**LLM-directed**: The parent agent's LLM decides dynamically which sub-agent to invoke. Implemented via tool calls (`agent.as_tool()`) or handoffs (`handoffs=[...]`). Best when the task is open-ended and the decomposition cannot be predicted.

**Code-directed**: The application code decides the flow — e.g., `asyncio.gather()` to fan out, then collect results. Best for predictable, structured tasks where you want determinism and lower latency.

```python
# Code-directed parallel fan-out (OpenAI SDK)
res_1, res_2, res_3 = await asyncio.gather(
    Runner.run(spanish_agent, msg),
    Runner.run(spanish_agent, msg),
    Runner.run(spanish_agent, msg),
)
# Synthesize
best = await Runner.run(synthesis_agent, "\n".join([r.final_output for r in [res_1, res_2, res_3]]))
```

The AdaptOrch paper (arXiv 2602.16873, Feb 2026) formalizes this as a Topology Routing Algorithm: it builds a task dependency DAG, then selects among four topologies (parallel, sequential, hierarchical, hybrid) based on dependency structure and domain characteristics. Tasks with no inter-dependencies → parallel. Tasks with strict ordering → sequential. Tasks with both → hybrid hierarchical.

---

## 2. Context Isolation

### The core principle

Sub-agents do not receive the parent's full conversation history. They receive a **self-contained, extractable prompt** constructed by the parent. This is the single most important architectural decision in multi-agent systems.

**Why this matters**:
- Each sub-agent in a parallel fan-out has its own context window. Token costs scale linearly with the number of active agents (Claude Code docs: "token usage scales with the number of active teammates").
- Sub-agents with irrelevant context perform worse and cost more.
- Context isolation prevents one agent's errors or tangents from polluting sibling agents.

### Implementation patterns

**Pattern 1: Shared state keys (LangGraph)**
Parent and sub-graph share specific state fields. Private state within the sub-graph is invisible to the parent.
```python
class SubgraphState(TypedDict):
    foo: str   # shared with parent
    bar: str   # private to subgraph

class ParentState(TypedDict):
    foo: str   # only sees the shared key
```

**Pattern 2: Input transformation (LangGraph different schemas)**
When sub-agents have completely different schemas, a wrapper function translates between them:
```python
def call_subgraph(state: ParentState):
    subgraph_output = subgraph.invoke({"bar": state["foo"]})  # extract
    return {"foo": subgraph_output["bar"]}                    # re-inject
```

**Pattern 3: Prompt-based isolation (Claude Code Task tool)**
The parent constructs a focused prompt and passes it to the Task tool:
```json
{
  "description": "Analyze hiring impact",
  "prompt": "Analyze the financial impact of hiring 5 engineers. Use the hiring_impact.py script. Current runway: 20 months, monthly burn: $500K.",
  "subagent_type": "financial-analyst"
}
```
The sub-agent definition (`.claude/agents/financial-analyst.md`) specifies: the system prompt, the tools it can access, and optionally the model. The parent conversation history does NOT carry over to the sub-agent.

**Pattern 4: Input filter (OpenAI Agents SDK handoffs)**
When handing off to a specialist, the previous conversation can be filtered:
```python
from agents.extensions import handoff_filters
handoff_obj = handoff(
    agent=faq_agent,
    input_filter=handoff_filters.remove_all_tools,  # strip tool calls from history
)
```
The nested handoff history option (`RunConfig.nest_handoff_history=True`) collapses the prior transcript into a single `<CONVERSATION HISTORY>` summary block rather than passing raw turns.

**Pattern 5: Magentic-One planning separation**
The LedgerOrchestrator uses a separate "planning conversation" that is dropped after plan creation. Only the synthesized plan is broadcast to workers. This means workers never see the orchestrator's internal deliberation — only the final directive.

---

## 3. Result Aggregation

### How sub-agent results fold back into the parent

**Direct return (Claude Code Task tool)**
The sub-agent's final output is returned to the parent as a tool result. The parent then continues its own reasoning incorporating that result. The parent context window grows by the size of the sub-agent's output (not the sub-agent's full conversation).

**State merge (LangGraph)**
Sub-graph returns state updates via `Command`:
```python
def web_scraper_node(state: State) -> Command[Literal["supervisor"]]:
    result = web_scraper_agent.invoke(state)
    return Command(
        update={
            "messages": [
                HumanMessage(content=result["messages"][-1].content, name="web_scraper")
            ]
        },
        goto="supervisor",  # always report back to supervisor
    )
```
Only the last message is extracted from the sub-agent's full conversation. The sub-agent's internal tool calls and intermediate steps are discarded.

**Synthesis agent (Anthropic/OpenAI pattern)**
A dedicated synthesis agent receives all worker outputs and produces a consolidated response:
```python
# Anthropic cookbook FlexibleOrchestrator
worker_results = []
for task_info in tasks:
    worker_input = format_prompt(worker_prompt, original_task=task, **task_info)
    result = llm_call(worker_input, model=self.model)
    worker_results.append(extract_xml(result, "response"))

# Fold results into synthesis agent
synthesis_input = "\n\n".join([f"## {t['type']}\n{r}" for t, r in zip(tasks, worker_results)])
final = llm_call(f"Synthesize these results:\n{synthesis_input}")
```

**Voting / best-selection (OpenAI parallelization pattern)**
Run the same agent N times and pick the best:
```python
res_1, res_2, res_3 = await asyncio.gather(
    Runner.run(agent, msg), Runner.run(agent, msg), Runner.run(agent, msg)
)
outputs = [r.final_output for r in [res_1, res_2, res_3]]
best = await Runner.run(picker_agent, f"Pick best:\n" + "\n\n".join(outputs))
```
This is appropriate for tasks where quality matters more than cost (creative writing, translation, code review).

**Aggregate into Magentic-One ledger**
The LedgerOrchestrator broadcasts all worker messages into a shared `_chat_history` list. After each turn, it evaluates the ledger (a structured JSON generated by the LLM) with fields:
```json
{
  "is_request_satisfied": {"reason": "...", "answer": false},
  "is_in_loop": {"reason": "...", "answer": false},
  "is_progress_being_made": {"reason": "...", "answer": true},
  "next_speaker": {"reason": "...", "answer": "WebSurfer"},
  "instruction_or_question": {"reason": "...", "answer": "Search for X on Y website"}
}
```
This JSON ledger is the orchestrator's working memory and the dispatch signal in one structure.

---

## 4. Error Handling

### What happens when a sub-agent fails

**Magentic-One stall detection + replanning**
This is the most sophisticated published error handling pattern (arXiv 2411.04468). The LedgerOrchestrator tracks stall detection via the `is_in_loop` and `is_progress_being_made` fields:

```python
stalled = ledger_dict["is_in_loop"]["answer"] or not ledger_dict["is_progress_being_made"]["answer"]
if stalled:
    self._stall_counter += 1
    if self._stall_counter > self._max_stalls_before_replan:
        self._replan_counter += 1
        self._stall_counter = 0
        if self._replan_counter > self._max_replans:
            return None  # terminate
        else:
            await self._update_facts_and_plan()  # replan
            await self.publish_message(ResetMessage(), ...)  # reset all workers
```

Default parameters: `max_stalls_before_replan=3`, `max_replans=3`. After replanning, the orchestrator broadcasts a `ResetMessage` to all workers (clearing their internal state) and sends a new synthesized plan.

**OpenAI Agents SDK exception handling**
The agent loop raises `MaxTurnsExceeded` when the turn limit is hit. Tool errors are handled via `tool_error_formatter` in `RunConfig`. The SDK supports error handlers that can intercept and re-route failures.

**LangGraph recursion limit**
LangGraph enforces a `recursion_limit` (default: typically 100 supersteps) that terminates cycles. For known failure patterns, conditional edges can route to an error handler node rather than crashing.

**Claude Code sub-agent no-nesting rule**
"Subagents cannot spawn other subagents" — this prevents infinite recursion at the architecture level. The Plan sub-agent is specifically noted as using this constraint to prevent infinite nesting during plan mode.

**Strands retry strategies**
The Strands SDK has an explicit `ModelRetryStrategy` at the event loop level (`event_loop/_retry.py`), with configurable `MAX_ATTEMPTS`, `INITIAL_DELAY`, and `MAX_DELAY` for handling transient model failures. The graph execution tracks `failed_nodes` and `GraphState.status` separately, allowing partial recovery.

**General best practices from Anthropic:**
> "We recommend extensive testing in sandboxed environments, along with the appropriate guardrails... it's also common to include stopping conditions (such as a maximum number of iterations) to maintain control."

---

## 5. Parallel Research Agents: Fan-Out Pattern

### Architecture

```
User Query
    |
    v
Orchestrator (Sonnet)
    |  decompose into N independent search tasks
    |
    +---> Agent-1: [arxiv, focused query A]    \
    +---> Agent-2: [web search, focused query B] > parallel via asyncio.gather()
    +---> Agent-3: [docs, focused query C]     /
    |
    v
Synthesis Agent (Sonnet/Opus)
    - Deduplicate overlapping findings
    - Rank by relevance
    - Return consolidated result
```

### Context isolation for parallel workers

Each worker gets a **self-contained, non-overlapping prompt**:
- A clear, specific query (not the general task)
- The specific source(s) it should search (prevents redundancy)
- The output format it should return
- No access to sibling workers' state (they run independently)

**Preventing redundant work**: The orchestrator assigns non-overlapping search domains to each worker. The synthesis step performs deduplication and Reciprocal Rank Fusion (RRF) to merge overlapping results.

### LangGraph Send API (fan-out to dynamic number of workers)

LangGraph's `Send` primitive enables dynamic parallelism — spawning a variable number of sub-graph instances based on the decomposed task list:

```python
from langgraph.types import Send

def orchestrator_node(state):
    # Decompose task into N sub-tasks
    tasks = decompose(state["task"])
    # Fan out: one Send per sub-task
    return [Send("worker_node", {"subtask": t}) for t in tasks]

builder.add_conditional_edges("orchestrator", orchestrator_node)
```
This is the canonical fan-out pattern in LangGraph. Each `Send` creates an independent sub-graph invocation with isolated state. Results are aggregated back through a reducer function on the parent state.

### Anti-patterns to avoid

1. **Giving all workers the same broad query**: causes redundant work and redundant token cost. Each worker must have a differentiated, scoped query.
2. **Over-parallelization**: "Agent teams add coordination overhead and use significantly more tokens than a single session" (Claude Code docs). Start with 3-5 workers for most workflows.
3. **Having workers access shared mutable state**: creates race conditions. Workers should be read-only or write to separate output buffers.
4. **Not setting a token budget per worker**: without caps, a single worker can consume excessive tokens on an unhelpful tangent.

---

## 6. Cost and Latency Optimization

### Model tiering

The clearest cost optimization pattern is **model tiering by task complexity**:

| Task | Recommended Model | Rationale |
|------|------------------|-----------|
| Codebase exploration (read-only) | Haiku | Fast, cheap; Claude Code Explore sub-agent default |
| Web search / source lookup | Haiku or Sonnet | High volume, simple extraction |
| Code review / analysis | Sonnet | Balanced capability + cost |
| Planning / synthesis / complex reasoning | Sonnet or Opus | Best reasoning, used sparingly |
| Guardrail / safety check | Haiku | Fast, parallel to main agent |

From Anthropic's routing pattern documentation:
> "Routing easy/common questions to smaller, cost-efficient models like Claude Haiku 4.5 and hard/unusual questions to more capable models like Claude Sonnet 4.5."

From Claude Code built-in sub-agent docs:
- **Explore** sub-agent: Haiku (read-only, high-frequency codebase search)
- **Plan** sub-agent: inherits from parent (plan mode research)
- **General-purpose** sub-agent: inherits from parent (complex multi-step tasks)
- The parent can specify a different model per sub-agent in the YAML frontmatter

### Prompt caching

For hierarchical agents with shared system context (e.g., a long CLAUDE.md or reference document used by all workers), **prompt caching** eliminates 90% of the cost for repeated context. Anthropic prompt caching (August 2025 GA):
- Cache write: +25% over base input price
- Cache read: 10% of base input price
- For a multi-worker system where all workers share a 10K token system prompt, caching reduces the input cost for each subsequent worker call by 90% after the first write.

### Parallel vs. sequential cost tradeoff

The AdaptOrch paper (arXiv 2602.16873) formalizes the topology tradeoff:
- Parallel topology: higher token cost (N agents × tokens), lower latency (runs concurrently)
- Sequential topology: lower token cost (one agent × N steps), higher latency
- The topology routing algorithm selects based on whether subtask latency or cost is the binding constraint

From Claude Code docs: "For research, review, and new feature work, the extra tokens are usually worthwhile. For routine tasks, a single session is more cost-effective."

### When parallel is worth it

Anthropic's guidance identifies three conditions where parallel fan-out pays off:
1. The sub-tasks can be parallelized for speed (independent, no ordering constraints)
2. Multiple perspectives or attempts are needed for higher confidence
3. Each consideration benefits from "focused attention on each specific aspect" — LLMs perform better when each concern is handled in a separate call

---

## 7. Specific Implementation Patterns

### 7.1 Claude Code Sub-Agents (Task Tool)

**Architecture**: Sub-agents are defined as Markdown files with YAML frontmatter in `.claude/agents/`. The parent invokes them via the `Task` tool.

**Sub-agent definition format**:
```markdown
---
name: financial-analyst
description: Financial analysis expert. Use for any budget, financial projections, or cost analysis questions.
tools: Read, Bash, WebSearch
model: claude-haiku-4-5   # optional; inherits from parent if unset
---

You are a senior financial analyst...
```

**Key properties**:
- Each sub-agent runs in its own context window
- Sub-agents cannot spawn other sub-agents (no recursion)
- Sub-agents inherit the parent's permissions unless restricted in frontmatter
- Sub-agents can be scoped to user-level (`~/.claude/agents/`) or project-level (`.claude/agents/`)
- `description` field is the dispatch signal — the parent's LLM reads it to decide when to delegate

**Parallel research use case**: Spawn N sub-agents with `Task` calls in a single parent response. In Claude Code, multiple Task calls in one response execute concurrently.

### 7.2 OpenAI Agents SDK (2025)

**Three dispatch mechanisms**:

1. **Handoffs**: Permanent context transfer. The current agent passes control (and optionally a filtered history) to a specialized agent. The handoff is presented as a tool (`transfer_to_<agent_name>`).
   - Use when: a conversation should continue with a different specialist
   - Context control: `input_filter` can strip tool calls, summarize history, or provide custom transformations

2. **Agents as tools**: The orchestrator can call a sub-agent as a tool and get the result back, without relinquishing control. `agent.as_tool(tool_name="...", tool_description="...")`.
   - Use when: you need a result from a specialist but want the orchestrator to continue coordinating

3. **Code-directed parallelism**: Use `asyncio.gather()` to run multiple agents simultaneously.

**Guardrails pattern**: Run a fast/cheap agent in parallel with the main agent as an input/output validator. Can run in `run_in_parallel=True` mode (latency-optimized) or `run_in_parallel=False` mode (blocking, cost-optimized):
```python
@input_guardrail
async def safety_check(ctx, agent, input):
    result = await Runner.run(guardrail_agent, input, context=ctx.context)
    return GuardrailFunctionOutput(
        output_info=result.final_output,
        tripwire_triggered=result.final_output.is_violation,
    )
```

**Tracing**: Every `Runner.run()` call is wrapped in a trace. Traces nest: an orchestrator's trace contains all sub-agent traces. Available via `with trace("name"):` context manager.

### 7.3 LangGraph Sub-Graphs

**Core mechanism**: Compile a subgraph as a `StateGraph`, then add it as a node in the parent graph. Two communication modes:

1. **Shared state keys**: Parent and sub-graph share specific state fields. The sub-graph can have additional private fields.

2. **Different schemas (state transformation)**: Wrap the subgraph invocation in a function that maps parent state → subgraph input and subgraph output → parent state.

**Hierarchical teams pattern (documented in examples)**:
```
SuperGraph
├── teams_supervisor_node (LLM decides which team to invoke)
├── research_team (subgraph)
│   ├── research_supervisor_node
│   ├── search_node (tavily)
│   └── web_scraper_node
└── paper_writing_team (subgraph)
    ├── doc_supervisor_node
    ├── doc_writer_node
    └── note_taker_node
```

Each team is a compiled sub-graph. The top-level supervisor invokes teams via `Command(goto="research_team")`. Workers always report back to their supervisor: `Command(update=..., goto="supervisor")`.

**Fan-out with Send**: `langgraph.types.Send` dispatches to a dynamic number of parallel worker nodes. This is the recommended pattern for map-reduce over unknown-length lists.

### 7.4 CrewAI Hierarchical Process

CrewAI's `Process.hierarchical` creates a manager agent automatically (or uses a provided `manager_agent`):
- Manager LLM decomposes tasks and assigns to crew members
- Tasks are NOT pre-assigned to specific agents — the manager allocates dynamically
- Manager reviews outputs and assesses completion
- Requires `manager_llm` or `manager_agent` parameter

```python
crew = Crew(
    agents=my_agents,
    tasks=my_tasks,
    process=Process.hierarchical,
    manager_llm="gpt-4o"  # or manager_agent=my_manager
)
```

### 7.5 AutoGen / Magentic-One

**Magentic-One architecture (arXiv 2411.04468)**:
- Orchestrator (LedgerOrchestrator): maintains a JSON "ledger" of task progress, selects next agent, detects stalls, triggers replanning
- Workers: WebSurfer (browser), FileSurfer (files), Coder (Python execution), ComputerTerminal
- Shared message history broadcast via publish/subscribe

**Key Magentic-One design decisions**:
1. Planning is separate from execution. The initial plan is created via a private planning conversation (discarded afterward), then broadcast as a synthesized directive.
2. Stall detection via LLM-evaluated fields (`is_in_loop`, `is_progress_being_made`) rather than timeout or heuristic.
3. Replanning with `ResetMessage` — all workers receive a reset signal, then the new plan.
4. `max_stalls_before_replan=3`, `max_replans=3` — bounded retry budget.

**AutoGen AgentTool (2025, current)**:
```python
math_agent_tool = AgentTool(math_agent, return_value_as_last_message=True)
orchestrator = AssistantAgent(
    "assistant",
    tools=[math_agent_tool, chemistry_agent_tool],
    max_tool_iterations=10,
)
```
Agents are wrapped as tools for the orchestrator, similar to OpenAI's `agent.as_tool()` pattern.

### 7.6 AWS Strands Multi-Agent

Strands provides three explicit multi-agent patterns:

1. **Agents as tools**: Wrap an agent as a `@tool` function callable by the orchestrator.
2. **Swarm**: Self-organizing agents with shared context. Agents coordinate autonomously via tool-based handoffs without a central orchestrator.
3. **Graph**: Deterministic DAG execution. Nodes are agents; edges are data dependencies. Supports cyclic graphs (feedback loops) and nested graphs.

```python
# Graph pattern: dependency-based execution
graph = Graph(nodes={
    "researcher": research_agent,
    "writer": writing_agent,
    "reviewer": review_agent,
})
graph.add_edge("researcher", "writer")   # writer runs after researcher
graph.add_edge("writer", "reviewer")     # reviewer runs after writer
result = await graph.invoke("Write a report on X")
```

The Graph executor resolves dependencies, runs independent nodes in parallel, and propagates outputs along edges. `GraphState` tracks `completed_nodes`, `failed_nodes`, and `execution_order`.

---

## 8. Agentic Tool Patterns Beyond Function Calling

### Computer use / browser automation

**Magentic-One WebSurfer**: Multi-modal browser agent that operates a real browser (via Playwright). Receives the current browser state (screenshot + DOM summary) and selects actions: click, type, navigate, scroll. Not a simple function call — it is a multi-turn interaction where each browser action changes the state.

**OpenAI ComputerTool**: Low-level computer use (mouse, keyboard, screenshot). Requires explicit approval in most configurations. Not available via hosted guardrail pipeline (only function tools get guardrails).

**Claude Code Bash tool**: Runs arbitrary shell commands. Sub-agents can be restricted to read-only tools by excluding `Bash` and `Write` from their `tools:` list.

### Code execution sandboxes

**Magentic-One Coder + ComputerTerminal**: Coder writes Python code, ComputerTerminal executes it in a subprocess. Results (stdout/stderr) are fed back to the orchestrator.

**Claude Code Bash tool**: Same pattern but integrated into the agent loop. Can run tests, build tools, scripts, etc. Used by the Explore and General-purpose sub-agents.

**OpenAI Code Interpreter (hosted)**: Sandboxed Python execution. Available as a hosted tool; does not use the function tool guardrail pipeline.

### File system access patterns

The pattern across all frameworks:
- **Read-only agents**: granted `Read` / `cat` equivalents, no `Write`, `Edit`, or `Bash`
- **Write-enabled agents**: granted full tool access
- **Path restrictions**: some frameworks support path allow-lists (e.g., Claude Code permission modes)

Claude Code's Explore sub-agent exemplifies this: it has read-only tools, so it can search any file but cannot modify anything. This makes it safe to run in parallel with write-enabled workers.

### Multi-turn tool interactions

Several tools require follow-up interactions (tool calls that return partial results and need continuation):

**Browser actions**: each click/type produces a new screenshot; the agent must decide the next action.

**File search with pagination**: a search tool returns the first N results; the agent must decide whether to fetch more.

**Code execution with errors**: the agent runs code, gets a stack trace, rewrites the code, runs again.

These require the agent to maintain working state across multiple tool calls. The orchestrator should track this via its message history (all tool results are appended to the conversation), not by spawning a new sub-agent for each step. Sub-agents are better for truly independent subtasks, not for sequential tool-use loops.

---

## 9. Key Architectural Decisions for HotM

Given the AIWG agent system (SDLC roles, research agents, quality assessors), the following patterns apply directly:

### For research agents (parallel fan-out)

**Recommended pattern**: Code-directed parallel fan-out with synthesis.

```python
# Pseudocode for parallel research agent
async def parallel_research(query: str) -> str:
    # Decompose into focused sub-queries
    subtasks = await orchestrator.decompose(query)  # Sonnet/Opus

    # Fan out to Haiku workers
    results = await asyncio.gather(*[
        haiku_agent.search(subtask)
        for subtask in subtasks
    ])

    # Synthesize with Sonnet
    return await synthesis_agent.merge(query, results)
```

**Context isolation**: Each Haiku worker gets only its specific sub-query. The synthesis agent gets all results but not the individual workers' internal tool calls.

### For quality assessment agents

**Recommended pattern**: Evaluator-optimizer with a fast evaluator.

The fast evaluator (Haiku) runs a GRADE assessment in parallel with or after the main artifact generation (Sonnet). The tripwire pattern from OpenAI Agents SDK directly maps to the GRADE quality gate.

### For SDLC phase orchestration

**Recommended pattern**: LLM-directed hierarchical orchestration (the existing AIWG pattern).

The `sdlc-orchestration` rule already implements the Primary Author → Parallel Reviewers → Synthesizer → Archive flow. This maps directly to the orchestrator-workers pattern where:
- Primary Author = orchestrator (Sonnet/Opus, generates artifact)
- Parallel Reviewers = worker agents (Haiku or Sonnet, focused domain review)
- Synthesizer = synthesis agent (Sonnet, consolidates review feedback)

---

## 10. References

All sources verified accessible as of 2026-02-27.

| Ref | Source | Type | Date |
|-----|--------|------|------|
| [1] | Anthropic, "Building effective agents" | Engineering blog | Dec 2024 |
| [2] | Claude Code documentation: "Create custom subagents" | Official docs | 2026 |
| [3] | Claude Code documentation: "Orchestrate teams of Claude Code sessions" | Official docs | 2026 |
| [4] | OpenAI Agents SDK documentation: "Orchestrating multiple agents" | Official docs | 2025-2026 |
| [5] | OpenAI Agents SDK documentation: "Handoffs" | Official docs | 2025-2026 |
| [6] | OpenAI Agents SDK documentation: "Guardrails" | Official docs | 2025-2026 |
| [7] | OpenAI Agents SDK documentation: "Running agents" | Official docs | 2025-2026 |
| [8] | Fourney et al., "Magentic-One: A Generalist Multi-Agent System for Solving Complex Tasks" | arXiv 2411.04468 | Nov 2024 |
| [9] | LangGraph documentation: "Use subgraphs" | Official docs | 2025 |
| [10] | LangGraph example: "Hierarchical Agent Teams" | GitHub notebook | 2025 |
| [11] | CrewAI documentation: "Processes" | Official docs | 2026 |
| [12] | AutoGen README (main branch) | GitHub | 2025 |
| [13] | Anthropic cookbook: "00_The_one_liner_research_agent.ipynb" | GitHub | 2026 |
| [14] | Anthropic cookbook: "01_The_chief_of_staff_agent.ipynb" | GitHub | 2026 |
| [15] | Anthropic cookbook: "patterns/agents/orchestrator_workers.ipynb" | GitHub | 2026 |
| [16] | Anonymous et al., "AdaptOrch: Task-Adaptive Multi-Agent Orchestration in the Era of LLM Performance Convergence" | arXiv 2602.16873 | Feb 2026 |
| [17] | Anonymous et al., "HALO: Hierarchical Autonomous Logic-Oriented Orchestration for Multi-Agent LLM Systems" | arXiv 2505.13516 | May 2025 |
| [18] | AWS Strands SDK documentation and source (strands-agents/sdk-python) | GitHub | 2026 |
| [19] | Magentic-One orchestrator source (microsoft/autogen v0.4.4) | GitHub | 2024-2025 |
| [20] | Anthropic, "Prompt caching with Claude" | Blog | Aug 2025 |

---

## Appendix A: Comparison Matrix

| Feature | Claude Code Tasks | OpenAI Agents SDK | LangGraph | CrewAI Hierarchical | Magentic-One |
|---------|-----------------|------------------|-----------|-------------------|-------------|
| Dispatch mechanism | Task tool + description matching | Handoffs / as_tool() / code | Conditional edges / Send | LLM manager agent | LedgerOrchestrator JSON |
| Context isolation | Own context window, no parent history | Input filter on handoff | Separate state schema | Manager allocates tasks | Planning conv. dropped |
| Parallel execution | Multiple Task calls in one message | asyncio.gather() | Send API (fan-out) | Sequential or parallel | Sequential (one worker at a time) |
| Error handling | No-nesting rule prevents recursion | MaxTurnsExceeded, error handlers | recursion_limit, conditional edges | N/A (sequential fallback) | Stall detection + replanning |
| Model routing | Per-agent model in frontmatter | Per-agent model selection | Per-node model config | manager_llm separate | Separate orchestrator model |
| Cost optimization | Haiku for Explore, custom per agent | Guardrails on cheap model | Node-level model config | manager_llm + agent models | Separate orchestrator |
| Tracing | Built-in (hooks) | Built-in trace() | LangSmith | Built-in | AutoGenBench |
| Language | Any (spawns subprocess) | Python | Python + TypeScript | Python | Python |

