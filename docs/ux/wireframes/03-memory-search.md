# Memory Search - Wireframe Specification

**Version**: 1.0
**Last Updated**: 2026-02-04
**Component**: Memory Search (Spatiotemporal)
**Grid System**: 8px base unit

---

## Overview

Spatiotemporal search interface for finding notes by location (radius search), time range (date picker + timeline), and combined filters.

---

## Desktop Layout (>1024px)

### Main Search View - Split Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Memory Search                                                              [×] Close    │ 64px
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│ ┌─────────────────────────────┐ ┌─────────────────────────────────────────────────┐   │
│ │ Search Filters              │ │ Results (42 memories)    [List][Grid][Map][⋮]   │   │
│ │                             │ │                                                 │   │
│ │ 📍 Location                 │ │ ┌───────────────────────────────────────────┐   │   │
│ │ ─────────────────────────   │ │ │ [Thumbnail]  Note Title                   │   │   │
│ │                             │ │ │              First 200 characters of      │   │   │
│ │ ┌─────────────────────────┐ │ │ │              note content appear here...  │   │   │
│ │ │ 🔍 San Francisco        │ │ │ │                                          │   │   │
│ │ └─────────────────────────┘ │ │ │              📍 2.4 km  📅 Jan 24  📱 iOS │   │   │
│ │                             │ │ └───────────────────────────────────────────┘   │   │
│ │ ┌─────────────────────────┐ │ │                                                 │   │
│ │ │                         │ │ │ ┌───────────────────────────────────────────┐   │   │
│ │ │    [MAP WITH CIRCLE]    │ │ │ │ [Thumbnail]  Another Note                 │   │   │
│ │ │         📍 Marker       │ │ │ │              Content preview...           │   │   │
│ │ │                         │ │ │ │                                          │   │   │
│ │ └─────────────────────────┘ │ │ │              📍 5.1 km  📅 Jan 22        │   │   │
│ │        200px height         │ │ └───────────────────────────────────────────┘   │   │
│ │                             │ │                                                 │   │
│ │ Radius: 5.0 km              │ │ ┌───────────────────────────────────────────┐   │   │
│ │ ├───────●─────────┤         │ │ │ [Thumbnail]  Third Note                   │   │   │
│ │ 100m         50km           │ │ │              More content...              │   │   │
│ │                             │ │ │                                          │   │   │
│ │ 🕐 Time Range               │ │ │              📍 1.2 km  📅 Jan 20        │   │   │
│ │ ─────────────────────────   │ │ └───────────────────────────────────────────┘   │   │
│ │                             │ │                                                 │   │
│ │ [Today] [Week] [Month]      │ │                     ... more results ...        │   │
│ │                             │ │                                                 │   │
│ │ Start: [Jan 1, 2026    ▼]   │ │ ┌───────────────────────────────────────────┐   │   │
│ │                             │ │ │ [Load More Results]                       │   │   │
│ │ End:   [Jan 31, 2026   ▼]   │ │ └───────────────────────────────────────────┘   │   │
│ │                             │ │                                                 │   │
│ │ ┌─────────────────────────┐ │ └─────────────────────────────────────────────────┘   │
│ │ │ ●─────────────────────● │ │                      600px+ width                    │
│ │ │ Jan 1          Jan 31   │ │                                                      │
│ │ └─────────────────────────┘ │                                                      │
│ │     Timeline Scrubber       │                                                      │
│ │                             │                                                      │
│ │ 🔍 Additional Filters       │                                                      │
│ │ ─────────────────────────   │                                                      │
│ │                             │                                                      │
│ │ Device: [All Devices   ▼]   │                                                      │
│ │                             │                                                      │
│ │ Type:   [All Types     ▼]   │                                                      │
│ │                             │                                                      │
│ │ Sort:   [Distance      ▼]   │                                                      │
│ │                             │                                                      │
│ │ ┌─────────────────────────┐ │                                                      │
│ │ │ [Search]                │ │                                                      │
│ │ └─────────────────────────┘ │                                                      │
│ │                             │                                                      │
│ │ [Clear All Filters]         │                                                      │
│ │                             │                                                      │
│ └─────────────────────────────┘                                                      │
│          350px width                                                                  │
│                                                                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Filter panel: 350px width (left)
- Results panel: Flex-grow (right), min 600px
- Header: 64px height
- Section header: 32px height
- Search input: 48px height
- Map preview: 200px height
- Radius slider: 40px height
- Date picker: 48px height each
- Timeline scrubber: 60px height
- Filter dropdown: 48px height
- Search button: 56px height
- Result card: 120px height
- Gap between sections: 24px
- Gap between results: 16px
- Horizontal padding: 16px

