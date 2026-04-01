---
document_type: Requirements Specification
title: "Acceptance Criteria: Regenerate AI Overhaul"
date: 2026-04-01
project: "HotM — Regenerate AI Overhaul"
issue: "#165"
status: draft
---

# Acceptance Criteria: Regenerate AI Overhaul

**Document Type**: Requirements Specification
**Date**: 2026-04-01
**Project**: HotM — Regenerate AI Overhaul
**Parent Issue**: [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165)

---

## Overview

This document defines the acceptance criteria for the Regenerate AI overhaul feature. The overhaul replaces the existing single-button regeneration flow with a structured panel (`RegeneratePanel`) that exposes revision modes, per-job controls, context filtering, and granular progress visibility. All criteria must pass before the feature is considered complete.

---

## AC-165.1: Regenerate with Revision Mode

**Component**: `RegeneratePanel`

### Given
A note is selected and the Enhanced tab is active, displaying the `RegeneratePanel`.

### When
The user selects a revision mode (standard, light, or contextual) from the mode selector and submits.

### Then
- An API call fires to `POST /notes/{id}/reprocess` with the `revision_mode` parameter set to the selected value.
- The note enters a processing state immediately after submission.
- A progress indicator is shown for the duration of processing.
- Note content updates in the UI when processing completes.

### Test Approach
- **Unit test**: Mock the API client and assert that `POST /notes/{id}/reprocess` is called with the correct `revision_mode` value for each of the three modes.
- **Manual verification**: Exercise all three modes against a running Fortemi instance and confirm content updates.

---

## AC-165.2: Regenerate with Context Filter

**Component**: `RegeneratePanel`

### Given
The user has selected "Contextual (Filtered)" as the revision mode in the `RegeneratePanel`.

### When
The user specifies one or more filters (tags, collection, or query string) in the context filter inputs and submits.

### Then
- The API call to `POST /notes/{id}/reprocess` includes a `context_filter` object containing the specified filter values.
- Only the populated filter fields are included in the object (no empty/null keys sent unnecessarily).

### Test Approach
- **Unit test**: Assert request body construction for several combinations of filter inputs (tags only, collection only, all three, none). Verify the `context_filter` shape matches the API specification.

---

## AC-165.3: Per-Job Regeneration

**Component**: `RegeneratePanel`

### Given
A note is selected and the `RegeneratePanel` is open.

### When
The user clicks an individual job button — Re-embed, Re-link, or Regenerate Title.

### Then
- A single job is queued via `POST /jobs` with the correct `job_type` for that button (`embedding`, `linking`, or `title_generation` respectively).
- Progress is shown for that specific job only; other jobs are unaffected.

### Test Approach
- **Unit test**: Mock the jobs API client and assert that exactly one `queueJob` call is made with the correct `job_type` for each individual button.
- **API mock**: Verify the request payload shape matches the jobs endpoint contract.

---

## AC-165.4: Full Reprocess

**Component**: `RegeneratePanel`

### Given
A note is selected and the `RegeneratePanel` is open.

### When
The user clicks "Full Reprocess".

### Then
- All five job types are queued: `ai_revision`, `embedding`, `linking`, `context_update`, `title_generation`.
- Aggregate progress is shown, covering all five jobs as a combined operation.

### Test Approach
- **Unit test**: Assert that exactly five `queueJob` calls are made, one for each required job type, with no duplicates and no missing types.

---

## AC-165.5: Job Progress Visibility

**Component**: `NoteJobProgress`

### Given
A regeneration job or per-job operation is in progress for the currently selected note.

### When
`jobEventStore` receives one or more `JobProgress` events for that note.

### Then
- The Enhanced tab renders per-job progress bars via `NoteJobProgress`, each labeled with its step name.
- The UI does not show a generic spinner in place of per-job detail.

### Test Approach
- **Unit test**: Render `NoteJobProgress` with a mocked `useJobStore` returning in-progress job state. Assert that labeled progress bars appear in the output and that no generic fallback spinner is rendered.

---

## AC-165.6: Job Failure with Retry

**Component**: `NoteJobProgress`, `RegeneratePanel`

### Given
A job has been queued and is in progress for the selected note.

### When
`jobEventStore` receives a `JobFailed` event for that job.

### Then
- An error message is displayed identifying the failed job.
- A retry button is rendered alongside the error message.
- Clicking the retry button re-queues that specific job type via `POST /jobs`.
- No other jobs are affected or re-queued.

### Test Approach
- **Unit test**: Render the component with a mocked `useJobStore` returning a failed job state. Assert error message and retry button are present. Simulate a click on retry and assert the correct `queueJob` call is made.

---

## AC-165.7: Reset to Original Confirmation

**Component**: `RegeneratePanel`

### Given
The selected note has revised content (i.e., a revision exists that differs from the original).

### When
The user clicks "Reset to Original" in the `RegeneratePanel`.

### Then
- A confirmation dialog (`AlertDialog`) is shown before any action is taken.
- If the user confirms: the API call fires with `revision_mode=none`, reverting the note to its original content.
- If the user cancels: no API call is made and the note is unchanged.

### Test Approach
- **Unit test**: Assert that clicking "Reset to Original" renders the `AlertDialog` without immediately calling the API. Test the confirm path to verify the API call includes `revision_mode=none`. Test the cancel path to verify no API call occurs.

---

## AC-165.8: API Spec Consistency

**Component**: `docs/specifications/api-specification.md`

### Given
The API specification document exists and is the authoritative reference for the Fortemi API contract.

### When
Reviewing job types and reprocess endpoint parameters documented in the specification.

### Then
- `title_generation` is listed as a valid `job_type` in the jobs endpoint documentation.
- The `/notes/{id}/reprocess` endpoint fully documents all accepted parameters including `revision_mode` (with valid values: `standard`, `light`, `contextual`, `none`) and `context_filter` (with sub-fields: `tags`, `collection`, `query`).

### Test Approach
- **Manual review**: Open `docs/specifications/api-specification.md` and verify both items are present and correctly specified before merging the feature.

---

## Traceability

| AC | Component | Issue |
|----|-----------|-------|
| AC-165.1 | `RegeneratePanel` | [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165) |
| AC-165.2 | `RegeneratePanel` | [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165) |
| AC-165.3 | `RegeneratePanel` | [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165) |
| AC-165.4 | `RegeneratePanel` | [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165) |
| AC-165.5 | `NoteJobProgress` | [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165) |
| AC-165.6 | `NoteJobProgress`, `RegeneratePanel` | [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165) |
| AC-165.7 | `RegeneratePanel` | [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165) |
| AC-165.8 | `docs/specifications/api-specification.md` | [#165](https://git.integrolabs.net/Fortemi/HotM/issues/165) |
