# File Attachments Panel - Wireframe Specification

**Version**: 1.0
**Last Updated**: 2026-02-04
**Component**: File Attachments Panel
**Grid System**: 8px base unit

---

## Overview

Upload, preview, and manage file attachments with rich metadata (EXIF, location, device info) supporting images, PDFs, and documents.

---

## Desktop Layout (>1024px)

### Attachments Section (Within Note View)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Attachments (3)                              [Grid] [List] [⋮] More     │ 56px header
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌──────────────────────────────────────────────────────────────────┐   │ 8px padding
│ │                                                                  │   │
│ │                        📎 Drop files here                        │   │
│ │                         or click to browse                       │   │ 120px height
│ │                   Images, PDFs, up to 100MB                      │   │
│ │                                                                  │   │
│ └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │ 16px gap
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │                            Grid View                             │   │
│ │                                                                  │   │
│ │  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐                    │   │
│ │  │ IMG   │  │ IMG   │  │ PDF   │  │ IMG   │                    │   │ 160px
│ │  │ 👁     │  │ 👁     │  │ 👁     │  │ 👁     │                    │   │ height
│ │  │       │  │       │  │       │  │       │                    │   │
│ │  │ photo │  │ note  │  │ doc.  │  │ scan  │                    │   │
│ │  │ 2.4MB │  │ 1.8MB │  │ 5.2MB │  │ 3.1MB │                    │   │
│ │  └───────┘  └───────┘  └───────┘  └───────┘                    │   │
│ │   160px      160px      160px      160px                         │   │
│ │                                                                  │   │
│ │  Jan 24     Jan 22     Jan 20     Jan 18                        │   │ 24px
│ │                                                                  │   │
│ └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Section header: 56px height
- Upload dropzone: 120px height (default)
- Thumbnail card: 160px × 160px
- Grid gap: 16px between cards
- Grid columns: 4 (desktop), responsive
- Metadata row: 24px height
- Horizontal padding: 16px
- Vertical gaps: 16px

**Grid Layout**:
- 4 columns on >1024px
- 3 columns on 768-1024px
- 2 columns on 640-768px
- 1 column on <640px

---

### Thumbnail Card (Grid View)

```
┌─────────────────────────────┐
│                             │
│        [Thumbnail]          │ 128px
│         Image               │ square
│                             │
│ ┌─────────────────────────┐ │ Overlay
│ │ 2.4 MB      👁  ⋮       │ │ 32px
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ photo_2026.jpg              │ 24px
│ Jan 24, 2026                │ 20px
├─────────────────────────────┤
│ 📍 San Francisco            │ 20px (optional)
└─────────────────────────────┘

Total: 160px width × 192px height (with location)
       160px width × 172px height (no location)
```

**Card Dimensions**:
- Total width: 160px
- Thumbnail area: 128px × 128px
- Overlay (hover): 32px height
- Filename: 24px height, truncated
- Date: 20px height
- Location badge: 20px height (if GPS data)
- Border-radius: 8px
- Padding: 8px

**Card States**:

**Default**:
```
Border: 1px solid #e5e7eb
Background: #ffffff
Shadow: 0 1px 2px rgba(0,0,0,0.05)
```

**Hover**:
```
Border: 1px solid #3b82f6
Shadow: 0 4px 6px rgba(0,0,0,0.1)
Overlay visible (dark gradient from bottom)
Actions visible (eye, menu icons)
```

**Selected** (for batch operations):
```
Border: 2px solid #3b82f6
Checkmark in top-right corner
Background: rgba(59, 130, 246, 0.05)
```

---

