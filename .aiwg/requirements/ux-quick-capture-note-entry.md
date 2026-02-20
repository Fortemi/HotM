# UX Specification: Quick Capture Note Entry

**Document ID**: UX-QC-001
**Status**: Draft
**Version**: 1.0.0
**Date**: 2026-02-20
**Author Role**: Product Designer
**Implements**: MVP Acceptance Criteria (see `.aiwg/requirements/mvp-acceptance-criteria-v2.md`)

---

## 1. Overview and Design Intent

The Quick Capture interface replaces the current minimal "Quick Note" sidebar widget with a dedicated, focused note entry experience. The design centers on one principle: reduce friction to near zero for the moment when a thought arrives and needs to be captured.

The current implementation (`HallOfMind.tsx`, lines 2006-2048) provides a collapsible textarea and a single "Create Note" button. It has no classification controls, no keyboard shortcut documentation, and no feedback after submission. This specification describes the replacement.

### 1.1 Mental Model

The interface models a physical "inbox tray": you drop items in rapidly, they already have a sticky label on them (collection, tags, concept), and the tray processes them in the background. The user never has to stop and re-configure between notes.

### 1.2 Primary Persona

A knowledge worker in a brainstorming session, research deep-dive, or reading sprint. They are capturing 5-30 notes in a burst. Speed is paramount. Each note is a fragment — a quote, an observation, a half-formed idea. Classification is set once per session and held.

### 1.3 Secondary Persona

A user pasting a single article excerpt or research finding who wants to assign it to a specific collection and concept before submission.

---

## 2. User Flows

### 2.1 Flow A: Rapid-Fire Session (Primary Flow)

```
Entry trigger (keyboard shortcut or nav click)
         |
         v
Quick Capture view opens
- Textarea is focused immediately
- Classification bar shows last-used settings (sticky)
         |
         v
User types or pastes note content
         |
         v
User presses Shift+Enter (or clicks Commit button)
         |
         v
Optimistic UI: note fades out, counter increments, textarea clears
         |
         v
Background: POST /api/v1/notes  (+ tags + collection assignment)
         |
         v
Textarea ready for next note — focus restored automatically
         |
         v
(repeat N times)
         |
         v
User closes view or navigates away
```

### 2.2 Flow B: Classification-First Entry

```
Quick Capture view opens (empty session)
         |
         v
User opens Collection selector
Selects "Research > ML Papers"  (persists to sticky state)
         |
         v
User opens Tag multi-select
Selects "llm", "attention"  (persists to sticky state)
         |
         v
User opens Concept picker
Types "Trans..." -> autocomplete suggests "Transformers (ML)"
Selects it  (persists to sticky state)
         |
         v
User types content, commits with Shift+Enter
         |
         v
Each subsequent note inherits same classification
         |
         v
User changes tags mid-session (toggle one off, add another)
New tag combination persists for all further notes
```

### 2.3 Flow C: Archive Routing (Multi-Archive Users)

```
Quick Capture opens
Archive selector shows current active archive (from X-Fortemi-Memory header)
         |
         v
User switches archive via selector
Sticky state resets: collection and concept selectors reload for new archive
Tags sticky state is preserved (tags are archive-scoped but user intent is clear)
         |
         v
Note committed to selected archive
```

### 2.4 Flow D: Error Recovery

```
User commits note
         |
         v
API call fails (network error, server down)
         |
         v
Note content is NOT cleared
Error banner appears inline: "Could not save — check connection. Retry?"
Retry button sends the same payload
         |
         v
Success: content clears, counter increments
-- OR --
Persistent failure: "Save failed. Your text is preserved above."
User can manually copy content if needed.
```

### 2.5 Flow E: Long Content / Paste

```
User pastes a large block of text (e.g., article excerpt, code snippet)
         |
         v
Textarea expands to show approximately 8 lines before scrolling internally
Character count appears in footer (e.g., "1,240 chars")
Format selector auto-suggests "Markdown" if markdown patterns detected
         |
         v
User commits
NLP pipeline handles chunking and summarization server-side
```

---

## 3. Interface Layout

### 3.1 View Context

Quick Capture lives as a full-page view within the main content area, accessible via:
- Sidebar navigation item "Capture" (new `AppView` value: `"capture"`)
- Global keyboard shortcut: `Cmd/Ctrl + Shift + N`
- The existing sidebar Quick Note widget is retained as a lightweight fallback but links to this view when clicked

### 3.2 Desktop Layout (>= 1024px)

