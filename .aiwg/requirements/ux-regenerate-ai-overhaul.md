---
doc_id: UX-SPEC-003
title: Regenerate AI Overhaul — UX Specification
status: Draft
version: 1.0.0
date: 2026-04-01
author_role: Product Designer
feature: Regenerate AI Overhaul
issue: "#165"
---

# Regenerate AI Overhaul — UX Specification

**Document ID**: UX-SPEC-003
**Status**: Draft
**Version**: 1.0.0
**Date**: 2026-04-01
**Author Role**: Product Designer

---

## 1. Overview and Design Intent

### 1.1 Problem Statement

The current Regenerate AI interface is a simple inline DropdownMenu embedded in `HallOfMind.tsx` (lines 2824–2877). It exposes five revision mode options (standard, light, contextual, contextual_filtered, none) but provides no mechanism to:

- Configure context filter parameters (tags, collection, search query) when selecting the `contextual_filtered` mode
- Trigger individual NLP job types (embedding, linking, title generation) independently
- View per-job progress with meaningful step labels and status color-coding
- Confirm destructive actions before resetting a note to its original content

This lack of control and feedback leads to uncertainty about what is happening after a user triggers regeneration, and makes advanced workflows (selective reprocessing, filtered context) inaccessible.

### 1.2 Design Goals

- **Progressive disclosure**: Simple one-click regeneration remains the primary path; advanced controls expand on demand.
- **Non-blocking**: Use a Popover (not a Dialog) so users can read the note content while configuring regeneration options.
- **Transparent progress**: Replace the binary spinner on the Enhanced tab with per-job progress bars that communicate step-level state.
- **Safe destructive action**: Gate "Reset to Original" behind an explicit confirmation dialog.
- **Composable controls**: Surface individual job buttons (Re-embed, Re-link, Regenerate Title) for surgical reprocessing without triggering the full pipeline.

### 1.3 Design Principles

- **Visible system status**: Job progress must communicate which step is active, not merely that something is running.
- **User control and freedom**: Individual job triggers give power users fine-grained control. Full Reprocess remains available for one-click convenience.
- **Error recovery**: Failed jobs surface an inline error message and a retry button without requiring the user to re-open any panel.
- **Consistency**: Color coding for job types reuses the existing `getJobTypeColor()` palette already established in `job-utils.ts`.

---

## 2. User Flows

### Flow 1: Regenerate with Mode

**Actor**: Any authenticated user with an open note.

**Preconditions**: A note is selected and displayed. No processing job is currently active for that note.

**Steps**:

1. User clicks the "Regenerate AI" trigger button (RefreshCw icon + label + ChevronDown).
2. The `RegeneratePanel` popover opens, anchored below the trigger.
3. Section 1 (Revision Modes) is visible. The currently active mode is highlighted.
4. User clicks one of the four active revision mode items (standard, light, contextual, contextual_filtered).
5. For modes other than `contextual_filtered`, the popover closes and the `onRegenerate` callback fires immediately with the selected mode.
6. `NoteJobProgress` replaces the binary spinner in the Enhanced tab, displaying per-job progress bars.
7. On completion, note content refreshes and progress indicators clear to an idle state.

**Success criteria**: Note content reflects the new revision. Progress reached 100% for the AiRevision job type before clearing.

**Edge cases**: If a job is already queued for the note, the trigger button is disabled and shows a tooltip "Processing in progress."

---

### Flow 2: Regenerate with Context Filter

**Actor**: Any authenticated user.

**Preconditions**: A note is selected. No processing job is active.

**Steps**:

1. User opens the `RegeneratePanel` popover.
2. User clicks the "Contextual (Filtered)" item (SlidersHorizontal icon).
3. The item enters a selected state and the `ContextFilterInputs` section expands inline beneath it within the popover.
4. User fills in one or more filter fields: tags input, collection selector, and/or search query input.
5. A "Submit" button in the context filter section becomes active when at least one filter field has a value (`filterValid === true`).
6. User clicks "Submit".
7. Popover closes and `onRegenerate` fires with `mode: contextual_filtered` and the populated context filter payload.
8. `NoteJobProgress` shows progress.