### List View

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              List View                                  │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ [📷] photo_2026.jpg                    2.4 MB    Jan 24  [👁][⋮]│   │ 64px
│ │      1920×1080 • Canon EOS R5 • 📍 San Francisco                │   │ height
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │ 8px gap
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ [🖼️] note_screenshot.png              1.8 MB    Jan 22  [👁][⋮]│   │ 64px
│ │      2560×1440 • Screenshot                                     │   │ height
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │ 8px gap
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ [📄] document.pdf                     5.2 MB    Jan 20  [👁][⋮]│   │ 64px
│ │      12 pages • PDF Document                                    │   │ height
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Row height: 64px
- Icon size: 40px × 40px (left aligned)
- Filename: 16px font, medium weight
- Metadata: 14px font, secondary color
- Action buttons: 32px × 32px
- Gap between rows: 8px
- Horizontal padding: 16px

---

### Upload Dropzone States

**Default State**:
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                          📎                                  │ 48px icon
│                   Drop files here                            │ 18px text
│                  or click to browse                          │ 14px text
│            Images, PDFs, up to 100MB                         │ 12px hint
│                                                              │
└──────────────────────────────────────────────────────────────┘
  Height: 120px
  Border: 2px dashed #d1d5db
  Background: #f9fafb
  Border-radius: 8px
```

**Drag Over State**:
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                          ⬇️                                  │ 48px icon
│                     Drop to attach                           │ 18px text
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
  Border: 2px dashed #3b82f6
  Background: rgba(59, 130, 246, 0.05)
  Icon animated (bounce)
```

**Uploading State**:
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Uploading: photo_2026.jpg                                   │ 16px
│  ┌────────────────────────────────────────────────────┐     │
│  │█████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 62% │ 8px
│  └────────────────────────────────────────────────────┘     │ progress
│  2.4 MB / 3.8 MB                                            │ 14px
│                                                              │
└──────────────────────────────────────────────────────────────┘
  Progress bar: 8px height
  Indeterminate animation for processing
```

---

## Preview Modal

### Image Preview (Desktop)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ photo_2026.jpg                                    [Download] [×] Close  │ 64px
├─────────────────────────────────────────────────────────────────────────┤ header
│                                                                         │
│ ┌─────────────────────────────────────┐ ┌────────────────────────────┐│
│ │                                     │ │ Metadata                    ││
│ │                                     │ │ ────────────────────────   ││ 48px
│ │                                     │ │                            ││
│ │                                     │ │ [File Info] [EXIF] [GPS]   ││ 40px
│ │                                     │ │                            ││ tabs
│ │                                     │ │ File Information            ││
│ │                                     │ │ ─────────────────          ││ 32px
│ │         [IMAGE PREVIEW]             │ │                            ││
│ │                                     │ │ Name                       ││ 24px
│ │                                     │ │ photo_2026.jpg             ││ 32px
│ │                                     │ │                            ││
│ │                                     │ │ Size                       ││ 24px
│ │                                     │ │ 2.4 MB (2,456,789 bytes)   ││ 32px
│ │                                     │ │                            ││
│ │                                     │ │ Type                       ││ 24px
│ │                                     │ │ image/jpeg                 ││ 32px
│ │                                     │ │                            ││
│ │                                     │ │ Dimensions                 ││ 24px
│ │                                     │ │ 1920 × 1080 pixels         ││ 32px
│ │                                     │ │                            ││
│ │                                     │ │ Uploaded                   ││ 24px
│ │                                     │ │ Jan 24, 2026 3:45 PM       ││ 32px
│ │                                     │ │                            ││
│ │ [🔍-] [🔍+] [↻] [⤢]                 │ │                            ││
│ └─────────────────────────────────────┘ └────────────────────────────┘│
│   700px width                              300px width                 │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ [Delete Attachment]                                             │   │ 64px
│ └─────────────────────────────────────────────────────────────────┘   │ footer
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
  Modal width: 1000px (80vw max)
  Modal height: 80vh max
```

**Dimensions**:
- Modal width: 1000px (max 80vw)
- Modal height: 80vh max
- Preview pane: 700px width (70%)
- Metadata sidebar: 300px width (30%)
- Header: 64px height
- Tab bar: 40px height
- Footer: 64px height
- Metadata row: 24px label + 32px value
- Section gap: 16px

