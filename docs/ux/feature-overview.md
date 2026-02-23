# Fortemi Integration: Feature Overview

Quick visual reference for the six major features being integrated into HotM.

---

## Feature 1: SKOS Concept Browser

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ SKOS Concept Browser                                       [×]       │
├─────────────────────────────────────────────────────────────────────┤
│ Scheme: [Project Taxonomy ▼]                    [+ New Concept]     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search concepts...                                           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────┬──────────────────────────────────┤
│ Tree View                        │ Concept Detail                   │
│ ┌──────────────────────────────┐ │ ┌──────────────────────────────┐ │
│ │ ▼ 📁 Software Development    │ │ │ Preferred Label:             │ │
│ │   ▶ 📁 Frontend (12)         │ │ │ Machine Learning             │ │
│ │   ▼ 📁 Backend (8)           │ │ │                              │ │
│ │     • API Design (3) ★       │ │ │ Alt Labels:                  │ │
│ │     • Database (5)           │ │ │ [ML] [Statistical Learning]  │ │
│ │   ▶ 📁 DevOps (15)           │ │ │                              │ │
│ │                              │ │ │ Definition:                  │ │
│ │ ▶ 📁 Research (23)           │ │ │ A field of AI focused on...  │ │
│ │ ▶ 📁 Projects (42)           │ │ │                              │ │
│ │                              │ │ │ Broader: Artificial Intel... │ │
│ │                              │ │ │ Narrower: Deep Learning,... │ │
│ │                              │ │ │ Related: Data Science, St... │ │
│ │                              │ │ │                              │ │
│ │                              │ │ │ Used in 42 notes             │ │
│ │                              │ │ │ Last used: 2 hours ago       │ │
│ └──────────────────────────────┘ │ └──────────────────────────────┘ │
│                                  │ [Edit] [Delete] [Export]         │
└──────────────────────────────────┴──────────────────────────────────┘
```

### Key Interactions
- **Expand/Collapse**: Click chevron or use arrow keys
- **Select Concept**: Click name to view details
- **Drag & Drop**: Reorder concepts (future enhancement)
- **Search**: Live autocomplete with highlighted results
- **Context Menu**: Right-click for quick actions

---

## Feature 2: File Attachments Panel

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Note: Trip to San Francisco                                         │
├─────────────────────────────────────────────────────────────────────┤
│ [Content Editor]                                                    │
│                                                                     │
│ Attachments (3 files, 7.2 MB)                     [Grid] [List] ▼  │
│ ┌───────────────────┬───────────────────┬───────────────────┐      │
│ │ [📷 Golden Gate]  │ [📷 Cable Car]    │ [📄 Itinerary]    │      │
│ │                   │                   │                   │      │
│ │ IMG_1234.jpg      │ IMG_1235.jpg      │ trip-plan.pdf     │      │
│ │ 2.4 MB            │ 1.8 MB            │ 524 KB            │      │
│ │ 📍 37.8199°N      │ 📍 37.7946°N      │ No location       │      │
│ │ Jan 24, 10:30 AM  │ Jan 24, 2:15 PM   │ Jan 20, 9:00 AM   │      │
│ │ [View] [⋮]        │ [View] [⋮]        │ [View] [⋮]        │      │
│ └───────────────────┴───────────────────┴───────────────────┘      │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 📎 Drag files here or click to upload                           │ │
│ │    Images, PDFs, up to 100MB each                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

Click attachment to open preview modal:

┌─────────────────────────────────────────────────────────────────────┐
│ IMG_1234.jpg                                              [×]       │
├──────────────────────────────────┬──────────────────────────────────┤
│                                  │ Tabs: [File] [EXIF] [Location]   │
│                                  │                                  │
│                                  │ Camera: Apple iPhone 14 Pro      │
│         [   Image Preview   ]    │ Capture: Jan 24, 2026 10:30 AM   │
│         [   Zoom: 100%     ]    │ ISO: 100                          │
│         [   Pan enabled    ]    │ Aperture: f/1.78                  │
│                                  │ Shutter: 1/120s                   │
│                                  │                                  │
│                                  │ Location Tab:                    │
│ [←] [→] [Download] [Delete]      │ ┌──────────────────────────────┐ │
│                                  │ │      [Interactive Map]       │ │
│                                  │ │        📍 Marker here        │ │
│                                  │ └──────────────────────────────┘ │
│                                  │ 37.8199°N, 122.4783°W            │
│                                  │ Altitude: 15.5m                  │
│                                  │                                  │
│                                  │ [Search nearby memories]          │
└──────────────────────────────────┴──────────────────────────────────┘
```

