# Version History - Wireframe Specification

**Version**: 1.0
**Last Updated**: 2026-02-04
**Component**: Version History
**Grid System**: 8px base unit

---

## Overview

Timeline-based interface for viewing note edit history, comparing versions with diff viewer, and restoring previous versions.

---

## Desktop Layout (>1024px)

### Side Panel Mode (Default)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Version History                                                          [×] Close      │ 64px
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ ┌────────────────────┐ ┌────────────────────────────────────────────────────────────┐ │
│ │ Timeline           │ │ Content Viewer                     [View] [Diff] [⋮] More  │ │
│ │ ──────────────     │ │                                                            │ │
│ │                    │ │                                                            │ │
│ │ [Original▼][All▼]  │ │ ┌────────────────────────────────────────────────────────┐ │ │
│ │                    │ │ │ Version 3 (Current)                                    │ │ │
│ │ ●──────            │ │ │ Jan 24, 2026 3:45 PM • You                             │ │ │
│ │ v3 Current         │ │ │ ──────────────────────────────────────────────────     │ │ │
│ │ Jan 24, 3:45 PM    │ │ │                                                        │ │ │
│ │ ✍️ You              │ │ │ # Meeting Notes                                       │ │ │
│ │ +245 chars         │ │ │                                                        │ │ │
│ │ [View] [Compare]   │ │ │ ## Attendees                                           │ │ │
│ │                    │ │ │ - Alice (Product)                                      │ │ │
│ │ ┊                  │ │ │ - Bob (Engineering)                                    │ │ │
│ │ ●──────            │ │ │ - Carol (Design)                                       │ │ │
│ │ v2                 │ │ │                                                        │ │ │
│ │ Jan 22, 2:30 PM    │ │ │ ## Action Items                                        │ │ │
│ │ 🤖 llama3.2         │ │ │ 1. Finalize designs (Carol)                           │ │ │
│ │ Revised            │ │ │ 2. Deploy API (Bob)                                    │ │ │
│ │ +89 / -12 chars    │ │ │ 3. Write docs (Alice)                                  │ │ │
│ │ [View] [Compare]   │ │ │                                                        │ │ │
│ │                    │ │ │ ## Next Meeting                                        │ │ │
│ │ ┊                  │ │ │ Friday, Jan 26 at 2 PM                                 │ │ │
│ │ ●──────            │ │ │                                                        │ │ │
│ │ v1                 │ │ │                                                        │ │ │
│ │ Jan 20, 10:15 AM   │ │ │                                                        │ │ │
│ │ ✍️ You              │ │ │                                                        │ │ │
│ │ Original           │ │ │                                                        │ │ │
│ │ 1,234 chars        │ │ │                                                        │ │ │
│ │ [View] [Compare]   │ │ │                                                        │ │ │
│ │                    │ │ │                                                        │ │ │
│ │                    │ │ │                                                        │ │ │
│ │                    │ │ │                                                        │ │ │
│ │                    │ │ │                                                        │ │ │
│ │                    │ │ │                                                        │ │ │
│ │                    │ │ └────────────────────────────────────────────────────────┘ │ │
│ │                    │ │                                                            │ │
│ │                    │ │ ┌────────────────────────────────────────────────────────┐ │ │
│ │                    │ │ │ [Restore This Version]           [Download as Markdown]│ │ │
│ │                    │ │ └────────────────────────────────────────────────────────┘ │ │
│ │                    │ │                        64px height                         │ │
│ └────────────────────┘ └────────────────────────────────────────────────────────────┘ │
│    300px width                      700px+ width                                       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Panel width: 1000px (80vw max)
- Timeline panel: 300px width (left)
- Content panel: 700px+ width (right)
- Header: 64px height
- Version card: 120px height
- Timeline connector: 2px width
- Timeline dot: 12px diameter
- Action buttons: 40px height
- Footer toolbar: 64px height
- Horizontal padding: 16px
- Gap between versions: 16px

---

### Version Card (Timeline)

```
┌──────────────────────────────────┐
│ ●────────                        │ 12px dot
│ v3 Current                       │ 24px
│ Jan 24, 2026 3:45 PM             │ 20px
│ ✍️ You                            │ 24px
│ +245 chars                       │ 20px
│ [View] [Compare]                 │ 40px
└──────────────────────────────────┘
  Total: 120px height
  Padding: 12px
  Border-radius: 8px
```