---

### Result Card (List View)

```
┌───────────────────────────────────────────────────────────────┐
│ ┌──────┐  Memory from Golden Gate Park                        │ 120px
│ │      │  ───────────────────────────────────────────         │ height
│ │ IMG  │                                                       │
│ │      │  I visited the Japanese Tea Garden today and took    │
│ │ 100px│  some beautiful photos of the cherry blossoms. The   │
│ │  ×   │  weather was perfect...                              │
│ │ 100px│                                                       │
│ │      │  📍 2.4 km away   📅 Jan 24, 2026   📱 iPhone 15     │ 32px
│ │      │                                                       │
│ └──────┘  [View Note →]                                        │ 40px
│                                                                │
└───────────────────────────────────────────────────────────────┘
  ├─ 116px ─┼────────────────── 500px+ ───────────────────────┤
  Thumbnail   Content area
```

**Dimensions**:
- Card height: 120px
- Thumbnail: 100px × 100px (left)
- Content padding: 16px
- Title: 20px height, 16px font, bold
- Snippet: 3 lines max, 14px font
- Metadata bar: 32px height
- Badge: 24px height, icon + text
- Gap between badges: 8px
- Action button: 32px height
- Card border-radius: 8px

---

### Map View

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Map View                                              [List] [Grid] [Map]│ 56px
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │                                                                 │   │
│ │                        [INTERACTIVE MAP]                        │   │
│ │                                                                 │   │
│ │     📍 (4)                                    [+] Zoom In       │   │
│ │                                              [-] Zoom Out       │   │
│ │                      📍                      [⊙] My Location    │   │
│ │                                                                 │   │
│ │                                                                 │   │
│ │                 📍 (2)           📍 (3)                         │   │
│ │                                                                 │   │
│ │                                                                 │   │
│ │                           📍                                    │   │
│ │                                                                 │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                           600px+ height                               │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ Selected: Memory from Golden Gate Park                          │   │ 200px
│ │ ───────────────────────────────────────────────────────         │   │ sidebar
│ │                                                                 │   │
│ │ [Thumbnail]  I visited the Japanese Tea Garden today...        │   │
│ │                                                                 │   │
│ │ 📍 2.4 km away   📅 Jan 24, 2026                               │   │
│ │                                                                 │   │
│ │ [View Note]                                                     │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Map height: 600px+ (fills available space)
- Marker size: 32px × 32px
- Cluster badge: 40px × 40px
- Map controls: 40px × 40px buttons
- Controls spacing: 8px gap
- Selected card sidebar: 200px height (bottom/right)
- Sidebar padding: 16px

---

### Timeline View

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Timeline View                                        [List] [Grid] [Map] │ 56px
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │         Jan 1                Jan 15                 Jan 31      │   │ 80px
│ │         ●───────────────────────●───────────────────────●       │   │ timeline
│ │         │                       │                       │       │   │
│ │        [3]                     [8]                     [5]      │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │ 16px gap
│ │ January 24, 2026 (5 memories)                                   │   │ 40px
│ ├─────────────────────────────────────────────────────────────────┤   │
│ │                                                                 │   │
│ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                            │   │
│ │ │IMG │ │IMG │ │IMG │ │IMG │ │PDF │                            │   │ 120px
│ │ │    │ │    │ │    │ │    │ │    │                            │   │
│ │ └────┘ └────┘ └────┘ └────┘ └────┘                            │   │
│ │  100px  100px  100px  100px  100px                              │   │
│ │                                                                 │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │ 16px gap
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ January 22, 2026 (3 memories)                                   │   │ 40px
│ ├─────────────────────────────────────────────────────────────────┤   │
│ │                                                                 │   │
│ │ ┌────┐ ┌────┐ ┌────┐                                           │   │
│ │ │IMG │ │IMG │ │IMG │                                           │   │ 120px
│ │ └────┘ └────┘ └────┘                                           │   │
│ │                                                                 │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Timeline bar: 80px height
- Date marker: 32px diameter
- Count badge: 28px height
- Date group header: 40px height
- Thumbnail: 100px × 100px
- Gap between thumbnails: 16px
- Gap between date groups: 16px
- Horizontal scroll for thumbnails if needed