```
+----------------------------------------------------------+
|  [Brain icon] Quick Capture         [Session: 0 notes]   |
|  Capture ideas fast. Settings stay until you change them. |
+----------------------------------------------------------+
|                                                          |
|  CLASSIFICATION BAR (sticky)                             |
|  +----------+  +------------------+  +--------------+   |
|  | Archive v|  | Collection      v|  | Concept     v|   |
|  | Personal |  | (none)           |  | (none)       |   |
|  +----------+  +------------------+  +--------------+   |
|                                                          |
|  +----------------------------------------------------+  |
|  | Tag: [llm x] [attention x]  [+ Add tag...]        |  |
|  +----------------------------------------------------+  |
|                                                          |
|  FORMAT:  (o) Markdown   ( ) Plain text                  |
|                                                          |
+----------------------------------------------------------+
|                                                          |
|  CAPTURE AREA                                            |
|  +----------------------------------------------------+  |
|  |                                                    |  |
|  |  Capture your thought here...                      |  |
|  |                                                    |  |
|  |  (textarea, min 5 lines, auto-grows to 12 lines)   |  |
|  |                                                    |  |
|  +----------------------------------------------------+  |
|                                                          |
|  [Commit note  Shift+Enter]              0 chars         |
|                                                          |
+----------------------------------------------------------+
|                                                          |
|  COMMITTED NOTES THIS SESSION (recent first)             |
|  +-  "The attention mechanism in transformers..."  ---+  |
|  |   llm, attention  |  Research > ML Papers  | 0:03s |  |
|  +----------------------------------------------------+  |
|  +-  "Scaled dot-product attention formula..."  ------+  |
|  |   llm, attention  |  Research > ML Papers  | 0:47s |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

### 3.3 Mobile Layout (< 768px)

```
+-------------------------------+
|  Quick Capture  [x notes]     |
+-------------------------------+
|  CLASSIFICATION BAR           |
|  [Archive v] [Collection v]   |
|  [Concept v]                  |
|  Tags: [llm x] [+ Add]        |
|  Format: [Markdown v]         |
+-------------------------------+
|                               |
|  [Capture area - full width]  |
|  3 lines visible, scrollable  |
|                               |
+-------------------------------+
|  [Commit - Shift+Enter]       |
+-------------------------------+
|  Session log (collapsed)      |
|  [3 notes captured  v]        |
+-------------------------------+
```

### 3.4 Sidebar Quick Note Widget (Minimal Mode — Retained)

The existing sidebar widget is simplified to an "Open Capture" affordance:

```
+----------------------------------+
|  Quick Note                  [>] |  <- chevron opens full view
+----------------------------------+
|  [Open Quick Capture  Ctrl+N]    |
+----------------------------------+
```

The widget may optionally render a minimal one-line input that immediately opens the full view on focus (acting as a trigger, not a replacement).

---

## 4. Component Hierarchy

```
QuickCapturePage (new AppView = "capture")
├── QuickCaptureHeader
│   ├── SessionCounter (animated note count badge)
│   └── HelpTrigger (keyboard shortcut summary popover)
├── ClassificationBar (sticky state via localStorage)
│   ├── ArchiveSelector
│   │   └── Radix Select (single-value, lists from GET /api/v1/archives)
│   ├── CollectionSelector
│   │   └── Radix Select (single-value + "(none)" option)
│   │       └── CollectionOption (displays hierarchical name)
│   ├── ConceptPicker
│   │   └── Radix Combobox (searchable, single-value + "(none)")
│   │       └── ConceptOption (pref_label + notation badge)
│   └── TagBar
│       ├── TagBadge[] (selected tags, each with dismiss button)
│       └── TagInput (type-ahead combobox, multi-value)
│           └── TagSuggestion (name + usage count)
├── FormatSelector
│   └── Radix RadioGroup (Markdown | Plain text)
├── CaptureArea
│   ├── NoteTextarea (auto-growing, max 12 visual lines before scroll)
│   ├── CharacterCounter
│   └── CommitButton (primary action, disabled when empty)
└── SessionLog
    └── SessionNoteCard[] (committed notes, most recent first)
        ├── NoteSnippet (first 80 chars of content)
        ├── TagList (badges, read-only)
        ├── CollectionBreadcrumb
        └── ElapsedTime (relative: "just now", "2m ago")