### Key Interactions
- **Upload**: Drag files or click dropzone
- **Preview**: Click thumbnail to open full view
- **Navigate**: Arrow keys or prev/next buttons
- **Metadata**: Switch tabs for EXIF, location, device info
- **Map**: Interactive Leaflet map with marker

---

## Feature 3: Memory Search

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Memory Search                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Location Filter                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 San Francisco, CA                          [Use Current Loc] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                    [Interactive Map]                            │ │
│ │                       📍 Center                                 │ │
│ │                   ○ Search radius                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ Radius: [======◉=========] 1.5 km                                   │
│                                                                     │
│ Time Range Filter                                                   │
│ [Today] [This Week] [This Month] [This Year] [Custom ▼]            │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ |────────────[████████████]────────────────|                    │ │
│ │ Jan 1         Jan 15-20         Jan 31                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Additional Filters                                                  │
│ Device: [All Devices ▼]    Type: [Images ▼]    Sort: [Distance ▼] │
│                                                                     │
│ [Clear All]                                           [Search]     │
├─────────────────────────────────────────────────────────────────────┤
│ Results (42 memories found)         [List] [Grid] [Map] [Timeline] │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ┌───────┐ Weekend Trip to SF                                   │ │
│ │ │ [IMG] │ Amazing sunset at the pier...                         │ │
│ │ └───────┘ 📍 342m away • 📅 Jan 18, 3:45 PM • 📷 iPhone 14 Pro │ │
│ │           [View Note]                                           │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ┌───────┐ Golden Gate Bridge Visit                             │ │
│ │ │ [IMG] │ Beautiful view of the bridge...                      │ │
│ │ └───────┘ 📍 245m away • 📅 Jan 18, 10:30 AM • 📷 iPhone 14 Pro│ │
│ │           [View Note]                                           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                          [Load More Results]                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Interactions
- **Location**: Search address, click map, use current location
- **Radius**: Drag slider or enter value
- **Time Range**: Presets or scrub timeline handles
- **View Modes**: Switch between list, grid, map, timeline
- **Results**: Click to open note, hover for preview

---

## Feature 4: Knowledge Health Dashboard

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Knowledge Health Dashboard                           📊 Export ▼    │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐          │
│ │ Health Score│ Total Notes │ Concepts    │ Link Density│          │
│ │   ┌───┐     │             │             │             │          │
│ │   │ 62│     │   1,523     │    342      │    3.2      │          │
│ │   └───┘     │             │             │             │          │
│ │   Fair ↓    │  +42 (30d)  │  87% cover  │  95 unlink  │          │
│ └─────────────┴─────────────┴─────────────┴─────────────┘          │
│                                                                     │
│ Priority Actions                                                    │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 HIGH   42 Orphan Notes                                       │ │
│ │   Notes with no links or tags. Impact: High | Effort: Low      │ │
│ │   [Review Orphans]                                              │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 🟡 MEDIUM  18 Stale Notes                                       │ │
│ │   Not updated in 180+ days. Impact: Medium | Effort: Medium    │ │
│ │   [Review Stale Content]                                        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Metrics                                                             │
│ ┌──────────────────┬──────────────────┬──────────────────┐         │
│ │ Orphan Notes     │ Stale Notes      │ Tag Coverage     │         │
│ │      42          │      18          │      58%         │         │
│ │      (8%)        │      (3%)        │   ┌──────┐       │         │
│ │ [Chart: 30d]     │ [Histogram]      │   │ 58%  │       │         │
│ │                  │                  │   └──────┘       │         │
│ └──────────────────┴──────────────────┴──────────────────┘         │
│                                                                     │
│ Trends (Last 30 days)                         [7d] [30d] [90d] [1y]│
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Health Score                                                    │ │
│ │ 80│                                                             │ │
│ │   │                                         ╱                   │ │
│ │ 60│                            ╱───╲───────╱                    │ │
│ │   │                ╱───────────╱                                │ │
│ │ 40│ ───────────────╱                                            │ │
│ │   └───────────────────────────────────────────────────────────→ │ │
│ │     Jan 1      Jan 10      Jan 20      Jan 30                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Interactions
- **Overview Cards**: Click for detailed view
- **Priority Actions**: Click to execute workflow
- **Metrics**: Hover for tooltip, click for filtered list
- **Trends**: Drag to select date range, hover for values

---