**Success criteria**: The `RegenerateAIRequest` object passed to the API includes both `mode: contextual_filtered` and the non-empty filter fields.

**Edge cases**:
- If no filter fields are filled, the Submit button remains disabled and a helper text reads "Enter at least one filter to continue."
- If the collections list fails to load, the collection selector shows an inline error state: "Could not load collections."

---

### Flow 3: Per-Job Regeneration

**Actor**: Power user who wants targeted reprocessing.

**Preconditions**: A note is selected. No processing job is active.

**Steps**:

1. User opens the `RegeneratePanel` popover.
2. User scrolls past the separator to Section 2 (Individual Jobs).
3. User clicks one of the three job buttons: "Re-embed" (Database icon), "Re-link" (Link icon), or "Regenerate Title" (Type icon).
4. The popover closes and `onQueueJob` fires with the corresponding `JobType`.
5. `NoteJobProgress` displays a single active job bar for the triggered job type, using the color from `getJobTypeColor()`.
6. On completion, the job bar clears.

**Success criteria**: Only the selected job type is queued. Other job types do not appear in the progress display.

**Edge cases**: If the job fails, the progress bar transitions to an error state with a "Retry" button (see Flow error states in Section 7).

---

### Flow 4: Full Reprocess

**Actor**: Any authenticated user.

**Preconditions**: A note is selected. No processing job is active.

**Steps**:

1. User opens the `RegeneratePanel` popover.
2. User clicks the "Full Reprocess" button (RefreshCcw icon) at the bottom of the popover.
3. The popover closes and all five job types are queued via successive `onQueueJob` calls (AiRevision, Embedding, Linking, ContextUpdate, TitleGeneration).
4. `NoteJobProgress` displays five parallel progress bars, each color-coded by job type.
5. An aggregate progress indicator summarizes overall completion.
6. As individual jobs complete, their bars clear or collapse to a completed state.
7. Once all five jobs are complete, the aggregate indicator clears.

**Success criteria**: All five job type bars appear in `NoteJobProgress`. Each reaches 100% before clearing.

**Edge cases**: If one job fails mid-queue, the other jobs continue. The failed job shows an inline error with a per-job retry button.

---

### Flow 5: Reset to Original

**Actor**: Any authenticated user.

**Preconditions**: A note is selected. The note has at least one AI revision (it is not already in the "none" / original state).

**Steps**:

1. User opens the `RegeneratePanel` popover.
2. User clicks the "Reset to Original" item (FileText icon) in Section 1.
3. A confirmation Dialog opens (separate from the popover, which closes): "Reset to Original? This will remove all AI revisions for this note. The original content will be restored. This cannot be undone."
4. Dialog presents two actions: "Cancel" (secondary) and "Reset" (destructive/red primary).
5. User clicks "Reset".
6. Dialog closes and `onRegenerate` fires with `mode: none`.
7. Note content updates to the original immutable text. Enhanced tab shows no revision content.

**Success criteria**: After confirmation, the note displays the original unrevised content. No AI revision is shown on the Enhanced tab.

**Edge cases**:
- If the user clicks "Cancel", the dialog closes and no API call is made.
- If the note is already in `mode: none` state, the "Reset to Original" item is visually disabled (muted text, no click action) and a tooltip reads "Note is already showing original content."

---

## 3. Interface Layout

### 3.1 Trigger Button

```
[ RefreshCw icon ]  Regenerate AI  [ ChevronDown icon ]
```

- Rendered as a standard outline button in the note toolbar.
- When `isProcessing === true` or `disabled === true`: button is grayed out, pointer-events none, tooltip "Processing in progress."
- ChevronDown rotates 180° when the popover is open.

### 3.2 Popover Panel

The popover anchors to the trigger button with `align="end"` so it does not obscure the note title. Minimum width: 280px. Maximum height: 480px with internal scroll if content overflows.

**Panel structure (top to bottom)**:

```
┌─────────────────────────────────────────┐
│  Section Header: "Revision Mode"        │
│  ○ Standard           [Sparkles icon]   │
│  ○ Light Touch        [PenLine icon]    │
│  ○ Contextual         [Brain icon]      │
│  ○ Contextual (Filtered) [Sliders icon] │
│    └─ [ContextFilterInputs — expanded   │
│        when Contextual Filtered active] │
│  ○ Reset to Original  [FileText icon]   │
├─────────────────────────────────────────┤
│  Section Header: "Individual Jobs"      │
│  [ Database ]  Re-embed                 │
│  [ Link     ]  Re-link                  │
│  [ Type     ]  Regenerate Title         │
│                                         │
│  [ RefreshCcw ]  Full Reprocess         │
└─────────────────────────────────────────┘
```

### 3.3 ContextFilterInputs Expansion

When "Contextual (Filtered)" is selected, the following inputs expand inline below the menu item using an animated collapse/expand transition (200ms ease-out):

```
┌─────────────────────────────────────┐
│  Tags                               │
│  [ tag input with add-on chips    ] │
│                                     │
│  Collection                         │
│  [ collection dropdown selector   ] │
│                                     │
│  Search Query                       │
│  [ text input                     ] │
│                                     │
│  [ Submit ]  (disabled if invalid)  │
└─────────────────────────────────────┘
```

### 3.4 NoteJobProgress (Enhanced Tab)

Replaces the current binary spinner at HallOfMind.tsx:2884–2891.

```
┌───────────────────────────────────────────────┐
│ AI Processing                                  │
│                                               │
│ [■■■■■■■■░░]  Embedding        Step 2/5       │
│              Generating vector embeddings...  │
│                                               │
│ [■■■░░░░░░░]  Linking          Step 1/5       │
│              Scanning for related notes...    │
│                                               │
│ [■■■■■■■■■■]  Title            Complete       │
│                                               │
└───────────────────────────────────────────────┘
```

- Each bar uses the color from `getJobTypeColor(jobType)`.
- Step labels use the format "Step N/M: {description}".
- Completed jobs show "Complete" label; bars optionally collapse after a 1.5s delay.
- Fallback: if `jobEventStore` has no data for `noteId`, display a generic spinner with "Processing…" label.

### 3.5 Reset to Original Confirmation Dialog

A standard Radix AlertDialog:

```
┌─────────────────────────────────────────┐
│  Reset to Original?                     │
│                                         │
│  This will remove all AI revisions for  │
│  this note. The original content will   │
│  be restored. This cannot be undone.    │
│                                         │
│             [ Cancel ]  [ Reset ]       │
└─────────────────────────────────────────┘
```

"Reset" uses the destructive button variant (red background).

---

## 4. Component Hierarchy

```
RegeneratePanel (Popover root)
├── Trigger (Button — RefreshCw + label + ChevronDown)
└── PopoverContent
    ├── RevisionModeList
    │   ├── RevisionModeItem (standard)
    │   ├── RevisionModeItem (light)
    │   ├── RevisionModeItem (contextual)
    │   ├── RevisionModeItem (contextual_filtered)
    │   │   └── ContextFilterInputs [conditional, animated]
    │   │       ├── TagsInput
    │   │       ├── CollectionSelector
    │   │       ├── SearchQueryInput
    │   │       └── SubmitButton
    │   └── RevisionModeItem (none / Reset to Original)
    │       └── ResetConfirmationDialog [AlertDialog]
    ├── Separator
    └── IndividualJobsSection
        ├── JobButton (Re-embed — Database)
        ├── JobButton (Re-link — Link)
        ├── JobButton (Regenerate Title — Type)
        └── FullReprocessButton (RefreshCcw)

NoteJobProgress (standalone, used in Enhanced tab)
├── Fallback (generic spinner, shown when no job data)
└── JobProgressList (shown when job data present)
    └── JobProgressItem (per active job)
        ├── JobTypeIcon
        ├── JobLabel
        ├── ProgressBar (color from getJobTypeColor)
        ├── StepLabel ("Step N/M: description")
        └── [ErrorState — conditional]
            ├── ErrorMessage
            └── RetryButton

ContextFilterInputs (shared component, also used in ProcessingOptionsPanel)
├── TagsInput
├── CollectionSelector
├── SearchQueryInput
└── SubmitButton (shown only when rendered inside RegeneratePanel)
```

---

## 5. Detailed Component Specs