**Card States**:

**Default**:
```
Background: #ffffff
Border: 1px solid #e5e7eb
```

**Selected (viewing)**:
```
Background: rgba(59, 130, 246, 0.05)
Border: 2px solid #3b82f6
Border-left: 4px solid #3b82f6
```

**Hover**:
```
Background: #f9fafb
Border: 1px solid #d1d5db
Shadow: 0 2px 4px rgba(0,0,0,0.05)
```

**Current Version**:
```
Badge: Blue pill shape, 24px height
Icon: ✓ checkmark
Text: "Current"
```

---

### Diff View Mode

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Diff Viewer                                                              [×] Close      │ 64px
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Compare:  [v2 Jan 22               ▼]  ⇄  [v3 Current            ▼]               │ │ 56px
│ │                                                                                    │ │
│ │ Changes:  [+245 lines added]  [-12 lines removed]  [= 842 unchanged]             │ │ 32px
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Side-by-Side View                                    [Side-by-Side▼] [Unified]    │ │ 48px
│ ├──────────────────────────────────────┬─────────────────────────────────────────────┤ │
│ │ Version 2 (Jan 22)                   │ Version 3 (Current)                         │ │ 40px
│ ├──────────────────────────────────────┼─────────────────────────────────────────────┤ │
│ │  1  # Meeting Notes                  │  1  # Meeting Notes                         │ │ 24px
│ │  2                                   │  2                                          │ │ 24px
│ │  3  ## Attendees                     │  3  ## Attendees                            │ │ 24px
│ │  4  - Alice (Product)                │  4  - Alice (Product)                       │ │ 24px
│ │  5  - Bob (Engineering)              │  5  - Bob (Engineering)                     │ │ 24px
│ │  6                                   │  6  - Carol (Design)                        │ │ 24px
│ │                                      │                                             │ │      green
│ │  7                                   │  7                                          │ │ 24px
│ │  8  ## Action Items                  │  8  ## Action Items                         │ │ 24px
│ │  9  1. Finalize designs              │  9  1. Finalize designs (Carol)             │ │ 24px
│ │                                      │                                             │ │      green
│ │ 10  2. Deploy API                    │ 10  2. Deploy API (Bob)                     │ │ 24px
│ │                                      │                                             │ │      green
│ │ 11  3. Write specs                   │ 11  3. Write docs (Alice)                   │ │ 24px
│ │                     red background   │                      green background       │ │
│ │ 12                                   │ 12                                          │ │ 24px
│ │ 13  ## Next Steps                    │ 13  ## Next Meeting                         │ │ 24px
│ │                     red background   │                      green background       │ │
│ │ 14  TBD                              │ 14  Friday, Jan 26 at 2 PM                  │ │ 24px
│ │                     red background   │                      green background       │ │
│ │                                      │                                             │ │
│ │              ... more ...            │              ... more ...                   │ │
│ └──────────────────────────────────────┴─────────────────────────────────────────────┘ │
│                                                                                         │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [◀ Previous Change]       Change 3 of 5       [Next Change ▶]                     │ │ 56px
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Selector bar: 56px height
- Stats bar: 32px height
- View toggle: 48px height
- Column headers: 40px height
- Line height: 24px
- Line numbers: 40px width
- Gutter (between panels): 2px width
- Navigation bar: 56px height
- Horizontal padding: 16px

**Diff Colors**:
```css
/* Added lines */
--color-diff-add-bg: rgba(16, 185, 129, 0.1);
--color-diff-add-text: #10b981;
--color-diff-add-marker: "+";

/* Removed lines */
--color-diff-remove-bg: rgba(239, 68, 68, 0.1);
--color-diff-remove-text: #ef4444;
--color-diff-remove-marker: "-";

/* Changed lines (inline) */
--color-diff-change-bg: rgba(245, 158, 11, 0.1);
--color-diff-change-text: #f59e0b;

/* Unchanged lines */
--color-diff-unchanged: #6b7280;

/* Line numbers */
--color-line-number: #9ca3af;
--color-line-number-bg: #f9fafb;
```

---

### Unified Diff View