## Feature 5: Version History

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Version History: Meeting Notes                            [×]       │
├──────────────────────────────┬──────────────────────────────────────┤
│ Timeline                     │ Content Viewer                       │
│ Track: [Both ▼] [Original]   │ Mode: [View] [Diff]                  │
│ ┌──────────────────────────┐ │                                      │
│ │ ● v3 (Current) ✓         │ │ Version 3 (Current)                  │
│ │   2 hours ago            │ │ Created: Jan 24, 3:45 PM             │
│ │   You                    │ │ Author: You                          │
│ │   "Updated action items" │ │                                      │
│ │   +12 -3 lines           │ │ ┌──────────────────────────────────┐ │
│ │   [View] [Compare] [⋮]   │ │ │ # Meeting: Sprint Planning       │ │
│ │                          │ │ │                                  │ │
│ │ │                        │ │ │ Date: Jan 24, 2026               │ │
│ │ │                        │ │ │                                  │ │
│ │ ○ v2                     │ │ │ ## Attendees                     │ │
│ │   5 hours ago            │ │ │ - Alice, Bob, Charlie            │ │
│ │   llama3.2 (AI)          │ │ │                                  │ │
│ │   "AI revision"          │ │ │ ## Accomplishments               │ │
│ │   +8 -2 lines            │ │ │ - Completed user auth            │ │
│ │   [View] [Compare] [⋮]   │ │ │ - Deployed staging env           │ │
│ │                          │ │ │                                  │ │
│ │ │                        │ │ │ ## Action Items                  │ │
│ │ │                        │ │ │ - [ ] Review PR #42              │ │
│ │ ○ v1                     │ │ │ - [ ] Update documentation       │ │
│ │   Yesterday              │ │ └──────────────────────────────────┘ │
│ │   You                    │ │                                      │
│ │   "Initial version"      │ │ [Restore Version] [Download]         │
│ │   +45 lines              │ │                                      │
│ │   [View] [Compare] [⋮]   │ │                                      │
│ └──────────────────────────┘ │                                      │
└──────────────────────────────┴──────────────────────────────────────┘

Diff Mode (Compare v2 → v3):

