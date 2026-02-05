# HotM UI Redesign P1 Features - Wireframe Specifications

**Version**: 1.0
**Date**: 2026-02-05
**Phase**: Elaboration (Construction Preparation)
**Status**: Draft
**Grid System**: 8px base unit

---

## Document Overview

This document provides detailed wireframe specifications for the **Priority 1 (P1) features** of the HotM UI redesign. These wireframes guide Construction phase implementation and ensure alignment with design principles: Progressive Disclosure, Spatial Awareness, and Accessibility.

### Target Personas

1. **Knowledge Workers (Primary)**: 500-2000 notes, semantic search, daily use
2. **Power Users**: Advanced features, integrations, performance-sensitive
3. **Team Leads**: Collaboration, organization, knowledge health

### Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Library**: Radix UI (accessible primitives)
- **Styling**: TailwindCSS (utility-first)
- **State**: React Query (server state) + Context (global state)
- **Routing**: React Router v6

---

## Table of Contents

1. [Collections Management (HOTM-001)](#1-collections-management-hotm-001)
2. [Knowledge Health Dashboard (HOTM-002)](#2-knowledge-health-dashboard-hotm-002)
3. [Memory Search - Spatiotemporal (HOTM-003)](#3-memory-search---spatiotemporal-hotm-003)
4. [Responsive Behavior](#4-responsive-behavior)
5. [Accessibility Standards](#5-accessibility-standards)
6. [Animation & Transitions](#6-animation--transitions)
7. [Implementation Notes](#7-implementation-notes)

---

## 1. Collections Management (HOTM-001)

### 1.1 Feature Overview

Collections provide hierarchical organization for notes, allowing users to group related content, filter searches by collection, and visualize knowledge structure.

**User Stories**:
- As a Knowledge Worker, I want to organize notes into collections so that I can find related content quickly
- As a Power User, I want to nest collections hierarchically so that I can model complex taxonomies
- As a Team Lead, I want to see collection health metrics so that I can identify gaps

---

### 1.2 Collections Sidebar (Desktop >1024px)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ HotM                                                                   [@] [⚙] [?]  │ 64px
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ ┌──────────────────┐ │ ┌───────────────────────────────────────────────────────┐ │
│ │ Collections      │ │ │ Notes                                   [Grid][List]  │ │
│ │ ────────────     │ │ │                                                       │ │
│ │                  │ │ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ [+ New]          │ │ │ │ [Preview]  Note Title                           │ │ │
│ │                  │ │ │ │            First 200 chars of content...        │ │ │
│ │ 📁 All Notes     │ │ │ │            📁 Project Alpha  🏷 tag1  📅 Jan 24 │ │ │
│ │    (1,247)       │ │ │ └─────────────────────────────────────────────────┘ │ │
│ │                  │ │ │                                                       │ │
│ │ ▼ 📁 Work        │ │ │ ┌─────────────────────────────────────────────────┐ │ │
│ │    (342)         │ │ │ │ [Preview]  Another Note                         │ │ │
│ │                  │ │ │ │            Content preview...                   │ │ │
│ │   ▼ 📁 Projects  │ │ │ │            📁 Team Meeting  🏷 urgent           │ │ │
│ │       (156)      │ │ │ └─────────────────────────────────────────────────┘ │ │
│ │                  │ │ │                                                       │ │
│ │      📁 Alpha    │ │ │                    ... more notes ...                │ │
│ │         (42)     │ │ │                                                       │ │
│ │                  │ │ └───────────────────────────────────────────────────────┘ │
│ │      📁 Beta     │ │          Flex-grow, min 600px width                     │
│ │         (38)     │ │                                                          │
│ │                  │ │                                                          │
│ │   📁 Meetings    │ │                                                          │
│ │      (186)       │ │                                                          │
│ │                  │ │                                                          │
│ │ ▼ 📁 Personal    │ │                                                          │
│ │    (528)         │ │                                                          │
│ │                  │ │                                                          │
│ │   📁 Reading     │ │                                                          │
│ │      (142)       │ │                                                          │
│ │                  │ │                                                          │
│ │   📁 Journal     │ │                                                          │
│ │      (386)       │ │                                                          │
│ │                  │ │                                                          │
│ │ 📁 Archive       │ │                                                          │
│ │    (377)         │ │                                                          │
│ │                  │ │                                                          │
│ │ [Manage...]      │ │                                                          │
│ │                  │ │                                                          │
│ └──────────────────┘ │                                                          │
│   280px width        │                                                          │
│   Resizable          │                                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Sidebar width: 280px (resizable 200px-400px)
- Sidebar header: 48px height
- New collection button: 40px height
- Collection item: 36px height
- Nested indent: 16px per level (max 3 levels)
- Icon size: 20px
- Count badge: 16px height
- Gap between items: 4px
- Vertical padding: 8px
- Horizontal padding: 12px

**Interactions**:
- Click collection: Filter notes to that collection
- Click chevron (▼/►): Expand/collapse nested collections
- Hover item: Show edit/delete actions
- Right-click: Context menu (Rename, Delete, Move, Add Subcollection)
- Drag note: Assign to collection (visual feedback with drop zone highlight)
- Drag collection: Reorder or nest

**States**:
- **Active**: Bold text, accent background (#3b82f6 10% opacity)
- **Hover**: Light gray background (#f9fafb)
- **Expanded**: Chevron down (▼), children visible
- **Collapsed**: Chevron right (►), children hidden
- **Empty**: Dimmed text (#6b7280), "(0)" count

---

### 1.3 Create Collection Modal

```
┌───────────────────────────────────────────────────────────────┐
│ Create Collection                                    [×] Close │ 64px
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Collection Name *                                             │ 24px
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Project Alpha                                           │ │ 48px
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │ 16px
│ Description (optional)                                        │ 24px
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Notes related to Project Alpha MVP development          │ │ 96px
│ │                                                         │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │ 16px
│ Parent Collection                                             │ 24px
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📁 Work > Projects                                   ▼ │ │ 48px
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │ 16px
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ □ Create as top-level collection                        │ │ 32px
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │ 24px
│ Collection Icon                                               │ 24px
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                              │
│ │📁│ │📂│ │📊│ │🎯│ │🔬│ │🎨│  ... more ...                │ 48px
│ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                              │
│                                                               │ 32px
│                                       [Cancel]  [Create]      │ 56px
│                                                               │
└───────────────────────────────────────────────────────────────┘
  560px width × 500px height (centered)
  Padding: 24px
  Border-radius: 12px
  Box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
```

**Dimensions**:
- Modal width: 560px
- Modal height: Auto (max 600px)
- Header: 64px height
- Label: 24px height
- Input field: 48px height
- Textarea: 96px height
- Dropdown: 48px height
- Checkbox: 32px height
- Icon picker: 48px height per row
- Icon cell: 40px × 40px
- Button: 40px height
- Gap between fields: 16px
- Modal padding: 24px

**Validation**:
- Name: Required, 1-100 characters, unique within parent
- Description: Optional, max 500 characters
- Parent: Optional, max 3 levels deep
- Icon: Optional, defaults to 📁

**Keyboard**:
- Enter: Create collection (if valid)
- Escape: Close modal

---

### 1.4 Edit Collection Dialog

```
┌───────────────────────────────────────────────────────────────┐
│ Edit Collection: Project Alpha                      [×] Close │ 64px
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Name *                                                        │ 24px
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Project Alpha                                           │ │ 48px
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │ 16px
│ Description                                                   │ 24px
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Notes related to Project Alpha MVP development          │ │ 96px
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │ 16px
│ Parent                                                        │ 24px
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📁 Work > Projects                                   ▼ │ │ 48px
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │ 16px
│ Icon: 📁 [Change]                                             │ 32px
│                                                               │ 16px
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📊 Statistics                                           │ │ 32px
│ │ ────────────────────────────────────────────────────    │ │
│ │                                                         │ │
│ │ Notes: 42                                               │ │ 24px
│ │ Created: Jan 15, 2026                                   │ │ 24px
│ │ Last Updated: Jan 24, 2026                              │ │ 24px
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │ 24px
│ [Delete Collection]           [Cancel]  [Save Changes]       │ 56px
│                                                               │
└───────────────────────────────────────────────────────────────┘
  560px width × 540px height
```

**Dimensions**: Same as Create modal, with additional statistics section (120px height)

**Actions**:
- **Delete Collection**: Shows confirmation dialog
  - "Delete 'Project Alpha' and move 42 notes to 'Work > Projects'?"
  - Options: [Move to Parent] [Delete Notes] [Cancel]

---

### 1.5 Collection Detail View

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Collections           Project Alpha                         [Edit] [⋮]   │ 64px
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────┐   │
│ │ 📁 Project Alpha                                                            │   │ 48px
│ │ ────────────────────────────────────────────────────────────────────────    │   │
│ │                                                                             │   │
│ │ Notes related to Project Alpha MVP development                              │   │ 40px
│ │                                                                             │   │
│ │ 42 notes · Created Jan 15, 2026 · Last updated 2 hours ago                 │   │ 32px
│ │                                                                             │   │
│ └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │ 16px
│ ┌─────────────────────────────────────────────────────────────────────────────┐   │
│ │ Subcollections (2)                                          [+ New]         │   │ 48px
│ │ ────────────────────────────────────────────────────────────────────────    │   │
│ │                                                                             │   │
│ │ ┌──────────────────────┐  ┌──────────────────────┐                        │   │
│ │ │ 📁 Backend           │  │ 📁 Frontend          │                        │   │
│ │ │    24 notes          │  │    18 notes          │                        │   │ 120px
│ │ │    Last: 1 day ago   │  │    Last: 2 hours ago │                        │   │
│ │ │    [View →]          │  │    [View →]          │                        │   │
│ │ └──────────────────────┘  └──────────────────────┘                        │   │
│ │     240px width             240px width                                     │   │
│ │                                                                             │   │
│ └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │ 16px
│ ┌─────────────────────────────────────────────────────────────────────────────┐   │
│ │ Notes (42)                         [Search]  [Sort: Recent ▼]  [Grid][List]│   │ 56px
│ │ ────────────────────────────────────────────────────────────────────────    │   │
│ │                                                                             │   │
│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │   │
│ │ │[Thumb]   │ │[Thumb]   │ │[Thumb]   │ │[Thumb]   │                      │   │
│ │ │Note Title│ │Note Title│ │Note Title│ │Note Title│                      │   │
│ │ │          │ │          │ │          │ │          │                      │   │ 200px
│ │ │First line│ │Preview...│ │Content...│ │Text...   │                      │   │
│ │ │of content│ │          │ │          │ │          │                      │   │
│ │ │Jan 24    │ │Jan 22    │ │Jan 20    │ │Jan 18    │                      │   │
│ │ └──────────┘ └──────────┘ └──────────┘ └──────────┘                      │   │
│ │   240px       240px       240px       240px                                │   │
│ │                                                                             │   │
│ │ ... more notes (4 per row) ...                                             │   │
│ │                                                                             │   │
│ └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Header: 64px height
- Collection info card: 120px height
- Subcollections section: 48px header + 120px cards
- Subcollection card: 240px width × 120px height
- Notes grid: 4 columns, 240px width per card
- Note card: 240px width × 200px height
- Gap between sections: 16px
- Gap between cards: 16px
- Padding: 24px

**Grid View (Notes)**:
- 4 columns on desktop (>1024px)
- 3 columns on tablet (640-1024px)
- 2 columns on mobile (>480px)
- 1 column on small mobile (<480px)

---

### 1.6 Drag-Drop Interaction

**Visual Feedback**:

```
Dragging Note:
┌────────────────────────────────┐
│ [Ghost Image]                  │ Semi-transparent
│ Note Title                     │ 50% opacity
│ Content preview...             │
└────────────────────────────────┘
  Cursor: grabbing

Drop Zone (Collection Sidebar):
▼ 📁 Work
   ▼ 📁 Projects
      ┌──────────────────────────┐
      │ ░░░░ Drop here ░░░░      │ Dashed border
      │                          │ Light blue bg (#3b82f6 10%)
      └──────────────────────────┘
       36px height
      📁 Alpha
      📁 Beta

Drop Zone (Grid Card):
┌────────────────────────────────┐
│ ┌──────────────────────────┐   │
│ │ ░░░░ Drop to add ░░░░    │   │ 2px dashed border
│ │                          │   │ Light blue bg
│ └──────────────────────────┘   │
│   Subcollection card           │
└────────────────────────────────┘
```

**States**:
- **Dragging**: Note card at 50% opacity, cursor `grabbing`
- **Valid Drop Zone**: Dashed border, accent background
- **Invalid Drop Zone**: Red border, cursor `not-allowed`
- **Dropped**: Smooth fade-out animation (300ms)

---

### 1.7 Collection Badge (on Note Cards)

```
Note Card:
┌─────────────────────────────────────────────────┐
│ [Thumbnail]  Note Title                         │
│              First 200 characters of content... │
│                                                 │
│ ┌─────────────────┐ 🏷 tag1  📅 Jan 24         │
│ │📁 Project Alpha │                             │
│ └─────────────────┘                             │
└─────────────────────────────────────────────────┘

Badge dimensions:
- Height: 24px
- Padding: 4px 8px
- Border-radius: 4px
- Font: 12px, medium weight
- Icon: 16px
- Background: rgba(59, 130, 246, 0.1)
- Border: 1px solid #3b82f6
- Hover: Shows full path tooltip
```

**Tooltip on Hover**:
```
┌────────────────────┐
│ Work > Projects >  │ 32px height
│ Project Alpha      │
└────────────────────┘
  Appears above badge
  Max-width: 300px
  Delay: 500ms
```

---

### 1.8 Empty States

**No Collections**:
```
┌──────────────────────────────┐
│                              │
│         📁                   │ 64px icon
│                              │
│   No Collections Yet         │ 24px
│                              │
│   Create your first          │ 16px
│   collection to organize     │
│   your notes.                │
│                              │
│   [+ Create Collection]      │ 48px button
│                              │
└──────────────────────────────┘
  Centered in sidebar
  Max-width: 240px
```

**Empty Collection**:
```
┌──────────────────────────────┐
│                              │
│         📂                   │ 64px icon
│                              │
│   No Notes Yet               │ 24px
│                              │
│   Drag notes here or click   │ 16px
│   to add your first note.    │
│                              │
│   [+ Add Note]               │ 48px button
│                              │
└──────────────────────────────┘
  Centered in notes area
  Max-width: 400px
```

---

### 1.9 Mobile Layout (<640px)

**Collections Bottom Sheet**:

```
┌────────────────────────────────────────┐
│ ← Notes                    Collections │ 64px
├────────────────────────────────────────┤
│                                        │
│ [Swipe up to expand]                   │
│ ════                                   │ 24px handle
│                                        │
│ ┌────────────────────────────────────┐│
│ │ 📁 All Notes (1,247)            ▼ ││ 56px
│ └────────────────────────────────────┘│
│ ┌────────────────────────────────────┐│
│ │ 📁 Work (342)                   ▼ ││ 56px
│ └────────────────────────────────────┘│
│ ┌────────────────────────────────────┐│
│ │ 📁 Personal (528)               ▼ ││ 56px
│ └────────────────────────────────────┘│
│                                        │
│              ... more ...              │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [+ New Collection]                 ││ 64px
│ └────────────────────────────────────┘│
│                                        │
└────────────────────────────────────────┘
  Bottom sheet
  Snap points: 25%, 50%, 90%
  Swipe gesture enabled
  Backdrop blur
```

**Dimensions**:
- Bottom sheet min height: 25% viewport
- Collection item: 56px height (touch-friendly)
- New collection button: 64px height
- Handle: 24px height
- Horizontal padding: 16px

---

## 2. Knowledge Health Dashboard (HOTM-002)

This feature has an existing detailed wireframe specification. See:
**[Knowledge Health Dashboard Wireframe](../../../docs/ux/wireframes/04-knowledge-health-dashboard.md)**

### 2.1 Summary

The Knowledge Health Dashboard provides visual analytics for knowledge base quality:

- **Health Score**: 0-100 gauge with trend indicator
- **Orphan Notes**: Notes without links (with line chart)
- **Stale Content**: Notes not updated in configurable days (histogram)
- **Tag Coverage**: Percentage of tagged notes (gauge)
- **Link Quality**: Distribution of link scores (bar chart)
- **Actionable Insights**: Prioritized recommendations (high/medium/low)
- **Trends**: Health score over time, activity heatmap

### 2.2 Integration Points

**Sidebar Access**:
```
┌──────────────────┐
│ Collections      │
│                  │
│ 📁 All Notes     │
│                  │
│ ──────────────   │
│                  │
│ 📊 Health        │ ← New sidebar item
│                  │
│ 🔍 Search        │
│                  │
│ ⚙ Settings       │
│                  │
└──────────────────┘
```

**Quick Stats in Header**:
```
┌─────────────────────────────────────────────────────────┐
│ HotM              Health: 62 (Fair)       [@] [⚙] [?]  │
│                   ◔◔◔◯◯                                 │
└─────────────────────────────────────────────────────────┘
  Click health score to open full dashboard
```

---

## 3. Memory Search - Spatiotemporal (HOTM-003)

This feature has an existing detailed wireframe specification. See:
**[Memory Search Wireframe](../../../docs/ux/wireframes/03-memory-search.md)**

### 3.1 Summary

Memory Search provides spatiotemporal filtering for notes with location and time metadata:

- **Location Search**: Address input with autocomplete (geocoding)
- **Radius Selector**: 100m to 50km slider with live preview
- **Map View**: Interactive map with markers and clustering (Leaflet.js)
- **Date Range Picker**: Start/end dates with timeline scrubber
- **Timeline View**: Chronological visualization with daily grouping
- **Combined Filters**: Device, type, sort order

### 3.2 Integration Points

**Search Bar Enhancement**:
```
┌──────────────────────────────────────────────────────────┐
│ [🔍] Search notes...                    [Filters ▼]     │
│                                                          │
│ Filters:                                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│ │ 📍 Location  │ │ 🕐 Time      │ │ 🏷 Tags         │  │
│ └──────────────┘ └──────────────┘ └─────────────────┘  │
└──────────────────────────────────────────────────────────┘
  Click "📍 Location" to open Memory Search
```

**Header Icon**:
```
┌─────────────────────────────────────────────────┐
│ HotM                        [🗺] [🔍] [@] [⚙]  │
│                              ▲                  │
│                              └─ Memory Search   │
└─────────────────────────────────────────────────┘
```

---

## 4. Responsive Behavior

### 4.1 Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| **Mobile** | <640px | Single column, bottom sheets, stacked cards |
| **Tablet** | 640-1024px | Collapsible sidebar, 2-column grids |
| **Desktop** | >1024px | Fixed sidebar, 4-column grids, split views |
| **Large** | >1440px | Wider content area, more grid columns |

### 4.2 Collections Responsive Layout

**Desktop (>1024px)**:
- Sidebar: 280px fixed width, resizable
- Notes area: Flex-grow
- Grid: 4 columns

**Tablet (640-1024px)**:
- Sidebar: Collapsible (48px collapsed, 280px expanded)
- Notes area: Full width when sidebar collapsed
- Grid: 2-3 columns

**Mobile (<640px)**:
- Sidebar: Bottom sheet (swipe up)
- Notes area: Full width
- Grid: 1-2 columns
- Touch targets: Minimum 44px × 44px

### 4.3 Dashboard Responsive Layout

**Desktop (>1024px)**:
- Overview cards: 4 columns (240px each)
- Metric cards: 2 columns (480px each)
- Action cards: 3 columns (320px each)

**Tablet (640-1024px)**:
- Overview cards: 2 columns
- Metric cards: 1-2 columns
- Action cards: 2 columns

**Mobile (<640px)**:
- All cards: 1 column, full width
- Overview cards: 160px height (compact)
- Metric cards: 200px height
- Collapsible sections

### 4.4 Memory Search Responsive Layout

**Desktop (>1024px)**:
- Split view: Filters (350px) + Results (flex-grow)
- Map: 600px+ height

**Tablet (640-1024px)**:
- Stacked: Filters (collapsible) + Results
- Map: 500px height

**Mobile (<640px)**:
- Full-screen modals for filters
- Bottom sheet for map details
- Result cards: 100px height (compact)

---

## 5. Accessibility Standards

### 5.1 WCAG 2.1 Level AA Compliance

**Color Contrast**:
- Text on background: Minimum 4.5:1 ratio
- Large text (18pt+): Minimum 3:1 ratio
- UI components: Minimum 3:1 ratio
- Focus indicators: Minimum 3:1 ratio, 2px outline

**Keyboard Navigation**:
- All interactive elements reachable via Tab
- Logical tab order (left-to-right, top-to-bottom)
- Focus indicators visible (2px blue outline)
- Arrow keys for navigation within components
- Enter/Space for activation
- Escape to close modals/dropdowns

**Screen Reader Support**:
- Semantic HTML (`<nav>`, `<main>`, `<article>`, etc.)
- ARIA labels for icons and buttons
- ARIA live regions for dynamic updates
- ARIA expanded/collapsed for accordions
- Descriptive link text (no "click here")

### 5.2 Collections Accessibility

**ARIA Attributes**:
```html
<!-- Collection Tree -->
<nav aria-label="Collections">
  <ul role="tree">
    <li role="treeitem" aria-expanded="true" aria-level="1">
      <button aria-label="Work collection, 342 notes, expanded">
        📁 Work (342)
      </button>
      <ul role="group">
        <li role="treeitem" aria-level="2">
          <button aria-label="Projects subcollection, 156 notes">
            📁 Projects (156)
          </button>
        </li>
      </ul>
    </li>
  </ul>
</nav>

<!-- Create Collection Modal -->
<div role="dialog" aria-labelledby="modal-title" aria-modal="true">
  <h2 id="modal-title">Create Collection</h2>
  <form>
    <label for="collection-name">Collection Name *</label>
    <input
      id="collection-name"
      type="text"
      required
      aria-required="true"
      aria-describedby="name-help"
    />
    <div id="name-help" class="sr-only">
      Enter a unique name for the collection
    </div>
  </form>
</div>

<!-- Drag-Drop -->
<div
  role="button"
  tabindex="0"
  draggable="true"
  aria-grabbed="false"
  aria-label="Note card: Project Alpha"
>
  <!-- Note content -->
</div>

<div
  role="region"
  aria-dropeffect="move"
  aria-label="Drop zone: Work collection"
>
  <!-- Collection content -->
</div>
```

**Keyboard Shortcuts**:
| Key | Action |
|-----|--------|
| N | New collection |
| Enter | Open/select collection |
| Space | Expand/collapse collection |
| Arrow Up/Down | Navigate tree |
| Arrow Right | Expand item |
| Arrow Left | Collapse item |
| F2 | Rename collection |
| Delete | Delete collection (with confirmation) |
| Escape | Close modal |

**Screen Reader Announcements**:
```
"Collections navigation. 5 collections.
 Work collection, 342 notes, expanded.
 2 subcollections: Projects and Meetings."

"Note assigned to Project Alpha collection."

"Collection created: Project Alpha.
 42 notes found in this collection."

"Warning: Deleting collection will move 42 notes to parent."
```

### 5.3 Dashboard Accessibility

**ARIA Attributes**:
```html
<!-- Health Score Gauge -->
<div
  role="meter"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow="62"
  aria-valuetext="62 out of 100, Fair health score"
>
  <!-- Gauge SVG -->
</div>

<!-- Metric Card -->
<article
  aria-labelledby="orphan-heading"
  aria-describedby="orphan-description"
>
  <h3 id="orphan-heading">Orphan Notes</h3>
  <p id="orphan-description">
    42 notes that are not linked to other notes
  </p>
  <button aria-label="View 42 orphan notes">View Orphans</button>
</article>

<!-- Chart -->
<figure role="img" aria-labelledby="chart-title">
  <figcaption id="chart-title">
    Health score trend over last 30 days, currently 62
  </figcaption>
  <svg><!-- Chart visualization --></svg>
  <!-- Fallback table -->
  <details>
    <summary>View data table</summary>
    <table>
      <caption>Health Score Data</caption>
      <thead>
        <tr><th>Date</th><th>Score</th></tr>
      </thead>
      <tbody>
        <tr><td>Jan 1</td><td>58</td></tr>
        <!-- ... -->
      </tbody>
    </table>
  </details>
</figure>
```

**Keyboard Shortcuts**:
| Key | Action |
|-----|--------|
| 1-4 | Jump to overview card |
| M | Jump to Metrics section |
| I | Jump to Insights section |
| T | Jump to Trends section |
| R | Refresh dashboard |
| Tab | Navigate cards/actions |
| Enter | Activate action button |
| Space | Toggle section expansion |
| Escape | Close expanded views |

### 5.4 Memory Search Accessibility

**ARIA Attributes**:
```html
<!-- Location Picker -->
<div role="combobox" aria-expanded="false" aria-haspopup="listbox">
  <label for="location-input">Search for location</label>
  <input
    id="location-input"
    type="text"
    aria-autocomplete="list"
    aria-controls="location-results"
  />
  <ul
    id="location-results"
    role="listbox"
    aria-label="Location suggestions"
  >
    <li role="option" aria-selected="false">
      San Francisco, CA
    </li>
  </ul>
</div>

<!-- Map -->
<div
  role="application"
  aria-label="Interactive map showing 42 memory locations"
>
  <!-- Leaflet map -->
</div>

<!-- Radius Slider -->
<label for="radius-slider">Search radius</label>
<input
  id="radius-slider"
  type="range"
  role="slider"
  min="100"
  max="50000"
  value="5000"
  aria-valuemin="100"
  aria-valuemax="50000"
  aria-valuenow="5000"
  aria-valuetext="5 kilometers"
/>

<!-- Timeline Scrubber -->
<div role="group" aria-label="Date range selection">
  <label for="start-date">Start date</label>
  <input
    id="start-date"
    type="date"
    aria-label="Start date"
    aria-valuetext="January 1st, 2026"
  />
  <label for="end-date">End date</label>
  <input
    id="end-date"
    type="date"
    aria-label="End date"
    aria-valuetext="January 31st, 2026"
  />
</div>
```

**Keyboard Shortcuts**:
| Key | Action |
|-----|--------|
| Ctrl+F | Focus location search |
| Tab | Navigate filters/results |
| Enter | Apply search, open result |
| Space | Open date picker, select result |
| Arrow Keys | Navigate map, adjust sliders |
| +/- | Zoom map in/out |
| Home | Jump to first result |
| End | Jump to last result |
| Escape | Close modal, clear search |

---

## 6. Animation & Transitions

### 6.1 General Principles

- **Duration**: 150-300ms for UI feedback, 400-600ms for page transitions
- **Easing**: `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for movements
- **Performance**: Use `transform` and `opacity` (GPU-accelerated)
- **Reduced Motion**: Respect `prefers-reduced-motion` media query

### 6.2 Collections Animations

**Sidebar Expand/Collapse**:
```css
transition: transform 300ms ease-out;

/* Collapsed */
transform: translateX(-280px);

/* Expanded */
transform: translateX(0);
```

**Tree Node Expand**:
```css
/* Children container */
transition: max-height 250ms ease-out, opacity 200ms ease-out;

/* Collapsed */
max-height: 0;
opacity: 0;
overflow: hidden;

/* Expanded */
max-height: 500px; /* Enough for all children */
opacity: 1;
```

**Drag-Drop**:
```css
/* Dragging */
.dragging {
  opacity: 0.5;
  cursor: grabbing;
  transition: opacity 150ms ease-out;
}

/* Drop zone highlight */
.drop-zone-active {
  border: 2px dashed #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  transition: all 200ms ease-out;
}

/* Success drop */
@keyframes drop-success {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
```

**Modal Entry**:
```css
animation: fade-slide-up 300ms ease-out;

@keyframes fade-slide-up {
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

### 6.3 Dashboard Animations

**Card Entrance**:
```css
animation: fade-slide-up 400ms ease-out;
animation-delay: calc(var(--index) * 50ms);

/* Stagger by index */
.card:nth-child(1) { --index: 0; }
.card:nth-child(2) { --index: 1; }
.card:nth-child(3) { --index: 2; }
```

**Health Score Count-Up**:
```javascript
// Animate number from 0 to target over 1000ms
function animateValue(element, target, duration) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * eased);

    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
```

**Chart Line Draw**:
```css
/* SVG path animation */
animation: draw-line 1500ms ease-out;

@keyframes draw-line {
  from {
    stroke-dashoffset: 1000;
  }
  to {
    stroke-dashoffset: 0;
  }
}
```

**Refresh Pulse**:
```css
animation: pulse 600ms ease-out;

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
```

### 6.4 Memory Search Animations

**Map Zoom**:
```css
transition: transform 300ms ease-out;

/* Zoom to marker on select */
animation: zoom-and-center 500ms ease-out;

@keyframes zoom-and-center {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.5);
  }
}
```

**Result Card Entry**:
```css
animation: slide-up 300ms ease-out;
animation-delay: calc(var(--index) * 50ms);

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

**Filter Accordion**:
```css
transition: max-height 300ms ease-out;

/* Collapsed */
max-height: 0;
overflow: hidden;

/* Expanded */
max-height: 500px;
```

**Bottom Sheet (Mobile)**:
```css
transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);

/* Snap points */
transform: translateY(0%);    /* 90% expanded */
transform: translateY(50%);   /* 50% peek */
transform: translateY(75%);   /* 25% preview */
```

### 6.5 Reduced Motion

**Media Query**:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Alternative Feedback**:
- Use instant state changes instead of animations
- Fade effects only (no movement)
- Focus indicators more prominent
- Loading states use static indicators

---

## 7. Implementation Notes

### 7.1 Component Architecture

**Collections**:
```
<CollectionsProvider>
  <CollectionsSidebar>
    <CollectionTree>
      <CollectionNode>
        <CollectionItem />
        <CollectionDropZone />
      </CollectionNode>
    </CollectionTree>
    <CreateCollectionButton />
  </CollectionsSidebar>

  <CollectionDetailView>
    <CollectionHeader />
    <SubcollectionGrid />
    <NotesGrid>
      <NoteCard draggable />
    </NotesGrid>
  </CollectionDetailView>

  <CreateCollectionModal />
  <EditCollectionDialog />
  <DeleteCollectionConfirm />
</CollectionsProvider>
```

**Dashboard**:
```
<DashboardProvider>
  <DashboardHeader />

  <OverviewCards>
    <HealthScoreCard />
    <TotalNotesCard />
    <ActiveConceptsCard />
    <LinkDensityCard />
  </OverviewCards>

  <MetricsSection>
    <OrphanNotesCard />
    <StaleContentCard />
    <TagCoverageCard />
    <LinkQualityCard />
  </MetricsSection>

  <InsightsSection>
    <ActionCard priority="high" />
    <ActionCard priority="medium" />
    <ActionCard priority="low" />
  </InsightsSection>

  <TrendsSection>
    <HealthScoreChart />
    <ActivityHeatmap />
  </TrendsSection>
</DashboardProvider>
```

**Memory Search**:
```
<MemorySearchProvider>
  <MemorySearchModal>
    <FilterPanel>
      <LocationPicker>
        <LocationAutocomplete />
        <MapPreview />
        <RadiusSlider />
      </LocationPicker>
      <TimeRangePicker>
        <DateInputs />
        <TimelineScrubber />
      </TimeRangePicker>
      <AdditionalFilters />
    </FilterPanel>

    <ResultsPanel>
      <ResultsHeader />
      <ResultsList />
      <ResultsGrid />
      <MapView>
        <LeafletMap />
        <MarkerCluster />
        <SelectedCardPreview />
      </MapView>
      <TimelineView />
    </ResultsPanel>
  </MemorySearchModal>
</MemorySearchProvider>
```

### 7.2 State Management

**Collections State**:
```typescript
interface CollectionsState {
  collections: Collection[];
  activeCollectionId: string | null;
  expandedIds: Set<string>;
  dragState: {
    noteId: string | null;
    validDropZones: string[];
  };
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  icon: string;
  parentId: string | null;
  noteCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Dashboard State**:
```typescript
interface DashboardState {
  healthScore: {
    current: number;
    trend: number;
    history: Array<{ date: Date; score: number }>;
  };
  metrics: {
    orphanNotes: { count: number; percentage: number };
    staleContent: { count: number; ageDistribution: Record<string, number> };
    tagCoverage: { percentage: number; untaggedCount: number };
    linkQuality: { avgScore: number; distribution: Record<string, number> };
  };
  insights: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    effort: string;
    action: () => void;
  }>;
  lastUpdated: Date;
  isRefreshing: boolean;
}
```

**Memory Search State**:
```typescript
interface MemorySearchState {
  filters: {
    location: {
      address: string;
      coordinates: { lat: number; lng: number } | null;
      radius: number; // meters
    };
    timeRange: {
      start: Date;
      end: Date;
    };
    device?: string;
    type?: string;
    sort: 'distance' | 'date' | 'relevance';
  };
  results: SearchResult[];
  viewMode: 'list' | 'grid' | 'map' | 'timeline';
  selectedNoteId: string | null;
  isLoading: boolean;
}

interface SearchResult {
  noteId: string;
  title: string;
  snippet: string;
  location: { lat: number; lng: number; address: string };
  distance: number; // meters
  timestamp: Date;
  device?: string;
}
```

### 7.3 API Endpoints

**Collections**:
```typescript
// GET /api/v1/collections
// Response: Collection[]

// POST /api/v1/collections
// Body: { name: string; description?: string; parentId?: string; icon?: string }
// Response: Collection

// GET /api/v1/collections/:id
// Response: Collection & { subcollections: Collection[]; notes: Note[] }

// PUT /api/v1/collections/:id
// Body: { name?: string; description?: string; parentId?: string; icon?: string }
// Response: Collection

// DELETE /api/v1/collections/:id
// Query: { moveNotesTo?: string }
// Response: { success: boolean }

// PUT /api/v1/notes/:id/collection
// Body: { collectionId: string | null }
// Response: Note
```

**Dashboard**:
```typescript
// GET /api/v1/health/score
// Response: { current: number; trend: number; history: Array }

// GET /api/v1/health/metrics
// Response: {
//   orphanNotes: { count: number; percentage: number; trend: Array };
//   staleContent: { count: number; ageDistribution: Record };
//   tagCoverage: { percentage: number; untaggedCount: number };
//   linkQuality: { avgScore: number; distribution: Record };
// }

// GET /api/v1/health/insights
// Response: Array<{ id: string; priority: string; title: string; ... }>

// POST /api/v1/health/refresh
// Response: { success: boolean; lastUpdated: Date }
```

**Memory Search**:
```typescript
// POST /api/v1/search/spatial
// Body: {
//   location: { lat: number; lng: number };
//   radius: number;
//   timeRange?: { start: Date; end: Date };
//   device?: string;
//   type?: string;
//   sort?: string;
//   limit?: number;
//   offset?: number;
// }
// Response: {
//   results: SearchResult[];
//   total: number;
//   hasMore: boolean;
// }

// POST /api/v1/geocode
// Body: { address: string }
// Response: { coordinates: { lat: number; lng: number }; address: string }

// POST /api/v1/reverse-geocode
// Body: { lat: number; lng: number }
// Response: { address: string }
```

### 7.4 Performance Optimizations

**Collections**:
1. **Virtual Scrolling**: For large collection lists (>100 items)
2. **Lazy Loading**: Load subcollections on expand
3. **Debounced Drag**: 100ms debounce for drag events
4. **Memoization**: Memoize collection tree computation
5. **Batch Updates**: Batch multiple collection assignments

**Dashboard**:
1. **Lazy Chart Rendering**: Render charts on scroll (IntersectionObserver)
2. **Cached Metrics**: 5-minute cache, background refresh
3. **Progressive Loading**: Load overview cards first, then metrics
4. **Debounced Refresh**: 500ms debounce on manual refresh
5. **Chart Optimization**: Canvas for complex charts, SVG for simple ones
6. **Data Aggregation**: Pre-aggregate metrics on backend

**Memory Search**:
1. **Map Rendering**: Use WebGL for >500 markers
2. **Clustering**: Dynamic clustering for zoom levels
3. **Debouncing**: 500ms for radius/location changes
4. **Pagination**: 50 results per page, infinite scroll
5. **Thumbnail Lazy Load**: Load on scroll (IntersectionObserver)
6. **Geocoding Cache**: Cache location lookups in localStorage
7. **Map Tile Cache**: Browser caches map tiles automatically
8. **Virtual Scrolling**: For timeline with >1000 results

### 7.5 Testing Strategy

**Unit Tests**:
- Collection CRUD operations
- Tree traversal logic
- Drag-drop validation
- Health score calculation
- Filter logic
- Distance calculation (Haversine)

**Integration Tests**:
- Collection API endpoints
- Note assignment workflow
- Dashboard data fetching
- Search with multiple filters
- Map interaction

**E2E Tests**:
- Create and organize collections
- Drag note to collection
- View health dashboard
- Perform spatial search
- Navigate map results

**Accessibility Tests**:
- Keyboard navigation flows
- Screen reader compatibility
- ARIA attribute presence
- Color contrast verification
- Focus management

### 7.6 Browser Compatibility

**Minimum Supported Versions**:
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile Safari: iOS 14+
- Chrome Mobile: Android 10+

**Polyfills Required**:
- ResizeObserver (for responsive components)
- IntersectionObserver (for lazy loading)
- Fetch API (if supporting older browsers)

**Progressive Enhancement**:
- Map view: Fallback to list view if Leaflet fails
- Drag-drop: Fallback to button-based assignment
- Charts: Fallback to data tables
- Animations: Respect `prefers-reduced-motion`

---

## 8. Glossary

| Term | Definition |
|------|------------|
| **Collection** | User-defined grouping of notes, can be nested hierarchically |
| **Health Score** | 0-100 metric indicating knowledge base quality |
| **Orphan Note** | Note with no incoming or outgoing links |
| **Stale Content** | Note not updated within configured threshold (default 365 days) |
| **Spatiotemporal Search** | Search combining location (spatial) and time (temporal) filters |
| **Radius Search** | Geographic search within circular distance from center point |
| **Timeline Scrubber** | Interactive date range selector with visual timeline |
| **Marker Clustering** | Grouping nearby map markers into single cluster icon |
| **Progressive Disclosure** | UI pattern revealing complexity gradually |
| **Spatial Awareness** | Visual cues about location and context in interface |

---

## 9. Related Documents

- **Functional Requirements**: [/home/roctinam/dev/HotM/docs/requirements/functional-requirements.md](../../../docs/requirements/functional-requirements.md)
- **System Architecture**: [/home/roctinam/dev/HotM/docs/architecture/system-architecture.md](../../../docs/architecture/system-architecture.md)
- **Software Architecture Document**: [/home/roctinam/dev/HotM/.aiwg/architecture/software-architecture-doc.md](../../architecture/software-architecture-doc.md)
- **MVP Acceptance Criteria**: [/home/roctinam/dev/HotM/.aiwg/requirements/mvp-acceptance-criteria.md](../../requirements/mvp-acceptance-criteria.md)
- **Existing Wireframes**:
  - Knowledge Health Dashboard: [/home/roctinam/dev/HotM/docs/ux/wireframes/04-knowledge-health-dashboard.md](../../../docs/ux/wireframes/04-knowledge-health-dashboard.md)
  - Memory Search: [/home/roctinam/dev/HotM/docs/ux/wireframes/03-memory-search.md](../../../docs/ux/wireframes/03-memory-search.md)

---

## Document Control

| Field | Value |
|-------|-------|
| **Created** | 2026-02-05 |
| **Version** | 1.0 (Draft) |
| **Author** | Product Designer |
| **Status** | Draft - Pending Review |
| **Next Steps** | Design review with team, validation against Fortemi API, implementation planning |

---

**End of P1 Wireframes Specification**
