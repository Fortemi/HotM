# UX Specification: Persistent Media Player (Pop-Out / Floating)

**Document type**: UX Design Specification
**Version**: 1.1
**Date**: 2026-02-22
**Status**: Implemented (MINI + EXPANDED + Fullscreen); DOCKED_BAR and Native PiP deferred
**Author**: Product Designer
**Target component path**: `ui/src/components/player/`

---

## 1. Problem Statement

Users attach recorded lectures, interviews, and reference audio to notes in HotM. The current `StreamingVideoPlayer` and `StreamingAudioPlayer` live inside a preview dialog (or inline in `AttachmentsPanel`). When the user navigates away — switching `currentView` via the sidebar, opening a different note, or using Quick Capture — the media element is unmounted and playback stops. This breaks the primary use case of reviewing media while simultaneously writing notes.

**Primary persona**: A researcher or student listening to a recorded lecture while annotating it in a note.

**Primary job to be done**: Keep media playing and positioned when switching between app views, so the user can consume reference content and write simultaneously without losing their place.

---

## 2. Scope and Content Type Priority

Not all attachment types benefit equally from a persistent player. This spec prioritizes as follows:

| Content type | Pop-out supported | Rationale |
|---|---|---|
| Video | Yes — full feature set | Highest user value; lecture / interview review |
| Audio | Yes — full feature set | Podcast, interview, voice memo reference |
| PDF | Partial — floating panel, page nav only | Useful for cross-referencing; lower urgency |
| Images | No | Static; users re-open trivially |
| 3D models | No | Requires full focus; interaction model incompatible with mini player |

PDF floating panel design is described in section 8. Video and audio are the primary design targets throughout.

---

## 3. Player States and State Machine

### 3.1 State Definitions

The persistent player exists in one of five states:

```
INACTIVE
  │
  ├─ User opens media ──────────────────────────────► INLINE
  │                                                       │
  │                                      User pops out ──┤
  │                                                       │
  │                             ┌─────────────────────► MINI
  │                             │   (default pop-out)     │
  │                             │                         ├── User expands ──► EXPANDED
  │                             │                         │
  │                             │                         ├── User docks ────► DOCKED_BAR
  │                             │                         │
  │                             │                         └── User dismisses ► INACTIVE
  │                             │
  │                    EXPANDED ─┤
  │                    DOCKED_BAR┘
  │
  └── User clicks "Return to source" (any pop-out state) ► INLINE
```

**INACTIVE**: No persistent player. The `<MediaPlayerProvider>` context holds null.

**INLINE**: Media plays inside the attachment preview at its natural location. No floating UI. This is the entry state for all media.

**MINI**: Small floating thumbnail in the bottom-right corner. 280px wide, 158px tall for video (16:9), 64px tall for audio. Draggable. Playback continues while the user works.

**EXPANDED**: Larger floating panel, resizable, draggable. 480px default width for video. Used when the user needs to see more of the content during note-taking.

**DOCKED_BAR**: Fixed bar anchored to the bottom edge of the app layout (above any global status bars). Full app width. 64px tall. Primarily for audio; acceptable for video with a small thumbnail.

**NATIVE_PIP**: Browser `requestPictureInPicture()`. The browser owns this window. HotM does not design this surface but provides the trigger and handles re-entry.

### 3.2 Allowed State Transitions

| From | To | Trigger |
|---|---|---|
| INLINE | MINI | User clicks Pop-out button on player |
| INLINE | MINI | Auto-transition on navigate-away (optional, opt-in) |
| MINI | EXPANDED | User clicks expand icon on mini player |
| MINI | DOCKED_BAR | User clicks dock icon on mini player |
| MINI | NATIVE_PIP | User clicks PiP icon (video only) |
| MINI | INLINE | User clicks "Return to note" |
| MINI | INACTIVE | User clicks X (dismiss) |
| EXPANDED | MINI | User clicks minimize icon |
| EXPANDED | DOCKED_BAR | User clicks dock icon |
| EXPANDED | NATIVE_PIP | User clicks PiP icon (video only) |
| EXPANDED | INLINE | User clicks "Return to note" |
| EXPANDED | INACTIVE | User clicks X |
| DOCKED_BAR | MINI | User clicks undock icon |
| DOCKED_BAR | EXPANDED | User clicks expand icon |
| DOCKED_BAR | INLINE | User clicks "Return to note" |
| DOCKED_BAR | INACTIVE | User clicks X |
| NATIVE_PIP | MINI | Browser PiP close / `leavepictureinpicture` event |
| Any pop-out | INACTIVE | Media playback ends naturally |