---

## Tablet Layout (640-1024px)

### Stacked Layout

```
┌─────────────────────────────────────────────────────┐
│ Memory Search                         [×] Close     │ 64px
├─────────────────────────────────────────────────────┤
│                                                     │
│ ▼ Filters                                           │ 48px
│ ───────────────────────────────────────────────     │
│                                                     │
│ 📍 Location: San Francisco         [Edit]          │ 48px
│ 🕐 Time: Jan 1 - Jan 31, 2026      [Edit]          │ 48px
│ 🔍 Sort: Distance                  [Edit]          │ 48px
│                                                     │
│ [Search]                            [Clear]         │ 56px
│                                                     │
├─────────────────────────────────────────────────────┤ 16px gap
│                                                     │
│ Results (42 memories)           [List][Grid][Map]   │ 48px
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ [IMG]  Note Title                           │   │ 120px
│ │        Content preview...                   │   │
│ │        📍 2.4 km  📅 Jan 24                 │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ [IMG]  Another Note                         │   │ 120px
│ │        Content preview...                   │   │
│ │        📍 5.1 km  📅 Jan 22                 │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Dimensions**:
- Filters: Collapsible accordion (48px header)
- Filter rows: 48px height (compact)
- Result cards: 120px height (same as desktop)
- Horizontal padding: 16px
- Gap between sections: 16px

---

## Mobile Layout (<640px)

### Mobile Search View

```
┌────────────────────────────────────────┐
│ ← Memory Search            [⋮] Menu    │ 64px
├────────────────────────────────────────┤
│                                        │
│ ▼ Filters                              │ 56px
│ ──────────────────────────────────     │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ 📍 Location                        ││ 56px
│ │    San Francisco            [Edit] ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ 🕐 Time Range                      ││ 56px
│ │    Jan 1 - Jan 31           [Edit] ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ 🔍 Sort by Distance            ▼   ││ 56px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ ┌────────────────────────────────────┐│
│ │ [Search (42)]                      ││ 64px
│ └────────────────────────────────────┘│ button
│                                        │
├────────────────────────────────────────┤ 16px gap
│                                        │
│ 42 memories    [List] [Grid] [Map]     │ 56px
│                                        │
│ ┌────────────────────────────────────┐│
│ │ ┌────┐  Note Title                ││ 100px
│ │ │IMG │  Content preview...        ││
│ │ │    │  📍 2.4 km  📅 Jan 24      ││
│ │ └────┘  >                         ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ ┌────┐  Another Note              ││ 100px
│ │ │IMG │  Content preview...        ││
│ │ │    │  📍 5.1 km  📅 Jan 22      ││
│ │ └────┘  >                         ││
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
- Filter accordion: 56px header
- Filter item: 56px height (touch-friendly)
- Search button: 64px height
- Result card: 100px height (compact)
- Thumbnail: 80px × 80px
- Gap between cards: 8px
- Horizontal padding: 16px
- Load more button: 64px height

---

### Mobile Location Picker (Full-Screen)