---

### EXIF Metadata Tab

```
┌────────────────────────────┐
│ EXIF Data                  │
│ ─────────────────          │ 32px header
│                            │
│ Camera                     │ 24px label
│ Canon EOS R5               │ 32px value
│                            │
│ Lens                       │ 24px label
│ RF 24-105mm f/4L IS USM    │ 32px value
│                            │
│ ▼ Capture Settings         │ 40px accordion
│ ─────────────────          │
│                            │
│ ISO         │ 400          │ 32px (2-col)
│ Aperture    │ f/4.0        │ 32px
│ Shutter     │ 1/250s       │ 32px
│ Focal Len   │ 35mm         │ 32px
│                            │
│ ▼ Date & Time              │ 40px accordion
│ ─────────────────          │
│                            │
│ Captured                   │ 24px label
│ Jan 24, 2026               │ 32px value
│ 3:42:18 PM PST             │ 28px value
│                            │
│ Modified                   │ 24px label
│ Jan 24, 2026               │ 32px value
│ 3:45:02 PM PST             │ 28px value
│                            │
└────────────────────────────┘
  Scrollable content area
```

**Dimensions**:
- Tab content padding: 16px
- Section header: 32px height
- Accordion header: 40px height
- Label: 24px height
- Value: 32px height
- Two-column row: 32px height, 50/50 split
- Gap between sections: 16px

---

### Location Tab (GPS Data)

```
┌────────────────────────────┐
│ Location                   │
│ ─────────────────          │ 32px header
│                            │
│ ┌────────────────────────┐ │
│ │                        │ │
│ │     [MAP VIEW]         │ │ 200px
│ │      📍 Marker         │ │ height
│ │                        │ │
│ └────────────────────────┘ │
│                            │ 16px gap
│ Coordinates                │ 24px label
│ 37.7749° N, 122.4194° W    │ 32px value
│                            │
│ Altitude                   │ 24px label
│ 52 meters                  │ 32px value
│                            │
│ Accuracy                   │ 24px label
│ ± 10 meters                │ 32px value
│                            │
│ ┌────────────────────────┐ │
│ │ [Search Nearby         │ │ 48px
│ │  Memories]             │ │ button
│ └────────────────────────┘ │
│                            │
└────────────────────────────┘
```

**Dimensions**:
- Map view: 200px height
- Coordinate display: 32px height
- Button: 48px height
- Gap between map and data: 16px
- Gap between button and data: 16px

---

## Tablet Layout (640-1024px)

### Attachments Grid (2-3 columns)

```
┌─────────────────────────────────────────────────────────┐
│ Attachments (3)                       [Grid] [List] [⋮] │ 56px
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Drop files or click to browse]                        │ 100px
│                                                         │
│ ┌───────┐  ┌───────┐  ┌───────┐                       │
│ │ IMG   │  │ IMG   │  │ PDF   │                       │ 160px
│ │ 👁     │  │ 👁     │  │ 👁     │                       │
│ └───────┘  └───────┘  └───────┘                       │
│  160px      160px      160px                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
  3 columns on tablet
  16px gaps
```

### Preview Modal (Tablet)

```
┌─────────────────────────────────────────────────────────┐
│ photo_2026.jpg                    [Download] [×] Close  │ 64px
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │                                                     ││
│ │              [IMAGE PREVIEW]                        ││ 500px
│ │                                                     ││ height
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ [File Info ▼] [EXIF ▼] [GPS ▼]                        │ 48px tabs
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ File Information (Expanded)                         ││
│ │ ─────────────────                                   ││
│ │ Name: photo_2026.jpg                                ││
│ │ Size: 2.4 MB                                        ││
│ │ Type: image/jpeg                                    ││
│ │ Dimensions: 1920 × 1080                             ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ [Delete Attachment]                                    │ 64px
│                                                         │
└─────────────────────────────────────────────────────────┘
  Modal: 80% width, centered
  Preview stacked above metadata
  Accordion-style tabs
```