### 5.1 RegeneratePanel

**Purpose**: Primary entry point for all AI regeneration actions. Combines revision mode selection, context filter configuration, individual job triggers, and full reprocess.

**Props**:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `noteId` | `string` | Yes | ID of the note being acted on |
| `isProcessing` | `boolean` | Yes | Disables the trigger when true |
| `onRegenerate` | `(req: RegenerateAIRequest) => void` | Yes | Called for revision mode changes and full pipeline |
| `onQueueJob` | `(jobType: JobType) => void` | Yes | Called for individual job triggers |
| `disabled` | `boolean` | No | Additional disabled condition (default: false) |

**Behavior**:

- Popover opens on trigger click; closes on outside click, Escape key, or after an action fires.
- The active revision mode (current note state) is indicated with a filled radio/check indicator.
- When `isProcessing` or `disabled` is true, all interactive elements inside the popover are also disabled.
- "Reset to Original" item opens the confirmation AlertDialog before firing `onRegenerate`.

**Variants**: None. The panel always renders both sections; Section 2 (Individual Jobs) does not hide based on mode.

---

### 5.2 NoteJobProgress

**Purpose**: Replaces the binary spinner in the Enhanced tab. Shows per-job progress with step labels, color coding, and error recovery.

**Props**:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `noteId` | `string` | Yes | Used to filter job events from the store |
| `fallbackContent` | `ReactNode` | No | Rendered when no job data exists for noteId |

**Behavior**:

- Subscribes to `useJobStore()` and filters events by `noteId`.
- When job data is present: renders `JobProgressList` with one `JobProgressItem` per active or recently completed job.
- When no job data: renders `fallbackContent` if provided, otherwise a generic spinner with "Processing…" label.
- Each `JobProgressItem` color-codes its progress bar using `getJobTypeColor(job.type)`.
- Step label format: `"Step {currentStep}/{totalSteps}: {stepDescription}"`.
- Completed jobs: show "Complete" text and collapse after a 1,500ms delay.
- Failed jobs: transition to error state (see Section 7.2).

**Job type to color mapping** (delegated to `getJobTypeColor()`):

| Job Type | Color |
|----------|-------|
| AiRevision | Purple |
| Embedding | Blue |
| Linking | Green |
| ContextUpdate | Orange |
| TitleGeneration | Pink |

---

### 5.3 ContextFilterInputs

**Purpose**: Provides tag, collection, and search query filter inputs. Extracted as a shared component usable in both `RegeneratePanel` and `ProcessingOptionsPanel`.

**Props**:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `contextFilter` | `ContextFilter` | Yes | Current filter values (controlled) |
| `onContextFilterChange` | `(filter: ContextFilter) => void` | Yes | Called on any field change |
| `collections` | `Collection[]` | Yes | Available collections for the selector |
| `filterValid` | `boolean` | Yes | True when at least one field is non-empty |

**Behavior**:

- Tags input allows free-form tag entry with chip-style display (Enter or comma to confirm a tag).
- Collection selector is a single-select dropdown populated from the `collections` prop.
- Search query input is a plain text field with placeholder "e.g., machine learning".
- The `SubmitButton` is shown only when this component is rendered inside `RegeneratePanel` (controlled by a render prop or composition pattern — not a prop on `ContextFilterInputs` itself).
- The component does not manage its own state; all values flow through `contextFilter` / `onContextFilterChange`.

---

## 6. Accessibility

### 6.1 Keyboard Navigation

- The trigger button is reachable via Tab and activatable with Enter or Space.
- When the popover opens, focus moves to the first focusable element inside (first revision mode item).
- Arrow keys (Up/Down) navigate between revision mode items and individual job buttons within the popover.
- Tab key moves forward through interactive elements; Shift+Tab moves backward.
- Escape closes the popover and returns focus to the trigger button.
- When the `ContextFilterInputs` section expands, focus moves to the first input (Tags) automatically.

### 6.2 ARIA Attributes

