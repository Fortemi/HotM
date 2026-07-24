# SKOS Concept Browser - Wireframe Specification

**Version**: 1.0
**Last Updated**: 2026-02-04
**Component**: SKOS Concept Browser
**Grid System**: 8px base unit

---

## Overview

Hierarchical tree interface for W3C SKOS controlled vocabularies with search, relationships, and inline editing.

---

## Desktop Layout (>1024px)

### Main Browser View - Side Panel Mode

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SKOS Concept Browser                                          [×] Close │ 400px width
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │ 8px padding
│ │ Scheme: [Default Taxonomy                              ▼]      │   │ 48px height
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │ 16px gap
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ 🔍 Search concepts...                                           │   │ 40px height
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │ 16px gap
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ Tree View                                                       │   │
│ │ ─────────────────────────────────────────────────────────────   │   │
│ │                                                                 │   │
│ │ ▼ 📁 Science                                           [42]    │   │ 44px height
│ │   ├─▶ 📁 Biology                                       [18]    │   │ 44px height
│ │   │   ├─ 📄 Cell Biology                               [5]     │   │ 40px height
│ │   │   ├─ 📄 Genetics                                    [8]     │   │ 40px height
│ │   │   └─▶ 📁 Ecology                                    [5]     │   │ 44px height
│ │   │       ├─ 📄 Marine Ecology                          [2]     │   │ 40px height
│ │   │       └─ 📄 Forest Ecology                          [3]     │   │ 40px height
│ │   ├─▶ 📁 Chemistry                                     [12]    │   │ 44px height
│ │   └─▶ 📁 Physics                                       [12]    │   │ 44px height
│ │                                                                 │   │
│ │ ▶ 📁 Technology                                        [28]    │   │ 44px height
│ │                                                                 │   │
│ │ ▶ 📁 Arts                                              [15]    │   │ 44px height
│ │                                                                 │   │
│ └─────────────────────────────────────────────────────────────────┘   │ Scrollable
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │ 16px gap
│ │ [+] Add Concept    [↓] Export Scheme                           │   │ 48px height
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Panel width: 400px fixed
- Header height: 64px
- Scheme selector: 48px height, 8px padding
- Search bar: 40px height
- Tree node (expandable): 44px height (larger touch target)
- Tree node (leaf): 40px height
- Actions toolbar: 48px height
- Left padding for hierarchy: 24px per level
- Icon size: 20px
- Badge size: 24px height, min-width 32px
- Gap between sections: 16px

**Grid Alignment**:
- All components align to 8px grid
- Horizontal padding: 16px
- Vertical spacing: 8px, 16px, or 24px

---

