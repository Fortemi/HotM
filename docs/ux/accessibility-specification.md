# HotM Fortemi Integration: Accessibility Compliance Specification

**Version**: 1.0
**Date**: 2026-02-04
**Status**: Final Review
**Target Standard**: WCAG 2.1 Level AA

---

## Executive Summary

This document specifies accessibility requirements for all six Fortemi features integrated into HotM. Compliance with WCAG 2.1 Level AA ensures the application is usable by people with disabilities, including those using assistive technologies like screen readers, keyboard-only navigation, and alternative input devices.

### Compliance Goals
- **WCAG 2.1 Level AA**: Full compliance across all features
- **Screen Reader Support**: NVDA, JAWS, VoiceOver, TalkBack compatibility
- **Keyboard Navigation**: 100% keyboard-accessible without mouse
- **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Motion**: Respects prefers-reduced-motion setting
- **Testing**: Automated (axe-core) + manual validation

---

## 1. WCAG 2.1 AA Compliance Matrix

### 1.1 Perceivable Requirements

#### Text Alternatives (1.1)
**Guideline 1.1.1**: All non-text content has text alternatives.

| Feature | Component | Requirement | Implementation |
|---------|-----------|-------------|----------------|
| SKOS Browser | Tree icons | Folder/concept icons have aria-label | `<FolderIcon aria-label="Concept category" />` |
| Attachments | Thumbnails | All images have descriptive alt text | `alt="Golden Gate Bridge photo, captured Jan 24, 2026 at 10:30 AM"` |
| Memory Search | Map markers | Markers have aria-label with location | `aria-label="Memory location: 37.8199°N, 122.4783°W"` |
| Knowledge Health | Charts/graphs | SVG charts have title/desc elements | `<title>Health Score Trend</title><desc>Line chart showing...</desc>` |
| Version History | Diff indicators | Addition/removal icons have labels | `<PlusIcon aria-label="Line added" />` |
| Templates | Category icons | Icons have text labels, not color-only | `<Icon aria-label="Meeting template" />` |

#### Time-Based Media (1.2)
Not applicable - no audio/video content in current features.

#### Adaptable (1.3)
**Guideline 1.3.1**: Information and relationships can be programmatically determined.

| Feature | Component | Requirement | Implementation |
|---------|-----------|-------------|----------------|
| SKOS Browser | Tree hierarchy | Use semantic tree roles | `<div role="tree"><div role="treeitem" aria-level="2">` |
| All Features | Form inputs | Labels properly associated | `<label htmlFor="location-input">Location</label><input id="location-input" />` |
| Version History | Timeline | Use ordered list for chronology | `<ol role="list"><li role="listitem">` |
| Knowledge Health | Metrics | Use definition lists for key-value pairs | `<dl><dt>Health Score</dt><dd>62</dd></dl>` |
| All Features | Headings | Logical heading hierarchy (h1→h2→h3) | Start with h2 (h1 is page title), no skipped levels |
| All Features | Data tables | Use proper table semantics | `<table><thead><th scope="col">` |

**Guideline 1.3.2**: Sequence of content is meaningful.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Tab order follows visual order | Default DOM order matches visual layout |
| Memory Search | Form order: Location → Time → Filters | Semantic ordering in markup |
| Templates | Form → Preview follows left-to-right | Grid layout preserves reading order |

**Guideline 1.3.3**: Sensory characteristics don't assume visual-only understanding.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| Version History | Don't rely on "red/green" for changes | Use text labels: "Added" / "Removed" + color |
| Knowledge Health | Don't rely on chart color only | Include text values alongside visual indicators |
| All Features | Don't use "click the icon on the right" | Use semantic labels: "Click the Delete button" |

**Guideline 1.3.4**: Content doesn't restrict to single display orientation.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Work in portrait and landscape | Responsive CSS, no orientation locks |

**Guideline 1.3.5**: Input purpose can be programmatically determined.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| Memory Search | Location input has autocomplete | `<input autocomplete="street-address" />` |
| All Features | Name inputs have autocomplete | `<input autocomplete="name" />` |

#### Distinguishable (1.4)
**Guideline 1.4.1**: Color is not the only means of conveying information.

| Feature | Component | Requirement | Implementation |
|---------|-----------|-------------|----------------|
| Version History | Diff changes | Color + icon + text | Red background + minus icon + "Removed" label |
| Knowledge Health | Status indicators | Color + icon + text | Green circle + checkmark + "Good" text |
| SKOS Browser | Concept types | Color + icon | Blue folder + icon + badge |

**Guideline 1.4.3**: Contrast ratio meets minimum 4.5:1.