```
┌─────────────────────────────────────────────────────────────────────┐
│ Unified View                                                        │ 48px
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1    # Meeting Notes                                               │ 24px
│  2                                                                  │ 24px
│  3    ## Attendees                                                  │ 24px
│  4    - Alice (Product)                                             │ 24px
│  5    - Bob (Engineering)                                           │ 24px
│ +6    - Carol (Design)                                              │ 24px (green)
│  7                                                                  │ 24px
│  8    ## Action Items                                               │ 24px
│ -9    1. Finalize designs                                           │ 24px (red)
│ +9    1. Finalize designs (Carol)                                   │ 24px (green)
│ -10   2. Deploy API                                                 │ 24px (red)
│ +10   2. Deploy API (Bob)                                           │ 24px (green)
│ -11   3. Write specs                                                │ 24px (red)
│ +11   3. Write docs (Alice)                                         │ 24px (green)
│  12                                                                 │ 24px
│ -13   ## Next Steps                                                 │ 24px (red)
│ +13   ## Next Meeting                                               │ 24px (green)
│ -14   TBD                                                           │ 24px (red)
│ +14   Friday, Jan 26 at 2 PM                                        │ 24px (green)
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  Full width
  Line numbers: 48px width
  Prefix markers: + / - / space
```

---

## Tablet Layout (640-1024px)

### Collapsed Timeline

```
┌─────────────────────────────────────────────────────┐
│ Version History                       [×] Close     │ 64px
├─────────────────────────────────────────────────────┤
│                                                     │
│ ▼ Timeline (3 versions)                             │ 48px
│ ─────────────────────────────────────────────       │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ v3 Current • Jan 24 3:45 PM • You           │   │ 56px
│ │ +245 chars                    [View] [Diff] │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ v2 • Jan 22 2:30 PM • AI Revised            │   │ 56px
│ │ +89 / -12 chars               [View] [Diff] │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ v1 • Jan 20 10:15 AM • You                  │   │ 56px
│ │ Original 1,234 chars          [View] [Diff] │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Version 3 (Current)                         │   │
│ │ Jan 24, 2026 3:45 PM • You                  │   │
│ │ ─────────────────────────────────────────   │   │
│ │                                             │   │
│ │ # Meeting Notes                             │   │
│ │                                             │   │
│ │ ... content ...                             │   │
│ │                                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ [Restore Version]           [Download]             │ 64px
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Dimensions**:
- Timeline: Collapsible accordion (48px header)
- Version item: 56px height (compact)
- Content: Full width below timeline
- Buttons: 48px height
- Horizontal padding: 16px

---

## Mobile Layout (<640px)

### Mobile Version List

```
┌────────────────────────────────────────┐
│ ← Versions                   [⋮] Menu  │ 64px
├────────────────────────────────────────┤
│                                        │
│ Track: [All Versions           ▼]      │ 56px
│                                        │
├────────────────────────────────────────┤ 8px gap
│                                        │
│ ┌────────────────────────────────────┐│
│ │ ✓ v3 Current                       ││
│ │ Jan 24, 2026 3:45 PM               ││
│ │ ✍️ You                              ││ 88px
│ │ +245 chars                         ││
│ │ [View >]                           ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ v2                                 ││
│ │ Jan 22, 2026 2:30 PM               ││
│ │ 🤖 AI Revised (llama3.2)            ││ 88px
│ │ +89 / -12 chars                    ││
│ │ [View >]                           ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ v1 Original                        ││
│ │ Jan 20, 2026 10:15 AM              ││
│ │ ✍️ You                              ││ 88px
│ │ 1,234 chars                        ││
│ │ [View >]                           ││
│ └────────────────────────────────────┘│
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Header: 64px height
- Filter dropdown: 56px height
- Version card: 88px height
- Gap between cards: 8px
- Horizontal padding: 16px
- Action button: 48px height

---

### Mobile Version View

