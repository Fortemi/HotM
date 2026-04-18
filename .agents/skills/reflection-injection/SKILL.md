---
name: "reflection-injection"
description: "Inject relevant past reflections into agent context at iteration start so agents learn from prior mistakes without repeating them"
platforms: [codex]
---

# reflection-injection

Automatically inject relevant past reflections into agent context when starting new iterations or retrying after failures.

## Triggers


Alternate expressions and non-obvious activations (primary phrases are matched automatically from the skill description):

- "inject reflection" → explicit reflection injection shorthand
- "add metacognition" → metacognitive step insertion

## Purpose

This skill implements the Reflexion episodic memory injection pattern. Before each iteration, it loads relevant past reflections and injects them into the agent's context, enabling learning from past mistakes without repeating them.

## Behavior

When triggered, this skill:

1. **Load reflection history**:
   - Read `.aiwg/ralph/reflections/loops/` for current loop reflections
   - Read `.aiwg/ralph/reflections/patterns/` for cross-loop patterns
   - Apply sliding window: k=5 most recent reflections

2. **Filter for relevance**:
   - Match reflections by task type similarity
   - Match by error type if retrying after failure
   - Match by file/module if working on specific code

3. **Format for injection**:
   - Convert reflections to natural language summary
   - Use @$AIWG_ROOT/agentic/code/addons/ralph/templates/self-reflection-prompt.md template
   - Prepend to agent context

4. **Track usage**:
   - Record which reflections were injected
   - Track whether injected reflections led to success
   - Update pattern effectiveness scores

## Activation Conditions

```yaml
activation:
  always_active_for:
    - ralph-loop-orchestrator
    - ralph-verifier

  triggered_by:
    - ralph_iteration_start
    - agent_retry_after_failure
    - explicit_user_request

  skip_when:
    - no_reflection_history: true
    - first_iteration_of_first_loop: true
```

## Integration

This skill uses:
- `project-awareness`: Context for relevance filtering
- Agent Loop Orchestrator: Provides iteration state
- Reflection memory at `.aiwg/ralph/reflections/`

## References

- @$AIWG_ROOT/agentic/code/addons/ralph/schemas/reflection-memory.json - Schema
- @$AIWG_ROOT/agentic/code/addons/ralph/docs/reflection-memory-guide.md - Guide
- @$AIWG_ROOT/agentic/code/addons/ralph/templates/self-reflection-prompt.md - Prompt template
- @.aiwg/research/findings/REF-021-reflexion.md - Research foundation
