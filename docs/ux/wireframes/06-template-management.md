# Template Management - Wireframe Specification

**Version**: 1.0
**Last Updated**: 2026-02-04
**Component**: Template Management
**Grid System**: 8px base unit

---

## Overview

CRUD interface for note templates with variable substitution, preview, and one-click instantiation.

---

## Desktop Layout (>1024px)

### Template Browser (Main View)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Templates                                                    [+] Create Template         │ 64px
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ ┌────────────────────────────────────────────┐  ┌────────────────────────────────────┐│
│ │ 🔍 Search templates...                     │  │ Category: [All              ▼]     ││ 48px
│ └────────────────────────────────────────────┘  └────────────────────────────────────┘│
│                                                                                         │
│ ┌─────────────────────────┐  Sort by: [Recent ▼] [Most Used] [Alphabetical]           │ 40px
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤ 16px gap
│                                                                                         │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│ │              │  │              │  │              │  │              │               │
│ │  📝 Meeting  │  │  👨‍💻 Code     │  │  🔬 Research │  │  📊 Project │               │
│ │   Notes      │  │  Snippet     │  │   Paper      │  │   Plan      │               │
│ │              │  │              │  │              │  │              │               │
│ │ Weekly       │  │ Function     │  │ Academic     │  │ Quarterly    │               │
│ │ standup      │  │ template     │  │ journal      │  │ planning     │               │
│ │              │  │              │  │              │  │              │               │
│ │ {{3}} vars   │  │ {{5}} vars   │  │ {{8}} vars   │  │ {{6}} vars   │               │
│ │ Used 42×     │  │ Used 18×     │  │ Used 12×     │  │ Used 8×      │               │
│ │              │  │              │  │              │  │              │               │
│ │ [Use] [👁][⋮]│  │ [Use] [👁][⋮]│  │ [Use] [👁][⋮]│  │ [Use] [👁][⋮]│               │
│ │              │  │              │  │              │  │              │               │
│ └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘               │
│    240px × 280px    240px × 280px    240px × 280px    240px × 280px                    │
│                                                                                         │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│ │              │  │              │  │              │  │              │               │
│ │  📋 Daily    │  │  💼 1:1      │  │  🎯 Sprint   │  │  📧 Email    │               │
│ │   Journal    │  │   Meeting    │  │   Retro      │  │   Draft      │               │
│ │              │  │              │  │              │  │              │               │
│ │ Gratitude &  │  │ Manager      │  │ Team         │  │ Professional │               │
│ │ reflection   │  │ check-in     │  │ feedback     │  │ template     │               │
│ │              │  │              │  │              │  │              │               │
│ │ {{4}} vars   │  │ {{6}} vars   │  │ {{7}} vars   │  │ {{5}} vars   │               │
│ │ Used 156×    │  │ Used 24×     │  │ Used 6×      │  │ Used 3×      │               │
│ │              │  │              │  │              │  │              │               │
│ │ [Use] [👁][⋮]│  │ [Use] [👁][⋮]│  │ [Use] [👁][⋮]│  │ [Use] [👁][⋮]│               │
│ │              │  │              │  │              │  │              │               │
│ └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                                         │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│ │                           [Load More Templates]                                  │  │ 56px
│ └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Header: 64px height
- Search bar: 48px height
- Category filter: 48px height
- Sort buttons: 40px height
- Template card: 240px width × 280px height
- Grid columns: 4 (desktop), responsive
- Grid gap: 16px
- Card padding: 16px
- Icon size: 48px
- Badge height: 24px
- Button height: 40px
- Horizontal padding: 24px
- Section gap: 16px

---

### Template Card (Detail)