```
┌────────────────────────────────────────┐
│ ← Back                       [⋮] Menu  │ 64px
├────────────────────────────────────────┤
│                                        │
│ Version 3 (Current)                    │ 48px
│ Jan 24, 2026 3:45 PM                   │ 32px
│ ✍️ You                                  │ 32px
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [View] [Diff] [More]               ││ 48px
│ └────────────────────────────────────┘│ tabs
│                                        │
├────────────────────────────────────────┤
│                                        │
│ # Meeting Notes                        │
│                                        │
│ ## Attendees                           │
│ - Alice (Product)                      │
│ - Bob (Engineering)                    │
│ - Carol (Design)                       │ Scrollable
│                                        │ content
│ ## Action Items                        │
│ 1. Finalize designs (Carol)            │
│ 2. Deploy API (Bob)                    │
│ 3. Write docs (Alice)                  │
│                                        │
│ ## Next Meeting                        │
│ Friday, Jan 26 at 2 PM                 │
│                                        │
│                                        │
│                                        │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐│
│ │ [Restore This Version]             ││ 64px
│ └────────────────────────────────────┘│ sticky
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Header: 64px height
- Version info: 48px + 32px + 32px = 112px
- Tab bar: 48px height
- Content: Scrollable, full width
- Action button: 64px height (sticky bottom)
- Horizontal padding: 16px

---

### Mobile Diff View

```
┌────────────────────────────────────────┐
│ ← Back              Diff View     [⋮]  │ 64px
├────────────────────────────────────────┤
│                                        │
│ From: [v2 Jan 22               ▼]      │ 56px
│                                        │
│ To:   [v3 Current              ▼]      │ 56px
│                                        │
│ ┌────────────────────────────────────┐│
│ │ +245  -12  Changes: 5              ││ 48px
│ └────────────────────────────────────┘│
│                                        │
├────────────────────────────────────────┤
│ Unified View                           │ 40px
├────────────────────────────────────────┤
│                                        │
│  1  # Meeting Notes                    │ 32px
│  2                                     │ 32px
│  3  ## Attendees                       │ 32px
│  4  - Alice (Product)                  │ 32px
│  5  - Bob (Engineering)                │ 32px
│ +6  - Carol (Design)                   │ 32px
│                         green bg       │
│  7                                     │ 32px
│  8  ## Action Items                    │ 32px
│ -9  1. Finalize designs                │ 32px
│                         red bg         │
│ +9  1. Finalize designs (Carol)        │ 32px
│                         green bg       │
│                                        │
│              ... more ...              │
│                                        │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐│
│ │ [◀] Change 3/5 [▶]                 ││ 64px
│ └────────────────────────────────────┘│ sticky
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Header: 64px height
- Version selectors: 56px height each
- Stats bar: 48px height
- View label: 40px height
- Line height: 32px (larger touch target)
- Line numbers: 32px width
- Navigation: 64px height (sticky bottom)
- Horizontal padding: 16px

---

## Component States

### Timeline Dot & Connector

```
Current version:
  ●──────
  Size: 12px diameter
  Color: #3b82f6 (blue)
  Border: 2px solid #3b82f6
  Fill: #3b82f6

AI revision:
  ●──────
  Size: 12px diameter
  Color: #8b5cf6 (purple)
  Border: 2px solid #8b5cf6
  Fill: #8b5cf6

User edit:
  ●──────
  Size: 12px diameter
  Color: #10b981 (green)
  Border: 2px solid #10b981
  Fill: #10b981

Connector line:
  ┊
  Width: 2px
  Color: #e5e7eb
  Style: Dashed (for time gaps)
```

### Author Badges

```
User:
┌────────────┐
│ ✍️ You      │ 24px height
└────────────┘
Background: rgba(16, 185, 129, 0.1)
Color: #10b981

AI (llama3.2):
┌────────────┐
│ 🤖 llama3.2 │ 24px height
└────────────┘
Background: rgba(139, 92, 246, 0.1)
Color: #8b5cf6

AI (Other model):
┌────────────┐
│ 🤖 gpt-4    │ 24px height
└────────────┘
Background: rgba(139, 92, 246, 0.1)
Color: #8b5cf6
```

### Change Indicators

```
Added:
┌─────────────┐
│ +245 chars  │ 20px height
└─────────────┘
Color: #10b981

Removed:
┌─────────────┐
│ -12 chars   │ 20px height
└─────────────┘
Color: #ef4444

Mixed:
┌─────────────────┐
│ +89 / -12 chars │ 20px height
└─────────────────┘
Green: #10b981, Red: #ef4444
```

---

## Restore Confirmation Dialog