┌─────────────────────────────────────────────────────────────────────┐
│ Compare: [v2 ▼] ⇄ [v3 (Current) ▼]           [Side-by-Side] [Unified]│
├──────────────────────────────────────────────────────────────────────┤
│ Version 2                       │ Version 3                          │
│ ┌───────────────────────────────┼────────────────────────────────────┐
│ │ ## Action Items               │ ## Action Items                    │
│ │ - [ ] Review PR #42           │ - [ ] Review PR #42                │
│ │ - [ ] Setup CI pipeline     ━━│ - [ ] Update documentation     ━━ │ (Red/Green)
│ │                               │ - [ ] Setup staging alerts     ━━ │
│ └───────────────────────────────┴────────────────────────────────────┘
│ Changes: +2 lines added, -1 line removed            [← Prev] 1/3 [Next →]
└─────────────────────────────────────────────────────────────────────┘
```

### Key Interactions
- **Timeline Navigation**: Click version to view
- **Compare**: Select two versions to diff
- **Restore**: Confirm dialog, creates new version
- **View Modes**: Toggle between view and diff
- **Navigation**: Arrow keys or prev/next buttons

---

## Feature 6: Template Management

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Templates                                      [+ Create Template]  │
├─────────────────────────────────────────────────────────────────────┤
│ 🔍 Search templates...          Category: [All ▼]  Sort: [Recent ▼] │
│                                                                     │
│ ┌───────────────┬───────────────┬───────────────┬───────────────┐  │
│ │ 📄 Meeting    │ 💻 Code       │ 🧪 Experiment │ 📝 Project    │  │
│ │    Notes      │    Snippet    │    Log        │    Brief      │  │
│ │               │               │               │               │  │
│ │ Weekly team   │ Function      │ Research exp  │ Project init  │  │
│ │ standup notes │ template      │ documentation │ documentation │  │
│ │               │               │               │               │  │
│ │ {{5}} vars    │ {{3}} vars    │ {{7}} vars    │ {{4}} vars    │  │
│ │ 🔥 12 uses    │ 🔥 8 uses     │ 🔥 5 uses     │ 🔥 15 uses    │  │
│ │ Last: 2h ago  │ Last: 1d ago  │ Last: 3d ago  │ Last: 1h ago  │  │
│ │               │               │               │               │  │
│ │ [Use] [👁] [⋮] │ [Use] [👁] [⋮] │ [Use] [👁] [⋮] │ [Use] [👁] [⋮] │  │
│ └───────────────┴───────────────┴───────────────┴───────────────┘  │
│ ┌───────────────┬───────────────┬───────────────┬───────────────┐  │
│ │ [More templates...]                                             │  │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

Click "Use" to instantiate:

┌─────────────────────────────────────────────────────────────────────┐
│ Use Template: Weekly Standup                              [×]       │
├──────────────────────────────┬──────────────────────────────────────┤
│ Fill in variables:           │ Preview                              │
│                              │                                      │
│ Date:                        │ ┌──────────────────────────────────┐ │
│ [Jan 24, 2026____________] ← │ │ # Standup: Jan 24, 2026          │ │
│                              │ │                                  │ │
│ Team Name:                   │ │ ## Team: Engineering             │ │
│ [Engineering____________] ← │ │                                  │ │
│                              │ │ ### What we accomplished         │ │
│ Accomplishments:             │ │ - Completed API endpoints        │ │
│ [─────────────────────────] ← │ │ - Fixed authentication bug       │ │
│ [- Completed API endpoints ] │ │                                  │ │
│ [- Fixed auth bug          ] │ │ ### Blockers                     │ │
│                              │ │ - Need design approval           │ │
│ Blockers:                    │ │                                  │ │
│ [─────────────────────────] ← │ │ ### Next steps                   │ │
│ [- Need design approval    ] │ │ - Deploy to staging              │ │
│                              │ └──────────────────────────────────┘ │
│ Next Steps:                  │                                      │
│ [─────────────────────────] ← │ Tags: [standup] [meeting] [Q1-2026] │
│ [- Deploy to staging       ] │                                      │
│                              │                                      │
│ Additional Tags:             │                                      │
│ [Q1-2026_____________]       │                                      │
│                              │                                      │
│                              │                                      │
└──────────────────────────────┴──────────────────────────────────────┘
│                           [Cancel]  [Create Note]                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Interactions
- **Browse**: Grid view with search and filters
- **Preview**: Click eye icon to view full template
- **Use**: Fill variable form with live preview
- **Edit**: Modify template content and variables
- **Create**: Build new template from scratch

---

## Feature 7: Persistent Pop-Out Media Player

### Visual Layout — MINI Mode (Video)

```
┌──────────────────────────────────────┐
│ ≡  lecture-recording.mp4         [×] │  ← drag handle + close
├──────────────────────────────────────┤
│                                      │
│          [ Video Frame ]             │  ← 280×158px, click to play/pause
│          [ object-contain ]          │    double-click for fullscreen
│                                      │
├──────────────────────────────────────┤
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← seek bar with thumbnail preview
├──────────────────────────────────────┤
│ [▶] [⏪]  3:42 / 48:15  [⏩]  [🔊] [⛶]│  ← controls always visible
└──────────────────────────────────────┘
  280 × 210 px — snaps to viewport corners
```

### Visual Layout — EXPANDED Mode (Video)

```
┌────────────────────────────────────────────────────┐
│ ≡  lecture-recording.mp4                       [×] │
├────────────────────────────────────────────────────┤
│                                                    │
│                                                    │
│              [ Video Frame ]                       │
│              [ 480 × 346 px ]                      │
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤
│ █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├────────────────────────────────────────────────────┤
│ [▶] [⏪]  3:42 / 48:15  [⏩]       [🔊] [⊟] [⛶]  │
└────────────────────────────────────────────────────┘
  480 × 398 px — [⊟] = minimize back to MINI
```

### Architecture

```
App.tsx
├── MediaPlayerProvider          ← always mounted, holds session state
│   ├── HallOfMind              ← view switching happens here
│   │   └── (attachments use useMediaPlayerOptional to pop out)
│   └── PersistentPlayerOverlay ← always mounted, fixed position
│       └── MiniPlayer          ← floating, draggable, snaps to corners
```

### Key Interactions
- **Pop out**: Click PiP icon in video controls or audio player
- **Drag**: Pointer-drag on title bar; snap to nearest corner on release
- **Fullscreen**: Click expand in EXPANDED mode, or double-click video
- **Keyboard**: Alt+P play/pause, Alt+←/→ skip, Alt+M mute, Alt+Shift+E cycle size
- **Close**: X button, Alt+Shift+P, or Escape
- **Seek thumbnails**: Hover scrub bar for sprite sheet preview (all modes including fullscreen)

### State Machine

```
INACTIVE → MINI ↔ EXPANDED → FULLSCREEN
                               ↓
                        (Esc exits to EXPANDED)