---

## Mobile Layout (<640px)

### Attachments List (Mobile)

```
┌────────────────────────────────────────┐
│ Attachments (3)              [⋮] More  │ 56px
├────────────────────────────────────────┤
│                                        │
│ [📎 Tap to attach files]               │ 80px
│                                        │
├────────────────────────────────────────┤ 8px gap
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [📷]  photo_2026.jpg          👁 ⋮ ││ 72px
│ │       2.4 MB • Jan 24              ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ [🖼️]  note_screenshot.png     👁 ⋮ ││ 72px
│ │       1.8 MB • Jan 22              ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ [📄]  document.pdf            👁 ⋮ ││ 72px
│ │       5.2 MB • Jan 20              ││
│ └────────────────────────────────────┘│
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Row height: 72px (larger touch target)
- Dropzone: 80px height
- Icon size: 48px × 48px
- Action buttons: 44px × 44px (touch-friendly)
- Horizontal padding: 16px
- Gap between rows: 8px

---

### Mobile Preview (Full-Screen)

```
┌────────────────────────────────────────┐
│ ← Back                      [⋮] Menu   │ 64px
├────────────────────────────────────────┤
│                                        │
│                                        │
│                                        │
│         [IMAGE PREVIEW]                │ Full
│          Pinch to zoom                 │ screen
│          Swipe to dismiss              │
│                                        │
│                                        │
│                                        │
├────────────────────────────────────────┤
│ ▲ Swipe up for details                 │ 48px
└────────────────────────────────────────┘
```

**Dimensions**:
- Full viewport width and height
- Header: 64px height
- Bottom handle: 48px height
- Image: Centered, max dimensions
- Swipe threshold: 100px

---

### Mobile Metadata (Bottom Sheet)

```
┌────────────────────────────────────────┐
│ ═══                                    │ 24px handle
├────────────────────────────────────────┤
│ photo_2026.jpg                         │ 48px
│ ──────────────────────────────────     │
│                                        │
│ [File Info] [EXIF] [GPS]               │ 48px tabs
│                                        │
│ ▼ File Information                     │ 48px
│ ───────────────────────────────────    │
│                                        │
│ Size: 2.4 MB                           │ 40px
│ Type: image/jpeg                       │ 40px
│ Dimensions: 1920 × 1080                │ 40px
│ Uploaded: Jan 24, 2026 3:45 PM         │ 40px
│                                        │
│ ▼ EXIF Data                            │ 48px
│ ───────────────────────────────────    │
│                                        │
│ Camera: Canon EOS R5                   │ 40px
│ ISO: 400 • f/4.0 • 1/250s              │ 40px
│                                        │
│ ▼ Location                             │ 48px
│ ───────────────────────────────────    │
│                                        │
│ [Map Preview]                          │ 200px
│                                        │
│ San Francisco, CA                      │ 40px
│ 37.7749° N, 122.4194° W                │ 40px
│                                        │
│ [Search Nearby Memories]               │ 56px
│                                        │
│ [Download]          [Delete]           │ 64px
│                                        │
└────────────────────────────────────────┘
  Swipeable bottom sheet
  Snap points: 25%, 50%, 90% of viewport
```

**Dimensions**:
- Handle area: 24px height
- Title: 48px height
- Tab bar: 48px height
- Section header: 48px height (accordion)
- Data row: 40px height
- Map preview: 200px height
- Button: 56px height (touch-friendly)
- Footer: 64px height
- Horizontal padding: 16px
- Snap points: 25%, 50%, 90% of viewport height

---

## Context Menu Actions

### Desktop Context Menu

```
┌──────────────────────────┐
│ View Full Size           │ 40px
├──────────────────────────┤
│ Download                 │ 40px
├──────────────────────────┤
│ View Metadata            │ 40px
├──────────────────────────┤
│ Search Nearby (GPS)      │ 40px
├──────────────────────────┤
│ Copy Link                │ 40px
├──────────────────────────┤
│ Delete                   │ 40px (Red)
└──────────────────────────┘
  Width: 200px
  Item height: 40px
  Shadow: 0 4px 6px rgba(0,0,0,0.1)
  Border-radius: 8px