- Trigger button: `aria-haspopup="true"`, `aria-expanded={isOpen}`, `aria-controls="regenerate-panel-content"`.
- Popover content: `role="dialog"`, `aria-label="Regenerate AI options"`, `id="regenerate-panel-content"`.
- Revision mode items: `role="radio"`, `aria-checked={isActive}`, grouped under `role="radiogroup"` with `aria-label="Revision mode"`.
- Individual job buttons: standard `<button>` elements with descriptive `aria-label` (e.g., `aria-label="Re-embed this note"`).
- Progress bars in `NoteJobProgress`: `role="progressbar"`, `aria-valuenow={percent}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label="{jobType} progress"`.
- Job status text: wrapped in `aria-live="polite"` region so screen readers announce step changes without interrupting.
- Error states: `role="alert"` with `aria-live="assertive"` for immediate announcement.
- Reset confirmation dialog: follows Radix AlertDialog accessibility defaults (`role="alertdialog"`, focus trapped inside, Escape cancels).

### 6.3 Focus Management

- Opening the popover traps focus within the popover content.
- Closing the popover (any method) restores focus to the trigger button.
- Opening the Reset confirmation dialog transfers focus trap from popover to dialog.
- Closing the dialog (Cancel or Reset) returns focus to the trigger button.

### 6.4 Color and Contrast

- All text and progress label combinations meet WCAG AA (4.5:1 for normal text, 3:1 for large text).
- Progress bar colors are not the sole indicator of job type; each bar also shows a text label.
- Error states use both red color and an error icon + text message (never color alone).

---

## 7. Error States

### 7.1 Trigger Disabled State

**Condition**: `isProcessing === true` or `disabled === true`.

**Display**: Button is grayed out (opacity-50, cursor-not-allowed). Tooltip on hover: "Processing in progress" (when isProcessing) or the value of a `disabledReason` prop if provided.

**Recovery**: Automatic — button re-enables when `isProcessing` returns to false.

---

### 7.2 Per-Job Failure in NoteJobProgress

**Condition**: A job event with `status: "failed"` arrives for the note.

**Display**: The job's progress bar stops and transitions to a red error color. Below the bar:

```
[ErrorIcon]  Embedding failed: {error message}
             [Retry]
```

The `[Retry]` button re-queues the same `JobType` via `onQueueJob`.

**ARIA**: The error container uses `role="alert"` and `aria-live="assertive"`.

**Recovery**: User clicks "Retry". The error state clears and the progress bar resets to 0% and resumes.

---

### 7.3 Collections Load Failure in ContextFilterInputs

**Condition**: The `collections` prop is an empty array and a load error flag is detected (passed via a separate `collectionsError?: boolean` prop).

**Display**: The collection selector is replaced with a muted inline message:

```
[AlertCircle icon]  Could not load collections.
```

**Recovery**: User can still submit using tags or search query alone. Collection filter is unavailable until the parent retries the collections fetch.

---

### 7.4 Context Filter Submit with No Valid Input

**Condition**: `filterValid === false` when user attempts to submit.

**Display**: Submit button remains disabled. Helper text below the inputs:

```
Enter at least one filter to continue.
```

Text is muted and displayed persistently (not only on attempt) to set expectations before submission.

**Recovery**: User fills in at least one filter field; `filterValid` becomes true and the Submit button enables.

---

### 7.5 Regenerate API Call Failure

**Condition**: The `onRegenerate` or `onQueueJob` callback results in an API error (error propagated back via job failure event).

**Display**: Handled by the existing error toast system (outside scope of this component). `NoteJobProgress` also shows the per-job error state per Section 7.2.

**Recovery**: User retries via the per-job Retry button or re-opens `RegeneratePanel` and re-submits.

---

## 8. References

| Reference | Location |
|-----------|----------|
| Current inline dropdown (replaced) | `HallOfMind.tsx:2824–2877` |
| Current binary spinner (replaced) | `HallOfMind.tsx:2884–2891` |
| ContextFilter UI pattern (source) | `ProcessingOptionsPanel.tsx:234–382` |
| Job progress data pattern | `JobQueueMonitor.tsx` |
| Job type color utilities | `jobs/job-utils.ts` — `getJobTypeColor()` |
| Related issue | #165 — Regenerate AI overhaul |
| Quick Capture UX spec (format reference) | `.aiwg/requirements/ux-quick-capture-note-entry.md` |