### Concept Detail Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Concept Details                                     [Edit] [×] Close    │ 400px width
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │ 8px padding
│ │ 📄 Cell Biology                              [🏷️ Science]        │   │ 56px height
│ │ ────────────────────────────────────────────────────────────    │   │
│ │                                                                 │   │
│ │ Notation: CELL_BIO_001                                          │   │ 32px height
│ │                                                                 │   │
│ │ Definition:                                                     │   │ 24px label
│ │ ┌─────────────────────────────────────────────────────────┐   │   │
│ │ │ The study of cells at the molecular and cellular        │   │
│ │ │ level, including cell structure, function, and          │   │ Auto height
│ │ │ processes.                                               │   │ Min 80px
│ │ └─────────────────────────────────────────────────────────┘   │   │
│ │                                                                 │   │ 16px gap
│ │ Alternate Labels:                                               │   │ 24px label
│ │ ┌─────────────────────────────────────────────────────────┐   │   │
│ │ │ [Cellular Biology ×] [Cytology ×]                       │   │ 40px height
│ │ └─────────────────────────────────────────────────────────┘   │   │
│ │                                                                 │   │ 16px gap
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │ 16px gap
│ │ ▼ Relationships                                                 │   │ 48px header
│ │ ────────────────────────────────────────────────────────────    │   │
│ │                                                                 │   │
│ │ Broader Concepts:                                               │   │ 24px label
│ │   • Biology →                                                   │   │ 32px height
│ │                                                                 │   │
│ │ Narrower Concepts:                                              │   │ 24px label
│ │   • Molecular Biology →                                         │   │ 32px height
│ │   • Cellular Metabolism →                                       │   │ 32px height
│ │                                                                 │   │
│ │ Related Concepts:                                               │   │ 24px label
│ │   • Genetics →                                                  │   │ 32px height
│ │   • Biochemistry →                                              │   │ 32px height
│ │                                                                 │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │ 16px gap
│ │ ▼ Usage Statistics                                              │   │ 48px header
│ │ ────────────────────────────────────────────────────────────    │   │
│ │                                                                 │   │
│ │ Notes using this concept: 5                                     │   │ 32px height
│ │ Last used: 2 days ago                                           │   │ 32px height
│ │ Created: Jan 15, 2026                                           │   │ 32px height
│ │                                                                 │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │ 16px gap
│ │ [Apply to Note]              [Add Related]      [Delete]        │   │ 56px height
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Panel width: 400px fixed
- Accordion header: 48px height (expandable)
- Label text: 24px height, 14px font
- Input field: 40px height
- Text area: Min 80px height
- Tag chip: 32px height
- Relationship link: 32px height
- Action buttons: 40px height
- Bottom toolbar: 56px height (with 8px padding)

---

### Create Concept Modal

```
┌───────────────────────────────────────────────────────────┐
│ Create New Concept                          [×] Close     │ 600px width
├───────────────────────────────────────────────────────────┤ 500px height
│                                                           │
│  Preferred Label *                                        │ 24px label
│  ┌───────────────────────────────────────────────────┐   │
│  │ Marine Ecology                                    │   │ 48px height
│  └───────────────────────────────────────────────────┘   │
│                                                           │ 16px gap
│  Alternate Labels                                         │ 24px label
│  ┌───────────────────────────────────────────────────┐   │
│  │ Ocean Ecology, Coastal Ecosystems                 │   │ 48px height
│  └───────────────────────────────────────────────────┘   │
│  Separate with commas                                     │ 20px hint
│                                                           │ 16px gap
│  Definition                                               │ 24px label
│  ┌───────────────────────────────────────────────────┐   │
│  │                                                   │   │
│  │                                                   │   │ 120px height
│  │                                                   │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │ 16px gap
│  Parent Concept                                           │ 24px label
│  ┌───────────────────────────────────────────────────┐   │
│  │ Ecology                                       ▼   │   │ 48px height
│  └───────────────────────────────────────────────────┘   │
│  Start typing to search...                                │ 20px hint
│                                                           │ 16px gap
│  Concept Scheme                                           │ 24px label
│  ┌───────────────────────────────────────────────────┐   │
│  │ Default Taxonomy                              ▼   │   │ 48px height
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │ 24px gap
│  │ [Cancel]                          [Create Concept]│   │ 64px height
│  └───────────────────────────────────────────────────┘   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Modal width: 600px
- Modal height: 500px (auto-adjusts, max 80vh)
- Modal padding: 24px
- Form field height: 48px (single line)
- Text area height: 120px
- Label spacing: 8px above input
- Gap between fields: 16px
- Button height: 48px
- Footer height: 64px (includes padding)

---

## Tablet Layout (640-1024px)

### Side Sheet Mode

```
┌────────────────────────────────────────────────────────┐
│ SKOS Concepts                              [×] Close   │ 70% width
├────────────────────────────────────────────────────────┤ (Min 500px)
│                                                        │
│ [Scheme Selector                                   ▼]  │ 48px
│                                                        │
│ [🔍 Search concepts...]                                │ 40px
│                                                        │
│ ┌────────────────────────────────────────────────┐   │
│ │                                                │   │
│ │ ▼ 📁 Science                          [42]     │   │ 44px
│ │   ├─▶ 📁 Biology                      [18]     │   │ 44px
│ │   │   └─ 📄 Cell Biology               [5]     │   │ 40px
│ │                                                │   │
│ └────────────────────────────────────────────────┘   │ Scrollable
│                                                        │
│ [+] Add    [↓] Export                                  │ 48px
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Width: 70% of viewport (min 500px, max 600px)
- Same vertical spacing as desktop
- Tree nodes: 44px/40px heights maintained
- Touch targets: Minimum 44px height