```

### Mobile Action Sheet

```
┌────────────────────────────────────────┐
│ photo_2026.jpg                         │ 64px
├────────────────────────────────────────┤
│                                        │
│ [Download]                             │ 64px
│                                        │
│ [View Metadata]                        │ 64px
│                                        │
│ [Search Nearby]                        │ 64px
│                                        │
│ [Copy Link]                            │ 64px
│                                        │
│ [Delete]                               │ 64px (Red)
│                                        │
├────────────────────────────────────────┤
│ [Cancel]                               │ 64px
└────────────────────────────────────────┘
  Full width
  Item height: 64px (touch-friendly)
  Backdrop: rgba(0,0,0,0.4)
  Slide up animation
```

---

## Component States

### Thumbnail Loading States

**Loading (Skeleton)**:
```
┌─────────────────────────────┐
│                             │
│   ┌─────────────────────┐   │
│   │  ░░░░░░░░░░░░░░░░░  │   │ Shimmer
│   │  ░░░░░░░░░░░░░░░░░  │   │ animation
│   │  ░░░░░░░░░░░░░░░░░  │   │
│   └─────────────────────┘   │
│                             │
├─────────────────────────────┤
│ ░░░░░░░░░░░░░              │ 24px
│ ░░░░░░░░░                  │ 20px
└─────────────────────────────┘
  Pulsing gray gradient animation
```

**Error State**:
```
┌─────────────────────────────┐
│                             │
│          ⚠️                  │ 48px icon
│    Failed to load            │ 16px
│                             │
│    [Retry]                   │ 32px button
│                             │
├─────────────────────────────┤
│ corrupted_file.jpg          │ 24px
│ Error loading               │ 20px (red)
└─────────────────────────────┘
```

---

## File Type Icons

```
Images:   📷 Camera (photos), 🖼️ Frame (screenshots)
PDFs:     📄 Document
Documents: 📝 Memo (text), 📊 Chart (spreadsheets)
Archives: 📦 Package
Video:    🎥 Camera
Audio:    🎵 Music
Code:     </> Code symbol
Other:    📎 Paperclip
```

**Icon Sizes**:
- Grid thumbnail: 20px (top-right badge)
- List view: 40px × 40px
- Preview modal: 24px

---

## Accessibility Specifications

### ARIA Attributes

**Attachment Card**:
```html
<div
  role="article"
  aria-label="Attachment: photo_2026.jpg, 2.4 MB, uploaded Jan 24"
  tabindex="0"
>
```

**Upload Dropzone**:
```html
<div
  role="button"
  aria-label="Drop files to upload or click to browse"
  tabindex="0"
>
```

**Preview Modal**:
```html
<dialog
  aria-modal="true"
  aria-labelledby="modal-title"
>
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between attachments |
| Shift+Tab | Navigate backward |
| Enter | Open preview modal |
| Space | Select/deselect (multi-select mode) |
| Arrow Keys | Navigate grid (Up/Down/Left/Right) |
| Delete | Delete selected attachment (confirm) |
| Escape | Close modal, cancel upload |
| Ctrl+A | Select all attachments |
| Ctrl+Click | Multi-select toggle |

### Screen Reader Announcements

```
"Uploading photo_2026.jpg, 62% complete"
"Upload complete. Photo added to attachments."
"3 attachments. Grid view selected."
"Attachment: photo_2026.jpg, JPEG image, 2.4 megabytes,
 taken with Canon EOS R5, location: San Francisco,
 uploaded January 24th at 3:45 PM"
```

---

## Responsive Breakpoints

