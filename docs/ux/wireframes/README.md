# Wireframes - Fortemi Integration Features

**Version**: 1.0
**Last Updated**: 2026-02-04
**Status**: Design Review

---

## Overview

This directory contains detailed wireframe specifications for all six Fortemi integration features. Each wireframe includes ASCII diagrams, exact dimensions (8px grid system), component states, responsive breakpoints, and accessibility specifications.

---

## Wireframe Specifications

### 1. [SKOS Concept Browser](./01-skos-concept-browser.md)

Hierarchical tree interface for W3C SKOS controlled vocabularies.

**Key Components**:
- Tree view with expand/collapse
- Search bar with autocomplete
- Concept detail panel
- Create/edit concept modals

**Breakpoints**:
- Desktop: 400px fixed side panel
- Tablet: 70% width side sheet
- Mobile: Full-screen modal

**File**: [01-skos-concept-browser.md](./01-skos-concept-browser.md)

---

### 2. [File Attachments Panel](./02-file-attachments-panel.md)

Upload, preview, and manage file attachments with rich metadata.

**Key Components**:
- Drag-and-drop upload zone
- Grid/list view toggles
- Preview modal with EXIF data
- Location map integration
- Bottom sheet (mobile)

**Breakpoints**:
- Desktop: 4-column grid
- Tablet: 2-3 columns
- Mobile: List view, full-screen preview

**File**: [02-file-attachments-panel.md](./02-file-attachments-panel.md)

---

### 3. [Memory Search](./03-memory-search.md)

Spatiotemporal search interface with location radius and time range filters.

**Key Components**:
- Location picker with map
- Radius slider
- Time range picker with timeline scrubber
- Map view with clustered markers
- Timeline view with date grouping

**Breakpoints**:
- Desktop: Split layout (filters left, results right)
- Tablet: Collapsible filters
- Mobile: Full-screen map, bottom sheet results

**File**: [03-memory-search.md](./03-memory-search.md)

---

### 4. [Knowledge Health Dashboard](./04-knowledge-health-dashboard.md)

Visual dashboard showing knowledge base quality metrics.

**Key Components**:
- Health score gauge
- Metric cards with charts
- Action cards (priority-based)
- Trend line charts
- Activity heatmap

**Breakpoints**:
- Desktop: 4-column overview, 2-column metrics
- Tablet: 2-column overview, 1-column metrics
- Mobile: Single column, collapsible sections

**File**: [04-knowledge-health-dashboard.md](./04-knowledge-health-dashboard.md)

---

### 5. [Version History](./05-version-history.md)

Timeline-based interface for viewing note edit history and comparing versions.

**Key Components**:
- Timeline with version cards
- Content viewer
- Diff viewer (side-by-side and unified)
- Restore confirmation dialog
- Version navigation controls

**Breakpoints**:
- Desktop: Side-by-side (timeline + content)
- Tablet: Collapsible timeline
- Mobile: Full-screen list, swipeable detail

**File**: [05-version-history.md](./05-version-history.md)

---

### 6. [Template Management](./06-template-management.md)

CRUD interface for note templates with variable substitution.

**Key Components**:
- Template browser (grid/list)
- Markdown editor with toolbar
- Variable detection panel
- Live preview pane
- Instantiation modal with form

**Breakpoints**:
- Desktop: 4-column grid, side-by-side editor
- Tablet: 2-3 columns, tabbed editor
- Mobile: List view, full-screen editor

**File**: [06-template-management.md](./06-template-management.md)

---

## Design System Standards

All wireframes follow these standards:

### Grid System

- **Base unit**: 8px
- **Common spacing**: 8px, 16px, 24px, 32px
- **Component heights**: Multiples of 8px
- **Touch targets**: Minimum 44px (mobile), 40px (desktop)

### Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| Mobile | <640px | Phone portrait |
| Tablet | 640-1024px | Tablet, small laptop |
| Desktop | >1024px | Standard desktop |
| Large Desktop | >1440px | Wide monitors |

### Typography Scale

```css
/* Headings */
--font-h1: 32px / 40px, 700
--font-h2: 24px / 32px, 700
--font-h3: 18px / 24px, 600
--font-h4: 16px / 24px, 600

/* Body */
--font-body-lg: 16px / 24px, 400
--font-body-md: 14px / 20px, 400
--font-body-sm: 12px / 16px, 400

/* Labels */
--font-label: 12px / 16px, 500
--font-label-lg: 14px / 20px, 500

/* Monospace */
--font-mono: 13px / 20px, monospace
```

### Color Palette

```css
/* Primary */
--color-primary: #3b82f6
--color-primary-hover: #2563eb
--color-primary-active: #1d4ed8

/* Semantic */
--color-success: #10b981
--color-warning: #f59e0b
--color-error: #ef4444
--color-info: #06b6d4

/* Neutral */
--color-gray-50: #f9fafb
--color-gray-100: #f3f4f6
--color-gray-200: #e5e7eb
--color-gray-300: #d1d5db
--color-gray-400: #9ca3af
--color-gray-500: #6b7280
--color-gray-600: #4b5563
--color-gray-700: #374151
--color-gray-800: #1f2937
--color-gray-900: #111827

/* Background */
--color-bg-primary: #ffffff
--color-bg-secondary: #f9fafb
--color-bg-tertiary: #f3f4f6

/* Border */
--color-border: #e5e7eb
--color-border-focus: #3b82f6
```