---

## Mobile Layout (<640px)

### Full-Screen Modal

```
┌──────────────────────────────────────────┐
│ ← SKOS Concepts              [×] Close   │ Full width
├──────────────────────────────────────────┤ 64px header
│                                          │
│ [Scheme: Default Taxonomy            ▼]  │ 56px height
│                                          │
│ [🔍 Search concepts...              ]    │ 48px height
│                                          │ 16px gap
│ ┌────────────────────────────────────┐  │
│ │                                    │  │
│ │ ▼ 📁 Science              [42]     │  │ 56px height
│ │                                    │  │
│ │ ▼ 📁 Biology              [18]     │  │ 56px height
│ │                                    │  │
│ │   ├─ 📄 Cell Biology       [5] >   │  │ 52px height
│ │                                    │  │
│ │   ├─ 📄 Genetics           [8] >   │  │ 52px height
│ │                                    │  │
│ │ ▶ 📁 Chemistry            [12]     │  │ 56px height
│ │                                    │  │
│ │ ▶ 📁 Physics              [12]     │  │ 56px height
│ │                                    │  │
│ │ ▶ 📁 Technology           [28]     │  │ 56px height
│ │                                    │  │
│ └────────────────────────────────────┘  │ Scrollable
│                                          │
│ ┌────────────────────────────────────┐  │ 16px gap
│ │ [+] Add Concept                    │  │ 64px height
│ └────────────────────────────────────┘  │ Sticky bottom
│                                          │
└──────────────────────────────────────────┘
```

**Dimensions**:
- Full viewport width
- Header: 64px height
- Scheme selector: 56px height (larger touch)
- Search bar: 48px height
- Tree node (expandable): 56px height
- Tree node (leaf): 52px height (with chevron)
- Minimum touch target: 48px
- Horizontal padding: 16px
- Add button (FAB style): 64px height
- Badge: 28px height

### Mobile Detail View

```
┌──────────────────────────────────────────┐
│ ← Back                       [Edit] [×]  │ Full width
├──────────────────────────────────────────┤ 64px header
│                                          │
│ 📄 Cell Biology                          │ 48px height
│ ──────────────────────────────────────   │
│                                          │
│ Scheme: Science                          │ 32px
│ Notation: CELL_BIO_001                   │ 32px
│                                          │
│ ▼ Definition                             │ 48px
│ ─────────────────────────────────────    │
│ ┌────────────────────────────────────┐  │
│ │ The study of cells at the          │  │
│ │ molecular and cellular level...    │  │ Auto height
│ └────────────────────────────────────┘  │
│                                          │ 16px gap
│ ▼ Alternate Labels                       │ 48px
│ ─────────────────────────────────────    │
│ • Cellular Biology                       │ 40px
│ • Cytology                               │ 40px
│                                          │ 16px gap
│ ▼ Relationships                          │ 48px
│ ─────────────────────────────────────    │
│ Broader:                                 │ 32px
│   • Biology >                            │ 48px
│                                          │
│ Narrower:                                │ 32px
│   • Molecular Biology >                  │ 48px
│   • Cellular Metabolism >                │ 48px
│                                          │
│ Related:                                 │ 32px
│   • Genetics >                           │ 48px
│                                          │
│ ▼ Usage                                  │ 48px
│ ─────────────────────────────────────    │
│ Used in: 5 notes                         │ 40px
│ Last used: 2 days ago                    │ 40px
│                                          │
│ ┌────────────────────────────────────┐  │ Sticky
│ │ [Apply to Note]                    │  │ 64px
│ └────────────────────────────────────┘  │ bottom
│                                          │
└──────────────────────────────────────────┘
```