---

## 4. Pop-Out Trigger Design

### 4.1 Primary Trigger: Explicit Button on the Player

The pop-out is initiated by an explicit button. It is never automatic by default because automatic behavior is surprising and can be disorienting — a recording stops and the user looks for where it went.

**Button placement in inline `StreamingVideoPlayer`**: Top-right of the player container, inside the `VideoControls` overlay (alongside the existing fullscreen and expert-mode buttons).

**Icon**: `PictureInPicture2` from Lucide (or equivalent pop-out/window icon). Label: "Pop out" (tooltip on hover, 300ms delay).

**Visual treatment**:

```
[existing player controls bar]
[Activity]                    [CC] [Volume] [Pop-out] [Fullscreen]
                                                ↑
                           New button, rightmost before fullscreen
```

Button appears on hover with the rest of the VideoControls bar (inherits existing auto-hide behavior). It is always visible when controls are visible, even during playback.

**Button placement in inline `StreamingAudioPlayer`**: Inline in the existing button row alongside CC and expert-mode toggles. It is always visible (not auto-hidden).

### 4.2 Secondary Affordance: Navigate-Away Auto-Minimize (Opt-in)

When the user navigates to a different view while media is playing and has not explicitly dismissed the player, HotM can optionally transition to MINI state automatically. This is opt-in (off by default) because it is surprising the first time.

Setting stored in `localStorage` key: `hotm.player.autoMinimizeOnNavigate` (boolean, default `false`).

The first time a user navigates away while something is playing (with auto-minimize off), show a one-time toast notification:

> "Playback stopped. Pop out the player to keep it running while you work. [Enable auto-minimize]"

"Enable auto-minimize" link sets the preference. This is not a blocking dialog.

### 4.3 Right-Click / Context Menu Trigger

The attachment thumbnail card in `AttachmentsBrowser` (grid and list view) gains a context menu item: "Open in player". This opens the media in INLINE state. A secondary option "Open in pop-out player" opens directly to MINI state, bypassing INLINE entirely.

---

## 5. Mini Player Design

Mini is the default pop-out state. It is a small, unobtrusive floating panel.

### 5.1 Dimensions

**Video mini player**:

```
┌──────────────────────────────────────────┐
│ [▶ ──────────────────────────] ×         │  20px top bar
├──────────────────────────────────────────┤
│                                          │
│         [video thumbnail frame]          │  158px
│                                          │
│  ▐▌  ◀10  0:42 / 1:23:15  ▶10  🔊  ⤢  │  32px control bar
└──────────────────────────────────────────┘
   280px wide
```

- Total dimensions: 280px wide × 210px tall
- Video aspect ratio: 16:9 (158px height for video area)
- Control bar: 32px, always visible (no auto-hide in mini state — controls bar is too small to hunt for)
- Top bar (drag handle + title + close): 20px

**Audio mini player**:

```
┌──────────────────────────────────────────┐
│ [♪] Lecture 3 — Ethics           [⤢] [×]│  44px row
│     ▐▌  ◀10  0:42 / 1:23:15  10▶  [🔊] │  20px row
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  │  4px seek bar
└──────────────────────────────────────────┘
   280px wide × 68px tall
```

- Total dimensions: 280px wide × 68px tall
- No waveform visualization in mini state (too small to be useful)

### 5.2 Position and Snapping