```
┌──────────────────────────────┐
│                              │
│          📝 Meeting          │ 64px
│          Notes               │ icon
│                              │
├──────────────────────────────┤
│ Weekly Standup               │ 32px
│                              │ title
│ Team standup meeting notes   │ 48px
│ with action items and        │ desc.
│ blockers.                    │
│                              │
├──────────────────────────────┤
│ {{3}} variables              │ 24px
│ 🔖 meeting, standup          │ 24px
│                              │
│ Used 42 times                │ 24px
│ Last: 2 hours ago            │ 20px
│                              │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ [Use Template]           │ │ 48px
│ └──────────────────────────┘ │
│                              │
│ [👁 Preview] [⋮ More]        │ 40px
│                              │
└──────────────────────────────┘

Total: 240px × 280px
Border: 1px solid #e5e7eb
Border-radius: 12px
Padding: 16px
```

**Card States**:

**Default**:
```
Background: #ffffff
Border: 1px solid #e5e7eb
Shadow: 0 1px 3px rgba(0,0,0,0.1)
```

**Hover**:
```
Border: 1px solid #3b82f6
Shadow: 0 4px 6px rgba(0,0,0,0.15)
Transform: translateY(-2px)
Transition: all 200ms ease
```

**Selected** (for editing):
```
Border: 2px solid #3b82f6
Background: rgba(59, 130, 246, 0.02)
```

---

### Template Editor Modal

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Create New Template                                                   [×] Close         │ 64px
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ ┌───────────────────────────────────────────┐  ┌───────────────────────────────────┐  │
│ │ Editor                                    │  │ Preview                           │  │ 40px
│ │ ─────────────────────────────────────     │  │ ─────────────────────────────     │  │
│ │                                           │  │                                   │  │
│ │ Template Name *                           │  │ Weekly Standup                    │  │
│ │ ┌───────────────────────────────────────┐ │  │                                   │  │
│ │ │ Weekly Standup                        │ │  │ Team: Engineering                 │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              48px height                  │  │ What we accomplished              │  │
│ │                                           │  │ [accomplishments placeholder]     │  │
│ │ Description                               │  │                                   │  │
│ │ ┌───────────────────────────────────────┐ │  │ Blockers                          │  │
│ │ │ Team standup meeting notes with       │ │  │ [blockers placeholder]            │  │
│ │ │ action items and blockers.            │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │ Next steps                        │  │
│ │              64px height                  │  │ [next_steps placeholder]          │  │
│ │                                           │  │                                   │  │
│ │ Category                                  │  │                                   │  │
│ │ ┌───────────────────────────────────────┐ │  │                                   │  │
│ │ │ Meeting Notes                     ▼   │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              48px height                  │  │                                   │  │
│ │                                           │  │                                   │  │
│ │ Template Content *                        │  │                                   │  │
│ │ ┌───────────────────────────────────────┐ │  │                                   │  │
│ │ │ [B] [I] [H] [Link] [{{}} Insert Var]  │ │  │                                   │  │
│ │ ├───────────────────────────────────────┤ │  │                                   │  │
│ │ │ # Standup: {{date}}                   │ │  │                                   │  │
│ │ │                                       │ │  │                                   │  │
│ │ │ ## Team: {{team_name}}                │ │  │                                   │  │
│ │ │                                       │ │  │                                   │  │
│ │ │ ### What we accomplished              │ │  │                                   │  │
│ │ │ {{accomplishments}}                   │ │  │                                   │  │
│ │ │                                       │ │  │                                   │  │
│ │ │ ### Blockers                          │ │  │                                   │  │
│ │ │ {{blockers}}                          │ │  │                                   │  │
│ │ │                                       │ │  │                                   │  │
│ │ │ ### Next steps                        │ │  │                                   │  │
│ │ │ {{next_steps}}                        │ │  │                                   │  │
│ │ │                                       │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              320px height                 │  │                                   │  │
│ │                                           │  │                                   │  │
│ │ ▼ Variables Detected (5)                  │  │                                   │  │
│ │ ─────────────────────────────────────     │  │                                   │  │
│ │ [{{date}}] [{{team_name}}]                │  │                                   │  │
│ │ [{{accomplishments}}] [{{blockers}}]      │  │                                   │  │
│ │ [{{next_steps}}]                          │  │                                   │  │
│ │              80px height                  │  │                                   │  │
│ │                                           │  │                                   │  │
│ │ Default Tags                              │  │                                   │  │
│ │ ┌───────────────────────────────────────┐ │  │                                   │  │
│ │ │ [meeting ×] [standup ×] [Add tag...]  │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              48px height                  │  │                                   │  │
│ │                                           │  │                                   │  │
│ └───────────────────────────────────────────┘  └───────────────────────────────────┘  │
│    500px width                                   450px width                           │
│                                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│ │ [Cancel]                                        [Save Template]                  │   │ 64px
│ └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
  Modal width: 950px (max 90vw)
  Modal height: 80vh max
  Scrollable content