```
┌────────────────────────────────────────┐
│ ← Back              Location      Done │ 64px
├────────────────────────────────────────┤
│                                        │
│ ┌────────────────────────────────────┐│
│ │ 🔍 Search places...                ││ 56px
│ └────────────────────────────────────┘│
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [⊙] Use Current Location           ││ 56px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ ┌────────────────────────────────────┐│
│ │                                    ││
│ │                                    ││
│ │      [INTERACTIVE MAP]             ││ Full
│ │       Tap to select                ││ height
│ │           📍                        ││
│ │       Search radius                ││
│ │         (circle)                   ││
│ │                                    ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │
│ ═══════════════════════════════════    │ 24px
│                                        │ handle
│ Radius: 5.0 km                         │ 32px
│ ├─────────●──────────────────┤         │ 48px
│ 100m                     50km          │ slider
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [Apply Location]                   ││ 64px
│ └────────────────────────────────────┘│ button
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Full-screen modal
- Header: 64px height
- Search bar: 56px height
- Current location button: 56px height
- Map: Flexible height (fills space)
- Bottom sheet handle: 24px
- Radius label: 32px height
- Slider: 48px height (touch-friendly)
- Apply button: 64px height
- Horizontal padding: 16px

---

### Mobile Time Range Picker

```
┌────────────────────────────────────────┐
│ ← Back              Time Range    Done │ 64px
├────────────────────────────────────────┤
│                                        │
│ Quick Ranges                           │ 32px
│ ────────────────────────────────────   │
│                                        │
│ [Today] [This Week] [This Month]       │ 48px
│                                        │
│ [This Year] [All Time]                 │ 48px
│                                        │ 16px gap
│ Custom Range                           │ 32px
│ ────────────────────────────────────   │
│                                        │
│ Start Date                             │ 24px
│ ┌────────────────────────────────────┐│
│ │ Jan 1, 2026                    📅  ││ 56px
│ └────────────────────────────────────┘│
│                                        │ 16px gap
│ End Date                               │ 24px
│ ┌────────────────────────────────────┐│
│ │ Jan 31, 2026                   📅  ││ 56px
│ └────────────────────────────────────┘│
│                                        │ 24px gap
│ ┌────────────────────────────────────┐│
│ │                                    ││
│ │    [CALENDAR PICKER]               ││ 300px
│ │     Jan 2026                       ││
│ │                                    ││
│ │  S  M  T  W  T  F  S               ││
│ │           1  2  3  4               ││
│ │  5  6  7  8  9 10 11               ││
│ │ 12 13 14 15 16 17 18               ││
│ │ 19 20 21 22 23 24 25               ││
│ │ 26 27 28 29 30 31                  ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [Apply Time Range]                 ││ 64px
│ └────────────────────────────────────┘│
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Quick range buttons: 48px height, 8px gap
- Label: 24px height
- Date input: 56px height
- Calendar: 300px height
- Apply button: 64px height
- Horizontal padding: 16px
- Section gap: 16px

---

### Mobile Map View (Full-Screen)

```
┌────────────────────────────────────────┐
│ ← Back              Map View      [⋮]  │ 64px
├────────────────────────────────────────┤
│                                        │
│                                        │
│                                        │
│       [INTERACTIVE MAP]                │ Full
│           📍 📍 📍                      │ screen
│                                        │ minus
│       📍         📍                     │ header
│                                        │
│           📍                           │
│                                        │
│                                        │
│                                        │
│ [+] [-] [⊙]                            │ 48px
│                                        │ controls
├────────────────────────────────────────┤
│ ═══                                    │ 24px
│                                        │ handle
│ Memory from Golden Gate Park           │ 48px
│ ──────────────────────────────────     │
│                                        │
│ [Thumbnail] Content preview...         │ 120px
│                                        │
│ 📍 2.4 km  📅 Jan 24                   │ 32px
│                                        │
│ [View Note]                            │ 56px
│                                        │
└────────────────────────────────────────┘
  Bottom sheet (swipeable)
  Snap points: 25%, 50%, 90%
```

**Dimensions**:
- Full viewport
- Header: 64px height
- Map controls: 48px × 48px buttons
- Bottom sheet handle: 24px height
- Selected card title: 48px height
- Card content: 120px height
- Metadata: 32px height
- Button: 56px height
- Sheet padding: 16px

---

## Component States

### Location Search (Autocomplete)

```
┌─────────────────────────────────────────────────────┐
│ 🔍 san fr                                        [×]│ 48px
├─────────────────────────────────────────────────────┤
│ 📍 San Francisco, CA                                │ 56px
│    City                                             │
├─────────────────────────────────────────────────────┤
│ 📍 San Francisco International Airport (SFO)        │ 56px
│    Airport                                          │
├─────────────────────────────────────────────────────┤
│ 📍 San Francisco Bay                                │ 56px
│    Bay                                              │
├─────────────────────────────────────────────────────┤
│ 📍 San Francisco Zoo                                │ 56px
│    Zoo                                              │
└─────────────────────────────────────────────────────┘
  Dropdown max-height: 320px
  Result item: 56px height
  Debounce: 300ms
```