**Dimensions**:
- Full viewport width
- Back button: 48px tap target
- Section headers (collapsible): 48px height
- Content rows: 40-48px height
- Primary action button: 64px height
- Horizontal padding: 16px
- Vertical section gap: 16px

---

## Component States

### Tree Node States

**Default State**:
```
▶ 📁 Biology                                        [18]
  ├─── 32px ────┼───────── 280px ───────────┼─ 48px ─┤
  Chevron  Icon  Label (14px, medium)         Badge
```

**Hover State** (Desktop):
```
▶ 📁 Biology                                        [18] ⋮
  └─────────────────────────────────────────────────────┘
  Background: rgba(0,0,0,0.05)
  Cursor: pointer
```

**Expanded State**:
```
▼ 📁 Biology                                        [18] ⋮
  ├─ 📄 Cell Biology                                 [5]
  └─ 📄 Genetics                                     [8]
```

**Selected State**:
```
▼ 📁 Biology                                        [18]
  └─────────────────────────────────────────────────────┘
  Background: rgba(59, 130, 246, 0.1)
  Border-left: 4px solid #3b82f6
  Padding-left: 28px (adjusted for border)
```

**Focus State** (Keyboard):
```
▶ 📁 Biology                                        [18]
  └─────────────────────────────────────────────────────┘
  Outline: 2px solid #3b82f6
  Outline-offset: 2px
```

### Search Bar States

**Empty State**:
```
┌─────────────────────────────────────────────────────┐
│ 🔍 Search concepts...                               │ 40px
└─────────────────────────────────────────────────────┘
  Border: 1px solid #e5e7eb
```

**Focus State**:
```
┌─────────────────────────────────────────────────────┐
│ 🔍 Search concepts...                               │ 40px
└─────────────────────────────────────────────────────┘
  Border: 2px solid #3b82f6
  Box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1)
```

**Active with Results**:
```
┌─────────────────────────────────────────────────────┐
│ 🔍 cell bio                                      [×]│ 40px
├─────────────────────────────────────────────────────┤
│ 📄 Cell Biology                              [5]    │ 48px
│ 📄 Cellular Metabolism                       [3]    │ 48px
│ 📄 Molecular Biology                         [8]    │ 48px
└─────────────────────────────────────────────────────┘
  Dropdown: Max-height 320px, scrollable
  Results: Highlighted match text
```

---

## Interactive Elements

### Chevron Icon (Expand/Collapse)

**Collapsed**:
```
▶  Size: 16px
   Color: #6b7280
   Rotation: 0deg
   Transition: transform 300ms ease
```

**Expanded**:
```
▼  Size: 16px
   Color: #6b7280
   Rotation: 90deg
   Transition: transform 300ms ease
```

### Context Menu (Right-click / Long-press)

```
┌──────────────────────────┐
│ Add Child Concept        │ 40px
├──────────────────────────┤
│ Add Related Concept      │ 40px
├──────────────────────────┤
│ Edit                     │ 40px
├──────────────────────────┤
│ Delete                   │ 40px (Red text)
└──────────────────────────┘
  Width: 200px
  Shadow: 0 4px 6px rgba(0,0,0,0.1)
  Border-radius: 8px
```

### Badge (Usage Count)

**Default**:
```
[18]
 ├─ 24px height
 ├─ Min-width: 32px
 ├─ Padding: 4px 8px
 ├─ Border-radius: 12px
 ├─ Background: #f3f4f6
 ├─ Text: 12px, medium
 └─ Color: #6b7280
```

**High Usage** (>50):
```
[142]
  Background: #dbeafe (light blue)
  Color: #1e40af
```

---

## Accessibility Specifications

### ARIA Attributes

**Tree Container**:
```html
<div role="tree" aria-label="SKOS concept hierarchy">
```

