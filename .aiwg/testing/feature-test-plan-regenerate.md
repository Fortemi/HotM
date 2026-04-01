# Feature Test Plan: Regenerate AI Overhaul

**Document Type**: Test Plan
**Date**: 2026-04-01
**Project**: HotM — Regenerate AI Overhaul (Issue #165)

---

## Overview

This test plan covers the unit, integration, and quality gate requirements for the Regenerate AI Overhaul feature (parent issue #165). The overhaul introduces a `RegeneratePanel` component, a `NoteJobProgress` component, `ContextFilterInputs`, and an extended API method. All tests must be written before implementation per project TDD standards.

---

## Test Levels

### Unit Tests (target: 80% coverage for new components)

#### RegeneratePanel.test.tsx (~10 cases)

1. Renders trigger button with correct icon and text
2. Opens popover on click
3. Calls `onRegenerate({ revision_mode: 'standard' })` when Standard clicked
4. Shows `ContextFilterInputs` when `contextual_filtered` selected
5. Hides `ContextFilterInputs` when different mode selected after
6. Calls `onQueueJob('embedding')` when Re-embed clicked
7. Shows confirmation `AlertDialog` when "Reset to Original" clicked
8. Disables all buttons when `isProcessing=true`
9. Disables all buttons when `disabled=true`
10. Full Reprocess queues all 5 job types

#### NoteJobProgress.test.tsx (~5 cases)

1. Shows progress bars for active jobs (mock `useJobStore` with active jobs)
2. Displays step label text ("Step 2/5: Embedding...")
3. Shows error state with retry button for failed jobs
4. Calls retry handler with correct `jobType` on retry click
5. Shows `fallbackContent` when no active/failed jobs for note

#### ContextFilterInputs.test.tsx (~4 cases)

1. Adds tag on Enter key
2. Removes tag on X button click
3. Changes collection via select
4. Updates query on input change

#### API Method (extended.test.ts) (~5 cases)

1. `regenerateAI` sends POST to `/notes/{id}/reprocess`
2. Includes `revision_mode` in body when provided
3. Includes `context_filter` in body when provided
4. Includes `job_types` array when provided
5. Sends empty body when no options provided

---

### Integration Tests

- **Regenerate AI flow**: mock API, verify `jobEventStore` receives events, verify `NoteJobProgress` updates accordingly
- **ContextFilterInputs validation**: at least one filter required when `contextual_filtered` mode is active

---

## Mocking Strategy

- Mock `useJobStore` using the same pattern established in `JobQueueIndicator.test.tsx`
- Mock `api.extended.regenerateAI` and `api.extended.queueJob`
- Mock websocket and `jobEventStore` modules
- Use plain HTML select mocks for Radix Select components (jsdom compat — Radix Select portals crash on `scrollIntoView` in jsdom; replace with native `<select>` in test environment)

---

## Coverage Targets

| Component | Target | Priority |
|-----------|--------|----------|
| RegeneratePanel | 80% | P0 |
| NoteJobProgress | 80% | P0 |
| ContextFilterInputs | 75% | P1 |
| API method update | 90% | P0 |

---

## Quality Gates

All of the following must pass before the feature is considered complete:

- All new tests pass: `npx vitest --run`
- No regressions in existing test suite
- CI passes: `act_runner exec -j ui-quality-checks -W .gitea/workflows/ui-ci.yml`
- TypeScript strict mode clean: `npm run typecheck`