```

**Dimensions**:
- Modal width: 950px (max 90vw)
- Modal height: 80vh max
- Editor panel: 500px width (left)
- Preview panel: 450px width (right)
- Header: 64px height
- Panel titles: 40px height
- Input field: 48px height
- Text area (description): 64px height
- Dropdown: 48px height
- Markdown editor: 320px height (expandable)
- Toolbar: 40px height
- Variables section: 80px height (collapsed: 48px)
- Tag input: 48px height
- Footer: 64px height
- Padding: 24px
- Gap between fields: 16px

---

### Markdown Editor Toolbar

```
┌─────────────────────────────────────────────────────────┐
│ [B] [I] [H] [🔗] [📋] [{{x}}]                 [Preview]│ 40px
└─────────────────────────────────────────────────────────┘
  Button size: 32px × 32px
  Gap: 4px
  Icons: 18px

Buttons:
- B: Bold (Ctrl+B)
- I: Italic (Ctrl+I)
- H: Heading (Ctrl+H)
- 🔗: Link (Ctrl+K)
- 📋: Code block (Ctrl+`)
- {{x}}: Insert variable
- Preview: Toggle preview mode
```

---

### Instantiation Modal

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Use Template: Weekly Standup                                          [×] Close         │ 64px
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ ┌───────────────────────────────────────────┐  ┌───────────────────────────────────┐  │
│ │ Fill in Variables                         │  │ Live Preview                      │  │ 40px
│ │ ─────────────────────────────────────     │  │ ─────────────────────────────     │  │
│ │                                           │  │                                   │  │
│ │ Date                                      │  │ # Standup: February 4, 2026       │  │
│ │ ┌───────────────────────────────────────┐ │  │                                   │  │
│ │ │ February 4, 2026                  📅  │ │  │ ## Team: Engineering              │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              48px height                  │  │ ### What we accomplished          │  │
│ │                                           │  │ - Completed API endpoints         │  │
│ │ Team Name                                 │  │ - Fixed critical bugs             │  │
│ │ ┌───────────────────────────────────────┐ │  │ - Updated documentation           │  │
│ │ │ Engineering                           │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │ ### Blockers                      │  │
│ │              48px height                  │  │ - Waiting on design review        │  │
│ │                                           │  │ - Database migration pending      │  │
│ │ Accomplishments                           │  │                                   │  │
│ │ ┌───────────────────────────────────────┐ │  │ ### Next steps                    │  │
│ │ │ - Completed API endpoints             │ │  │ - Deploy to staging               │  │
│ │ │ - Fixed critical bugs                 │ │  │ - Run security audit              │  │
│ │ │ - Updated documentation               │ │  │ - Plan next sprint                │  │
│ │ │                                       │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              120px height                 │  │                                   │  │
│ │                                           │  │                                   │  │
│ │ Blockers                                  │  │                                   │  │
│ │ ┌───────────────────────────────────────┐ │  │                                   │  │
│ │ │ - Waiting on design review            │ │  │                                   │  │
│ │ │ - Database migration pending          │ │  │                                   │  │
│ │ │                                       │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              120px height                 │  │                                   │  │
│ │                                           │  │                                   │  │
│ │ Next Steps                                │  │                                   │  │
│ │ ┌───────────────────────────────────────┐ │  │                                   │  │
│ │ │ - Deploy to staging                   │ │  │                                   │  │
│ │ │ - Run security audit                  │ │  │                                   │  │
│ │ │ - Plan next sprint                    │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              120px height                 │  │                                   │  │
│ │                                           │  │                                   │  │
│ │ ▼ Tags                                    │  │                                   │  │
│ │ ─────────────────────────────────────     │  │                                   │  │
│ │ ┌───────────────────────────────────────┐ │  │                                   │  │
│ │ │ [meeting ×] [standup ×] [Feb2026 ×]   │ │  │                                   │  │
│ │ │ [Add tag...]                          │ │  │                                   │  │
│ │ └───────────────────────────────────────┘ │  │                                   │  │
│ │              80px height                  │  │                                   │  │
│ │                                           │  │                                   │  │
│ └───────────────────────────────────────────┘  └───────────────────────────────────┘  │
│    500px width                                   450px width                           │
│                                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│ │ [Cancel]                                        [Create Note]                    │   │ 64px
│ └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
  Modal width: 950px
  Modal height: Auto (max 80vh)
  Scrollable content
```

**Dimensions**:
- Same modal dimensions as editor
- Form panel: 500px width
- Preview panel: 450px width
- Single-line input: 48px height
- Multi-line textarea: 120px height
- Date picker: 48px height
- Tags section: 80px height (collapsed: 48px)
- Footer: 64px height
- Input labels: 24px height
- Gap between inputs: 16px

---

## Tablet Layout (640-1024px)

### Template Grid (2-3 columns)

```
┌─────────────────────────────────────────────────────┐
│ Templates                  [+] Create Template      │ 64px
├─────────────────────────────────────────────────────┤
│                                                     │
│ [🔍 Search...]  [Category ▼]  [Sort ▼]             │ 48px
│                                                     │
├─────────────────────────────────────────────────────┤ 16px gap
│                                                     │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│ │  📝        │  │  👨‍💻        │  │  🔬        │    │
│ │  Meeting   │  │  Code      │  │  Research  │    │
│ │  Notes     │  │  Snippet   │  │  Paper     │    │ 280px
│ │            │  │            │  │            │    │
│ │  {{3}}     │  │  {{5}}     │  │  {{8}}     │    │
│ │  Used 42×  │  │  Used 18×  │  │  Used 12×  │    │
│ │  [Use][⋮]  │  │  [Use][⋮]  │  │  [Use][⋮]  │    │
│ └────────────┘  └────────────┘  └────────────┘    │
│    200px          200px          200px             │
│                                                     │
│         ... more templates ...                     │
│                                                     │
└─────────────────────────────────────────────────────┘
  3 columns, 200px × 280px cards
  16px gaps
```

### Editor Modal (Tablet)

```
┌─────────────────────────────────────────────────────┐
│ Create Template                       [×] Close     │ 64px
├─────────────────────────────────────────────────────┤
│                                                     │
│ [Editor] [Preview]                                  │ 48px tabs
│                                                     │
│ Template Name *                                     │ 24px
│ ┌─────────────────────────────────────────────┐   │
│ │ Weekly Standup                              │   │ 48px
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Description                                         │ 24px
│ ┌─────────────────────────────────────────────┐   │
│ │ Team standup meeting notes...               │   │ 64px
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Category: [Meeting Notes           ▼]              │ 48px
│                                                     │
│ Template Content *                                  │ 24px
│ ┌─────────────────────────────────────────────┐   │
│ │ [B][I][H][{{}}]                             │   │ 40px
│ ├─────────────────────────────────────────────┤   │
│ │ # Standup: {{date}}                         │   │
│ │                                             │   │
│ │ ## Team: {{team_name}}                      │   │ 300px
│ │                                             │   │
│ │ ... content ...                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Variables: [{{date}}] [{{team_name}}] ...          │ 48px
│                                                     │
│ Tags: [meeting ×] [standup ×]                      │ 48px
│                                                     │
│ [Cancel]                        [Save Template]    │ 64px
│                                                     │
└─────────────────────────────────────────────────────┘
  Modal: 80% width, centered
  Tabs switch between editor and preview
  Vertical layout
```

---

## Mobile Layout (<640px)

### Mobile Template List

```
┌────────────────────────────────────────┐
│ ← Templates                [+] Create  │ 64px
├────────────────────────────────────────┤
│                                        │
│ [🔍 Search templates...]               │ 56px
│                                        │
│ [All Categories                    ▼]  │ 56px
│                                        │
│ [Recent ▼] [Most Used] [A-Z]           │ 48px
│                                        │
├────────────────────────────────────────┤ 8px gap
│                                        │
│ ┌────────────────────────────────────┐│
│ │ 📝 Meeting Notes                   ││
│ │ Weekly Standup                     ││
│ │                                    ││
│ │ Team standup meeting notes with    ││
│ │ action items and blockers.         ││ 140px
│ │                                    ││
│ │ {{3}} variables • Used 42×         ││
│ │ Last used: 2 hours ago             ││
│ │                                    ││
│ │ [Use Template]              [⋮]    ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ 👨‍💻 Code Snippet                    ││
│ │ Function Template                  ││
│ │                                    ││
│ │ Reusable function template with    ││
│ │ documentation and examples.        ││ 140px
│ │                                    ││
│ │ {{5}} variables • Used 18×         ││
│ │ Last used: 1 day ago               ││
│ │                                    ││
│ │ [Use Template]              [⋮]    ││
│ └────────────────────────────────────┘│
│                                        │
│              ... more ...              │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [Load More]                        ││ 64px
│ └────────────────────────────────────┘│
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Header: 64px height
- Search bar: 56px height
- Category dropdown: 56px height
- Sort buttons: 48px height (horizontal scroll if needed)
- Template card: 140px height
- Gap between cards: 8px
- Action button: 56px height
- Horizontal padding: 16px

---

### Mobile Template Editor

```
┌────────────────────────────────────────┐
│ ← Back              Create Template    │ 64px
├────────────────────────────────────────┤
│                                        │
│ Template Name *                        │ 24px
│ ┌────────────────────────────────────┐│
│ │ Weekly Standup                     ││ 56px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ Description                            │ 24px
│ ┌────────────────────────────────────┐│
│ │ Team standup meeting notes with    ││
│ │ action items and blockers.         ││ 80px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ Category                               │ 24px
│ ┌────────────────────────────────────┐│
│ │ Meeting Notes                  ▼   ││ 56px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ Template Content *                     │ 24px
│ ┌────────────────────────────────────┐│
│ │ [B][I][H][{{}}]              [👁]  ││ 48px
│ ├────────────────────────────────────┤│ toolbar
│ │                                    ││
│ │ # Standup: {{date}}                ││
│ │                                    ││
│ │ ## Team: {{team_name}}             ││
│ │                                    ││
│ │ ### What we accomplished           ││ 300px
│ │ {{accomplishments}}                ││ editor
│ │                                    ││
│ │ ### Blockers                       ││
│ │ {{blockers}}                       ││
│ │                                    ││
│ │ ### Next steps                     ││
│ │ {{next_steps}}                     ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ ▼ Variables (5)                        │ 56px
│ ──────────────────────────────────     │
│                                        │
│ [{{date}}] [{{team_name}}]             │
│ [{{accomplishments}}] [{{blockers}}]   │ 80px
│ [{{next_steps}}]                       │
│                                        │ 16px gap
│ Default Tags                           │ 24px
│ ┌────────────────────────────────────┐│
│ │ [meeting ×] [standup ×]            ││
│ │ [Add tag...]                       ││ 64px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ ┌────────────────────────────────────┐│
│ │ [Save Template]                    ││ 64px
│ └────────────────────────────────────┘│ sticky
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Full viewport width
- Header: 64px height
- Labels: 24px height
- Text input: 56px height (touch-friendly)
- Text area (description): 80px height
- Dropdown: 56px height
- Markdown toolbar: 48px height
- Markdown editor: 300px height (expandable)
- Variables section: Collapsible (56px header, 80px content)
- Tag input: 64px height
- Save button: 64px height (sticky to bottom)
- Horizontal padding: 16px
- Section gap: 16px

---

### Mobile Instantiation

```
┌────────────────────────────────────────┐
│ ← Back              Use Template       │ 64px
├────────────────────────────────────────┤
│                                        │
│ Template: Weekly Standup               │ 40px
│                                        │
│ [Fill In] [Preview]                    │ 48px
│                                        │ tabs
├────────────────────────────────────────┤
│                                        │
│ Date                                   │ 24px
│ ┌────────────────────────────────────┐│
│ │ February 4, 2026               📅  ││ 56px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ Team Name                              │ 24px
│ ┌────────────────────────────────────┐│
│ │ Engineering                        ││ 56px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ Accomplishments                        │ 24px
│ ┌────────────────────────────────────┐│
│ │ - Completed API endpoints          ││
│ │ - Fixed critical bugs              ││
│ │ - Updated documentation            ││ 120px
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ Blockers                               │ 24px
│ ┌────────────────────────────────────┐│
│ │ - Waiting on design review         ││
│ │ - Database migration pending       ││ 120px
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ Next Steps                             │ 24px
│ ┌────────────────────────────────────┐│
│ │ - Deploy to staging                ││
│ │ - Run security audit               ││ 120px
│ │ - Plan next sprint                 ││
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ ▼ Tags                                 │ 56px
│ ──────────────────────────────────     │
│                                        │
│ [meeting ×] [standup ×] [Feb2026 ×]    │ 64px
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [Create Note]                      ││ 64px
│ └────────────────────────────────────┘│ sticky
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Header: 64px height
- Template name: 40px height
- Tab bar: 48px height
- Field labels: 24px height
- Single-line input: 56px height
- Date picker: 56px height
- Multi-line textarea: 120px height
- Tags section: Collapsible (56px header, 64px content)
- Create button: 64px height (sticky)
- Horizontal padding: 16px
- Section gap: 16px

---

## Component States

### Template Icon/Category

```
Meeting Notes: 📝
Code Snippet: 👨‍💻
Research: 🔬
Project: 📊
Daily Journal: 📋
1:1 Meeting: 💼
Sprint: 🎯
Email: 📧
Custom: 📄

Icon size:
- Card: 48px
- List item: 32px
- Chip: 20px
```

### Variable Chip

```
Default:
┌──────────────┐
│ {{variable}} │ 32px height
└──────────────┘
Background: rgba(59, 130, 246, 0.1)
Border: 1px solid #3b82f6
Color: #3b82f6
Padding: 6px 12px
Border-radius: 16px
Font: 13px monospace

Clickable (insert):
Cursor: pointer
Hover: Background rgba(59, 130, 246, 0.2)
```

### Usage Badge

```
High usage (>50):
┌──────────────┐
│ Used 156×    │ 24px height
└──────────────┘
Background: rgba(16, 185, 129, 0.1)
Color: #10b981

Medium usage (10-50):
┌──────────────┐
│ Used 24×     │ 24px height
└──────────────┘
Background: rgba(245, 158, 11, 0.1)
Color: #f59e0b

Low usage (<10):
┌──────────────┐
│ Used 3×      │ 24px height
└──────────────┘
Background: rgba(107, 114, 128, 0.1)
Color: #6b7280
```

---

## Empty States

### No Templates

```
┌────────────────────────────────────────┐
│                                        │
│              📝                        │ 64px
│                                        │
│    No Templates Yet                    │ 24px
│                                        │
│    Create your first template to       │ 16px
│    quickly generate notes with         │
│    consistent structure.               │
│                                        │
│    [Create Template]                   │ 56px
│                                        │
└────────────────────────────────────────┘
  Centered, max-width 400px
```

### No Search Results

```
┌────────────────────────────────────────┐
│                                        │
│              🔍                        │ 64px
│                                        │
│    No Templates Found                  │ 24px
│                                        │
│    No templates match "standup"        │ 16px
│                                        │
│    Try:                                │ 16px
│    • Different keywords                │ 14px
│    • Broader search                    │ 14px
│    • Browse all categories             │ 14px
│                                        │
│    [Clear Search]  [Browse All]        │ 48px
│                                        │
└────────────────────────────────────────┘
```

---

## Context Menu Actions

### Template Card Menu

```
┌──────────────────────────┐
│ Use Template             │ 48px
├──────────────────────────┤
│ Preview                  │ 48px
├──────────────────────────┤
│ Edit                     │ 48px
├──────────────────────────┤
│ Clone                    │ 48px
├──────────────────────────┤
│ Export                   │ 48px
├──────────────────────────┤
│ Delete                   │ 48px (Red)
└──────────────────────────┘
  Width: 200px
  Item height: 48px
  Shadow: 0 4px 6px rgba(0,0,0,0.1)
  Border-radius: 8px
```

### Mobile Action Sheet

```
┌────────────────────────────────────────┐
│ Weekly Standup                         │ 64px
├────────────────────────────────────────┤
│                                        │
│ [Use Template]                         │ 64px
│                                        │
│ [Preview]                              │ 64px
│                                        │
│ [Edit]                                 │ 64px
│                                        │
│ [Clone]                                │ 64px
│                                        │
│ [Export]                               │ 64px
│                                        │
│ [Delete]                               │ 64px (Red)
│                                        │
├────────────────────────────────────────┤
│ [Cancel]                               │ 64px
└────────────────────────────────────────┘
  Full width
  Item height: 64px (touch-friendly)
  Slide up animation
```

---

## Delete Confirmation Dialog

```
┌───────────────────────────────────────┐
│ Delete Template?                      │ 48px
├───────────────────────────────────────┤
│                                       │
│ ⚠️ Delete "Weekly Standup" template?  │ 32px
│                                       │
│ This action cannot be undone.         │ 20px
│                                       │
│ Template has been used 42 times.      │ 20px
│ Notes created from this template      │
│ will not be affected.                 │
│                                       │
│ ┌───────────────────────────────────┐ │
│ │ [Cancel]         [Delete Template]│ │ 56px
│ └───────────────────────────────────┘ │
│  Secondary           Danger button    │
│                                       │
└───────────────────────────────────────┘
  Width: 480px
  Delete button: Red #ef4444
```

---

## Accessibility Specifications

### ARIA Attributes

**Template Card**:
```html
<article
  role="article"
  aria-labelledby="template-title-123"
  aria-describedby="template-desc-123"
  tabindex="0"
>
  <h3 id="template-title-123">Weekly Standup</h3>
  <p id="template-desc-123">
    Team standup meeting notes with action items
  </p>
</article>
```

**Variable Input**:
```html
<label for="var-date">
  Date
  <span aria-label="Required field">*</span>
</label>
<input
  id="var-date"
  type="text"
  aria-required="true"
  aria-describedby="var-date-hint"
  placeholder="e.g., February 4, 2026"
/>
<span id="var-date-hint" class="sr-only">
  Enter the date for this standup
</span>
```

**Markdown Editor**:
```html
<div role="textbox" aria-multiline="true" aria-label="Template content">
  <textarea
    aria-describedby="editor-help"
    placeholder="Use {{variable}} syntax for variables"
  ></textarea>
</div>
<div id="editor-help" class="sr-only">
  Press Ctrl+Space to insert a variable
</div>
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between templates and actions |
| Enter | Use template, open editor |
| Space | Select template for comparison |
| Ctrl+N | Create new template |
| Ctrl+E | Edit selected template |
| Ctrl+F | Focus search bar |
| Ctrl+S | Save template (in editor) |
| Ctrl+Space | Insert variable (in editor) |
| Ctrl+P | Toggle preview (in editor) |
| Escape | Close modal, cancel action |
| Delete | Delete selected template (with confirm) |

### Screen Reader Announcements

```
"Templates page. 8 templates available.
 Use arrow keys to browse, Enter to use a template."

"Weekly Standup template.
 Meeting Notes category.
 3 variables: date, team_name, accomplishments.
 Used 42 times. Last used 2 hours ago."

"Create template editor opened.
 Fill in required fields marked with asterisk."

"Variable detected: date. Press Tab to move to next field."

"Template saved successfully. Weekly Standup template created."

"Use template dialog opened. Fill in 5 variables to create note."

"Preview updated with your changes."
```

---

## Responsive Breakpoints

| Breakpoint | Width | Grid Columns | Card Size |
|------------|-------|--------------|-----------|
| Mobile | <640px | 1 | Full width (list) |
| Tablet | 640-1024px | 2-3 | 200px × 280px |
| Desktop | >1024px | 4 | 240px × 280px |
| Large | >1440px | 5 | 240px × 280px |

---

## Animation Specifications

### Card Hover

```css
transition: all 200ms ease;

&:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.15);
}
```

### Modal Open/Close

```css
animation: modal-enter 250ms ease-out;

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### Variable Chip Insert