| Color Combination | Contrast Ratio | Pass AA | Pass AAA | Usage |
|-------------------|----------------|---------|----------|-------|
| Text on white (#000 / #FFF) | 21:1 | ✓ | ✓ | Body text |
| Primary blue on white (#0066CC / #FFF) | 7.5:1 | ✓ | ✓ | Links, primary buttons |
| Gray text on white (#666 / #FFF) | 5.7:1 | ✓ | ✓ | Secondary text |
| White on primary blue (#FFF / #0066CC) | 7.5:1 | ✓ | ✓ | Button text |
| Success green on white (#107C10 / #FFF) | 4.6:1 | ✓ | ✗ | Success states |
| Error red on white (#C42B1C / #FFF) | 5.2:1 | ✓ | ✗ | Error states |
| Warning orange on white (#CA5010 / #FFF) | 4.7:1 | ✓ | ✗ | Warning states |

**Guideline 1.4.4**: Text can be resized to 200% without loss of content/functionality.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Support browser zoom to 200% | Relative units (rem, em), flexible layouts |
| All Features | No horizontal scrolling at 200% zoom | Max-width constraints, responsive breakpoints |

**Guideline 1.4.5**: Images of text are not used.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Use actual text, not images | Web fonts for logos/headings, SVG icons |
| Attachments | Exception: User-uploaded images | Not controlled by application |

**Guideline 1.4.10**: Content reflows without horizontal scrolling at 320px width.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Mobile-first responsive design | Breakpoint at 640px, vertical stacking |
| Version History | Side-by-side diff → unified diff | Switch layout at narrow widths |

**Guideline 1.4.11**: Non-text contrast is at least 3:1.

| Feature | Component | Contrast Ratio | Pass |
|---------|-----------|----------------|------|
| All Features | Focus indicators | 4.5:1 (blue on white) | ✓ |
| All Features | Button borders | 3.2:1 (gray on white) | ✓ |
| Maps | Markers | 4.1:1 (on map background) | ✓ |
| Charts | Lines/bars | 3.5:1 minimum | ✓ |

**Guideline 1.4.12**: Text spacing can be adjusted without loss of content.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Support custom text spacing | No fixed heights, overflow handling |

**Guideline 1.4.13**: Content on hover/focus is dismissible, hoverable, persistent.

| Feature | Component | Requirement | Implementation |
|---------|-----------|-------------|----------------|
| All Features | Tooltips | Dismissible with Escape key | `onKeyDown={(e) => e.key === 'Escape' && close()}` |
| All Features | Tooltips | Hoverable (pointer can move to tooltip) | Delay before hide, tooltip has padding |
| All Features | Tooltips | Persistent until dismissed | Don't auto-hide on timer |

### 1.2 Operable Requirements

#### Keyboard Accessible (2.1)
**Guideline 2.1.1**: All functionality available from keyboard.

| Feature | Component | Keyboard Support | Implementation |
|---------|-----------|------------------|----------------|
| SKOS Browser | Tree navigation | ←↑→↓ arrows | Arrow key handlers on treeitem role |
| SKOS Browser | Expand/collapse | →/← or Enter | `onKeyDown` event handlers |
| Memory Search | Location picker | Tab to map, arrow keys to pan | Accessible map controls |
| Memory Search | Radius slider | ←/→ arrows to adjust | `role="slider"` with arrow support |
| Attachments | Upload dropzone | Enter/Space to activate | `<button>` for clickable area |
| Version History | Version selection | ↑/↓ arrows in list | `role="listbox"` with arrow nav |
| Templates | Variable form | Tab between fields | Natural tab order |
| Knowledge Health | Chart navigation | Tab to elements, arrow keys | Focusable chart elements |

**Guideline 2.1.2**: No keyboard trap.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Modals | Can exit with Escape or Tab | Focus trap with Escape handler |
| All Modals | Tab cycles within modal | Focus management library (focus-trap-react) |
| All Features | No infinite loops | Test all tab sequences |

**Guideline 2.1.4**: Single character shortcuts can be turned off or remapped.

| Feature | Shortcut | Requirement | Implementation |
|---------|----------|-------------|----------------|
| Version History | `D` key (toggle diff) | Only active when component focused | Check `document.activeElement` |
| All Features | Single-key shortcuts | Require modifier key (Ctrl/Cmd) | `Ctrl+K`, `Ctrl+F`, etc. |

#### Enough Time (2.2)
**Guideline 2.2.1**: Time limits can be adjusted.

Not applicable - no session timeouts in current features.

**Guideline 2.2.2**: Content can be paused, stopped, or hidden.

| Feature | Component | Requirement | Implementation |
|---------|-----------|-------------|----------------|
| Knowledge Health | Activity heatmap animation | Auto-play duration < 5s | Animation completes quickly |
| All Features | Loading spinners | Not flashing/distracting | Smooth rotation, low saturation |

#### Seizures and Physical Reactions (2.3)
**Guideline 2.3.1**: No content flashes more than 3 times per second.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | No flashing animations | CSS animations use smooth transitions |
| All Features | Loading indicators | Steady rotation, no strobing |

#### Navigable (2.4)
**Guideline 2.4.1**: Bypass blocks of repeated content.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Pages | Skip link to main content | `<a href="#main" class="skip-link">Skip to main content</a>` |
| All Features | Landmarks for screen readers | `<nav>`, `<main>`, `<aside>`, `<footer>` |

**Guideline 2.4.2**: Pages have descriptive titles.

| Feature | Page Title | Implementation |
|---------|-----------|----------------|
| SKOS Browser | "SKOS Concepts - HotM" | Dynamic `document.title` |
| Memory Search | "Memory Search - HotM" | React Helmet for title management |
| Knowledge Health | "Knowledge Health - HotM" | Title reflects current view |

**Guideline 2.4.3**: Focus order is meaningful.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Tab order follows visual order | DOM order matches layout |
| Memory Search | Location → Time → Filters → Results | Semantic form ordering |
| Templates | Name → Description → Content → Actions | Logical flow |

**Guideline 2.4.4**: Link purpose is clear from context.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | No "click here" links | Descriptive text: "View attachment metadata" |
| Version History | Version links | "View version 3 created 2 hours ago" |

**Guideline 2.4.5**: Multiple ways to find pages.

| Feature | Access Methods | Implementation |
|---------|----------------|----------------|
| All Features | Sidebar nav + search + breadcrumbs | Multiple navigation patterns |
| All Features | Command palette (Ctrl+K) | Quick access to all features |

**Guideline 2.4.6**: Headings and labels are descriptive.

| Feature | Component | Good Label | Bad Label |
|---------|-----------|------------|-----------|
| Memory Search | Location input | "Search location or address" | "Location" |
| Templates | Variable input | "Enter team name" | "Team" |
| Version History | Restore button | "Restore version 2" | "Restore" |

**Guideline 2.4.7**: Focus indicator is visible.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | 2px blue outline on focus | CSS: `outline: 2px solid #0066CC; outline-offset: 2px;` |
| All Features | Custom focus for complex components | High-contrast border, no outline removal |

#### Input Modalities (2.5)
**Guideline 2.5.1**: Pointer gestures have alternatives.

| Feature | Gesture | Alternative | Implementation |
|---------|---------|-------------|----------------|
| Memory Search | Pinch-to-zoom map | Zoom buttons | `<button>Zoom In</button>` on map |
| Version History | Swipe timeline | Arrow buttons | `<button>Previous</button>` |
| Attachments | Drag-and-drop | Click to upload | `<button>Browse files</button>` |

**Guideline 2.5.2**: Pointer cancellation available.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Actions on mouse-up, not mouse-down | `onClick` (fires on up), not `onMouseDown` |
| All Features | Can cancel by moving pointer away | Standard button behavior |

**Guideline 2.5.3**: Labels match accessible names.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Visible label = aria-label | `<button aria-label="Delete attachment">Delete</button>` |
| All Features | Icon buttons have text or aria-label | Always provide text alternative |

**Guideline 2.5.4**: Motion actuation has alternatives.

Not applicable - no shake/tilt gestures used.

### 1.3 Understandable Requirements

#### Readable (3.1)
**Guideline 3.1.1**: Language of page can be programmatically determined.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Pages | HTML lang attribute | `<html lang="en">` |

**Guideline 3.1.2**: Language of parts can be programmatically determined.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | User content with different language | Detect and apply `lang` attribute if needed |

#### Predictable (3.2)
**Guideline 3.2.1**: On focus doesn't cause context change.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Focus doesn't trigger navigation | No auto-submit on focus |
| All Features | Focus doesn't open modals | Actions require explicit activation |

**Guideline 3.2.2**: On input doesn't cause context change.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| Memory Search | Search doesn't trigger on typing | Debounced search, explicit button |
| SKOS Browser | Tree expansion doesn't navigate | Only expands, doesn't select |

**Guideline 3.2.3**: Navigation is consistent.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Sidebar position consistent | Always on left (desktop) |
| All Features | Action buttons in consistent locations | Primary actions right/bottom |

**Guideline 3.2.4**: Components are identified consistently.

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Delete icon always trash can | Consistent Lucide icons |
| All Features | Close icon always X | `<XIcon />` everywhere |

#### Input Assistance (3.3)
**Guideline 3.3.1**: Errors are identified clearly.

| Feature | Component | Error State | Implementation |
|---------|-----------|-------------|----------------|
| All Forms | Required fields | Red border + error message | `aria-invalid="true"` + `aria-describedby="error-id"` |
| Memory Search | Invalid location | "Location not found. Try another address." | Error text below input |
| Templates | Blank template name | "Template name is required." | Inline validation |

**Guideline 3.3.2**: Labels or instructions are provided.

| Feature | Component | Requirement | Implementation |
|---------|-----------|-------------|----------------|
| All Forms | Every input has label | Visible label or aria-label | `<label>` element required |
| Templates | Variable form fields | Help text for complex fields | `aria-describedby="help-text-id"` |
| Memory Search | Radius slider | Current value displayed | `aria-valuenow`, `aria-valuetext` |

**Guideline 3.3.3**: Error suggestions are provided.

| Feature | Error | Suggestion | Implementation |
|---------|-------|------------|----------------|
| Memory Search | Location not found | "Did you mean: San Francisco, CA?" | Fuzzy match suggestions |
| Templates | Duplicate name | "Try: Weekly Standup v2" | Auto-generated alternatives |
| Attachments | File too large | "Maximum size: 100MB. Compress or split file." | Actionable guidance |

**Guideline 3.3.4**: Error prevention for legal/financial/data modifications.

| Feature | Action | Requirement | Implementation |
|---------|--------|-------------|----------------|
| Version History | Restore version | Confirmation dialog | "Restore version 2? Current version will be preserved." |
| Templates | Delete template | Confirmation dialog | "Delete template? This cannot be undone." |
| Attachments | Delete attachment | Confirmation dialog | "Delete photo? This cannot be undone." |

### 1.4 Robust Requirements

#### Compatible (4.1)
**Guideline 4.1.1**: Markup is valid (deprecated in WCAG 2.2, but good practice).

| Feature | Requirement | Implementation |
|---------|-------------|----------------|
| All Features | Valid HTML5 | React generates valid markup |
| All Features | No duplicate IDs | Unique ID generation (useId hook) |

**Guideline 4.1.2**: Name, role, value can be programmatically determined.

| Feature | Component | Role | Name | Value | Implementation |
|---------|-----------|------|------|-------|----------------|
| SKOS Browser | Tree | `role="tree"` | aria-label | N/A | `<div role="tree" aria-label="Concept hierarchy">` |
| SKOS Browser | Tree item | `role="treeitem"` | Text content | aria-expanded | `<div role="treeitem" aria-expanded="false">` |
| Memory Search | Slider | `role="slider"` | aria-label | aria-valuenow | `<div role="slider" aria-valuenow="1500">` |
| All Features | Custom buttons | `role="button"` | aria-label | N/A | `<div role="button" aria-label="Close">` |
| All Features | Toggle buttons | `role="switch"` | aria-label | aria-checked | `<button role="switch" aria-checked="true">` |

**Guideline 4.1.3**: Status messages can be programmatically determined.

| Feature | Component | Requirement | Implementation |
|---------|-----------|-------------|----------------|
| All Features | Success toasts | aria-live="polite" | `<div role="status" aria-live="polite">File uploaded</div>` |
| All Features | Error messages | aria-live="assertive" | `<div role="alert" aria-live="assertive">Upload failed</div>` |
| Memory Search | Results count | aria-live="polite" | `<div aria-live="polite">42 memories found</div>` |
| Knowledge Health | Metric updates | aria-live="polite" | Live region announces changes |

---

## 2. Keyboard Navigation Specification

### 2.1 Global Keyboard Shortcuts

| Shortcut | Action | Implementation |
|----------|--------|----------------|
| `Ctrl+K` (Cmd+K on Mac) | Open command palette | Global event listener |
| `Ctrl+/` | Toggle sidebar | Focus management |
| `Escape` | Close modal/dialog | Modal component handler |
| `Tab` | Navigate forward | Natural browser behavior |
| `Shift+Tab` | Navigate backward | Natural browser behavior |
| `Ctrl+F` | Focus search (context-dependent) | Component-level handler |

### 2.2 SKOS Concept Browser

#### Tab Order
1. Scheme selector dropdown
2. Search input
3. Tree view (first item)
4. Concept detail pane (first focusable element)
5. Action toolbar buttons

#### Navigation Within Tree
| Key | Action | Implementation |
|-----|--------|----------------|
| `↓` | Move to next visible node | Focus management in tree component |
| `↑` | Move to previous visible node | Focus management in tree component |
| `→` | Expand collapsed node / move to first child | Check `aria-expanded`, update and focus |
| `←` | Collapse expanded node / move to parent | Check `aria-expanded`, update and focus |
| `Enter` | Select node, show details | Fire selection event |
| `Space` | Toggle selection (multi-select) | Toggle `aria-selected` |
| `Home` | Move to first node | Focus first treeitem |
| `End` | Move to last visible node | Focus last visible treeitem |
| `*` (asterisk) | Expand all siblings | Expand all at current level |

#### Focus Management
```typescript
// Example tree keyboard handler
function handleTreeKeyDown(event: React.KeyboardEvent) {
  const currentItem = event.target as HTMLElement;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusNextTreeItem(currentItem);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusPreviousTreeItem(currentItem);
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (currentItem.getAttribute('aria-expanded') === 'false') {
        expandNode(currentItem);
      } else {
        focusFirstChild(currentItem);
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (currentItem.getAttribute('aria-expanded') === 'true') {
        collapseNode(currentItem);
      } else {
        focusParent(currentItem);
      }
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      selectNode(currentItem);
      break;
  }
}
```

### 2.3 File Attachments Panel

#### Tab Order
1. "Attach File" button / Upload dropzone
2. View mode toggle (Grid/List)
3. First attachment thumbnail
4. Subsequent attachments
5. Actions menu for focused attachment

#### Attachment Grid Navigation
| Key | Action | Implementation |
|-----|--------|----------------|
| `Tab` | Move to next attachment | Natural tab order |
| `Shift+Tab` | Move to previous attachment | Natural tab order |
| `Enter` | Open attachment preview modal | Fire click handler |
| `Space` | Select attachment (multi-select) | Toggle selection state |
| `Delete` | Delete selected attachment(s) | Confirm dialog first |

#### Preview Modal
| Key | Action | Implementation |
|-----|--------|----------------|
| `→` | Next attachment | Navigate carousel |
| `←` | Previous attachment | Navigate carousel |
| `Escape` | Close modal | Return focus to trigger |
| `Tab` | Cycle through metadata tabs | Tab between File/EXIF/Location |

#### Focus Trap Implementation
```typescript
// Modal focus trap
function AttachmentPreviewModal({ onClose }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first element in modal
    const firstFocusable = modalRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    firstFocusable?.focus();

    return () => {
      // Restore focus on unmount
      previousFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      {/* Modal content */}
    </div>
  );
}
```

### 2.4 Memory Search

#### Tab Order
1. Location search input
2. "Use Current Location" button
3. Map container (interactive)
4. Radius slider
5. Time range preset buttons
6. Date range picker
7. Additional filters
8. "Search" button
9. Results list (first item)

#### Map Keyboard Controls
| Key | Action | Implementation |
|-----|--------|----------------|
| `+` / `=` | Zoom in | Map control API |
| `-` | Zoom out | Map control API |
| `↑↓←→` | Pan map | Map control API |
| `Tab` | Focus next map control | Custom focus management |
| `Enter` | Activate focused map element | Click handler |

#### Radius Slider
| Key | Action | Implementation |
|-----|--------|----------------|
| `←` | Decrease radius by 100m | `aria-valuenow` update |
| `→` | Increase radius by 100m | `aria-valuenow` update |
| `Home` | Set to minimum (100m) | Jump to min value |
| `End` | Set to maximum (50km) | Jump to max value |
| `Page Up` | Increase by 1km | Large increment |
| `Page Down` | Decrease by 1km | Large decrement |

```typescript
// Accessible slider implementation
function RadiusSlider({ value, onChange, min = 100, max = 50000 }) {
  const formatRadius = (meters: number) => {
    return meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  };

  return (
    <div
      role="slider"
      aria-label="Search radius"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={formatRadius(value)}
      tabIndex={0}
      onKeyDown={(e) => {
        let newValue = value;
        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowDown':
            newValue = Math.max(min, value - 100);
            break;
          case 'ArrowRight':
          case 'ArrowUp':
            newValue = Math.min(max, value + 100);
            break;
          case 'Home':
            newValue = min;
            break;
          case 'End':
            newValue = max;
            break;
          case 'PageDown':
            newValue = Math.max(min, value - 1000);
            break;
          case 'PageUp':
            newValue = Math.min(max, value + 1000);
            break;
          default:
            return;
        }
        e.preventDefault();
        onChange(newValue);
      }}
    />
  );
}
```

### 2.5 Knowledge Health Dashboard

#### Tab Order
1. Time range selector (7d/30d/90d/1y)
2. Health score card
3. Total notes card
4. Active concepts card
5. Link density card
6. First priority action button
7. Subsequent metric cards
8. Trend chart (if interactive)

#### Chart Navigation
| Key | Action | Implementation |
|-----|--------|----------------|
| `Tab` | Focus chart, then data points | SVG elements with tabindex="0" |
| `←→` | Navigate between data points | Update focus and announcement |
| `Enter` | Show details for focused point | Tooltip or detail view |

### 2.6 Version History

#### Tab Order (Timeline View)
1. Track selector dropdown
2. First version card
3. Subsequent version cards
4. Content viewer area
5. Action buttons (Restore/Download)

#### Version List Navigation
| Key | Action | Implementation |
|-----|--------|----------------|
| `↑` | Previous version | Focus management in list |
| `↓` | Next version | Focus management in list |
| `Enter` | View selected version | Load content in viewer |
| `Shift+Enter` | Compare with current | Switch to diff mode |
| `D` | Toggle diff mode | Mode switcher |
| `R` | Restore selected version | Confirmation dialog |

#### Diff Viewer Navigation
| Key | Action | Implementation |
|-----|--------|----------------|
| `N` or `→` | Next change | Scroll to next diff block |
| `P` or `←` | Previous change | Scroll to previous diff block |
| `Escape` | Exit diff mode | Return to view mode |

### 2.7 Template Management

#### Tab Order (Browser)
1. Search input
2. Category filter dropdown
3. Sort selector
4. "Create Template" button
5. First template card
6. Subsequent template cards

#### Template Card Actions
| Key | Action | Implementation |
|-----|--------|----------------|
| `Enter` | Use template | Open instantiation modal |
| `Space` | Preview template | Open preview modal |
| `E` | Edit template | Open editor (when card focused) |

#### Template Editor
| Key | Action | Implementation |
|-----|--------|----------------|
| `Ctrl+S` | Save template | Form submission |
| `Ctrl+P` | Toggle preview pane | Show/hide preview |
| `Escape` | Cancel editing | Close modal with confirmation |
| `Ctrl+B` | Bold text | Markdown formatting |
| `Ctrl+I` | Italic text | Markdown formatting |

#### Instantiation Modal
| Key | Action | Implementation |
|-----|--------|----------------|
| `Tab` | Next variable field | Natural form tab order |
| `Ctrl+Enter` | Create note | Form submission |
| `Escape` | Cancel | Close modal |

---

## 3. Screen Reader Support

### 3.1 ARIA Attributes by Component

#### SKOS Concept Browser

```typescript
// Tree structure
<div
  role="tree"
  aria-label="SKOS concept hierarchy"
  aria-multiselectable="false"
>
  <div
    role="treeitem"
    aria-label="Software Development"
    aria-expanded="true"
    aria-level="1"
    aria-posinset="1"
    aria-setsize="5"
    tabIndex={0}
  >
    <span>Software Development</span>
    <div role="group">
      <div
        role="treeitem"
        aria-label="Backend"
        aria-expanded="false"
        aria-level="2"
        aria-posinset="1"
        aria-setsize="3"
        tabIndex={-1}
      >
        <span>Backend</span>
      </div>
    </div>
  </div>
</div>

// Concept detail panel
<aside aria-labelledby="concept-detail-heading">
  <h2 id="concept-detail-heading">Concept Details</h2>
  <dl>
    <dt>Preferred Label</dt>
    <dd>Machine Learning</dd>
    <dt>Definition</dt>
    <dd>A field of AI focused on algorithms that improve through experience.</dd>
    <dt>Used in</dt>
    <dd>
      <a href="#" aria-label="42 notes use this concept">42 notes</a>
    </dd>
  </dl>
</aside>
```

#### File Attachments Panel

```typescript
// Upload dropzone
<div
  role="button"
  aria-label="Upload files"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      openFilePicker();
    }
  }}
>
  <p>Drag files here or click to upload</p>
</div>

// Attachment grid
<div
  role="list"
  aria-label="Attachments"
>
  <div
    role="listitem"
    aria-label="Golden Gate Bridge photo, captured January 24, 2026 at 10:30 AM, 2.4 megabytes, has GPS location"
  >
    <img
      src={thumbnail}
      alt="Golden Gate Bridge photo"
    />
    <div>
      <p>IMG_1234.jpg</p>
      <p>2.4 MB</p>
      <p aria-label="Location: 37.8199 degrees north, 122.4783 degrees west">
        📍 37.8199°N, 122.4783°W
      </p>
    </div>
  </div>
</div>

// Preview modal
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="preview-title"
  aria-describedby="preview-description"
>
  <h2 id="preview-title">IMG_1234.jpg</h2>
  <div id="preview-description" className="sr-only">
    Image preview with metadata tabs for file information, EXIF data, and location
  </div>

  <div role="tablist" aria-label="Metadata">
    <button
      role="tab"
      aria-selected="true"
      aria-controls="file-panel"
      id="file-tab"
    >
      File Info
    </button>
    <button
      role="tab"
      aria-selected="false"
      aria-controls="exif-panel"
      id="exif-tab"
    >
      EXIF Data
    </button>
  </div>

  <div
    role="tabpanel"
    id="file-panel"
    aria-labelledby="file-tab"
    tabIndex={0}
  >
    {/* File info content */}
  </div>
</div>
```

#### Memory Search

```typescript
// Location picker
<div>
  <label htmlFor="location-input">
    Search location or address
  </label>
  <input
    id="location-input"
    type="text"
    aria-describedby="location-help"
    aria-autocomplete="list"
    aria-controls="location-results"
    aria-activedescendant={activeResultId}
  />
  <div id="location-help" className="sr-only">
    Enter a location, address, or place name. Use Current Location button to use your device location.
  </div>

  <ul
    id="location-results"
    role="listbox"
    aria-label="Location suggestions"
  >
    <li role="option" id="result-1">San Francisco, CA</li>
    <li role="option" id="result-2">San Francisco, CA, USA</li>
  </ul>
</div>

// Results announcement
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {`${resultCount} memories found within ${formatRadius(radius)} of ${location}`}
</div>

// Map
<div
  role="application"
  aria-label="Interactive map showing memory locations"
  tabIndex={0}
>
  {/* Map implementation with keyboard controls */}
  <div className="sr-only" aria-live="polite">
    {`Map centered at ${centerLat}, ${centerLon}. Zoom level ${zoomLevel}. ${markerCount} markers visible.`}
  </div>
</div>
```

#### Knowledge Health Dashboard

```typescript
// Health score gauge
<div role="img" aria-label="Health score: 62 out of 100. Status: Fair. Decreased by 3% compared to last month.">
  <svg aria-hidden="true">
    {/* Visual gauge */}
  </svg>
  <div className="sr-only">
    Health score: 62 out of 100. Status: Fair. Decreased by 3% compared to last month.
  </div>
</div>

// Metric card
<article aria-labelledby="orphan-notes-heading">
  <h3 id="orphan-notes-heading">Orphan Notes</h3>
  <div>
    <p>
      <span aria-label="42 orphan notes, representing 8% of total notes">
        42 <span className="text-sm">(8%)</span>
      </span>
    </p>
  </div>
  <div role="img" aria-label="Trend chart showing orphan notes over last 30 days, decreasing from 50 to 42">
    <canvas aria-hidden="true" />
    {/* Provide data table alternative */}
    <details>
      <summary>View data table</summary>
      <table>
        <caption>Orphan notes over last 30 days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Jan 1</td>
            <td>50</td>
          </tr>
          {/* More rows */}
        </tbody>
      </table>
    </details>
  </div>
  <button aria-label="View orphan notes and take action to link them">
    View Orphans
  </button>
</article>

// Activity heatmap
<div role="img" aria-label="Activity heatmap showing note creation over past year">
  <svg aria-hidden="true">
    {/* Visual heatmap */}
  </svg>
  <div className="sr-only">
    Activity heatmap: Most active day was January 15 with 12 notes.
    Average activity: 3 notes per day.
    42 days with no activity.
  </div>
</div>
```

#### Version History

```typescript
// Version list
<div
  role="list"
  aria-label="Version history"
>
  <div
    role="listitem"
    aria-label="Version 3, current version, created 2 hours ago by you. Changes: 12 lines added, 3 lines removed."
  >
    <div aria-hidden="true">
      <span>v3</span>
      <span>(Current)</span>
      <span>2 hours ago</span>
      <span>You</span>
      <span>+12 -3 lines</span>
    </div>
  </div>
</div>

// Diff viewer
<div
  role="region"
  aria-label="Differences between version 2 and version 3"
  aria-describedby="diff-summary"
>
  <div id="diff-summary" className="sr-only">
    Comparing version 2 to version 3.
    2 lines added, 1 line removed.
    Use Next and Previous buttons to navigate changes.
  </div>

  <div role="group" aria-label="Change 1 of 3">
    <div
      aria-label="Line removed from version 2"
      className="diff-line-removed"
    >
      <span aria-hidden="true">-</span>
      <span>Old line content</span>
    </div>
    <div
      aria-label="Line added in version 3"
      className="diff-line-added"
    >
      <span aria-hidden="true">+</span>
      <span>New line content</span>
    </div>
  </div>
</div>
```

#### Template Management

```typescript
// Template card
<article aria-labelledby="template-title-1">
  <h3 id="template-title-1">Weekly Standup</h3>
  <p>Team standup meeting notes</p>
  <div aria-label="Template metadata">
    <span aria-label="5 variables">{{5}} vars</span>
    <span aria-label="Used 12 times">🔥 12 uses</span>
    <span aria-label="Last used 2 hours ago">Last: 2h ago</span>
  </div>
  <button aria-label="Use Weekly Standup template to create new note">
    Use Template
  </button>
</article>

// Variable form (instantiation)
<form aria-labelledby="instantiate-title">
  <h2 id="instantiate-title">Use Template: Weekly Standup</h2>

  <div>
    <label htmlFor="var-date">Date</label>
    <input
      id="var-date"
      type="date"
      aria-required="true"
      aria-describedby="var-date-help"
    />
    <div id="var-date-help" className="text-sm">
      Meeting date
    </div>
  </div>

  <div>
    <label htmlFor="var-team">Team Name</label>
    <input
      id="var-team"
      type="text"
      aria-required="true"
    />
  </div>

  <div
    role="region"
    aria-live="polite"
    aria-label="Live preview"
  >
    <h3>Preview</h3>
    <div aria-label="Preview updates as you type">
      {/* Rendered preview */}
    </div>
  </div>
</form>
```

### 3.2 Live Region Announcements

#### Success Messages
```typescript
<div role="status" aria-live="polite" aria-atomic="true">
  Photo uploaded successfully. GPS location detected.
</div>

<div role="status" aria-live="polite">
  Version restored successfully. Now viewing version 4.
</div>

<div role="status" aria-live="polite">
  Template created: Weekly Standup.
</div>
```

#### Error Messages
```typescript
<div role="alert" aria-live="assertive" aria-atomic="true">
  Upload failed. File size exceeds 100MB limit.
</div>

<div role="alert" aria-live="assertive">
  Cannot delete current version.
</div>

<div role="alert" aria-live="assertive">
  Location not found. Please enter a valid address.
</div>
```

#### Progress Announcements
```typescript
<div role="status" aria-live="polite" aria-atomic="false">
  Uploading file: 45% complete.
</div>

<div role="status" aria-live="polite">
  Searching... 42 memories found within 1.5 kilometers.
</div>

<div role="status" aria-live="polite">
  Processing version comparison. Please wait.
</div>
```

### 3.3 Landmark Structure

```html
<!-- Global page structure -->
<body>
  <!-- Skip link (visible on focus) -->
  <a href="#main-content" class="skip-link">
    Skip to main content
  </a>

  <!-- Top banner -->
  <header role="banner">
    <div>HotM - Hall of Mind</div>
    <nav aria-label="User menu">
      <button aria-label="User profile">👤</button>
      <button aria-label="Settings">⚙️</button>
    </nav>
  </header>

  <!-- Main navigation -->
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/notes">Notes</a></li>
      <li><a href="/search">Search</a></li>
      <li><a href="/memory-search">Memory Search</a></li>
      <li><a href="/skos">SKOS Concepts</a></li>
      <li><a href="/templates">Templates</a></li>
      <li><a href="/health">Knowledge Health</a></li>
    </ul>
  </nav>

  <!-- Main content area -->
  <main id="main-content" role="main">
    <!-- Feature-specific content -->
  </main>

  <!-- Complementary sidebar (if present) -->
  <aside aria-label="Details panel">
    <!-- Context-specific information -->
  </aside>

  <!-- Footer -->
  <footer role="contentinfo">
    <p>&copy; 2026 HotM</p>
  </footer>
</body>
```

### 3.4 Alternative Text Requirements

#### Images
| Context | Alt Text Pattern | Example |
|---------|------------------|---------|
| User-uploaded photo | Filename + metadata if available | "Golden Gate Bridge photo, captured Jan 24, 2026 at 10:30 AM" |
| Thumbnail in grid | Filename + brief description | "Sunset at pier, IMG_5678.jpg" |
| Empty state illustration | Purpose of illustration | "No attachments yet. Upload files to get started." |
| User avatar | Username | "Profile picture for John Doe" |
| Logo | Organization name | "HotM logo" |

#### Icons
| Icon | Context | Alt Text / Aria-Label |
|------|---------|----------------------|
| Folder | SKOS tree node | "Concept category" (via aria-label) |
| Plus | Add button | "Add new concept" |
| Pencil | Edit button | "Edit template" |
| Trash | Delete button | "Delete attachment" |
| Download | Download button | "Download version" |
| Eye | Preview button | "Preview template" |
| Map Pin | Location indicator | "Location available" |
| Calendar | Date indicator | "Capture date" |
| Camera | Device indicator | "Captured with iPhone 14 Pro" |

#### Decorative Images
```html
<!-- Use empty alt for decorative images -->
<img src="decorative-divider.svg" alt="" role="presentation" />

<!-- Or hide from assistive tech -->
<svg aria-hidden="true">
  <!-- Decorative graphic -->
</svg>
```

---

## 4. Color Contrast Verification

### 4.1 Primary Color Palette

#### Core Colors
| Color Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| White | #FFFFFF | 255, 255, 255 | Background |
| Black | #000000 | 0, 0, 0 | Primary text |
| Gray 100 | #F3F4F6 | 243, 244, 246 | Hover backgrounds |
| Gray 300 | #D1D5DB | 209, 213, 219 | Borders |
| Gray 500 | #6B7280 | 107, 114, 128 | Secondary text |
| Gray 700 | #374151 | 55, 65, 81 | Tertiary text |
| Gray 900 | #111827 | 17, 24, 39 | Headings |

#### Brand Colors
| Color Name | Hex | RGB | Usage |
|------------|-----|-----|-------|
| Primary Blue | #0066CC | 0, 102, 204 | Links, primary actions |
| Primary Blue Dark | #0052A3 | 0, 82, 163 | Hover state |
| Success Green | #107C10 | 16, 124, 16 | Success states |
| Warning Orange | #CA5010 | 202, 80, 16 | Warning states |
| Error Red | #C42B1C | 196, 43, 28 | Error states |
| Info Blue | #0078D4 | 0, 120, 212 | Info states |

### 4.2 Contrast Ratio Matrix

#### Text on White Background
| Foreground | Background | Ratio | Normal Text AA | Normal Text AAA | Large Text AA | Large Text AAA |
|------------|------------|-------|----------------|-----------------|---------------|----------------|
| Black (#000) | White (#FFF) | 21:1 | ✓ Pass | ✓ Pass | ✓ Pass | ✓ Pass |
| Gray 900 | White | 16.1:1 | ✓ Pass | ✓ Pass | ✓ Pass | ✓ Pass |
| Gray 700 | White | 8.6:1 | ✓ Pass | ✓ Pass | ✓ Pass | ✓ Pass |
| Gray 500 | White | 4.6:1 | ✓ Pass | ✗ Fail | ✓ Pass | ✓ Pass |
| Primary Blue | White | 7.5:1 | ✓ Pass | ✓ Pass | ✓ Pass | ✓ Pass |
| Success Green | White | 4.6:1 | ✓ Pass | ✗ Fail | ✓ Pass | ✓ Pass |
| Warning Orange | White | 4.7:1 | ✓ Pass | ✗ Fail | ✓ Pass | ✓ Pass |
| Error Red | White | 5.2:1 | ✓ Pass | ✓ Pass | ✓ Pass | ✓ Pass |

#### Text on Colored Backgrounds
| Foreground | Background | Ratio | Normal Text AA | Large Text AA |
|------------|------------|-------|----------------|---------------|
| White | Primary Blue | 7.5:1 | ✓ Pass | ✓ Pass |
| White | Success Green | 4.6:1 | ✓ Pass | ✓ Pass |
| White | Error Red | 5.2:1 | ✓ Pass | ✓ Pass |
| White | Gray 700 | 8.6:1 | ✓ Pass | ✓ Pass |
| Black | Gray 100 | 17.7:1 | ✓ Pass | ✓ Pass |

#### UI Components
| Component | Foreground | Background | Ratio | Pass AA |
|-----------|------------|------------|-------|---------|
| Focus indicator | Blue (#0066CC) | White | 7.5:1 | ✓ |
| Button border | Gray 300 | White | 3.2:1 | ✓ (UI component) |
| Disabled text | Gray 500 | White | 4.6:1 | ✓ |
| Placeholder text | Gray 500 | White | 4.6:1 | ✓ |
| Link hover | Blue Dark (#0052A3) | White | 9.2:1 | ✓ |

### 4.3 Color-Blind Safe Palette

#### Protanopia (Red-Blind) Considerations
| Original Color | Issue | Solution |
|----------------|-------|----------|
| Error Red | May appear similar to gray | Add icon: `<XCircleIcon />` |
| Success Green | May appear gray/yellow | Add icon: `<CheckCircleIcon />` |
| Version diff red/green | Hard to distinguish | Use `-` / `+` symbols + text labels |

#### Deuteranopia (Green-Blind) Considerations
| Original Color | Issue | Solution |
|----------------|-------|----------|
| Success Green | May appear similar to red | Add icon: `<CheckCircleIcon />` |
| Health score green | May appear yellow | Use text label: "Good" / "Fair" / "Poor" |
| Map markers | Hard to distinguish | Use different shapes + labels |

#### Tritanopia (Blue-Blind) Considerations
| Original Color | Issue | Solution |
|----------------|-------|----------|
| Primary Blue | May appear similar to green | Contrast with surrounding elements |
| Link text | May be hard to spot | Underline links in body text |

#### Implementation: Never Rely on Color Alone
```typescript
// BAD: Color only
<div style={{ color: 'red' }}>Error occurred</div>

// GOOD: Color + icon + text
<div style={{ color: 'red' }}>
  <XCircleIcon aria-hidden="true" />
  <span>Error:</span> Upload failed
</div>

// GOOD: Version diff with color + symbol + text
<div className="diff-line-removed">
  <span className="diff-symbol" aria-hidden="true">-</span>
  <span className="sr-only">Removed: </span>
  <span>Old line content</span>
</div>
```

### 4.4 Contrast Testing Tools

#### Automated Testing
```bash
# Install axe-core for automated contrast checks
npm install --save-dev @axe-core/react

# In test file
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('should not have contrast violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

#### Manual Testing
- **Browser DevTools**: Chrome/Edge Accessibility panel shows contrast ratios
- **Online Tools**:
  - WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
  - Coolors Contrast Checker: https://coolors.co/contrast-checker
- **Design Tools**: Figma/Sketch plugins for real-time contrast checking

---

## 5. Motion and Animation

### 5.1 Reduced Motion Support

#### CSS Implementation
```css
/* Default: Smooth transitions */
.fade-enter {
  opacity: 0;
  transition: opacity 300ms ease-in-out;
}

.fade-enter-active {
  opacity: 1;
}

/* Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  .fade-enter {
    transition: none;
    opacity: 1;
  }

  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### JavaScript Detection
```typescript
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}

// Usage
function MyComponent() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.3
      }}
    >
      Content
    </motion.div>
  );
}
```

### 5.2 Animation Guidelines

#### Safe Animation Durations
| Animation Type | Duration | Reduced Motion |
|----------------|----------|----------------|
| Micro-interactions | 100-200ms | Instant (0ms) |
| Modal open/close | 200-300ms | Instant |
| Page transitions | 300-500ms | Instant |
| Loading spinners | Continuous | Reduced rotation speed |
| Skeleton screens | Pulsing | Static |

#### No Flashing Content
- **Maximum flash rate**: 3 times per second (absolute limit)
- **Recommended**: Avoid any flashing animations
- **Loading indicators**: Smooth rotation, no strobing

#### Parallax Scrolling
```typescript
// Only enable parallax if user hasn't requested reduced motion
function ParallaxSection() {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <StaticSection />;
  }

  return <ParallaxScrollEffect />;
}
```

### 5.3 Animation Controls

#### Pause Controls (If Needed)
```typescript
// For long-running animations (> 5 seconds)
function ActivityHeatmap() {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsPaused(!isPaused)}
        aria-label={isPaused ? 'Resume animation' : 'Pause animation'}
      >
        {isPaused ? <PlayIcon /> : <PauseIcon />}
      </button>
      <Canvas animationPaused={isPaused} />
    </div>
  );
}
```

#### Auto-Play Restrictions
- **Auto-play duration**: < 5 seconds (WCAG 2.2.2)
- **Looping animations**: Provide pause control
- **Background videos**: Not used in current features

### 5.4 Transition Examples

#### SKOS Tree Expansion
```typescript
// Smooth expansion with reduced motion support
function TreeNode({ isExpanded }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      style={{
        maxHeight: isExpanded ? '1000px' : '0',
        overflow: 'hidden',
        transition: prefersReducedMotion
          ? 'none'
          : 'max-height 300ms ease-in-out'
      }}
    >
      {children}
    </div>
  );
}
```

#### Modal Appearance
```typescript
function Modal({ isOpen }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.2
          }}
        >
          Modal content
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

#### Loading States
```typescript
// Skeleton screen with optional animation
function SkeletonCard() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={prefersReducedMotion ? 'skeleton-static' : 'skeleton-pulse'}
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading..."
    >
      <div className="skeleton-line" />
      <div className="skeleton-line" />
    </div>
  );
}
```

```css
.skeleton-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.skeleton-static {
  background-color: #E5E7EB; /* Static gray */
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-pulse {
    animation: none;
    background-color: #E5E7EB;
  }
}
```

---

## 6. Testing Checklist

### 6.1 Automated Testing Tools

#### Install and Configure
```bash
# axe-core for React
npm install --save-dev @axe-core/react jest-axe

# Pa11y for CI/CD
npm install --save-dev pa11y pa11y-ci

# Lighthouse CI
npm install --save-dev @lhci/cli
```

#### axe-core Integration
```typescript
// setupTests.ts
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

// Component test
import { render } from '@testing-library/react';

test('SKOS Browser is accessible', async () => {
  const { container } = render(<SKOSBrowser />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('Memory Search has no contrast violations', async () => {
  const { container } = render(<MemorySearch />);
  const results = await axe(container, {
    rules: {
      'color-contrast': { enabled: true }
    }
  });
  expect(results).toHaveNoViolations();
});
```

#### Pa11y CI Configuration
```json
// .pa11yci.json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 10000,
    "wait": 1000,
    "chromeLaunchConfig": {
      "args": ["--no-sandbox"]
    }
  },
  "urls": [
    "http://localhost:5173/",
    "http://localhost:5173/skos",
    "http://localhost:5173/memory-search",
    "http://localhost:5173/templates",
    "http://localhost:5173/health",
    {
      "url": "http://localhost:5173/attachments",
      "screenCapture": "screenshots/attachments.png"
    }
  ]
}
```

```json
// package.json scripts
{
  "scripts": {
    "a11y:test": "pa11y-ci",
    "a11y:report": "pa11y http://localhost:5173 --reporter json > a11y-report.json"
  }
}
```

#### Lighthouse CI
```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/skos',
        'http://localhost:4173/memory-search',
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'accessibility/aria-required-attr': 'error',
        'accessibility/button-name': 'error',
        'accessibility/color-contrast': 'error',
        'accessibility/document-title': 'error',
        'accessibility/html-has-lang': 'error',
        'accessibility/image-alt': 'error',
        'accessibility/label': 'error',
        'accessibility/link-name': 'error',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

### 6.2 Manual Testing Procedures

#### Keyboard Navigation Test
**For each feature:**
1. [ ] Disconnect mouse/trackpad
2. [ ] Use only `Tab`, `Shift+Tab`, `Enter`, `Space`, arrow keys
3. [ ] Verify focus indicator always visible
4. [ ] Verify all interactive elements reachable
5. [ ] Verify no keyboard traps (can always exit modals)
6. [ ] Verify tab order follows visual order
7. [ ] Verify custom keyboard shortcuts work (Ctrl+K, etc.)

**SKOS Browser specific:**
1. [ ] Arrow keys navigate tree (up/down/left/right)
2. [ ] Enter selects node
3. [ ] Right arrow expands, left arrow collapses
4. [ ] Home/End keys work
5. [ ] Search is reachable and functional

**Memory Search specific:**
1. [ ] Tab through location input, map controls, radius slider
2. [ ] Arrow keys adjust radius slider
3. [ ] Map controls work with keyboard
4. [ ] Date picker is keyboard-accessible
5. [ ] Results are navigable with Tab

**Attachments specific:**
1. [ ] Upload dropzone activates with Enter/Space
2. [ ] Tab through thumbnails
3. [ ] Enter opens preview modal
4. [ ] Arrow keys navigate between attachments in modal
5. [ ] Escape closes modal

#### Screen Reader Test Matrix

| Screen Reader | OS | Browser | Tester | Date | Pass/Fail | Notes |
|---------------|-----|---------|--------|------|-----------|-------|
| NVDA 2024.1 | Windows 11 | Chrome | | | | |
| NVDA 2024.1 | Windows 11 | Firefox | | | | |
| JAWS 2024 | Windows 11 | Chrome | | | | |
| VoiceOver | macOS 14 | Safari | | | | |
| VoiceOver | iOS 17 | Safari | | | | |
| TalkBack | Android 14 | Chrome | | | | |

#### Screen Reader Test Script (SKOS Browser)
1. [ ] Navigate to SKOS Concepts page
2. [ ] Screen reader announces page title: "SKOS Concepts - HotM"
3. [ ] Navigate to main landmark
4. [ ] Screen reader announces: "SKOS concept hierarchy, tree"
5. [ ] Navigate to first tree item
6. [ ] Screen reader announces: "Software Development, level 1, collapsed, 1 of 5"
7. [ ] Press right arrow to expand
8. [ ] Screen reader announces: "Expanded"
9. [ ] Navigate to child item
10. [ ] Screen reader announces: "Backend, level 2, collapsed, 1 of 3"
11. [ ] Navigate to concept detail pane
12. [ ] Screen reader reads all labels and values correctly

#### Screen Reader Test Script (Memory Search)
1. [ ] Navigate to Memory Search page
2. [ ] Screen reader announces page title
3. [ ] Focus on location input
4. [ ] Screen reader announces: "Search location or address, edit text"
5. [ ] Type "San Francisco"
6. [ ] Screen reader announces: "5 suggestions available"
7. [ ] Navigate to radius slider
8. [ ] Screen reader announces: "Search radius, slider, currently 1 kilometer, minimum 100 meters, maximum 50 kilometers"
9. [ ] Press right arrow
10. [ ] Screen reader announces: "1.1 kilometers"
11. [ ] Submit search
12. [ ] Screen reader announces: "42 memories found within 1.5 kilometers of San Francisco"

#### Color Contrast Test
1. [ ] Use browser DevTools Accessibility panel
2. [ ] Check all text elements for contrast ratio
3. [ ] Verify minimum 4.5:1 for normal text (< 18pt)
4. [ ] Verify minimum 3:1 for large text (≥ 18pt or 14pt bold)
5. [ ] Check focus indicators (minimum 3:1 contrast)
6. [ ] Check button borders and UI components

#### Color Blindness Simulation
1. [ ] Use Chrome DevTools > Rendering > Emulate vision deficiencies
2. [ ] Test each feature with:
   - [ ] Protanopia (red-blind)
   - [ ] Deuteranopia (green-blind)
   - [ ] Tritanopia (blue-blind)
   - [ ] Achromatopsia (no color)
3. [ ] Verify information not conveyed by color alone
4. [ ] Verify icons/text labels supplement color

#### Zoom and Reflow Test
1. [ ] Set browser zoom to 200%
2. [ ] Verify no horizontal scrolling
3. [ ] Verify all content remains visible
4. [ ] Verify layout reflows appropriately
5. [ ] Test at 320px width (mobile)
6. [ ] Verify content reflows to single column

#### Motion and Animation Test
1. [ ] Enable "Reduce Motion" in OS settings:
   - **Windows**: Settings > Ease of Access > Display > Show animations
   - **macOS**: System Preferences > Accessibility > Display > Reduce motion
   - **Chrome DevTools**: Rendering > Emulate CSS media feature prefers-reduced-motion
2. [ ] Reload application
3. [ ] Verify animations are disabled/instant
4. [ ] Verify functionality still works
5. [ ] Verify loading indicators are static or simplified

### 6.3 Screen Reader Testing Matrix

#### Test Coverage by Feature

| Feature | NVDA (Windows) | JAWS (Windows) | VoiceOver (Mac) | VoiceOver (iOS) | TalkBack (Android) |
|---------|----------------|----------------|-----------------|-----------------|-------------------|
| SKOS Browser | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| File Attachments | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Memory Search | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Knowledge Health | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Version History | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Template Management | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

#### Critical User Flows to Test

1. **SKOS Browser**
   - [ ] Navigate tree hierarchy
   - [ ] Expand/collapse nodes
   - [ ] Search concepts
   - [ ] View concept details
   - [ ] Create new concept

2. **File Attachments**
   - [ ] Upload file
   - [ ] View thumbnail grid
   - [ ] Open preview modal
   - [ ] Navigate between attachments
   - [ ] View EXIF metadata

3. **Memory Search**
   - [ ] Enter location
   - [ ] Adjust radius
   - [ ] Select time range
   - [ ] View results
   - [ ] Open result note

4. **Knowledge Health**
   - [ ] Understand health score
   - [ ] Navigate metrics
   - [ ] Read chart data
   - [ ] Take action on orphan notes

5. **Version History**
   - [ ] View version list
   - [ ] Compare versions
   - [ ] Navigate diff changes
   - [ ] Restore version

6. **Template Management**
   - [ ] Browse templates
   - [ ] Preview template
   - [ ] Fill variable form
   - [ ] Create note from template

### 6.4 Acceptance Criteria

#### WCAG 2.1 Level AA Compliance
- [ ] **Automated tests**: 0 critical violations in axe-core
- [ ] **Pa11y score**: 0 errors, < 5 warnings
- [ ] **Lighthouse accessibility score**: ≥ 90/100
- [ ] **Manual review**: All WCAG 2.1 AA criteria met

#### Keyboard Navigation
- [ ] **100% keyboard accessible**: All features usable without mouse
- [ ] **Focus indicators**: Always visible (2px blue outline)
- [ ] **No keyboard traps**: Can always exit modals with Escape
- [ ] **Logical tab order**: Matches visual order

#### Screen Reader Support
- [ ] **NVDA**: All features functional and understandable
- [ ] **JAWS**: All features functional and understandable
- [ ] **VoiceOver**: All features functional and understandable
- [ ] **Landmark navigation**: All screen readers can jump between landmarks
- [ ] **Live regions**: Announcements work correctly

#### Color Contrast
- [ ] **All text**: Meets minimum 4.5:1 ratio
- [ ] **Large text**: Meets minimum 3:1 ratio
- [ ] **UI components**: Meet minimum 3:1 ratio
- [ ] **Focus indicators**: Meet minimum 3:1 ratio

#### Color Blindness
- [ ] **Protanopia**: All information conveyed without red
- [ ] **Deuteranopia**: All information conveyed without green
- [ ] **Tritanopia**: All information conveyed without blue
- [ ] **Icons/labels**: Supplement all color coding

#### Motion and Animation
- [ ] **Reduced motion**: Respected across all features
- [ ] **No flashing**: No content flashes > 3 times/second
- [ ] **Animation duration**: < 5 seconds or pause control

---

## 7. Implementation Guidelines

### 7.1 Development Checklist

#### For Every New Component
1. [ ] Use semantic HTML (button, nav, main, aside, etc.)
2. [ ] Add ARIA attributes where needed (role, aria-label, aria-describedby)
3. [ ] Ensure keyboard navigation works (Tab, Enter, Escape, arrows)
4. [ ] Add focus styles (don't remove outline)
5. [ ] Check color contrast (text and UI elements)
6. [ ] Test with screen reader (NVDA minimum)
7. [ ] Support reduced motion preference
8. [ ] Add alt text to images
9. [ ] Associate labels with form inputs
10. [ ] Run axe-core test

#### For Every Form
1. [ ] All inputs have associated labels
2. [ ] Required fields marked with aria-required
3. [ ] Error messages use aria-invalid and aria-describedby
4. [ ] Help text associated with aria-describedby
5. [ ] Form can be submitted with Enter key
6. [ ] Errors announced to screen readers (aria-live)
7. [ ] Focus moves to first error on submit
8. [ ] Success confirmation announced (aria-live)

#### For Every Modal/Dialog
1. [ ] Use role="dialog" and aria-modal="true"
2. [ ] Include aria-labelledby (modal title)
3. [ ] Include aria-describedby (modal description)
4. [ ] Trap focus within modal (use focus-trap-react)
5. [ ] Return focus to trigger on close
6. [ ] Close with Escape key
7. [ ] Close button has aria-label
8. [ ] Backdrop click closes modal (optional)

#### For Every Data Visualization
1. [ ] Provide text alternative (sr-only summary)
2. [ ] Use aria-label on container
3. [ ] Provide data table alternative
4. [ ] Don't rely on color alone
5. [ ] Make interactive elements keyboard-accessible
6. [ ] Announce data changes with aria-live

### 7.2 Code Patterns

#### Skip Link
```typescript
// components/SkipLink.tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="skip-link"
    >
      Skip to main content
    </a>
  );
}
```

```css
/* styles/skip-link.css */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #0066CC;
  color: white;
  padding: 8px 16px;
  text-decoration: none;
  border-radius: 0 0 4px 0;
  z-index: 1000;
}

.skip-link:focus {
  top: 0;
  outline: 2px solid white;
  outline-offset: 2px;
}
```

#### Focus Management Hook
```typescript
// hooks/useFocusManagement.ts
import { useEffect, useRef } from 'react';

export function useFocusManagement(isOpen: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus first focusable element in container
      const firstFocusable = containerRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;

      firstFocusable?.focus();
    } else {
      // Restore previous focus
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  return containerRef;
}

// Usage
function Modal({ isOpen, onClose }) {
  const containerRef = useFocusManagement(isOpen);

  if (!isOpen) return null;

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {/* Modal content */}
    </div>
  );
}
```

#### Accessible Button Component
```typescript
// components/Button.tsx
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  );
}
```

#### Accessible Form Input
```typescript
// components/Input.tsx
interface InputProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number';
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  helpText?: string;
  placeholder?: string;
}

export function Input({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  error,
  helpText,
  placeholder,
}: InputProps) {
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        placeholder={placeholder}
      />

      {helpText && (
        <div id={helpId} className="help-text">
          {helpText}
        </div>
      )}

      {error && (
        <div id={errorId} className="error-text" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
```

#### Live Region Component
```typescript
// components/LiveRegion.tsx
interface LiveRegionProps {
  message: string;
  type?: 'polite' | 'assertive';
}

export function LiveRegion({ message, type = 'polite' }: LiveRegionProps) {
  return (
    <div
      role={type === 'assertive' ? 'alert' : 'status'}
      aria-live={type}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

// Usage
function UploadButton() {
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    setMessage('Uploading...');
    try {
      await uploadFile();
      setMessage('File uploaded successfully');
    } catch (error) {
      setMessage('Upload failed. Please try again.');
    }
  };

  return (
    <>
      <button onClick={handleUpload}>Upload</button>
      <LiveRegion message={message} />
    </>
  );
}
```

### 7.3 Testing Integration

#### Jest + React Testing Library
```typescript
// tests/SKOSBrowser.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SKOSBrowser } from '../SKOSBrowser';

expect.extend(toHaveNoViolations);

describe('SKOS Browser Accessibility', () => {
  test('should not have accessibility violations', async () => {
    const { container } = render(<SKOSBrowser />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('should be navigable with keyboard', async () => {
    const user = userEvent.setup();
    render(<SKOSBrowser />);

    // Tab to search input
    await user.tab();
    expect(screen.getByRole('textbox', { name: /search concepts/i })).toHaveFocus();

    // Tab to tree
    await user.tab();
    const firstTreeItem = screen.getByRole('treeitem', { name: /software development/i });
    expect(firstTreeItem).toHaveFocus();

    // Arrow key navigation
    await user.keyboard('{ArrowRight}'); // Expand
    expect(firstTreeItem).toHaveAttribute('aria-expanded', 'true');
  });

  test('should announce changes to screen readers', async () => {
    const user = userEvent.setup();
    render(<SKOSBrowser />);

    // Find live region
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeInTheDocument();

    // Perform search
    const searchInput = screen.getByRole('textbox', { name: /search concepts/i });
    await user.type(searchInput, 'machine learning');

    // Live region should announce results
    expect(liveRegion).toHaveTextContent(/5 concepts found/i);
  });

  test('should have proper ARIA attributes', () => {
    render(<SKOSBrowser />);

    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('aria-label', 'SKOS concept hierarchy');

    const treeItems = screen.getAllByRole('treeitem');
    treeItems.forEach((item) => {
      expect(item).toHaveAttribute('aria-level');
      expect(item).toHaveAttribute('aria-expanded');
    });
  });
});
```

#### CI/CD Integration (GitHub Actions)
```yaml
# .github/workflows/accessibility.yml
name: Accessibility Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  a11y-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Run Jest accessibility tests
        run: npm test -- --coverage

      - name: Start preview server
        run: npm run preview &

      - name: Wait for server
        run: npx wait-on http://localhost:4173

      - name: Run Pa11y tests
        run: npm run a11y:test

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun

      - name: Upload accessibility reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: accessibility-reports
          path: |
            coverage/
            .lighthouseci/
            pa11y-results.json
```

---

## 8. Resources and References

### 8.1 WCAG Guidelines
- **WCAG 2.1 Quick Reference**: https://www.w3.org/WAI/WCAG21/quickref/
- **Understanding WCAG 2.1**: https://www.w3.org/WAI/WCAG21/Understanding/
- **How to Meet WCAG**: https://www.w3.org/WAI/WCAG21/quickref/

### 8.2 ARIA Documentation
- **ARIA Authoring Practices Guide (APG)**: https://www.w3.org/WAI/ARIA/apg/
- **ARIA Roles**: https://www.w3.org/TR/wai-aria-1.2/#role_definitions
- **ARIA States and Properties**: https://www.w3.org/TR/wai-aria-1.2/#state_prop_def

### 8.3 Testing Tools
- **axe DevTools**: https://www.deque.com/axe/devtools/
- **axe-core**: https://github.com/dequelabs/axe-core
- **Pa11y**: https://pa11y.org/
- **Lighthouse**: https://developers.google.com/web/tools/lighthouse
- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **NVDA Screen Reader**: https://www.nvaccess.org/download/
- **Color Oracle (Color Blindness Simulator)**: https://colororacle.org/

### 8.4 Component Patterns
- **Radix UI Accessibility**: https://www.radix-ui.com/docs/primitives/overview/accessibility
- **React ARIA**: https://react-spectrum.adobe.com/react-aria/
- **Accessible Components Examples**: https://www.a11ymatters.com/patterns/

### 8.5 Internal Documentation
- [UX Design Document](./fortemi-integration-ux-design.md)
- [Feature Overview](./feature-overview.md)
- [API Specification](../specifications/api-specification.md)
- [Testing Strategy](../implementation/testing-strategy.md)

---

## Appendix A: WCAG 2.1 AA Criteria Summary

### Level A (Must Have)
- 1.1.1 Non-text Content
- 1.2.1 Audio-only and Video-only (Prerecorded)
- 1.2.2 Captions (Prerecorded)
- 1.2.3 Audio Description or Media Alternative (Prerecorded)
- 1.3.1 Info and Relationships
- 1.3.2 Meaningful Sequence
- 1.3.3 Sensory Characteristics
- 1.4.1 Use of Color
- 1.4.2 Audio Control
- 2.1.1 Keyboard
- 2.1.2 No Keyboard Trap
- 2.1.4 Character Key Shortcuts
- 2.2.1 Timing Adjustable
- 2.2.2 Pause, Stop, Hide
- 2.3.1 Three Flashes or Below Threshold
- 2.4.1 Bypass Blocks
- 2.4.2 Page Titled
- 2.4.3 Focus Order
- 2.4.4 Link Purpose (In Context)
- 2.5.1 Pointer Gestures
- 2.5.2 Pointer Cancellation
- 2.5.3 Label in Name
- 2.5.4 Motion Actuation
- 3.1.1 Language of Page
- 3.2.1 On Focus
- 3.2.2 On Input
- 3.3.1 Error Identification
- 3.3.2 Labels or Instructions
- 4.1.1 Parsing (Deprecated in WCAG 2.2)
- 4.1.2 Name, Role, Value

### Level AA (Should Have)
- 1.2.4 Captions (Live)
- 1.2.5 Audio Description (Prerecorded)
- 1.3.4 Orientation
- 1.3.5 Identify Input Purpose
- 1.4.3 Contrast (Minimum) - 4.5:1
- 1.4.4 Resize Text
- 1.4.5 Images of Text
- 1.4.10 Reflow
- 1.4.11 Non-text Contrast
- 1.4.12 Text Spacing
- 1.4.13 Content on Hover or Focus
- 2.4.5 Multiple Ways
- 2.4.6 Headings and Labels
- 2.4.7 Focus Visible
- 3.1.2 Language of Parts
- 3.2.3 Consistent Navigation
- 3.2.4 Consistent Identification
- 3.3.3 Error Suggestion
- 3.3.4 Error Prevention (Legal, Financial, Data)
- 4.1.3 Status Messages

---

## Document Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Accessibility Specialist | [Name] | [Date] | [Signature] |
| UX Designer | [Name] | [Date] | [Signature] |
| Engineering Lead | [Name] | [Date] | [Signature] |
| QA Lead | [Name] | [Date] | [Signature] |

---

**Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-04 | Accessibility Specialist | Initial comprehensive specification |

---

*This document ensures HotM provides an inclusive experience for all users, regardless of ability or assistive technology used.*