**Default position**: Bottom-right corner of the viewport, 16px from the right edge and 16px from the bottom edge (above any docked system bars or the app's bottom status indicators).

**Drag behavior**: Draggable by the top bar drag handle area. The entire top bar is the drag target.

**Snap zones**: On drag release, the player snaps to the nearest of four corners:
- Bottom-right (default)
- Bottom-left
- Top-right
- Top-left

Snap occurs when the player center is within 120px of a corner. Outside that threshold, it floats freely.

Snap zone animation: `transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1)` on release.

Last position (including corner snap) is persisted in `localStorage` key `hotm.player.miniPosition` as `{ corner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left', offsetX: number, offsetY: number }`.

**Conflict avoidance**: When the mini player would overlap the active input area (note editor), default to bottom-right and flash a brief tooltip suggesting drag to relocate.

### 5.3 Controls in Mini State

Controls must be readable at 280px width. Prioritize by frequency of use in lecture-review scenario.

**Video mini controls** (left to right in the 32px control bar):

| Control | Icon | Touch target |
|---|---|---|
| Play/Pause | Play / Pause | 28px |
| Skip back 10s | SkipBack | 24px |
| Time display | "0:42 / 1:23:15" monospace | auto |
| Skip forward 10s | SkipForward | 24px |
| Mute toggle | Volume2 / VolumeX | 24px |
| Expand to EXPANDED state | Maximize2 | 24px |

**Omitted from mini state** (not enough space, accessible in EXPANDED):
- Volume slider
- Caption toggle
- Seek-bar thumbnail preview
- Expert mode

**Seek bar**: Full-width above the control row, 4px height. Draggable. No hover thumbnail preview in mini (no room). Shows buffer in muted blue.

**Audio mini controls**:

Same as video but without video area. The seek bar sits at the bottom of the panel.

### 5.4 Mini Player Z-Index

Z-index layer: 1000. This places it above all app content, sidebar overlays, and dropdowns (which use z-index up to 50 in Radix UI's default stack), but below system-level dialogs and full-screen overlays (which should use z-index 1100+).

### 5.5 Return-to-Source Button

The top bar of the mini player includes a small "Return to note" icon (FilmIcon or a note icon) as a clickable element. Clicking it:
1. Navigates the main view back to the note that owns the attachment (sets `currentView` to "notes" and selects the note).
2. Transitions the player from MINI back to INLINE.
3. Restores playback position (already in progress if it was playing).

If the originating note context cannot be resolved (e.g., media opened from the global AttachmentsBrowser without a specific note), the button is labeled "Close pop-out" and transitions to INACTIVE instead.

---

## 6. Expanded Floating Player Design

### 6.1 Dimensions

**Video expanded**:
```
┌─────────────────────────────────────────────────────────┐
│ [drag handle]  lecture-3.mp4                  [_][⤢][×] │  40px header
├─────────────────────────────────────────────────────────┤
│                                                         │
│                 [video playback area]                   │  270px (16:9)
│                                                         │
│  ── Full VideoControls bar (all controls) ─────────────│  48px
├─────────────────────────────────────────────────────────┤
│ [Return to note]           [PiP] [Dock] [Fullscreen]   │  40px footer
└─────────────────────────────────────────────────────────┘
   480px wide × 398px tall (default)
```

**Resizable**: Resize handle on bottom-right corner. Minimum: 320px wide, 240px tall. Maximum: 80vw × 80vh.

**Draggable**: By the header bar.

**Default position**: Bottom-right, 24px margin from edges.

### 6.2 Controls in Expanded State

Expanded state renders the full `VideoControls` component with no omissions:
- Play/Pause, Skip ±10s
- SeekBar with buffer visualization and hover thumbnail preview
- Time display
- Volume slider (expanded on hover as currently implemented)
- Caption toggle (when captions available)
- Mute toggle
- Expert mode button (Activity icon)

Audio expanded state adds a waveform image if the API provides a posterUrl for the attachment.

### 6.3 Footer Bar in Expanded State

```
[FileText icon] Return to note   [PiP] [Dock bar] [Fullscreen] [X Close]
```

- "Return to note" navigates back to the source note and collapses to INLINE.
- PiP triggers `videoRef.current.requestPictureInPicture()`.
- "Dock bar" transitions to DOCKED_BAR state.
- Fullscreen expands the video to the full viewport (existing behavior).
- X closes the player entirely (INACTIVE).

---

## 7. Docked Bar Design

### 7.1 Layout

Fixed bottom bar. Renders below the main app content area but above any browser chrome.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ [thumbnail] lecture-3.mp4  ▐▌  ◀10  ████████░░░░░░░░░░░░░  0:42/1:23  10▶  🔊  [↗][×]│
└──────────────────────────────────────────────────────────────────────────────────────┘
  Full app width × 64px tall
```

- Left: 48×48px video thumbnail (or audio waveform icon + Music icon)
- Filename truncated to available space
- Play/Pause, Skip ±10s
- Seek bar (full width center, 8px height)
- Time display
- Volume mute toggle
- Expand icon (transitions to EXPANDED)
- X icon (INACTIVE)

The docked bar shifts the main content area upward by 64px so no content is obscured. This is handled by adding a class `has-docked-player` to the app root that applies `padding-bottom: 64px` to the main scroll container.

### 7.2 When to Recommend Docked Bar

Audio content defaults better in the docked bar than the mini player because there is no video frame — the mini player for audio is very narrow and offers no visual context. When a user pops out audio for the first time, display a tooltip: "Prefer a full-width player? [Dock to bottom]". One-time only.

---

## 8. Native Picture-in-Picture (Video Only)

### 8.1 Trigger

Available as an option in MINI and EXPANDED states. Uses the browser's `document.pictureInPictureEnabled` capability check. If unavailable (Firefox without flag, mobile browsers), the button is hidden, not disabled with an error.

Implementation calls `videoRef.current.requestPictureInPicture()`. The existing `videoRef` in `StreamingVideoPlayer` is already the correct ref to use.

### 8.2 Re-entry Behavior

When the browser fires `leavepictureinpicture` (user closes the PiP window), HotM transitions back to MINI state at the last known position. Playback does not pause — the browser maintains the media element's playback state through PiP transitions.

### 8.3 Controls in PiP Mode

The browser provides its own basic controls in the PiP window. HotM registers media session action handlers for `play`, `pause`, `seekbackward`, and `seekforward` so OS-level media controls (keyboard media keys, lock screen controls) continue to function.

---

## 9. Multi-Media and Conflict Handling

### 9.1 Opening a Second Media File While One is Playing

When the user opens a second attachment:

1. Pause the currently playing media (do not stop, preserve position).
2. Show an inline decision prompt overlaid at the bottom of the mini player (or as a toast if in DOCKED_BAR):

```
┌─────────────────────────────────────────────┐
│ Playing: lecture-3.mp4 (paused)             │
│ Open: interview-notes.mp4 ?                 │
│                                             │
│  [Replace]    [Open inline]    [Cancel]     │
└─────────────────────────────────────────────┘
```

**Replace**: Load new media into the persistent player. Previous media's position is saved; user can return to it via playback history (future feature) or by reopening the attachment.

**Open inline**: Open the new media in the normal INLINE preview within the attachment panel, leaving the pop-out player undisturbed. Both play simultaneously (user controls volume of each individually).

**Cancel**: Dismiss, resume previously paused media.

### 9.2 Same Attachment Re-Opened

If the user navigates back to the source note and clicks the same attachment again while the pop-out player is active for that attachment, do not re-open a second player. Instead, scroll the pop-out player into view if it is out of the viewport, and optionally transition from pop-out MINI to INLINE to show full context. Offer a choice: "Resume in pop-out" (keeps current state) or "Bring back here" (INLINE transition).

### 9.3 Queue (Future Scope — Not Designed Here)

Multi-file queuing (playlist behavior) is out of scope for this feature. Flagged as a future enhancement.

---

## 10. Interaction with the Note Editor

### 10.1 Positioning

Default corner: bottom-right. The note editor's primary action area (the markdown editor textarea, `MarkdownEditor`) occupies center-left. This means the mini player does not overlap the typing area by default.

If the user drags the mini player to overlap the editor, no automatic repositioning occurs. Trust the user's intent.

### 10.2 Keyboard Shortcuts

Player keyboard shortcuts must not conflict with note editor shortcuts. The player's keyboard handlers fire only when the player element has focus. Global shortcuts (when player does not have focus) are scoped with a modifier:

| Shortcut | Action | Scope |
|---|---|---|
| Alt+P | Play/Pause pop-out player | Global (when player active) |
| Alt+ArrowLeft | Skip back 10s | Global |
| Alt+ArrowRight | Skip forward 10s | Global |
| Alt+M | Mute/unmute | Global |
| Alt+Shift+P | Dismiss pop-out (INACTIVE) | Global |
| Alt+Shift+E | Toggle MINI/EXPANDED | Global |
| Space, k, j, l, f, m, c | Existing VideoControls shortcuts | Player focused only |

`Alt` was chosen because:
- It does not conflict with the Markdown editor's text input (Space, Arrow keys are consumed by the editor).
- It does not conflict with browser shortcuts (which use `Ctrl+Alt`).
- It is memorable as "alt content" or "alternate control".

Global shortcuts are registered on the window when a persistent player is active and unregistered when INACTIVE.

### 10.3 Transcript Sync in Pop-Out Mode

The interactive `TranscriptPanel` (which currently renders below the inline player) is not included in the MINI state. In EXPANDED state, the transcript panel can optionally be shown as a collapsible section below the video controls, within the expanded panel. This is a significant addition to the expanded panel height; it is off by default and toggled by a CC icon in the expanded footer.

In DOCKED_BAR state, the transcript is not shown. The user can return to INLINE to read it.

---

## 11. Mobile and Small-Screen Behavior

### 11.1 Mobile (< 640px)

The floating mini player is not shown on mobile. The screen is too small for simultaneous media and editing.

On mobile, when a user navigates away from media:
- Pause playback
- Show a persistent notification bar (bottom of screen, 48px) with play/pause, time display, and a "Tap to return" affordance.
- This bar does not float. It docks at the bottom, like DOCKED_BAR.

Full editing + media simultaneously is a desktop / large-tablet use case. On mobile, the pattern is: tap notification bar to return to media, back button to return to editor.

### 11.2 Tablet (640px–1024px)

Mini player and docked bar are supported. Expanded player defaults to a smaller size (360px wide). Drag and snap behavior is identical to desktop.

The sidebar in HotM collapses on tablet (`SidebarProvider` behavior). When the sidebar is collapsed, the mini player has more room and does not need adjustment.

---

## 12. PDF Floating Panel

Out of full video/audio scope, but designed here for completeness.

### 12.1 Panel Design

A PDF cannot play in a true player sense. The floating panel for PDFs is a lightweight floating viewer.

```
┌──────────────────────────────┐
│ [drag] document.pdf    [×]   │  40px header
├──────────────────────────────┤
│                              │
│    [PDF page content]        │  400px
│                              │
├──────────────────────────────┤
│ [<] Page 3 of 12 [>]  [⤢]  │  40px nav bar
└──────────────────────────────┘
   360px wide × 480px tall (default)
```

PDF rendering uses the existing PDF viewer (or an embedded browser frame pointing to the attachment URL with a `#page=N` fragment). The floating panel does not implement a custom renderer — it wraps whatever the current preview uses.

Page position is persisted in `localStorage` key `hotm.player.pdf.{attachmentId}.page`.

Trigger: same "Pop out" button on the existing PDF preview, plus context menu option on the attachment card.

---

## 13. State Persistence and Media Continuity

### 13.1 What is Persisted

The `MediaPlayerProvider` React context holds the single active player session. On app reload or SPA navigation, the session is not automatically restored — the user must re-open the media. There is no cross-session persistence for the player state (only position, which already persists via `hotm-playback-{attachmentId}`).

### 13.2 `localStorage` Keys Summary

| Key | Type | Purpose |
|---|---|---|
| `hotm-playback-{attachmentId}` | number | Playback position (existing) |
| `hotm.player.autoMinimizeOnNavigate` | boolean | Opt-in auto-minimize behavior |
| `hotm.player.miniPosition` | object | Last mini player corner and offset |
| `hotm.player.defaultState` | string | Preferred pop-out state (MINI, EXPANDED, DOCKED_BAR) |
| `hotm.player.pdf.{attachmentId}.page` | number | PDF page position |

### 13.3 Media Element Lifecycle

The critical implementation constraint: to maintain playback across `currentView` changes, the media element (`<video>` or `<audio>`) must not be unmounted when the view changes. This means the `<MediaPlayerPortal>` component must render at the root level (sibling of `<SidebarProvider>` / the main app layout), not inside any view-specific component tree.

The `StreamingVideoPlayer` in pop-out mode renders into this root portal. The inline player and the pop-out portal share the same underlying media element via a ref passed through the `MediaPlayerProvider` context.

---

## 14. Accessibility Requirements

All requirements are additions to the existing WCAG 2.1 AA baseline documented in `/home/roctinam/dev/HotM/docs/ux/accessibility-specification.md`.

### 14.1 Roles and ARIA

**Mini player**:

```html
<div
  role="region"
  aria-label="Media player: lecture-3.mp4"
  aria-live="polite"
>
  <button aria-label="Drag to reposition player" class="drag-handle" />
  <button aria-label="Play / Pause" />
  <button aria-label="Skip back 10 seconds" />
  <!-- time display -->
  <output aria-label="Playback position">0:42 / 1:23:15</output>
  <input type="range" aria-label="Seek bar" aria-valuemin="0" aria-valuemax="5000" aria-valuenow="42" aria-valuetext="42 seconds" />
  <button aria-label="Expand player" />
  <button aria-label="Close player" />
</div>
```

**Docked bar**:

```html
<aside
  role="complementary"
  aria-label="Media player bar"
>
```

**State change announcements**: When the player state changes (e.g., transitions to MINI or is dismissed), announce via `aria-live="polite"` region at app root:

- Transition to MINI: "Media player minimized. Press Alt+P to play or pause."
- Transition to INACTIVE: "Media player closed."

### 14.2 Keyboard-Only Usage

The mini player is reachable via Tab in the natural focus order. It appears after the main content and before any global footers. When focused, all controls are operable with keyboard.

The drag handle is keyboard-operable: focus the handle, press Space/Enter to activate repositioning mode, then use Arrow keys to move 8px per keypress, Enter or Escape to confirm/cancel.

```
[drag handle focused] → Press Space → arrows move player → Enter to confirm
```

### 14.3 Reduced Motion

When `prefers-reduced-motion: reduce`:
- Snap animation is instant (no transition).
- State transition fade-ins are instant.
- The player does not bounce or animate on appearance.

### 14.4 Screen Reader Announcements

| Event | Announcement |
|---|---|
| Pop-out initiated | "lecture-3.mp4 moved to floating player. Press Alt+P to play or pause." |
| Playback paused (auto, on navigate) | "Playback paused. Media player is in the bottom-right corner." |
| Player dismissed | "Media player closed." |
| Second media conflict | Alert dialog: "lecture-3.mp4 is paused. Do you want to replace it with interview-notes.mp4?" (modal dialog, `role="alertdialog"`) |

### 14.5 Color Contrast

Controls on the dark video control bar: white (#FFFFFF) on black/80% overlay. Ratio: > 4.5:1 — meets AA.

Controls on the docked bar: must use the app's existing foreground-on-surface token. Verify minimum 4.5:1.

---

## 15. Component Architecture Sketch

This is a high-level implementation sketch to confirm feasibility — not a full implementation spec.

### 15.1 New Files

```
ui/src/components/media-player/
  MediaPlayerProvider.tsx    — React context holding active session
  MediaPlayerPortal.tsx      — Renders at app root, outside view tree
  MiniPlayer.tsx             — MINI state UI
  ExpandedPlayer.tsx         — EXPANDED state UI
  DockedBar.tsx              — DOCKED_BAR state UI
  PdfFloatingPanel.tsx       — PDF viewer floating panel
  useMediaPlayer.ts          — Hook to read/write active session
  usePlayerPosition.ts       — Drag and snap logic
  usePlayerKeyboard.ts       — Global Alt+* shortcuts
  useConflictResolution.ts   — Second-media-opened logic
  index.ts                   — Barrel export
```

### 15.2 Changes to Existing Files

**`HallOfMind.tsx`**:
- Wrap app layout with `<MediaPlayerProvider>`.
- Render `<MediaPlayerPortal>` as a sibling to the main content area, outside the view-switching tree.
- Pass `onPopOut` callback down into `AttachmentsBrowser` and `AttachmentsPanel`.

**`StreamingVideoPlayer.tsx` and `StreamingAudioPlayer.tsx`**:
- Accept an `onPopOut?: () => void` prop.
- When `onPopOut` is defined, render the pop-out trigger button.
- When operating in pop-out mode (controlled by context), defer rendering to `MediaPlayerPortal`.

**`VideoControls.tsx`**:
- Accept a `compact?: boolean` prop that removes omitted controls in mini state.
- Accept `onPopOut?: () => void` prop for the new button.

### 15.3 Context Shape (Sketch)

```typescript
interface MediaSession {
  attachmentId: string;
  noteId?: string;          // originating note, for "Return to note"
  mediaType: 'video' | 'audio' | 'pdf';
  filename: string;
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement>;
  state: 'INLINE' | 'MINI' | 'EXPANDED' | 'DOCKED_BAR' | 'NATIVE_PIP';
  currentTime: number;
  isPlaying: boolean;
  // ... other playback state
}

interface MediaPlayerContextValue {
  session: MediaSession | null;
  startSession: (opts: StartSessionOpts) => void;
  endSession: () => void;
  setState: (state: MediaSession['state']) => void;
  returnToInline: () => void;
}
```

---

## 16. Outstanding Questions and Design Risks

| # | Question | Impact | Owner |
|---|---|---|---|
| Q1 | Does React 19 allow sharing a single `<video>` element between two render trees (inline + portal) via a ref, or does the element need to be cloned? | Critical — determines whether position is preserved on state transition | Implementer |
| Q2 | The `StreamingVideoPlayer` currently handles `direct` vs `blob` mode internally. Does moving the element to a portal break the blob URL lifecycle (which is tied to the component's `useEffect` cleanup)? | High | Implementer |
| Q3 | Will the existing `VideoControls` auto-hide timer behave correctly when the component re-renders inside a portal on state change? | Medium | Implementer |
| Q4 | Does the Fortemi API return a poster/thumbnail URL for video attachments that can be used in the mini player's 280×158px thumbnail area? | Medium — mini player works without it but is better with it | System Analyst |
| Q5 | On `leavepictureinpicture` event, does the video element remain the same DOM element or does the browser re-create it? (affects position restoration) | Medium | Implementer |
| Q6 | Is a playlist / queue feature expected in the near term? If yes, the multi-media conflict model should be extended rather than the current "replace or open inline" design. | Low (future scope) | Product |
| Q7 | Should the docked bar shift the main content area upward, or float above it? Shifting is cleaner but requires layout changes to `HallOfMind.tsx`. | Low-Medium | Implementer |

---

## 17. Acceptance Criteria

### Functional

- A user can initiate pop-out from the inline video or audio player with one click.
- Media continues playing when `currentView` changes (sidebar navigation).
- The mini player is draggable and snaps to corners on release.
- All four states (MINI, EXPANDED, DOCKED_BAR, NATIVE_PIP) are reachable via UI affordances.
- "Return to note" navigates to the source note and collapses the player to INLINE.
- Opening a second media file while one is playing presents a choice prompt rather than auto-replacing.
- Playback position is preserved across all state transitions.

### Accessibility

- The mini player is fully keyboard-navigable including the drag handle.
- All controls have appropriate `aria-label` values.
- State transitions are announced to screen readers via `aria-live`.
- Global Alt+P, Alt+ArrowLeft, Alt+ArrowRight shortcuts function when editor has focus.
- `prefers-reduced-motion` removes all transition animations.

### Usability

- The mini player does not obscure the note editor when in the default bottom-right corner position.
- The docked bar shifts layout rather than floating over content.
- On mobile (< 640px), a simple bottom notification bar replaces the floating player.
- The one-time auto-minimize suggestion toast appears the first time playback is interrupted by navigation.

### Performance

- No additional API calls are made to sustain the pop-out player — the existing media element and stream are preserved.
- Blob URL lifecycle (for memory-routed archives) is not broken by the portal rendering approach.
- The `MediaPlayerProvider` adds no observable rendering overhead to the main app view.

---

## 18. Related Documents

- `/home/roctinam/dev/HotM/docs/ux/wireframes/02-file-attachments-panel.md` — Attachment browser grid and preview modal specs (thumbnails, context menus)
- `/home/roctinam/dev/HotM/docs/ux/accessibility-specification.md` — Project-wide WCAG 2.1 AA baseline
- `/home/roctinam/dev/HotM/ui/src/components/attachments/StreamingMedia.tsx` — Current video/audio player implementation
- `/home/roctinam/dev/HotM/ui/src/components/attachments/VideoControls.tsx` — Current controls overlay
- `/home/roctinam/dev/HotM/ui/src/components/HallOfMind.tsx` — App shell, `AppView` union type, layout structure