```

---

## 5. Classification Controls — Detailed Specification

### 5.1 Archive Selector

**Label**: "Archive"
**Component type**: Radix `Select` (single-value)
**Default**: Current active archive (from `getActiveMemory()` in `memory-context.ts`)
**Options**: Fetched via `GET /api/v1/archives`, displayed by `name`. A "(default)" option maps to `null`.

**Behavior**:
- On archive change, the collection and concept selectors reload their options for the new archive context. Tags selector retains its current value (user intent).
- Archive routing is applied via the `X-Fortemi-Memory` header on all subsequent note creation requests. This aligns with how `setActiveMemory()` works in the existing API client.
- If only one archive exists, the selector is hidden to reduce noise.

**Sticky**: Yes — persists in `localStorage` under key `hotm.quickCapture.archive`.

**Accessibility**: `aria-label="Archive"`. Options include archive description as `aria-describedby`.

### 5.2 Collection Selector

**Label**: "Collection"
**Component type**: Radix `Select` (single-value)
**Default**: "(none)" — no collection assigned
**Options**: Fetched via `GET /api/v1/collections`. Hierarchical collections are displayed with indentation using their `parent_id` relationship.

**Behavior**:
- Selecting a collection stores its `id` in sticky state.
- "(none)" maps to `null` — note is created without collection assignment.
- After note creation, if a collection is selected, the assignment is made via `POST /api/v1/notes/{id}/move` with `{ collection_id: selectedId }`.

**Sticky**: Yes — persists in `localStorage` under key `hotm.quickCapture.collectionId`.

**Accessibility**: `aria-label="Collection"`. Hierarchical items use `aria-level` indentation hint in label.

### 5.3 Concept Picker

**Label**: "Concept"
**Component type**: Combobox (Radix Popover + Input + listbox)
**Default**: "(none)" — no concept pre-assigned
**Interaction**: Type-ahead search calling `GET /api/v1/concepts/autocomplete?q={query}` after 200ms debounce. Minimum 2 characters to trigger.

**Options display**:
```
[Transformers (ML)]   notation: ML.attn.004
[Transfer Learning]   notation: ML.train.012
```

**Behavior**:
- Selecting a concept stores its `concept_id` and `pref_label` in sticky state.
- The concept association is applied by including a `metadata.concepts` hint in the note creation payload (see Section 7.2). The NLP pipeline respects pre-tagged concepts and does not override them.
- Clearing the picker removes the pre-classification.
- If no concept schemes exist in the archive, this control is hidden.

**Loading state**: Spinner replaces the chevron icon during autocomplete fetch.

**Sticky**: Yes — persists `concept_id` and `pref_label` in `localStorage` under key `hotm.quickCapture.concept`.

**Accessibility**: Implements ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`). Arrow keys navigate suggestions. Enter selects. Escape closes without selecting.

### 5.4 Tag Bar

**Label**: "Tags"
**Component type**: Multi-value token input (custom, built on Radix Popover + Input)
**Default**: Empty (no tags pre-selected)

**Interaction**:
- Typing in the tag input fetches suggestions from `GET /api/v1/tags` (filtered client-side by the typed prefix, since tag lists are typically small enough to load once on mount).
- Pressing `Enter` or `Tab` commits the typed value as a new tag (even if not in suggestions — user-created tags are valid).
- Tags appear as dismissible badges inline with the input.
- Pressing `Backspace` when the input is empty removes the last tag.

**Behavior**:
- All tags in the bar are applied to every committed note via `PUT /api/v1/notes/{id}/tags` after creation.
- Tags persist in sticky state — they survive between notes until explicitly removed.
- The tag list is loaded once on component mount and cached for the session.

**Sticky**: Yes — persists in `localStorage` under key `hotm.quickCapture.tags`.

**Accessibility**: `role="group"` wrapping the tag bar. Each tag badge has `aria-label="Remove tag: {name}"`. Input has `aria-label="Add tag"` and `aria-describedby` pointing to the badge list.

### 5.5 Format Selector

**Label**: "Format"
**Component type**: Radix `RadioGroup` (inline, two options)
**Options**: `markdown` | `plaintext`
**Default**: `markdown`