### Component Heights

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Header/Nav | 64px | 64px |
| Button (primary) | 48px | 56-64px |
| Button (secondary) | 40px | 48px |
| Input field | 40-48px | 56px |
| Dropdown | 48px | 56px |
| Card title | 40-48px | 48px |
| List item | 40-48px | 56-64px |
| Tab bar | 48px | 56px |
| Toolbar | 48px | 56px |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, tight spacing |
| sm | 8px | Small gaps between related items |
| md | 16px | Standard spacing between components |
| lg | 24px | Section spacing |
| xl | 32px | Large section gaps |
| 2xl | 48px | Major section dividers |

---

## Accessibility Standards

All wireframes are designed for **WCAG 2.1 Level AA** compliance:

### Keyboard Navigation

- Tab order follows visual flow
- All interactive elements keyboard-accessible
- Focus indicators clearly visible (2px outline)
- Escape key closes modals/menus
- Arrow keys for lists/grids/trees

### Screen Reader Support

- Semantic HTML roles (button, navigation, article, etc.)
- ARIA labels for all interactive elements
- ARIA live regions for dynamic content
- Landmark regions (header, main, aside, footer)
- Descriptive alt text for images

### Visual Accessibility

- Contrast ratio ≥4.5:1 for text
- Color not sole indicator (icons + text)
- Focus indicators meet 3:1 contrast
- Text resizable to 200% without overflow
- Minimum touch target: 44px × 44px

### Motion & Animation

- Reduced motion support (prefers-reduced-motion)
- No auto-play without user consent
- Animations ≤300ms for UI feedback
- Timeouts ≥20s for user actions

---

## Animation Standards

### Timing Functions

```css
/* Standard easing */
--ease-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-in: cubic-bezier(0.4, 0, 1, 1)
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)

/* Spring (for interactive elements) */
--spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

### Duration Guidelines

| Animation Type | Duration |
|----------------|----------|
| Micro-interaction | 100-200ms |
| UI feedback | 200-300ms |
| Modal open/close | 250-350ms |
| Page transition | 300-500ms |
| Complex animation | 500-800ms |

---

## Component Library Mapping

These wireframes assume **Radix UI** primitives + **TailwindCSS**:

| Wireframe Component | Radix UI Primitive |
|---------------------|-------------------|
| Dialog/Modal | Dialog |
| Dropdown Menu | DropdownMenu |
| Select | Select |
| Checkbox | Checkbox |
| Radio Group | RadioGroup |
| Tabs | Tabs |
| Accordion | Accordion |
| Slider | Slider |
| Toggle | Toggle |
| Tooltip | Tooltip |
| Popover | Popover |
| Context Menu | ContextMenu |
| Alert Dialog | AlertDialog |
| Progress | Progress |

---

## Implementation Guidelines

### Development Workflow

1. **Read Wireframe Spec**: Review full wireframe before coding
2. **Component Breakdown**: Identify reusable components
3. **Mobile-First**: Start with mobile layout, enhance for desktop
4. **Accessibility First**: Implement keyboard nav and ARIA from start
5. **Test Incrementally**: Test each component in isolation
6. **Integration**: Combine components into feature
7. **Review**: Cross-check against wireframe spec

### Testing Checklist

- [ ] Visual match to wireframe (dimensions, spacing)
- [ ] Responsive at all breakpoints
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets ≥44px (mobile)
- [ ] Animations respect prefers-reduced-motion
- [ ] Empty states render correctly
- [ ] Error states handle gracefully

---

## Tools & Resources

### Design Tools

- **Figma**: High-fidelity mockups (if needed)
- **Storybook**: Component development and documentation
- **Chromatic**: Visual regression testing

### Accessibility Tools

- **axe DevTools**: Automated accessibility testing
- **NVDA/VoiceOver**: Screen reader testing
- **Keyboard**: Manual keyboard navigation testing
- **Lighthouse**: Accessibility audit

### Performance Tools

- **React DevTools Profiler**: Component performance
- **Chrome DevTools**: Network, rendering performance
- **Lighthouse**: Performance audit

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-04 | Initial wireframe specifications for all 6 features |

---

## Related Documentation

- [Parent UX Design Document](../fortemi-integration-ux-design.md)
- [API Specification](/mnt/dev-inbox/fortemi/fortemi/docs/content/api.md)
- [System Architecture](../../architecture/system-architecture.md)
- [Implementation Guide](../../implementation/implementation-guide.md)

---

**Questions or Feedback?**

For wireframe clarifications or design decisions, please refer to the [UX Design Document](../fortemi-integration-ux-design.md) or contact the Product Design team.