```css
animation: chip-pop 200ms ease-out;

@keyframes chip-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

### Live Preview Update

```css
/* Subtle fade on content update */
animation: preview-update 300ms ease;

@keyframes preview-update {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
```

---

## Color Specifications

```css
/* Template Categories */
--color-category-meeting: #3b82f6;
--color-category-code: #8b5cf6;
--color-category-research: #06b6d4;
--color-category-project: #10b981;
--color-category-journal: #f59e0b;
--color-category-custom: #6b7280;

/* Variable */
--color-variable-bg: rgba(59, 130, 246, 0.1);
--color-variable-border: #3b82f6;
--color-variable-text: #3b82f6;

/* Usage Badges */
--color-usage-high: #10b981;
--color-usage-medium: #f59e0b;
--color-usage-low: #6b7280;

/* Card */
--color-card-bg: #ffffff;
--color-card-border: #e5e7eb;
--color-card-border-hover: #3b82f6;
--color-card-shadow: rgba(0, 0, 0, 0.1);
--color-card-shadow-hover: rgba(0, 0, 0, 0.15);

/* Editor */
--color-editor-bg: #f9fafb;
--color-editor-border: #d1d5db;
--color-preview-bg: #ffffff;
```

---

## Typography

```css
/* Template Name */
--font-template-name: 18px / 24px, font-weight: 600;

/* Template Description */
--font-template-desc: 14px / 20px, font-weight: 400;

/* Variable Name */
--font-variable: 13px / 18px, font-family: 'Monaco', monospace;

/* Form Labels */
--font-label: 14px / 20px, font-weight: 500;

/* Input Text */
--font-input: 15px / 22px, font-weight: 400;

/* Markdown Content */
--font-markdown: 14px / 22px, font-weight: 400;

/* Metadata */
--font-metadata: 12px / 16px, font-weight: 400;
```

---

## Performance Considerations

1. **Template List Pagination**: 24 templates per page, lazy load on scroll
2. **Debounced Preview**: 500ms delay on input change
3. **Markdown Parsing**: Cached, incremental parsing
4. **Variable Detection**: Regex scan on content change, debounced 300ms
5. **Search Filtering**: Client-side for <100 templates, server-side for more
6. **Image Optimization**: Compress template icon images
7. **Virtual Scrolling**: For >50 templates in list view

---

## Implementation Notes

1. **Markdown Editor**: react-markdown-editor-lite or custom
2. **Markdown Parser**: Marked.js or remark
3. **Syntax Highlighting**: Prism.js for code blocks
4. **Variable Parsing**: Custom regex: `/\{\{(\w+)\}\}/g`
5. **Date Picker**: React DatePicker or Radix UI Calendar
6. **Tag Input**: react-tag-input or custom
7. **Export Format**: JSON or Markdown with frontmatter
8. **Template Storage**: API provides CRUD, client caches frequently used

---

## Related Specifications

- [UX Design Document](../fortemi-integration-ux-design.md)
- [Templates API](/mnt/dev-inbox/fortemi/fortemi/docs/content/api.md#template-endpoints)
- [Knowledge Health Dashboard](./04-knowledge-health-dashboard.md) (Template usage metrics)