### Radius Slider

```
Default:
├──────────────────────●──────────────────┤
100m            5.0 km              50km
      Radius: 5.0 km

Focus:
├══════════════════════●══════════════════┤
               ↓
         ┌──────────┐
         │ 5.0 km   │ Tooltip
         └──────────┘

Sizes:
- Track height: 4px
- Thumb size: 20px diameter
- Track color: #e5e7eb
- Active track: #3b82f6
- Thumb color: #3b82f6
- Focus ring: 2px, rgba(59, 130, 246, 0.3)
```

### Map Marker States

**Default Marker**:
```
   📍
  Size: 32px
  Color: #3b82f6
  Drop shadow: 0 2px 4px rgba(0,0,0,0.2)
```

**Cluster Marker**:
```
  ┌────┐
  │ 5  │  Size: 40px diameter
  └────┘  Background: #3b82f6
          Text: White, 14px bold
          Border: 3px white
          Shadow: 0 2px 6px rgba(0,0,0,0.3)
```

**Selected Marker**:
```
   📍
  Size: 40px (scaled up)
  Pulse animation
  Z-index elevated
```

### Timeline Scrubber

```
  Start Handle         End Handle
       │                  │
       ▼                  ▼
  ┌────●══════════════════●────┐
  │    Jan 1         Jan 31    │
  └───────────────────────────┘
      Selected Range (blue)

  Handle size: 16px diameter
  Track height: 4px
  Selected track: 8px height, #3b82f6
  Unselected track: 4px height, #e5e7eb
```

---

## Filter Chips (Active Filters)

```
┌─────────────────────────────────────────────────────────┐
│ Active Filters:                                         │ 32px
│                                                         │
│ [📍 San Francisco (5km) ×] [🕐 Jan 1-31 ×] [📱 iOS ×]  │ 40px
│                                                         │
│ [Clear All]                                             │ 32px
└─────────────────────────────────────────────────────────┘
  Chip height: 32px
  Padding: 8px 12px
  Border-radius: 16px
  Background: rgba(59, 130, 246, 0.1)
  Border: 1px solid #3b82f6
  Close icon: 16px
```

---

## Empty States

### No Location Permission

```
┌─────────────────────────────────────┐
│                                     │
│            🗺️                        │ 64px icon
│                                     │
│    Location Access Needed           │ 24px
│                                     │
│    To search by location, grant     │ 16px
│    location permission in your      │
│    browser settings.                │
│                                     │
│    [Enable Location]                │ 48px button
│                                     │
│    or                               │ 16px
│                                     │
│    [Enter Location Manually]        │ 48px button
│                                     │
└─────────────────────────────────────┘
  Centered vertically
  Max-width: 400px
```

### No Results

```
┌─────────────────────────────────────┐
│                                     │
│            🔍                        │ 64px icon
│                                     │
│    No Memories Found                │ 24px
│                                     │
│    Try expanding your search        │ 16px
│    radius or date range.            │
│                                     │
│    Current filters:                 │ 14px
│    • Location: 5km radius           │ 14px
│    • Time: Jan 2026                 │ 14px
│                                     │
│    [Expand Radius]  [Clear Filters] │ 48px
│                                     │
└─────────────────────────────────────┘
```

---

## Accessibility Specifications

### ARIA Attributes

**Location Picker**:
```html
<div role="combobox" aria-expanded="false" aria-haspopup="listbox">
  <input
    type="text"
    aria-autocomplete="list"
    aria-controls="location-results"
    aria-label="Search for location"
  />
</div>
```

**Map**:
```html
<div
  role="application"
  aria-label="Interactive map showing 42 memory locations"
>
```

**Radius Slider**:
```html
<input
  type="range"
  role="slider"
  aria-valuemin="100"
  aria-valuemax="50000"
  aria-valuenow="5000"
  aria-valuetext="5 kilometers"
  aria-label="Search radius"
/>
```