**Behavior**:
- Auto-detection: When the user pastes content, the system checks for markdown patterns (headings `#`, bold `**`, code fences ` ``` `, links `[text](url)`). If detected, Markdown is selected automatically and a tooltip announces "Format auto-detected as Markdown".
- The selected format is sent as `format` in the note creation payload.

**Sticky**: Yes — persists in `localStorage` under key `hotm.quickCapture.format`.

---

## 6. Capture Area — Detailed Specification

### 6.1 Textarea

**Element**: `<textarea>` (not a rich editor — deliberate choice for speed and focus)
**Min height**: 5 lines (~120px)
**Max height**: 12 lines (~288px), after which the textarea scrolls internally
**Auto-grow**: Height grows with content between min and max bounds
**Font**: Monospace (`font-mono` via TailwindCSS) — reinforces "raw capture" mental model
**Placeholder**: `"Capture your thought... (Shift+Enter to commit)"`

**On mount**: Focus is placed in the textarea immediately. No user action required.

**Paste behavior**:
- Rich text (HTML) is stripped to plain text on paste.
- Format auto-detection runs on paste (see Section 5.5).
- Character count updates immediately.

**Resize**: `resize-none` (disallow manual resize — auto-grow handles this).

### 6.2 Character Counter

Displayed at bottom-right of the capture area. Shows character count in real time.

States:
- `0–2000 chars`: Default color (`text-muted-foreground`)
- `2001–5000 chars`: Amber (`text-amber-500`) — note is long, NLP will handle chunking
- `> 5000 chars`: Red (`text-red-500`) with tooltip: "Very long notes are chunked by the NLP pipeline"

No hard length limit is enforced (the API accepts arbitrary content). The visual signal is informational only.

### 6.3 Commit Button

**Label**: "Commit note"
**Keyboard hint**: `Shift+Enter` displayed inline in the button label on desktop
**Variant**: `default` (primary)
**Full width on mobile**, fixed width on desktop
**Position**: Below the textarea, right-aligned

**Disabled states**:
- Textarea is empty (whitespace-only)
- A commit is in flight (shows spinner + "Saving...")
- API is unreachable (shows "Offline" with tooltip explaining the server is unavailable)

**Loading state**: Button enters loading state for the duration of the API sequence (note creation + tag assignment + collection assignment). Typical duration is < 500ms.

---

## 7. Interaction Design

### 7.1 Keyboard Shortcuts

| Shortcut | Context | Action |
|---|---|---|
| `Shift+Enter` | Textarea focused | Commit note (primary shortcut) |
| `Ctrl+Enter` (Win/Linux) or `Cmd+Enter` (Mac) | Textarea focused | Commit note (secondary shortcut — familiar from many chat apps) |
| `Escape` | Textarea focused | Clear textarea content (with confirmation if > 20 chars) |
| `Tab` | Tag input focused | Commit typed tag text as a new tag |
| `Backspace` | Tag input empty | Remove last tag |
| `Arrow Down` | Tag/Concept input open | Move focus into suggestion list |
| `Escape` | Suggestion popover open | Close popover, return focus to input |
| `Cmd/Ctrl+Shift+N` | Global | Open Quick Capture view |

**Rationale for `Shift+Enter`**: The user's requirement. `Enter` alone would be dangerous in a textarea (newline is a primary text input action). `Ctrl/Cmd+Enter` is the secondary — it matches GitHub, Slack, and other multi-line-text commit patterns. `Shift+Enter` is offered as the primary because it is easier to execute one-handed.

### 7.2 Focus Management

**On view open**: Focus immediately enters the textarea. No intermediate click required.

**After commit (success)**:
1. Committed note slides into the session log with a brief fade-in animation.
2. Textarea clears.
3. Focus returns to the textarea.
4. Session counter increments with a brief pulse animation.

**After commit (error)**:
1. Error banner appears above the textarea.
2. Textarea content is preserved.
3. Focus stays in the textarea (user can edit and retry).

**Tab order** (desktop, left to right, top to bottom):
1. Archive selector
2. Collection selector
3. Concept picker (input)
4. Tag input
5. Format: Markdown radio
6. Format: Plain text radio
7. Textarea (primary focus on open)
8. Commit button
9. Session log notes (focusable for screen reader access)

**Tab order** (mobile): Same sequence, laid out vertically.

### 7.3 State Transitions

```
EMPTY STATE
  - Textarea empty
  - Commit button disabled
  - Character counter shows "0 chars"
         |
         | user types or pastes
         v
COMPOSING STATE
  - Textarea has content
  - Commit button enabled
  - Character counter updating
         |
         | Shift+Enter or Commit button
         v
COMMITTING STATE (optimistic)
  - Commit button shows spinner: "Saving..."
  - Textarea is read-only (disabled attribute prevents accidental edits)
  - Classification bar is not disabled (user may pre-configure next note)
         |
         | API calls complete successfully
         v
COMMITTED STATE (brief, ~300ms)
  - Success flash: textarea background pulses green briefly
  - Committed note appears at top of session log
  - Counter increments
         |
         | automatic transition
         v
EMPTY STATE (ready for next note)
  - Focus in textarea
  - Classification bar retains all values

-- ALTERNATE PATH FROM COMMITTING STATE --

         | API call fails
         v
ERROR STATE
  - Error banner renders above textarea
  - Textarea re-enabled with content preserved
  - "Retry" button in error banner
  - Commit button re-enabled
```

### 7.4 Optimistic UI Strategy

The note creation itself is not optimistic (we need the note ID for subsequent tag and collection assignments). However, the user experience is made to feel near-instant by:

1. Disabling the textarea immediately on commit (signals "accepted").
2. Clearing the textarea and resetting focus in parallel with the API call, before awaiting the response.
3. Adding a placeholder card in the session log immediately ("Saving...") that resolves to the committed note entry on success, or is removed on error.

If the API call fails, the placeholder is removed and the content is restored to the textarea.

### 7.5 Session Counter

A badge in the header shows the count of notes committed in the current view session. It is:
- Reset to 0 when the view is navigated away from.
- Animated with a brief scale pulse (`scale-110` for 200ms) on each increment.
- Labeled: "3 notes captured" (pluralized correctly).

---

## 8. API Integration

### 8.1 Data Loading (on view mount)

All three calls are made in parallel:

```typescript
const [archives, collections, tags] = await Promise.all([
  api.archives.list(),              // GET /api/v1/archives
  api.collections.list(),           // GET /api/v1/collections
  api.tags.list(),                  // GET /api/v1/tags
]);
```

Concepts are loaded on demand via the autocomplete endpoint (not pre-fetched).

If the archives call returns a single result, the archive selector is hidden.

### 8.2 Note Creation Sequence

A committed note triggers the following sequential API calls. Steps 2-4 are conditional on user selections.

**Step 1 — Create note**
```http
POST /api/v1/notes
X-Fortemi-Memory: {activeArchive | omit if default}
Content-Type: application/json

{
  "content": "{textarea content}",
  "format": "markdown" | "plaintext",
  "source": "manual"
}

Response: { "note_id": "uuid" }
```

**Step 2 — Apply tags (if any tags selected)**
```http
PUT /api/v1/notes/{note_id}/tags
Content-Type: application/json

{
  "add": ["tag-a", "tag-b"],
  "remove": []
}
```

**Step 3 — Assign to collection (if collection selected)**
```http
POST /api/v1/notes/{note_id}/move
Content-Type: application/json

{
  "collection_id": "{selectedCollectionId}"
}
```

**Step 4 — Pre-tag concept (if concept selected)**

Concept association is delivered via note metadata to signal the NLP pipeline. The NLP pipeline reads `metadata.concept_hints` and applies the specified concept without overriding it during its own extraction pass:

```http
PATCH /api/v1/notes/{note_id}
Content-Type: application/json

{
  "metadata": {
    "concept_hints": [
      {
        "concept_id": "{selectedConceptId}",
        "pref_label": "{selectedConceptLabel}",
        "source": "user_pre_classification"
      }
    ]
  }
}
```

**Note**: If the Fortemi API provides a dedicated endpoint for attaching concepts to notes directly, that endpoint should be preferred over the metadata hint approach. Verify against the API spec when implementing.

### 8.3 Error Handling per Step

| Step | Failure mode | Recovery |
|---|---|---|
| Step 1 (create) | Network error, 5xx | Show error banner, preserve content, offer retry |
| Step 1 (create) | 422 Validation | Show inline error with specific message |
| Step 2 (tags) | Any failure | Note was created; show partial success warning: "Note saved, but tags could not be applied" |
| Step 3 (collection) | Any failure | Note was created; show partial success warning: "Note saved, but could not assign to collection" |
| Step 4 (concept) | Any failure | Note was created; show partial success warning: "Note saved, concept hint could not be stored" |

Partial success warnings appear in the session log entry, not as a blocking banner.

### 8.4 Sticky State Persistence

Sticky state is stored in `localStorage` and read on component mount. Keys:

| Key | Type | Description |
|---|---|---|
| `hotm.quickCapture.archive` | `string \| null` | Active archive name |
| `hotm.quickCapture.collectionId` | `string \| null` | Selected collection UUID |
| `hotm.quickCapture.collectionName` | `string` | Display name (for UI before fresh load) |
| `hotm.quickCapture.tags` | `string[]` (JSON) | Array of tag strings |
| `hotm.quickCapture.conceptId` | `string \| null` | Selected concept UUID |
| `hotm.quickCapture.conceptLabel` | `string` | Display label (for UI before fresh load) |
| `hotm.quickCapture.format` | `"markdown" \| "plaintext"` | Note format |

**Stale reference handling**: If a persisted `collectionId` no longer exists in the fetched collections list, the selector falls back to "(none)" and clears the stale localStorage key. Same for concept.

---

## 9. Visual Design Specifications

### 9.1 Classification Bar

- Light background: `bg-muted/40`
- Border: `border border-border rounded-lg`
- Padding: `px-4 py-3`
- Gap between controls: `gap-3`
- Controls use existing Radix `Select` and `Button` styling from the project's component library

### 9.2 Tag Badges

- Selected tags: `bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-xs`
- Dismiss button within badge: `ml-1 opacity-60 hover:opacity-100` with `X` icon (12px)
- New tag on hover suggestion: `bg-accent text-accent-foreground`

### 9.3 Commit Success Animation

On successful commit, the textarea undergoes a brief highlight:
- Background transitions: `transparent -> bg-green-500/10 -> transparent`
- Duration: 400ms total (100ms in, 300ms out)
- Implemented via CSS class toggling, not JavaScript-driven keyframes

### 9.4 Session Log Cards

```
bg-muted/30
border border-border/50
rounded-md
px-3 py-2
```

Each card:
- Left: Note snippet (truncated at 80 chars, `text-sm text-foreground`)
- Below snippet: Tag badges (if any), collection breadcrumb (if any), concept chip (if any)
- Right: Elapsed time (`text-xs text-muted-foreground`)
- Cards are clickable — clicking opens the note in the main notes view

### 9.5 Error Banner

```
bg-destructive/10
border border-destructive/30
rounded-md
px-4 py-3
```

Contains: error icon + message text + "Retry" button + "Dismiss" button.

---

## 10. Accessibility (WCAG 2.1 AA)

### 10.1 Keyboard-Only Operation

Every action in the interface is reachable and executable without a mouse:
- All selectors, inputs, and buttons are keyboard-accessible.
- Tag addition via keyboard: type tag text, press `Tab` to commit.
- Concept picker: type to search, arrow keys to navigate, `Enter` to select.
- Commit: `Shift+Enter` or `Tab` to Commit button and `Enter`.

No mouse-only interactions exist in this interface.

### 10.2 Screen Reader Support

- **Page landmark**: The Quick Capture view is wrapped in `<main>` with `aria-label="Quick Capture"`.
- **Live region**: A `role="status" aria-live="polite"` element announces commit results: "Note committed. 3 notes captured this session." This fires on successful commit.
- **Error live region**: A `role="alert" aria-live="assertive"` element announces errors.
- **Session counter**: Has `aria-label="3 notes captured this session"` (updated on each commit).
- **Textarea**: `aria-label="Note content"`, `aria-describedby` points to the character counter and keyboard shortcut hint.
- **Commit button**: When disabled, `aria-disabled="true"` and `aria-describedby` explains why (empty textarea or offline).
- **Classification selectors**: Each has a visible label and matching `aria-label`. The archive selector (when hidden) is also removed from the accessibility tree (`aria-hidden` or conditional render).
- **Session log cards**: Each card has `role="article"` with a descriptive `aria-label` including the snippet and timestamp.

### 10.3 Color and Contrast

- All text meets WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text).
- Status states (success, error, warning) do not rely on color alone — icons and text labels accompany color signals.
- The green success flash uses both background color and an optional checkmark icon appearing briefly in the textarea corner.

### 10.4 Motion and Animation

- All animations respect the `prefers-reduced-motion` media query.
- When reduced motion is preferred: transitions are instant (no fade, no pulse, no slide).

### 10.5 Focus Indicators

- Focus rings use the project's existing focus-visible styles (TailwindCSS `focus-visible:ring-2 focus-visible:ring-ring`).
- Focus is never trapped (except within open popovers, where `Escape` always provides exit).

### 10.6 Touch and Mobile

- All tap targets are at minimum 44x44px (per WCAG 2.5.5).
- On mobile, the textarea minimum height is 3 lines to leave room for the classification bar and commit button without scrolling.
- The keyboard shortcut hint (`Shift+Enter`) is hidden on mobile in favor of the explicit "Commit" button label.

---

## 11. Edge Cases

### 11.1 Offline / Server Unreachable

Detection: existing `serverStatus` from the health check in `HallOfMind.tsx`.

- If offline on view open: a persistent banner fills the classification bar area: "HotM is offline. Notes cannot be saved." The textarea is disabled. When the connection is restored, the banner clears and the textarea enables.
- If offline mid-session (server drops): the Commit button transitions to "Offline" state. Existing session log is retained in view. No data loss of in-progress content.
- The character counter and all local interactions continue to work offline (typing, classification selection reads from localStorage).

### 11.2 Very Long Notes (> 5,000 characters)

- Textarea continues to accept input.
- Character counter turns red; a tooltip appears: "Long notes are automatically chunked and summarized by the NLP pipeline."
- No truncation is applied by the UI. The full content is submitted to the API.
- The session log card for long notes shows a "chunked" chip to inform the user.

### 11.3 Rich Text Paste (HTML)

When content is pasted:
1. The browser's `paste` event is intercepted.
2. `ClipboardEvent.clipboardData.getData('text/plain')` is used to extract plain text.
3. Rich formatting (bold, links, images) is discarded.
4. A brief informational tooltip appears: "Rich formatting was stripped. Plain text captured."

This is intentional — the NLP pipeline will enrich the note. The user's raw signal is what matters.

### 11.4 Very Short Notes (1-2 words)

Accepted and submitted without warning. Single-word notes or fragments are valid captures (e.g., "Backpropagation", "Read this again"). The NLP pipeline will summarize and contextualize.

### 11.5 Duplicate Consecutive Notes

No duplicate detection. Rapid note entry may result in near-identical notes. This is intentional — the user is responsible for their capture. The NLP pipeline may detect and link related notes after creation.

### 11.6 API Rate Limiting (429 responses)

If the API returns 429 on note creation:
- The commit is treated as a transient error.
- Error banner shows: "Server is busy. Your note is preserved. Retry?"
- Retry uses exponential backoff: 1s, 2s, 4s, then surfaces the error to the user.

### 11.7 Collection/Tag Data Loading Failures

If the `GET /api/v1/collections` or `GET /api/v1/tags` call fails on mount:
- The selector shows "Could not load" with a retry icon button.
- The user can still submit notes without classification — classification controls degrade gracefully.
- Note creation is not blocked by classification data loading failures.

### 11.8 Simultaneous Session in Another Tab

The sticky state (localStorage) is shared across tabs. If a user has Quick Capture open in two tabs:
- Tag/collection/concept changes in one tab are reflected in the other tab on the next mount or refresh.
- Active session counters are tab-local (not synchronized).
- No conflict resolution is needed — the most recently written localStorage value wins.

---

## 12. Outstanding Questions and Design Risks

### 12.1 Questions for Implementation Team

1. **Concept metadata hints**: Does the Fortemi API currently read `metadata.concept_hints` from the note payload to pre-seed concept associations, or is there a dedicated endpoint for this? If a dedicated endpoint exists (`POST /api/v1/notes/{id}/concepts` or similar), Section 8.2 Step 4 should be updated to use it.

2. **Collection assignment endpoint**: The spec uses `POST /api/v1/notes/{id}/move` (derived from `collections.ts` in the API client). Is this the correct and supported endpoint? The older `PUT /notes/{id}/collection` in the v1 spec uses a different shape (`{ collectionId }`). Clarify which is canonical.

3. **Tag creation**: If a user types a tag that does not yet exist, does `PUT /api/v1/notes/{id}/tags` with `{ add: ["new-tag"] }` create the tag implicitly, or must `POST /api/v1/tags` be called first?

4. **Concept autocomplete minimum query length**: The current `autocompleteConcepts` client function requires a non-empty query. What is the server's minimum character threshold, and should we show popular/recent concepts when the field is focused but empty?

5. **NLP pipeline concept respect**: The spec assumes the NLP pipeline respects `metadata.concept_hints` and does not override them. Is this behavior confirmed in the Fortemi implementation?

### 12.2 Design Risks

**Risk 1 — Classification bar visual weight**
Four controls (archive, collection, concept, tags) plus a format selector may feel heavy above a simple textarea. If user testing reveals the bar is perceived as "too much to configure," consider collapsing archive + collection into a single "Destination" picker with a hierarchical select, reducing the bar to three visual elements.

**Risk 2 — Sticky state surprise**
A returning user may not realize their classification settings from a previous session are still active and inadvertently file new notes into an unintended collection. Mitigation: display a subtle "Sticky from last session" indicator next to the classification bar on first render, auto-dismissing after 3 seconds or on first interaction.

**Risk 3 — Mobile textarea cramping**
On smaller phones (375px wide), the classification bar may require more than one row. Verify that the mobile layout functions correctly on 375px viewport width. The Tag bar in particular may need to be collapsed into an expandable panel on mobile.

**Risk 4 — Concept autocomplete latency**
The `GET /api/v1/concepts/autocomplete` call depends on the NLP service being responsive. If Ollama is slow, the concept picker may feel unresponsive. Debounce (200ms) is specified; additionally, a 500ms timeout should trigger a "Search taking longer than expected" inline message, and the user can still type and press Enter to use the typed text as a free-form concept (surfacing this as a design decision to the system analyst).

**Risk 5 — Session log grows unbounded**
During a long brainstorming session, the session log could accumulate 50+ cards, making the page very long. Mitigation: cap the visible session log at 10 most recent items, with a "Show all N notes from this session" expand control.

---

## 13. Implementation Notes for Developers

### 13.1 New Route/View

Add `"capture"` to the `AppView` type union in `HallOfMind.tsx`. Add a corresponding sidebar navigation entry in the Features group with a `Zap` or `Feather` icon from `lucide-react`.

### 13.2 Component Location

```
ui/src/components/capture/
├── QuickCapturePage.tsx        (main view, registered as AppView "capture")
├── ClassificationBar.tsx       (sticky controls wrapper)
├── ArchiveSelector.tsx         (single-select, conditionally rendered)
├── CollectionSelector.tsx      (single-select with hierarchy display)
├── ConceptPicker.tsx           (combobox with autocomplete)
├── TagBar.tsx                  (multi-value token input)
├── CaptureArea.tsx             (textarea + counter + commit button)
├── SessionLog.tsx              (list of committed notes)
├── SessionNoteCard.tsx         (individual committed note card)
├── useStickySettings.ts        (custom hook: read/write localStorage sticky state)
├── useNoteCommit.ts            (custom hook: API call sequence for note creation)
└── index.ts                    (barrel export)
```

### 13.3 useStickySettings Hook

This hook encapsulates the read/write of all classification bar values from/to localStorage. It returns the current values and setter functions. All setters write to localStorage immediately (no debounce needed — values are small strings).

### 13.4 useNoteCommit Hook

This hook manages the four-step API call sequence (create → tags → collection → concept hint). It returns:
- `commit(content, format, settings) => Promise<CommitResult>`
- `isCommitting: boolean`
- `lastError: string | null`
- `retry: () => void`

### 13.5 Textarea Auto-Grow

Use a standard pattern: mirror the textarea content in a hidden `<div>` with identical styling. Set the textarea height to match the div's `scrollHeight`, clamped between `minHeight` and `maxHeight`. This avoids flicker and works without JavaScript measurement loops.

---

## 14. Acceptance Criteria

The following criteria define when this feature is ready for review:

### Functional

- [ ] `Shift+Enter` in the textarea commits the note without inserting a newline
- [ ] `Ctrl+Enter` (Win/Linux) and `Cmd+Enter` (Mac) also commit the note
- [ ] After a successful commit, the textarea is cleared and focus returns to it within 100ms
- [ ] The classification bar retains all values after a commit
- [ ] Sticky settings survive a page refresh (read from localStorage on mount)
- [ ] Selecting a collection assigns the note to that collection via the API
- [ ] Applying tags in the tag bar results in those tags being set on the created note
- [ ] The concept picker autocompletes from `GET /api/v1/concepts/autocomplete`
- [ ] A selected concept is stored in note metadata after creation
- [ ] Committing a note with an offline server preserves the textarea content and shows an error
- [ ] Tag and collection data loading failures degrade gracefully without blocking note creation
- [ ] The session log renders the most recent note at the top after each commit
- [ ] Session log cards are clickable and open the note in the main notes view
- [ ] The session counter increments with each successful commit and pulses briefly

### Accessibility

- [ ] The view is fully operable by keyboard alone (no mouse required for any action)
- [ ] A screen reader using NVDA or JAWS announces successful commit via a live region
- [ ] Screen reader announces errors via an assertive live region
- [ ] Focus is placed in the textarea immediately when the view opens
- [ ] All form controls have visible labels and correct ARIA attributes
- [ ] All animated transitions respect `prefers-reduced-motion`
- [ ] All tap targets on mobile are at least 44x44px

### Performance

- [ ] The view renders and textarea is focused within 200ms of navigation
- [ ] The API call sequence for a note with one tag and one collection completes in under 1 second on a local Fortemi instance
- [ ] Autocomplete suggestions appear within 300ms of the 200ms debounce completing (500ms total from last keystroke)

---

*End of specification.*