**Tree Node** (Expandable):
```html
<div
  role="treeitem"
  aria-expanded="false"
  aria-level="2"
  aria-setsize="3"
  aria-posinset="1"
  tabindex="0"
>
```

**Search Combobox**:
```html
<input
  role="combobox"
  aria-autocomplete="list"
  aria-controls="search-results"
  aria-expanded="false"
  aria-activedescendant=""
/>
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Move focus to next interactive element |
| Shift+Tab | Move focus to previous element |
| Arrow Down | Navigate to next tree node |
| Arrow Up | Navigate to previous tree node |
| Arrow Right | Expand node (if collapsed) |
| Arrow Left | Collapse node (if expanded) or move to parent |
| Enter | Select node, open detail view |
| Space | Toggle node expansion |
| Home | Move to first tree node |
| End | Move to last visible tree node |
| Ctrl+F | Focus search bar |
| Escape | Close modal/clear search |
| * (asterisk) | Expand all siblings at current level |

### Focus Order

1. Scheme selector dropdown
2. Search input
3. Tree root node (first)
4. Tree child nodes (depth-first)
5. Add Concept button
6. Export button

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | <640px | Full-screen modal, vertical stack |
| Tablet | 640-1024px | Side sheet (70% width) |
| Desktop | >1024px | Fixed side panel (400px) |
| Large Desktop | >1440px | Panel + detail side-by-side |

---

## Animation Specifications

### Tree Node Expansion

```
Timing: 300ms ease-out
Property: height, opacity
Easing: cubic-bezier(0.4, 0, 0.2, 1)

Expanded children fade in:
  0ms: opacity 0, height 0
  150ms: opacity 0.5, height 50%
  300ms: opacity 1, height 100%
```

### Search Results Dropdown

```
Timing: 200ms ease-out
Property: opacity, transform
Transform: translateY(-8px) → translateY(0)
Opacity: 0 → 1
```

### Modal Open/Close

```
Timing: 250ms ease-in-out
Property: opacity, scale
Scale: 0.95 → 1 (open)
Opacity: 0 → 1 (open)
```

---

## Color Specifications

### Semantic Colors

```css
/* Primary (Interactive) */
--color-primary: #3b82f6;
--color-primary-hover: #2563eb;
--color-primary-active: #1d4ed8;

/* Background */
--color-bg-panel: #ffffff;
--color-bg-hover: rgba(0, 0, 0, 0.05);
--color-bg-selected: rgba(59, 130, 246, 0.1);

/* Border */
--color-border: #e5e7eb;
--color-border-focus: #3b82f6;

/* Text */
--color-text-primary: #111827;
--color-text-secondary: #6b7280;
--color-text-muted: #9ca3af;

/* Status */
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;
```

---

## Typography

```css
/* Headings */
--font-heading-lg: 18px / 24px, font-weight: 600;
--font-heading-md: 16px / 20px, font-weight: 600;

/* Body */
--font-body-md: 14px / 20px, font-weight: 400;
--font-body-sm: 12px / 16px, font-weight: 400;

/* Labels */
--font-label: 12px / 16px, font-weight: 500;
--font-label-caps: 11px / 14px, font-weight: 600, uppercase;

/* Monospace (Notation) */
--font-mono: 13px / 18px, font-family: 'Monaco', 'Courier New';
```

---

## Implementation Notes

1. **Virtualization**: Tree should use virtual scrolling for >200 nodes (react-window or similar)
2. **Lazy Loading**: Load child concepts on expand (not all upfront)
3. **Search Debounce**: 300ms delay on search input
4. **Drag-and-Drop**: Support reordering nodes within same parent (Phase 2)
5. **Offline Support**: Cache concept tree in IndexedDB for offline browsing
6. **Performance**: Memoize tree node components, only re-render on data change

---

## Related Specifications

- [UX Design Document](../fortemi-integration-ux-design.md)
- [SKOS API Endpoints](https://git.integrolabs.net/Fortemi/fortemi/src/branch/main/docs/content/api.md#skos-endpoints)
- [Accessibility Guidelines](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