| Breakpoint | Width | Grid Columns | Card Size |
|------------|-------|--------------|-----------|
| Mobile | <640px | 1 | Full width (list) |
| Tablet | 640-1024px | 2-3 | 160px × 160px |
| Desktop | >1024px | 4 | 160px × 160px |
| Large | >1440px | 5 | 160px × 160px |

---

## Animation Specifications

### Upload Progress

```css
/* Progress bar fill */
transition: width 300ms ease-out;

/* Indeterminate (processing) */
animation: progress-indeterminate 1.5s infinite;
@keyframes progress-indeterminate {
  0% { left: -35%; right: 100%; }
  60% { left: 100%; right: -90%; }
  100% { left: 100%; right: -90%; }
}
```

### Thumbnail Fade-In

```css
/* After image loads */
animation: fade-in 300ms ease-out;
@keyframes fade-in {
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

### Modal Open/Close

```css
/* Modal backdrop */
animation: fade-in 200ms ease-out;

/* Modal content */
animation: slide-up 250ms ease-out;
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

### Bottom Sheet (Mobile)

```css
/* Slide up from bottom */
animation: slide-up-sheet 300ms ease-out;
@keyframes slide-up-sheet {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* Snap points with spring */
transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
```

---

## Color Specifications

```css
/* Attachment card */
--color-card-bg: #ffffff;
--color-card-border: #e5e7eb;
--color-card-border-hover: #3b82f6;
--color-card-shadow: rgba(0, 0, 0, 0.05);
--color-card-shadow-hover: rgba(0, 0, 0, 0.1);

/* Upload dropzone */
--color-dropzone-border: #d1d5db;
--color-dropzone-border-active: #3b82f6;
--color-dropzone-bg: #f9fafb;
--color-dropzone-bg-active: rgba(59, 130, 246, 0.05);

/* Progress bar */
--color-progress-bg: #e5e7eb;
--color-progress-fill: #3b82f6;

/* File type badges */
--color-badge-image: #10b981;
--color-badge-pdf: #ef4444;
--color-badge-document: #3b82f6;
--color-badge-other: #6b7280;

/* Location badge */
--color-location: #f59e0b;
```

---

## Typography

```css
/* Attachment filename */
--font-filename: 14px / 20px, font-weight: 500;

/* Metadata */
--font-metadata: 12px / 16px, font-weight: 400;

/* File size */
--font-size: 12px / 16px, font-weight: 500;

/* Section labels */
--font-label: 12px / 16px, font-weight: 600;

/* EXIF data */
--font-exif: 13px / 18px, font-weight: 400;
```

---

## Performance Considerations

1. **Lazy Loading**: Load thumbnails on scroll (IntersectionObserver)
2. **Progressive Images**: Show blur placeholder → low-res → high-res
3. **Thumbnail Generation**: Server-side on upload, cache aggressively
4. **Chunked Upload**: 5MB chunks for files >20MB
5. **Image Optimization**: WebP format with JPEG fallback
6. **Virtual Scrolling**: For >100 attachments
7. **Preview Preloading**: Preload adjacent images in preview modal
8. **EXIF Caching**: Cache parsed EXIF data in IndexedDB

---

## Implementation Notes

1. **File Size Limits**: 100MB per file (configurable)
2. **Allowed Types**: images/*, application/pdf, text/*, application/vnd.*
3. **Thumbnail Size**: 256×256px (2x for retina)
4. **Map Library**: Leaflet.js for location display
5. **EXIF Parsing**: exif-js library (client-side) or backend-side
6. **Image Viewer**: react-image-lightbox or custom
7. **Drag-and-Drop**: HTML5 File API with polyfill for older browsers

---

## Related Specifications

- [UX Design Document](../fortemi-integration-ux-design.md)
- [File Attachments API](/mnt/dev-inbox/fortemi/fortemi/docs/content/api.md#attachments)
- [Memory Search Wireframe](./03-memory-search.md) (Location integration)