```

---

## Navigation Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│ HotM - Hall of Mind                                      [👤] [⚙️]   │
├───────────────┬─────────────────────────────────────────────────────┤
│ Sidebar       │ Main Content Area                                   │
│               │                                                     │
│ 🏠 Dashboard   │                                                     │
│ 📝 Notes       │                                                     │
│ 🔍 Search      │           [Feature-specific content]               │
│ ✏️  Capture    │                                                     │
│               │                                                     │
│ FEATURES:     │                                                     │
│ 🗺️  Memory     │                                                     │
│     Search    │                                                     │
│ 🏷️  SKOS       │                                                     │
│     Concepts  │                                                     │
│ 📋 Templates  │                                                     │
│ 📎 Attachments│                                                     │
│               │                                                     │
│ 📁 Collections │                                                     │
│ 📊 Knowledge   │                                                     │
│     Health    │   ┌──────────────────────────────┐                  │
│ ⚙️  Settings   │   │  [Floating Mini Player]      │ ← persistent    │
│               │   │  snapped to corner           │    overlay       │
│               │   └──────────────────────────────┘                  │
└───────────────┴─────────────────────────────────────────────────────┘
```

---

## Responsive Breakpoints

### Desktop (> 1024px)
```
┌─────────┬──────────────────┐
│ Sidebar │   Main Content   │
│ (Fixed) │   (Flexible)     │
│  240px  │   Remaining      │
└─────────┴──────────────────┘
```

### Tablet (640-1024px)
```
┌──┬─────────────────────────┐
│S │   Main Content          │
│i │   (Full width)          │
│d │                         │
│e │   (Sidebar collapses    │
│b │    to overlay)          │
│a │                         │
│r │                         │
└──┴─────────────────────────┘
```

### Mobile (< 640px)
```
┌─────────────────────────────┐
│ ☰  HotM        [👤] [⚙️]     │
├─────────────────────────────┤
│                             │
│    Main Content             │
│    (Full screen)            │
│                             │
│  (Sidebar = Bottom nav)     │
│                             │
├─────────────────────────────┤
│ [🏠] [📝] [🔍] [📁] [⋯]      │
└─────────────────────────────┘
```

---

## Performance Targets

| Metric | Target | Critical Path |
|--------|--------|---------------|
| Initial Load | < 2s | 3G network |
| Feature Switch | < 100ms | Navigation |
| Search Results | < 500ms | API query |
| Map Render | < 500ms | 100 markers |
| Thumbnail Load | < 200ms | Per image |
| Diff Generation | < 1s | 10k lines |
| Template Instantiation | < 100ms | Variable substitution |

---

## Accessibility Summary

### Keyboard Shortcuts

| Feature | Shortcut | Action |
|---------|----------|--------|
| Global | `Ctrl+K` | Open command palette |
| Global | `Ctrl+/` | Toggle sidebar |
| SKOS | `Ctrl+F` | Focus search |
| SKOS | `←↑→↓` | Navigate tree |
| Memory | `Ctrl+L` | Focus location |
| Memory | `Ctrl+T` | Focus time range |
| Attachments | `Ctrl+U` | Open upload |
| History | `Ctrl+H` | Open history |
| History | `D` | Toggle diff mode |
| Templates | `Ctrl+N` | New from template |

### Screen Reader Announcements

- **SKOS**: "Expanded Software Development node. 3 child concepts."
- **Memory Search**: "42 memories found within 1.5 kilometers."
- **Attachments**: "Photo uploaded successfully. GPS location detected."
- **History**: "Version 3 selected. Current version. Created by you 2 hours ago."
- **Health**: "Health score: 62 out of 100. Status: Fair."
- **Templates**: "Template instantiated. Note created with title: Weekly Standup."

### Focus Management

All modals and overlays:
1. Trap focus within modal
2. Return focus to trigger element on close
3. First focusable element receives focus on open
4. ESC key closes modal

---

## Next Steps

1. **Prototype**: Build interactive Figma prototypes
2. **Component Library**: Extend Storybook with new components
3. **API Client**: Implement Fortemi endpoint methods
4. **User Testing**: Recruit 15 participants (5 per persona)
5. **Implementation**: Begin Phase 1 (Weeks 1-2)

For detailed specifications, see [fortemi-integration-ux-design.md](./fortemi-integration-ux-design.md)