```
┌───────────────────────────────────────┐
│ Restore Version?                      │ 48px
├───────────────────────────────────────┤
│                                       │
│ Restore version 2 from Jan 22, 2026?  │ 24px
│                                       │
│ The current version will be preserved │ 20px
│ as a new version (v4).                │
│                                       │
│ Version 2 details:                    │ 24px
│ • Author: AI Revised (llama3.2)       │ 20px
│ • Date: Jan 22, 2026 2:30 PM          │ 20px
│ • Changes: +89 / -12 characters       │ 20px
│                                       │
│ This action can be undone by viewing  │ 20px
│ version history again.                │
│                                       │
│ ┌───────────────────────────────────┐ │
│ │ [Cancel]         [Restore Version]│ │ 56px
│ └───────────────────────────────────┘ │
│                                       │
└───────────────────────────────────────┘
  Width: 480px
  Height: Auto
  Padding: 24px
```

---

## Delete Version Confirmation

```
┌───────────────────────────────────────┐
│ Delete Version?                       │ 48px
├───────────────────────────────────────┤
│                                       │
│ ⚠️ Permanently delete version 1?      │ 32px
│                                       │
│ This action cannot be undone.         │ 20px
│                                       │
│ Version details:                      │ 24px
│ • v1 (Original)                       │ 20px
│ • Created: Jan 20, 2026 10:15 AM      │ 20px
│ • Author: You                         │ 20px
│                                       │
│ Note: You cannot delete the current   │ 20px
│ version. Restore a different version  │
│ first if you want to remove the       │
│ current content.                      │
│                                       │
│ ┌───────────────────────────────────┐ │
│ │ [Cancel]         [Delete Version] │ │ 56px
│ └───────────────────────────────────┘ │
│  Secondary button    Danger button    │
│                                       │
└───────────────────────────────────────┘
  Width: 480px
  Delete button: Red background
```

---

## Empty States

### No History Yet

```
┌────────────────────────────────────────┐
│                                        │
│              📜                        │ 64px
│                                        │
│    No Version History Yet              │ 24px
│                                        │
│    This note has only one version.     │ 16px
│    Edit the note to create a new       │
│    version and see changes over time.  │
│                                        │
│    [Edit Note]                         │ 48px
│                                        │
└────────────────────────────────────────┘
  Centered, max-width 400px
```

### Loading State

```
┌────────────────────────────────────────┐
│                                        │
│ ●────── v3 Current                     │
│ ░░░░░░░ ░░░░░░░░░░░░░░                │ Skeleton
│ ░░░░░░░ ░░░░░░░░                      │
│                                        │
│ ●────── v2                             │
│ ░░░░░░░ ░░░░░░░░░░░░░░                │
│ ░░░░░░░ ░░░░░░░░                      │
│                                        │
│ ●────── v1                             │
│ ░░░░░░░ ░░░░░░░░░░░░░░                │
│ ░░░░░░░ ░░░░░░░░                      │
│                                        │
└────────────────────────────────────────┘
  Pulsing gray gradient animation
```

---

## Accessibility Specifications

### ARIA Attributes

**Timeline**:
```html
<ol role="list" aria-label="Version history timeline">
  <li
    role="listitem"
    aria-label="Version 3, current version, created January 24th at 3:45 PM by you"
    aria-current="true"
  >
```

**Diff Viewer**:
```html
<div
  role="region"
  aria-label="Differences between version 2 and version 3"
>
  <table role="table" aria-label="Side-by-side diff">
    <thead>
      <tr role="row">
        <th scope="col">Change</th>
      </tr>
    </thead>
    <tbody>
      <tr role="row">
        <td role="cell" aria-label="Line 6 added">
          <ins>- Carol (Design)</ins>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**Version Selector**:
```html
<select
  aria-label="Select version to compare from"
  aria-controls="diff-content"
>
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between versions and actions |
| Shift+Tab | Navigate backward |
| Enter | View selected version |
| Space | Toggle version selection for comparison |
| Arrow Up/Down | Navigate version list |
| D | Open diff view |
| R | Restore selected version (with confirm) |
| N | Next change in diff (when in diff view) |
| P | Previous change in diff |
| Escape | Close diff view, close modal |
| Ctrl+F | Find in version content |

### Screen Reader Announcements