**Timeline Scrubber**:
```html
<div role="slider" aria-label="Date range selection">
  <input
    aria-label="Start date"
    aria-valuetext="January 1st, 2026"
  />
  <input
    aria-label="End date"
    aria-valuetext="January 31st, 2026"
  />
</div>
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between filters and results |
| Enter | Apply search, open result |
| Space | Open date picker, select result |
| Arrow Keys | Navigate map, adjust sliders |
| +/- | Zoom map in/out |
| Home | Jump to first result |
| End | Jump to last result |
| Escape | Close modal, clear search |
| Ctrl+F | Focus location search |

### Screen Reader Announcements

```
"42 memories found within 5 kilometers of San Francisco
 between January 1st and January 31st, 2026"

"Distance filter changed to 10 kilometers.
 Search results will update."

"Map marker selected: Memory from Golden Gate Park,
 2.4 kilometers away, January 24th"

"Loading more results... 12 additional memories loaded"
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | <640px | Full-screen, stacked, bottom sheets |
| Tablet | 640-1024px | Collapsible filters, stacked results |
| Desktop | >1024px | Side-by-side, fixed filter panel |
| Large | >1440px | Wider results, more columns in grid |

---

## Animation Specifications

### Map Zoom

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

### Result Card Entry

```css
/* Stagger animation on load */
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

### Filter Accordion

```css
transition: max-height 300ms ease-out;

/* Collapsed */
max-height: 0;
overflow: hidden;

/* Expanded */
max-height: 500px;
```

### Bottom Sheet (Mobile)

```css
/* Swipe gesture */
transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);

/* Snap points */
transform: translateY(0%);    /* 90% expanded */
transform: translateY(50%);   /* 50% peek */
transform: translateY(75%);   /* 25% preview */
```

---

## Color Specifications

```css
/* Primary (Location/Active) */
--color-location: #3b82f6;
--color-location-light: rgba(59, 130, 246, 0.1);

/* Time Range */
--color-time: #8b5cf6;
--color-time-light: rgba(139, 92, 246, 0.1);

/* Distance Badge */
--color-distance: #10b981;

/* Map Elements */
--color-marker: #3b82f6;
--color-cluster: #2563eb;
--color-radius-circle: rgba(59, 130, 246, 0.2);
--color-radius-border: #3b82f6;

/* Results */
--color-result-bg: #ffffff;
--color-result-border: #e5e7eb;
--color-result-hover: #f9fafb;
```

---

## Typography

```css
/* Result Title */
--font-result-title: 16px / 24px, font-weight: 600;

/* Result Snippet */
--font-result-snippet: 14px / 20px, font-weight: 400;

/* Metadata Badges */
--font-badge: 12px / 16px, font-weight: 500;

/* Filter Labels */
--font-filter-label: 14px / 20px, font-weight: 500;

/* Map Labels */
--font-map-label: 12px / 16px, font-weight: 600;
```

---

## Performance Considerations

1. **Map Rendering**: Use WebGL for >500 markers
2. **Clustering**: Dynamic clustering for zoom levels
3. **Debouncing**: 500ms for radius/location changes
4. **Pagination**: 50 results per page, infinite scroll
5. **Thumbnail Lazy Load**: Load on scroll (IntersectionObserver)
6. **Geocoding Cache**: Cache location lookups in localStorage
7. **Map Tile Cache**: Browser caches map tiles automatically
8. **Virtual Scrolling**: For timeline with >1000 results

---

## Implementation Notes

1. **Map Library**: Leaflet.js (lightweight, 39KB gzipped)
2. **Geocoding**: Nominatim (OpenStreetMap) or Mapbox
3. **Date Picker**: React DatePicker or Radix UI Calendar
4. **Slider**: Radix UI Slider component
5. **Distance Calculation**: Haversine formula (API-side)
6. **Time Zones**: Display in user's local time, store UTC
7. **Offline Mode**: Cache recent searches and results

---

## Related Specifications

- [UX Design Document](../fortemi-integration-ux-design.md)
- [Memory Search API](https://git.integrolabs.net/Fortemi/fortemi/src/branch/main/docs/content/api.md#memory-search)
- [File Attachments Wireframe](./02-file-attachments-panel.md) (GPS integration)