```
"Version history loaded. 3 versions available.
 Currently viewing version 3, created January 24th."

"Comparing version 2 with version 3.
 5 changes found: 245 characters added, 12 removed."

"Navigated to change 3 of 5.
 Line 11: 'Write specs' changed to 'Write docs (Alice)'"

"Version 2 restored as new version 4.
 Version history updated."
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | <640px | Full-screen, list view, unified diff |
| Tablet | 640-1024px | Collapsible timeline, full-width content |
| Desktop | >1024px | Side-by-side (timeline + content) |
| Large | >1440px | Wider panels, side-by-side diff default |

---

## Animation Specifications

### Version Card Entry

```css
animation: slide-in 300ms ease-out;
animation-delay: calc(var(--index) * 50ms);

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### Timeline Connector Draw

```css
animation: draw-line 500ms ease-out;

@keyframes draw-line {
  from {
    height: 0;
  }
  to {
    height: 100%;
  }
}
```

### Diff Highlight

```css
/* Highlight changed line on navigation */
animation: pulse-highlight 800ms ease-out;

@keyframes pulse-highlight {
  0%, 100% {
    background-color: rgba(59, 130, 246, 0.1);
  }
  50% {
    background-color: rgba(59, 130, 246, 0.3);
  }
}
```

### Restore Success

```css
/* Toast notification slides in */
animation: slide-up 300ms ease-out;

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## Color Specifications

```css
/* Timeline */
--color-timeline-current: #3b82f6;
--color-timeline-ai: #8b5cf6;
--color-timeline-user: #10b981;
--color-timeline-connector: #e5e7eb;

/* Diff */
--color-diff-add-bg: rgba(16, 185, 129, 0.1);
--color-diff-add-text: #10b981;
--color-diff-remove-bg: rgba(239, 68, 68, 0.1);
--color-diff-remove-text: #ef4444;
--color-diff-change-bg: rgba(245, 158, 11, 0.1);
--color-diff-change-text: #f59e0b;
--color-diff-gutter: #f9fafb;

/* Version Card */
--color-card-bg: #ffffff;
--color-card-border: #e5e7eb;
--color-card-border-selected: #3b82f6;
--color-card-shadow: rgba(0, 0, 0, 0.05);

/* Author Badges */
--color-badge-user: rgba(16, 185, 129, 0.1);
--color-badge-user-text: #10b981;
--color-badge-ai: rgba(139, 92, 246, 0.1);
--color-badge-ai-text: #8b5cf6;
```

---

## Typography

```css
/* Version Number */
--font-version: 16px / 24px, font-weight: 600;

/* Timestamp */
--font-timestamp: 12px / 16px, font-weight: 400;

/* Author */
--font-author: 13px / 18px, font-weight: 500;

/* Change Stats */
--font-stats: 12px / 16px, font-weight: 500;

/* Diff Line */
--font-diff: 13px / 20px, font-family: 'Monaco', monospace;

/* Line Numbers */
--font-line-number: 12px / 20px, font-family: monospace;
```

---

## Performance Considerations

1. **Virtual Scrolling**: For >50 versions, use react-window
2. **Diff Computation**: Compute diffs on-demand, cache results
3. **Lazy Load Content**: Load version content only when viewed
4. **Debounced Comparison**: 300ms delay on version selector change
5. **Incremental Diff**: Show first 100 lines, load more on scroll
6. **Syntax Highlighting**: Use web worker for large documents
7. **Memory Management**: Unload old version content when switching

---

## Implementation Notes

1. **Diff Library**: react-diff-viewer or custom diff-match-patch
2. **Markdown Rendering**: Marked.js or react-markdown
3. **Syntax Highlighting**: Prism.js or Highlight.js (for code in notes)
4. **Timeline Animation**: Framer Motion or CSS animations
5. **Version Storage**: API provides full history, client caches recent
6. **Diff Algorithm**: Myers diff for accuracy, patience diff for readability
7. **Export Format**: Markdown with metadata header

---

## Related Specifications

- [UX Design Document](../fortemi-integration-ux-design.md)
- [Version History API](https://git.integrolabs.net/Fortemi/fortemi/src/branch/main/docs/content/api.md#version-endpoints)
- [Knowledge Health Dashboard](./04-knowledge-health-dashboard.md) (Version metrics)
