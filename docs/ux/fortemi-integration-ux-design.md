# HotM Fortemi Integration: UX Design Document

**Version**: 1.0
**Date**: 2026-02-04
**Status**: Design Review
**Design Team**: Product Design

---

## Executive Summary

This document provides comprehensive UX design specifications for integrating six major Fortemi API features into the HotM React SPA. Each feature has been designed following user-centered methodologies with a focus on accessibility (WCAG 2.1 AA compliance), mobile responsiveness, and consistency with HotM's existing design system (Radix UI + TailwindCSS).

### Features Covered

1. **SKOS Concept Browser** - Hierarchical taxonomy management
2. **File Attachments Panel** - Rich media with EXIF and location
3. **Memory Search** - Spatiotemporal exploration
4. **Knowledge Health Dashboard** - System quality metrics
5. **Version History** - Temporal navigation and diff viewing
6. **Template Management** - Content scaffolding

---

## Design System Foundation

### Current Tech Stack
- **UI Framework**: React 19 + TypeScript
- **Component Library**: Radix UI primitives
- **Styling**: TailwindCSS 3.x
- **Icons**: Lucide React
- **Layout**: Sidebar pattern with collapsible navigation
- **State Management**: React hooks + Context API

### Design Principles
1. **Progressive Disclosure**: Complex features revealed gradually
2. **Spatial Consistency**: Related features grouped logically
3. **Feedback Clarity**: System state always visible
4. **Graceful Degradation**: Features work without AI/network
5. **Accessibility First**: Keyboard navigation, ARIA labels, screen reader support

### Color Palette (Existing)
- **Primary**: Blue shades (links, actions)
- **Success**: Green (confirmations, health)
- **Warning**: Yellow/Orange (attention needed)
- **Error**: Red (problems, failures)
- **Neutral**: Gray scale (text, borders, backgrounds)

---

## User Personas

### Primary Personas

#### 1. **Research Rachel**
- **Role**: Academic researcher
- **Goals**: Organize literature, track citations, maintain controlled vocabularies
- **Pain Points**: Inconsistent tagging, hard to find related work, no citation provenance
- **Key Features**: SKOS Browser, Knowledge Health, Version History

#### 2. **Creative Chris**
- **Role**: Content creator / journalist
- **Goals**: Capture ideas with photos, recall context by location/time
- **Pain Points**: Lost context for old photos, can't remember "when I was at..."
- **Key Features**: File Attachments, Memory Search

#### 3. **Manager Morgan**
- **Role**: Project manager
- **Goals**: Maintain project documentation, use templates for consistency
- **Pain Points**: Repetitive document creation, outdated information
- **Key Features**: Template Management, Knowledge Health

#### 4. **Developer Devon**
- **Role**: Software engineer
- **Goals**: Track code snippets, document APIs, maintain changelogs
- **Pain Points**: Version confusion, need to compare changes
- **Key Features**: Version History, SKOS Browser (for API concepts)

---

## Feature 1: SKOS Concept Browser

### Overview
A hierarchical tree interface for managing W3C SKOS controlled vocabularies with drag-and-drop, search, and inline editing.

### User Stories
- **US-1.1**: As Research Rachel, I want to browse concept schemes so I can understand the taxonomy structure
- **US-1.2**: As Research Rachel, I want to search concepts by label so I can find terms quickly
- **US-1.3**: As Research Rachel, I want to tag notes with concepts so they're properly classified
- **US-1.4**: As Manager Morgan, I want to create new concepts so I can expand the vocabulary
- **US-1.5**: As Developer Devon, I want to see concept relationships so I understand semantic connections

### Information Architecture

```
SKOS Concept Browser (Panel/Sidebar)
├── Scheme Selector (Dropdown)
│   ├── Active Schemes List
│   ├── Recently Used
│   └── Create New Scheme
├── Search Bar (Autocomplete)
│   ├── Search by preferred label
│   ├── Search by alternate labels
│   └── Search by definition
├── Tree View (Collapsible Hierarchy)
│   ├── Top Concepts (Root nodes)
│   ├── Broader/Narrower Relationships
│   ├── Related Concepts (Dashed links)
│   └── Usage Counts (Badges)
├── Concept Detail Pane
│   ├── Preferred Label (Editable)
│   ├── Alternate Labels (Tag list)
│   ├── Definition (Textarea)
│   ├── Notation (Code)
│   ├── Relationships (Linked list)
│   │   ├── Broader (Parents)
│   │   ├── Narrower (Children)
│   │   └── Related (Siblings)
│   └── Usage Statistics
│       ├── Notes using this concept
│       └── Last used timestamp
└── Actions Toolbar
    ├── Add Concept (+)
    ├── Edit Concept (Pencil)
    ├── Delete Concept (Trash)
    └── Export Scheme (Download)
```

### Key User Flows

#### Flow 1.1: Browse Concept Hierarchy
1. User opens SKOS Browser from sidebar
2. System displays scheme selector with default scheme selected
3. User expands tree nodes using chevron icons
4. System reveals children with 300ms animation
5. User clicks on concept
6. System displays concept details in right pane
7. User can see related concepts as clickable links

#### Flow 1.2: Search and Apply Concept to Note
1. User viewing a note, clicks "Add Concept" button
2. System opens SKOS Browser modal
3. User types in search bar
4. System shows autocomplete results (live, debounced 300ms)
5. User selects concept from results
6. System highlights concept in tree, shows full details
7. User clicks "Apply to Note" button
8. System adds concept tag to note, closes modal
9. Note view shows new concept badge with scheme indicator

#### Flow 1.3: Create New Concept
1. User clicks "+" button in SKOS Browser
2. System shows "New Concept" form modal
3. User enters:
   - Preferred label (required)
   - Alternate labels (optional, comma-separated)
   - Definition (optional)
   - Parent concept (optional, autocomplete)
4. User clicks "Create"
5. System validates, creates concept via API
6. Tree view auto-expands to show new concept
7. System shows success toast

### UI Components

#### Tree Node Component
```typescript
interface ConceptNode {
  id: string
  prefLabel: string
  altLabels: string[]
  narrower: string[] // IDs of child concepts
  broader: string[] // IDs of parent concepts
  related: string[] // IDs of related concepts
  usageCount: number
  depth: number
}

<TreeNode>
  <ChevronIcon /> // Expandable if narrower.length > 0
  <FolderIcon color={schemeColor} />
  <Label>{prefLabel}</Label>
  <Badge>{usageCount}</Badge> // Only if > 0
  <ContextMenu>
    <MenuItem>Add Child</MenuItem>
    <MenuItem>Add Related</MenuItem>
    <MenuItem>Edit</MenuItem>
    <MenuItem>Delete</MenuItem>
  </ContextMenu>
</TreeNode>
```

#### Concept Detail Panel
- **Layout**: Fixed right panel (400px desktop, full-width mobile)
- **Sections**: Collapsible accordions
- **Edit Mode**: Inline editing with "Save" / "Cancel" buttons
- **Relationships**: Chip list with "X" to remove, "+" to add

### Accessibility Considerations

#### Keyboard Navigation
- **Tab**: Navigate between search, tree, detail pane
- **Arrow Keys**: Navigate tree (Up/Down/Left/Right)
- **Enter**: Expand/collapse node or select
- **Space**: Toggle selection
- **Escape**: Close modals, cancel edit mode
- **Ctrl+F**: Focus search bar

#### Screen Reader Support
- **Tree Role**: `<div role="tree">`
- **TreeItem Role**: `<div role="treeitem" aria-expanded="true/false">`
- **Labels**: All buttons have aria-label
- **Live Regions**: Search results use aria-live="polite"
- **Hierarchy**: aria-level indicates depth

#### Visual Accessibility
- **Contrast**: All text meets WCAG AA (4.5:1)
- **Focus Indicators**: 2px blue outline on focus
- **Color Independence**: Icons supplement color coding
- **Text Size**: Minimum 14px for body text

### Mobile Responsive Design

#### Breakpoints
- **Mobile (< 640px)**: Full-screen modal, vertical stack
- **Tablet (640-1024px)**: Side sheet (70% width)
- **Desktop (> 1024px)**: Side panel (fixed 400px)

#### Mobile Adaptations
- Tree nodes have larger touch targets (44px minimum)
- Search bar becomes sticky at top
- Detail pane overlays tree (back button to return)
- Swipe gestures for expand/collapse

### Error States
- **No Schemes**: Empty state with "Create Scheme" CTA
- **No Concepts**: Empty state with "Add First Concept" CTA
- **Search No Results**: "No concepts found. Try different terms."
- **Delete Conflict**: "Cannot delete concept in use by N notes. Remove tags first."
- **Network Error**: Retry button with offline indicator

---

## Feature 2: File Attachments Panel

### Overview
Upload, preview, and manage file attachments with rich metadata (EXIF, location, device info). Supports images, PDFs, documents with inline preview.

### User Stories
- **US-2.1**: As Creative Chris, I want to attach photos to notes so I can remember visual context
- **US-2.2**: As Creative Chris, I want to see photo locations on a map so I can recall where I was
- **US-2.3**: As Research Rachel, I want to attach PDFs to notes so I can link research papers
- **US-2.4**: As Creative Chris, I want to see camera EXIF data so I know photo details
- **US-2.5**: As Developer Devon, I want to attach code files so I can preserve examples

### Information Architecture

```
Attachments Panel (Note Detail Section)
├── Upload Area (Drag & Drop)
│   ├── Click to Upload Button
│   ├── Drag Overlay (Visual feedback)
│   └── Progress Indicators
├── Attachments List
│   ├── Thumbnail View (Grid, 2-4 columns)
│   │   ├── Preview Thumbnail
│   │   ├── Filename
│   │   ├── File Size
│   │   ├── Upload Date
│   │   └── Actions Menu (⋮)
│   └── List View (Compact)
│       ├── Icon (File type)
│       ├── Filename + Extension
│       ├── Size + Date
│       └── Actions (Download, Delete)
├── Preview Modal
│   ├── Full-Size Preview
│   │   ├── Image Viewer (Zoom, Pan)
│   │   ├── PDF Viewer (Page navigation)
│   │   └── Document Preview (Monaco editor for code)
│   ├── Metadata Sidebar
│   │   ├── File Info Tab
│   │   │   ├── Filename
│   │   │   ├── Size
│   │   │   ├── Type (MIME)
│   │   │   └── Upload Date
│   │   ├── EXIF Tab (Images only)
│   │   │   ├── Camera Make/Model
│   │   │   ├── Capture DateTime
│   │   │   ├── Settings (ISO, Aperture, Shutter)
│   │   │   └── Dimensions
│   │   ├── Location Tab (If GPS data)
│   │   │   ├── Map Preview (Leaflet/Mapbox)
│   │   │   ├── Coordinates (Lat/Lon)
│   │   │   ├── Altitude
│   │   │   └── Accuracy
│   │   └── Device Tab (Provenance)
│   │       ├── Device Name
│   │       ├── OS + Version
│   │       └── Software Info
│   └── Actions
│       ├── Download Button
│       ├── Delete Button (Confirm)
│       └── Close Button
└── Map View (Optional Tab)
    ├── Interactive Map (All attachments with GPS)
    ├── Clustered Markers
    ├── Thumbnail Popups
    └── Date Filter (Timeline)
```

### Key User Flows

#### Flow 2.1: Upload Attachment
1. User clicks "Attach File" button or drags file over note
2. System shows drag overlay if dragging
3. User drops file or selects from file picker
4. System validates file (size < 100MB, type allowed)
5. Upload progress bar appears (chunked upload)
6. On complete, system extracts EXIF (if image)
7. Thumbnail generated, added to attachments list
8. Success toast: "Photo uploaded. GPS location detected."

#### Flow 2.2: View Attachment with Location
1. User clicks attachment thumbnail
2. System opens preview modal with metadata sidebar
3. Default tab shows file info
4. User clicks "Location" tab
5. System displays interactive map with marker
6. Map shows capture location, zoom level 15
7. User can click "Search nearby memories" button
8. System navigates to Memory Search with location pre-filled

#### Flow 2.3: Batch Upload
1. User selects multiple files (Shift+Click or Cmd+A)
2. System shows batch upload dialog
3. Progress bars for each file in parallel
4. System processes EXIF extraction in background
5. Thumbnails appear as each completes
6. Final toast: "5 files uploaded successfully."

### UI Components

#### Upload Dropzone
```typescript
<AttachmentDropzone>
  <DragOverlay visible={isDragging}>
    <Icon size="xl">Upload</Icon>
    <Text>Drop files to attach</Text>
  </DragOverlay>
  <DefaultState>
    <Icon>Paperclip</Icon>
    <Text>Drag files or <Button>Browse</Button></Text>
    <Caption>Images, PDFs, up to 100MB</Caption>
  </DefaultState>
</AttachmentDropzone>
```

#### Attachment Card (Thumbnail View)
```typescript
<AttachmentCard>
  <Thumbnail src={thumbnailUrl} alt={filename} />
  <Overlay> // Shown on hover
    <Badge>2.4 MB</Badge>
    <IconButton onClick={onPreview}>
      <Eye />
    </IconButton>
    <ContextMenu>
      <MenuItem>Download</MenuItem>
      <MenuItem>View Metadata</MenuItem>
      <MenuItem danger>Delete</MenuItem>
    </ContextMenu>
  </Overlay>
  <Footer>
    <Filename truncate>{filename}</Filename>
    <Date>{uploadDate}</Date>
  </Footer>
</AttachmentCard>
```

#### EXIF Metadata Panel
- **Camera Section**: Make, Model, Lens (if available)
- **Settings Section**: ISO, Aperture, Shutter Speed, Focal Length
- **Time Section**: Capture DateTime (local + UTC)
- **Location Section**: GPS coordinates with "View on Map" link

#### Map Integration
- **Library**: Leaflet.js (lightweight, open-source)
- **Tiles**: OpenStreetMap (default) or Mapbox (if API key provided)
- **Markers**: Custom icon with attachment thumbnail
- **Popups**: Mini-card with filename, date, "View Note" button

### Accessibility Considerations

#### Keyboard Navigation
- **Tab**: Navigate between attachments
- **Enter**: Open preview modal
- **Arrow Keys**: Navigate between attachments in modal
- **Escape**: Close modal

#### Screen Reader Support
- **Upload Status**: aria-live region announces progress
- **Thumbnails**: alt text with filename + capture date
- **EXIF Data**: Properly labeled fields (not just icons)
- **Map**: aria-label="Map showing attachment locations"

#### Visual Accessibility
- **Loading States**: Skeleton screens for thumbnails
- **Error Icons**: Red exclamation with text label
- **File Type Icons**: Distinct shapes + colors + text labels

### Mobile Responsive Design

#### Mobile Adaptations (< 640px)
- Upload button always visible (bottom FAB)
- Thumbnail grid: 2 columns
- Preview modal: Full-screen overlay
- Metadata tabs: Bottom sheet (swipe up)
- Map view: Separate full-screen page

#### Tablet (640-1024px)
- Thumbnail grid: 3-4 columns
- Preview modal: 80% width, centered
- Metadata sidebar: Collapsible accordion

### Error States
- **Upload Failed**: Retry button, error reason (size, type, network)
- **No GPS Data**: "Location unavailable" with icon
- **Corrupt File**: "Cannot preview. Download to view."
- **Storage Full**: "Upload limit reached. Delete old attachments."

### Performance Considerations
- **Lazy Loading**: Thumbnails load on scroll (IntersectionObserver)
- **Progressive Image Loading**: Blur placeholder -> Low-res -> High-res
- **EXIF Extraction**: Background job, metadata appears async
- **Chunked Upload**: 5MB chunks for large files with resume support

---

## Feature 3: Memory Search

### Overview
Spatiotemporal search interface for finding notes by location (radius search), time range (date picker + timeline), and combined filters.

### User Stories
- **US-3.1**: As Creative Chris, I want to find photos taken near a location so I can recall memories
- **US-3.2**: As Creative Chris, I want to see all notes from a specific week so I can review activities
- **US-3.3**: As Research Rachel, I want to find notes with attachments from a conference so I can write a report
- **US-3.4**: As Manager Morgan, I want to find project photos from site visits so I can update stakeholders

### Information Architecture

```
Memory Search (Full Page / Modal)
├── Search Criteria Panel (Left/Top)
│   ├── Location Filter
│   │   ├── Location Picker (Map + Search)
│   │   │   ├── Current Location Button
│   │   │   ├── Search Address/Place
│   │   │   ├── Click on Map
│   │   │   └── Recent Locations
│   │   ├── Radius Slider (100m - 50km)
│   │   └── Location Badge (Removable)
│   ├── Time Range Filter
│   │   ├── Preset Ranges (Quick select)
│   │   │   ├── Today
│   │   │   ├── This Week
│   │   │   ├── This Month
│   │   │   ├── This Year
│   │   │   └── Custom Range
│   │   ├── Date Range Picker (Calendar)
│   │   │   ├── Start Date
│   │   │   └── End Date
│   │   └── Timeline Scrubber (Visual selection)
│   ├── Combined Filters
│   │   ├── Device Filter (Dropdown)
│   │   ├── Attachment Type (Image, PDF, etc.)
│   │   └── Sort Order (Distance, Date, Relevance)
│   └── Action Buttons
│       ├── Search Button (Primary)
│       ├── Clear All Filters
│       └── Save Search (Bookmark)
├── Results Panel (Right/Main)
│   ├── Results Header
│   │   ├── Count ("42 memories found")
│   │   ├── View Toggle (List, Grid, Map, Timeline)
│   │   └── Export Button
│   ├── List View
│   │   ├── Result Card
│   │   │   ├── Thumbnail (If attachment)
│   │   │   ├── Note Title
│   │   │   ├── Snippet (First 200 chars)
│   │   │   ├── Metadata Bar
│   │   │   │   ├── Distance (From search center)
│   │   │   │   ├── Date (Capture or creation)
│   │   │   │   └── Device (If known)
│   │   │   └── Actions (View, Open in New Tab)
│   │   └── Load More Button
│   ├── Grid View (Thumbnail wall)
│   │   └── Photo Card (Image-focused)
│   ├── Map View
│   │   ├── Interactive Map with Results
│   │   ├── Clustered Markers
│   │   ├── Selected Marker Highlight
│   │   └── Result Sidebar (On marker click)
│   └── Timeline View
│       ├── Horizontal Timeline
│       ├── Grouped by Date
│       └── Thumbnail Clusters
└── Context Sidebar (Optional)
    ├── Search History
    ├── Saved Searches
    └── Suggestions ("Try searching near...")
```

### Key User Flows

#### Flow 3.1: Location-Based Search
1. User opens Memory Search from navigation
2. System requests geolocation permission (first time)
3. User clicks "Use Current Location" button
4. System centers map on user's position
5. User adjusts radius slider (default: 1km)
6. Visual circle appears on map showing search area
7. User clicks "Search" button
8. System queries API with lat/lon/radius
9. Results appear with distance badges
10. User switches to Map View to see spatial distribution

#### Flow 3.2: Time Range Search
1. User selects "This Month" preset
2. System auto-fills date range (Month start -> Today)
3. Timeline scrubber highlights selected range
4. User clicks "Search"
5. Results show chronologically with date headers
6. User switches to Timeline View
7. Results displayed on horizontal timeline with thumbnails
8. User scrubs timeline to see date distribution

#### Flow 3.3: Combined Search (Location + Time)
1. User enters "San Francisco" in location search
2. System geocodes address, centers map
3. User sets radius to 5km
4. User selects custom date range (Jan 15-20, 2026)
5. User filters by "Image" attachment type
6. User clicks "Search"
7. System applies AND logic to all filters
8. Results show photos from SF during that week
9. User clicks result card, opens note with attachment preview

#### Flow 3.4: Save and Reuse Search
1. User configures complex search criteria
2. User clicks "Save Search" button
3. System prompts for search name
4. User enters "SF Trip Jan 2026"
5. Saved search appears in sidebar
6. Later, user clicks saved search
7. System auto-loads all criteria, runs search

### UI Components

#### Location Picker Component
```typescript
<LocationPicker>
  <SearchBar>
    <Input placeholder="Search places..." />
    <Button icon={<Target />}>Use Current Location</Button>
  </SearchBar>
  <Map>
    <Circle center={location} radius={radiusMeters} />
    <Marker draggable position={location} />
    <TileLayer />
  </Map>
  <RadiusSlider
    min={100}
    max={50000}
    step={100}
    value={radiusMeters}
    label={formatRadius(radiusMeters)} // "1.2 km"
  />
</LocationPicker>
```

#### Timeline Scrubber
```typescript
<TimelineScrubber>
  <Timeline>
    <Range start={startDate} end={endDate} />
    <Handle position="start" draggable />
    <Handle position="end" draggable />
    <Markers> // Date ticks
      <Tick date={date} label={formatDate(date)} />
    </Markers>
  </Timeline>
  <PresetButtons>
    <Button>Today</Button>
    <Button>This Week</Button>
    <Button>This Month</Button>
    <Button>Custom</Button>
  </PresetButtons>
</TimelineScrubber>
```

#### Memory Result Card
```typescript
<MemoryCard>
  <Thumbnail src={thumbnail} />
  <Content>
    <Title>{noteTitle}</Title>
    <Snippet>{truncate(content, 200)}</Snippet>
    <MetadataBar>
      <Badge icon={<MapPin />}>{distance} away</Badge>
      <Badge icon={<Calendar />}>{captureDate}</Badge>
      {device && <Badge icon={<Camera />}>{device}</Badge>}
    </MetadataBar>
  </Content>
  <Actions>
    <IconButton onClick={onView}>
      <Eye />
    </IconButton>
  </Actions>
</MemoryCard>
```

### Accessibility Considerations

#### Keyboard Navigation
- **Tab**: Navigate filter inputs, results
- **Enter**: Submit search, open result
- **Arrow Keys**: Navigate map, timeline scrubber
- **Space**: Select preset buttons

#### Screen Reader Support
- **Map Controls**: aria-label for zoom, pan buttons
- **Radius Slider**: aria-valuemin/max/now, live region on change
- **Results Count**: aria-live="polite" announces count
- **Date Picker**: Standard datepicker ARIA patterns

#### Visual Accessibility
- **Map**: High contrast markers, labels visible at all zoom levels
- **Timeline**: Clear date labels, not color-dependent
- **Distance**: Text label + icon (not just color coding)

### Mobile Responsive Design

#### Mobile (< 640px)
- Filters: Collapsible accordion at top
- Location picker: Full-screen modal
- Map view: Default view (most intuitive on mobile)
- Results: List view with large touch targets
- Timeline: Vertical orientation

#### Tablet (640-1024px)
- Filters: Left sidebar (collapsible)
- Results: Grid view (2 columns)
- Map view: Split screen (filters left, map right)

### Error States
- **No Location Permission**: Prompt with instructions, fallback to manual entry
- **No Results**: "No memories found. Try expanding radius or date range."
- **Geolocation Failed**: "Could not determine location. Enter manually."
- **API Timeout**: Retry button, "Search taking longer than expected..."

### Performance Considerations
- **Debounced Search**: 500ms after radius/location change
- **Result Pagination**: 50 results per page, infinite scroll
- **Map Clustering**: Group nearby markers (< 50px apart)
- **Thumbnail Lazy Load**: Load on scroll (IntersectionObserver)

---

## Feature 4: Knowledge Health Dashboard

### Overview
Visual dashboard showing knowledge base quality metrics: orphan notes, stale content, tag coverage, link density, and actionable recommendations.

### User Stories
- **US-4.1**: As Manager Morgan, I want to see system health metrics so I know knowledge quality
- **US-4.2**: As Research Rachel, I want to find orphan notes so I can link them properly
- **US-4.3**: As Manager Morgan, I want to identify stale notes so I can review/archive them
- **US-4.4**: As Developer Devon, I want to see tag coverage so I can improve organization
- **US-4.5**: As Research Rachel, I want to find unlinked notes so I can build connections

### Information Architecture

```
Knowledge Health Dashboard (Full Page)
├── Overview Cards (Top Row)
│   ├── Health Score Card (0-100)
│   │   ├── Score Circle (Visual gauge)
│   │   ├── Trend Indicator (↑↓)
│   │   └── Status Label (Excellent, Good, Fair, Poor)
│   ├── Total Notes Card
│   │   ├── Count (Large number)
│   │   ├── Breakdown (Original, Revised)
│   │   └── Growth Rate (Last 30 days)
│   ├── Active Concepts Card
│   │   ├── Count of Concepts in Use
│   │   ├── Coverage Percentage
│   │   └── Orphan Concepts Count
│   └── Link Density Card
│       ├── Avg Links per Note
│       ├── Density Gauge (Visual)
│       └── Unlinked Notes Count
├── Metrics Section
│   ├── Orphan Notes Metric
│   │   ├── Count + Percentage
│   │   ├── Trend Chart (Last 30 days)
│   │   ├── "View Orphans" Button
│   │   └── Recommendation (Action item)
│   ├── Stale Notes Metric
│   │   ├── Count (Not updated in 180+ days)
│   │   ├── Age Distribution (Histogram)
│   │   ├── "Review Stale" Button
│   │   └── Auto-Archive Suggestion
│   ├── Tag Coverage Metric
│   │   ├── Coverage Percentage (Gauge)
│   │   ├── Untagged Notes Count
│   │   ├── "Add Tags" Button
│   │   └── Suggested Tags (AI-powered)
│   ├── Link Quality Metric
│   │   ├── Semantic Links Count
│   │   ├── Manual Links Count
│   │   ├── Average Link Score
│   │   └── "Find Connections" Button
│   └── Concept Governance Metric
│       ├── Concepts with Definitions (%)
│       ├── Hierarchy Depth (Avg)
│       ├── Orphan Concepts Count
│       └── "Review Taxonomy" Button
├── Actionable Insights Panel
│   ├── Priority Actions (Alert cards)
│   │   ├── Action Title (e.g., "42 orphan notes")
│   │   ├── Impact Description
│   │   ├── Effort Estimate (Low, Medium, High)
│   │   └── "Take Action" Button
│   └── Suggestions Carousel
│       ├── "Tag 18 untagged notes"
│       ├── "Link 5 related notes"
│       └── "Archive 12 stale notes"
├── Trends Section (Bottom)
│   ├── Time Range Selector (7d, 30d, 90d, 1y)
│   ├── Health Score Trend (Line chart)
│   ├── Activity Heatmap (Calendar view)
│   └── Tag Usage Trends (Bar chart)
└── Export/Report
    ├── Export Button (PDF, CSV)
    ├── Schedule Report (Email digest)
    └── Share Dashboard (Link)
```

### Key User Flows

#### Flow 4.1: Review Dashboard Health
1. User navigates to "Knowledge Health" from sidebar
2. System fetches metrics via API (`/api/v1/health/knowledge`)
3. Overview cards animate in with current values
4. Health score displays with color coding (Green: 80+, Yellow: 50-79, Red: <50)
5. User sees "Fair" status (Score: 62)
6. Metrics section highlights main issues (42 orphans, 18 stale)
7. Actionable insights panel shows prioritized actions

#### Flow 4.2: Address Orphan Notes
1. User clicks "View Orphans" button in Orphan Notes metric
2. System navigates to filtered note list (orphans only)
3. User reviews orphan note, clicks "Find Related"
4. System shows semantic search results
5. User clicks "Link" on related note
6. System creates semantic link, removes orphan status
7. User returns to dashboard, orphan count decreases

#### Flow 4.3: Review Stale Content
1. User clicks "Review Stale" button
2. System shows list of notes not updated in 180+ days
3. Each note has "Archive" or "Update" action
4. User bulk-selects 5 notes, clicks "Archive Selected"
5. Confirmation dialog shows impact
6. User confirms, notes archived
7. Dashboard reflects updated stale count

#### Flow 4.4: Improve Tag Coverage
1. User sees 32% tag coverage (Low)
2. User clicks "Add Tags" button
3. System shows untagged notes with AI-suggested tags
4. User reviews suggestions, accepts/modifies tags
5. System applies tags via batch API call
6. Tag coverage metric updates to 58% (Good)

### UI Components

#### Health Score Gauge
```typescript
<HealthScoreCard>
  <CircularProgress
    value={healthScore}
    size="xl"
    color={getHealthColor(healthScore)} // Green/Yellow/Red
  >
    <Text size="4xl" weight="bold">{healthScore}</Text>
  </CircularProgress>
  <StatusLabel color={getHealthColor(healthScore)}>
    {getHealthLabel(healthScore)} // Excellent/Good/Fair/Poor
  </StatusLabel>
  <TrendIndicator>
    <Icon>{trend > 0 ? <TrendingUp /> : <TrendingDown />}</Icon>
    <Text>{Math.abs(trend)}% vs last month</Text>
  </TrendIndicator>
</HealthScoreCard>
```

#### Metric Card
```typescript
<MetricCard severity={severity}> // info, warning, error
  <Header>
    <Icon>{icon}</Icon>
    <Title>{title}</Title>
  </Header>
  <Value>
    <Number>{value}</Number>
    <Unit>{unit}</Unit>
    <Percentage>{percentage}%</Percentage>
  </Value>
  <TrendChart data={historicalData} />
  <Actions>
    <Button>{actionLabel}</Button>
  </Actions>
  <Recommendation>
    <Icon><Lightbulb /></Icon>
    <Text>{recommendationText}</Text>
  </Recommendation>
</MetricCard>
```

#### Action Priority Card
```typescript
<ActionCard priority={priority}> // high, medium, low
  <Badge color={getPriorityColor(priority)}>
    {priority.toUpperCase()}
  </Badge>
  <Title>{title}</Title>
  <Description>{description}</Description>
  <MetadataBar>
    <Badge icon={<Target />}>Impact: {impact}</Badge>
    <Badge icon={<Clock />}>Effort: {effort}</Badge>
  </MetadataBar>
  <Button onClick={onTakeAction}>
    Take Action
  </Button>
</ActionCard>
```

#### Activity Heatmap
```typescript
<ActivityHeatmap>
  <Calendar>
    {dates.map(date => (
      <CalendarDay
        date={date}
        activityLevel={getActivity(date)} // 0-4
        color={getHeatColor(activityLevel)}
        tooltip={`${activityLevel} notes on ${date}`}
      />
    ))}
  </Calendar>
  <Legend>
    <LegendItem color="gray" label="No activity" />
    <LegendItem color="green-100" label="Low" />
    <LegendItem color="green-500" label="High" />
  </Legend>
</ActivityHeatmap>
```

### Accessibility Considerations

#### Keyboard Navigation
- **Tab**: Navigate cards, buttons
- **Enter**: Activate actions
- **Arrow Keys**: Navigate chart elements

#### Screen Reader Support
- **Metrics**: aria-label with full context ("42 orphan notes, 8% of total")
- **Charts**: Table alternative in disclosure
- **Trend Indicators**: "Health score increased by 5% last month"
- **Action Cards**: Priority level announced

#### Visual Accessibility
- **Color + Icons**: Not color-dependent (icons supplement)
- **Chart Text**: Labels always visible, not just tooltips
- **High Contrast**: Meets WCAG AA for all text/backgrounds

### Mobile Responsive Design

#### Mobile (< 640px)
- Overview cards: Vertical stack, full width
- Metrics: Accordion (expand to see details)
- Charts: Simplified, touch-optimized
- Actions: Bottom sheet with swipe

#### Tablet (640-1024px)
- Overview cards: 2x2 grid
- Metrics: 2 columns
- Charts: Full-width, scrollable

### Error States
- **API Failure**: "Unable to load metrics. Retry?"
- **Partial Data**: Warning indicator on affected cards
- **No Data**: "Not enough data yet. Create some notes!"

### Performance Considerations
- **Lazy Chart Rendering**: Charts load on scroll
- **Cached Metrics**: 5-minute cache, refresh button available
- **Progressive Loading**: Cards load independently

---

## Feature 5: Version History

### Overview
Timeline-based interface for viewing note edit history, comparing versions with diff viewer, and restoring previous versions.

### User Stories
- **US-5.1**: As Developer Devon, I want to see all note versions so I can track changes over time
- **US-5.2**: As Research Rachel, I want to compare versions so I can see what changed
- **US-5.3**: As Manager Morgan, I want to restore old versions so I can undo mistakes
- **US-5.4**: As Developer Devon, I want to see AI revision history so I understand edits
- **US-5.5**: As Research Rachel, I want to delete old versions so I can clean up history

### Information Architecture

```
Version History (Side Panel / Modal)
├── Timeline View (Left Panel)
│   ├── Filter Controls
│   │   ├── Track Selector (Original, Revised)
│   │   ├── Date Range Filter
│   │   └── Author Filter (User, AI)
│   ├── Version List (Chronological)
│   │   ├── Version Card
│   │   │   ├── Version Number (v3, v2, v1)
│   │   │   ├── Timestamp (Relative + Absolute)
│   │   │   ├── Author Badge (User/AI model)
│   │   │   ├── Change Summary (Auto or manual)
│   │   │   ├── Change Size (Characters added/removed)
│   │   │   └── Actions Menu (⋮)
│   │   │       ├── View
│   │   │       ├── Compare with Current
│   │   │       ├── Restore
│   │   │       └── Delete (Not current)
│   │   └── Current Version Indicator (Badge)
│   └── Timeline Visualization
│       ├── Vertical Timeline (Dots + Lines)
│       ├── Branch Indicators (Original/Revised)
│       └── Time Gaps (Visual spacing)
├── Content Viewer (Right Panel)
│   ├── View Mode Selector (View, Diff)
│   ├── View Mode (Single Version)
│   │   ├── Version Header
│   │   │   ├── "Version 3 (Current)"
│   │   │   ├── Timestamp
│   │   │   ├── Author
│   │   │   └── Restore Button (If not current)
│   │   └── Content Display (Markdown rendered)
│   └── Diff Mode (Two Versions)
│       ├── Version Selector Bar
│       │   ├── From Version (Dropdown)
│       │   ├── Compare Icon (⇄)
│       │   └── To Version (Dropdown)
│       ├── Diff Display
│       │   ├── Side-by-Side View (Desktop)
│       │   │   ├── Left Panel (Old version)
│       │   │   └── Right Panel (New version)
│       │   ├── Unified View (Mobile)
│       │   │   ├── Deletions (Red background)
│       │   │   └── Additions (Green background)
│       │   └── Change Stats
│       │       ├── Lines Added (+42)
│       │       ├── Lines Removed (-18)
│       │       └── Net Change (+24)
│       └── Navigation Controls
│           ├── Previous Change Button
│           ├── Change Counter (3/15)
│           └── Next Change Button
└── Actions Toolbar (Bottom)
    ├── Restore Version Button
    ├── Download Version Button
    └── Close Button
```

### Key User Flows

#### Flow 5.1: View Version History
1. User opens note, clicks "History" icon in toolbar
2. System opens side panel with version timeline
3. Timeline shows current version at top (highlighted)
4. User scrolls down to see older versions
5. Each version card shows summary and timestamp
6. User clicks on v2
7. Content viewer displays v2 content (rendered markdown)
8. User can see author badge (AI model: llama3.2)

#### Flow 5.2: Compare Versions (Diff View)
1. User clicks "Compare" button on v2
2. System switches to diff mode
3. From: v2 (selected), To: v3 (current) auto-selected
4. Side-by-side view shows differences
5. Deletions highlighted in red, additions in green
6. User clicks "Next Change" button
7. View scrolls to next diff block
8. Change counter shows "2/5"

#### Flow 5.3: Restore Previous Version
1. User reviewing v2, decides it's better than current
2. User clicks "Restore" button
3. Confirmation dialog appears
4. Dialog shows: "Restore version 2? Current version will be preserved as new version."
5. User confirms
6. System creates new version (v4) with v2 content
7. Timeline updates, v4 becomes current
8. Success toast: "Version restored successfully"

#### Flow 5.4: Delete Old Version
1. User right-clicks on v1 (very old)
2. Context menu shows "Delete Version"
3. Confirmation dialog: "Delete version 1? This cannot be undone."
4. User confirms
5. v1 removed from timeline
6. Gap appears in timeline visualization

### UI Components

#### Version Card
```typescript
<VersionCard isCurrentVersion={isCurrent}>
  <Header>
    <VersionBadge color={isCurrent ? 'blue' : 'gray'}>
      v{versionNumber}
      {isCurrent && <Icon><Check /></Icon>}
    </VersionBadge>
    <Timestamp>
      <Relative>{relativeTime}</Relative> // "2 hours ago"
      <Absolute>{absoluteTime}</Absolute> // "Jan 24, 2026 3:45 PM"
    </Timestamp>
  </Header>
  <Content>
    <AuthorBadge>
      <Icon>{authorType === 'ai' ? <Sparkles /> : <User />}</Icon>
      <Text>{author}</Text> // "llama3.2" or "You"
    </AuthorBadge>
    <ChangeSummary>{summary}</ChangeSummary>
    <ChangeSize>
      <Badge color="green">+{linesAdded}</Badge>
      <Badge color="red">-{linesRemoved}</Badge>
    </ChangeSize>
  </Content>
  <Actions>
    <IconButton onClick={onView}>
      <Eye />
    </IconButton>
    <DropdownMenu>
      <MenuItem onClick={onCompare}>Compare</MenuItem>
      <MenuItem onClick={onRestore} disabled={isCurrent}>
        Restore
      </MenuItem>
      <MenuItem onClick={onDelete} disabled={isCurrent} danger>
        Delete
      </MenuItem>
    </DropdownMenu>
  </Actions>
</VersionCard>
```

#### Diff Viewer Component
```typescript
<DiffViewer mode="side-by-side"> // or "unified"
  <DiffHeader>
    <VersionSelector>
      <Select value={fromVersion}>
        <Option value="v1">Version 1</Option>
        <Option value="v2">Version 2</Option>
      </Select>
      <CompareIcon><ArrowsLeftRight /></CompareIcon>
      <Select value={toVersion}>
        <Option value="v3">Version 3 (Current)</Option>
      </Select>
    </VersionSelector>
    <ChangeStats>
      <Stat color="green">+{linesAdded} lines</Stat>
      <Stat color="red">-{linesRemoved} lines</Stat>
    </ChangeStats>
  </DiffHeader>
  <DiffContent>
    {mode === 'side-by-side' ? (
      <SideBySide>
        <Panel>
          <Label>Version {fromVersion}</Label>
          <DiffLines lines={fromLines} />
        </Panel>
        <Panel>
          <Label>Version {toVersion}</Label>
          <DiffLines lines={toLines} />
        </Panel>
      </SideBySide>
    ) : (
      <Unified>
        <DiffLines lines={unifiedLines} />
      </Unified>
    )}
  </DiffContent>
  <DiffNavigation>
    <Button onClick={onPrevChange} disabled={isFirstChange}>
      <ChevronUp /> Previous
    </Button>
    <Text>{currentChange}/{totalChanges}</Text>
    <Button onClick={onNextChange} disabled={isLastChange}>
      Next <ChevronDown />
    </Button>
  </DiffNavigation>
</DiffViewer>
```

#### Timeline Visualization
```typescript
<TimelineVisualization>
  <Timeline>
    {versions.map((version, index) => (
      <TimelineNode key={version.id}>
        <Dot
          color={version.isCurrent ? 'blue' : 'gray'}
          size={version.isCurrent ? 'lg' : 'md'}
        />
        {index < versions.length - 1 && (
          <Line height={getGapHeight(versions[index+1].timestamp)} />
        )}
        <BranchLabel>
          {version.track === 'revised' ? 'AI Revised' : 'Original'}
        </BranchLabel>
      </TimelineNode>
    ))}
  </Timeline>
</TimelineVisualization>
```

### Accessibility Considerations

#### Keyboard Navigation
- **Tab**: Navigate version cards, action buttons
- **Arrow Up/Down**: Navigate version list
- **Enter**: Open selected version
- **Shift+Enter**: Compare selected version with current
- **D**: Toggle diff mode
- **R**: Restore selected version (with confirmation)

#### Screen Reader Support
- **Version Card**: "Version 3, current, created 2 hours ago by you"
- **Diff Lines**: "Line removed: Old text" / "Line added: New text"
- **Change Navigation**: "Change 2 of 5"
- **Timeline**: "Version history timeline, 5 versions"

#### Visual Accessibility
- **Diff Colors**: Red/green + icons (- / +) for colorblind users
- **Current Version**: Blue badge + checkmark (not just color)
- **Contrast**: All diff highlights meet WCAG AA

### Mobile Responsive Design

#### Mobile (< 640px)
- Full-screen modal
- Version list: Bottom sheet (swipe up)
- Content viewer: Full-screen, toggle between list and content
- Diff mode: Unified view only (side-by-side too narrow)
- Timeline: Horizontal scroll at top

#### Tablet (640-1024px)
- Side panel (50% width)
- Version list: Scrollable left panel
- Diff mode: Side-by-side if enough width, else unified

### Error States
- **Version Load Failed**: "Cannot load version. It may have been deleted."
- **Restore Failed**: "Restore failed. Please try again."
- **Delete Failed**: "Cannot delete current version."
- **Diff Generation Failed**: "Cannot compare versions. Try again."

### Performance Considerations
- **Lazy Load Versions**: Initial load shows 10 most recent, load more on scroll
- **Diff Streaming**: Large diffs load progressively
- **Debounced Comparison**: Wait 300ms after version selector change
- **Virtual Scrolling**: For version lists > 50 items

---

## Feature 6: Template Management

### Overview
CRUD interface for note templates with variable substitution, preview, and one-click instantiation.

### User Stories
- **US-6.1**: As Manager Morgan, I want to create meeting note templates so I can standardize documentation
- **US-6.2**: As Developer Devon, I want to create code snippet templates so I can capture patterns
- **US-6.3**: As Research Rachel, I want to browse templates so I can find the right format
- **US-6.4**: As Manager Morgan, I want to instantiate templates so I can quickly create notes
- **US-6.5**: As Developer Devon, I want to edit templates so I can improve them over time

### Information Architecture

```
Template Management (Page/Modal)
├── Template Browser (Main View)
│   ├── Search/Filter Bar
│   │   ├── Search Input (Template name, tags)
│   │   ├── Category Filter (Dropdown)
│   │   │   ├── All Templates
│   │   │   ├── Meeting Notes
│   │   │   ├── Project Docs
│   │   │   ├── Code Snippets
│   │   │   └── Research
│   │   └── Sort Selector (Recent, Alphabetical, Usage)
│   ├── Template Grid/List
│   │   ├── Template Card
│   │   │   ├── Template Icon (Category-specific)
│   │   │   ├── Template Name
│   │   │   ├── Description (Truncated)
│   │   │   ├── Variable Count Badge ({{vars}})
│   │   │   ├── Usage Count (Times used)
│   │   │   ├── Last Used Timestamp
│   │   │   └── Quick Actions
│   │   │       ├── Use Template (Primary button)
│   │   │       ├── Preview (Eye icon)
│   │   │       ├── Edit (Pencil icon)
│   │   │       └── Delete (Trash icon)
│   │   └── "Create Template" Card (CTA)
│   └── Empty State
│       ├── Illustration
│       ├── "No templates yet"
│       └── "Create Template" Button
├── Template Editor (Modal/Slide-over)
│   ├── Editor Header
│   │   ├── "Create Template" / "Edit Template" Title
│   │   ├── Save Button (Primary)
│   │   └── Cancel Button
│   ├── Template Form
│   │   ├── Name Input (Required)
│   │   ├── Description Textarea (Optional)
│   │   ├── Category Selector
│   │   ├── Content Editor (Markdown with syntax help)
│   │   │   ├── Editor Toolbar
│   │   │   │   ├── Bold, Italic, Heading buttons
│   │   │   │   ├── Insert Variable button
│   │   │   │   └── Preview Toggle
│   │   │   ├── Syntax Highlighting (Variables in blue)
│   │   │   └── Variables Detected Panel
│   │   │       ├── "Variables: {{date}}, {{topic}}, {{attendees}}"
│   │   │       └── "Click to insert variable"
│   │   ├── Default Tags (Tag input)
│   │   └── Preview Pane (Live)
│   │       ├── Rendered Markdown
│   │       └── Variable Placeholders (Highlighted)
│   └── Validation Messages
│       ├── Error: "Template name required"
│       └── Warning: "Variable {{name}} not defined"
├── Template Instantiation Modal
│   ├── Modal Header
│   │   ├── Template Name
│   │   ├── Description
│   │   └── Close Button
│   ├── Variable Form (Dynamic)
│   │   ├── Variable Input Fields (Generated from {{vars}})
│   │   │   ├── Label (Variable name)
│   │   │   ├── Input/Textarea (Based on type)
│   │   │   ├── Placeholder (Example value)
│   │   │   └── Help Text (Optional)
│   │   └── Live Preview Panel
│   │       ├── Preview Header ("Preview")
│   │       ├── Rendered Content (Variables replaced)
│   │       └── Update Indicator (Debounced)
│   ├── Tags Section
│   │   ├── Default Tags (From template)
│   │   └── Additional Tags Input
│   └── Actions
│       ├── Create Note Button (Primary)
│       └── Cancel Button
└── Template Preview Modal
    ├── Preview Header
    │   ├── Template Name
    │   ├── Category Badge
    │   └── Close Button
    ├── Preview Content
    │   ├── Rendered Markdown (Full)
    │   ├── Variables List (Highlighted)
    │   └── Metadata
    │       ├── Created Date
    │       ├── Last Modified
    │       └── Usage Count
    └── Actions
        ├── Use Template Button (Primary)
        ├── Edit Button
        └── Clone Button
```

### Key User Flows

#### Flow 6.1: Create New Template
1. User clicks "Create Template" button in template browser
2. System opens template editor modal
3. User enters template name: "Weekly Standup"
4. User enters description: "Team standup meeting notes"
5. User selects category: "Meeting Notes"
6. User writes template content in markdown editor:
   ```
   # Standup: {{date}}

   ## Team: {{team_name}}

   ### What we accomplished
   {{accomplishments}}

   ### Blockers
   {{blockers}}

   ### Next steps
   {{next_steps}}
   ```
7. System detects variables: date, team_name, accomplishments, blockers, next_steps
8. Variables panel shows list of detected variables
9. User adds default tags: "standup", "meeting"
10. User clicks "Save"
11. System validates, creates template
12. User returns to browser, sees new template card

#### Flow 6.2: Use Template to Create Note
1. User clicks "Use Template" button on "Weekly Standup" card
2. System opens instantiation modal
3. Modal shows form with input for each variable:
   - Date: Pre-filled with today's date (editable)
   - Team Name: Empty input
   - Accomplishments: Multi-line textarea
   - Blockers: Multi-line textarea
   - Next Steps: Multi-line textarea
4. User fills in values
5. Live preview updates as user types (debounced 500ms)
6. User reviews preview, sees variables replaced
7. User adds additional tag: "Q1-2026"
8. User clicks "Create Note"
9. System creates note with content, tags applied
10. User redirected to new note view

#### Flow 6.3: Edit Existing Template
1. User clicks "Edit" icon on template card
2. System opens editor modal with current content
3. User modifies description
4. User adds new variable: {{action_items}}
5. User clicks "Save"
6. System validates, updates template
7. Modal closes, card shows updated timestamp

#### Flow 6.4: Browse and Search Templates
1. User opens template browser
2. Grid shows 12 templates (3x4 grid on desktop)
3. User enters "meeting" in search bar
4. System filters to show 4 matching templates
5. User changes sort to "Most Used"
6. Results reorder by usage count

### UI Components

#### Template Card
```typescript
<TemplateCard>
  <Icon>
    {getCategoryIcon(category)} // FileText, Code, Beaker, etc.
  </Icon>
  <Content>
    <Title>{name}</Title>
    <Description>{truncate(description, 100)}</Description>
    <MetadataBar>
      <Badge icon={<BracesIcon />}>{variableCount} variables</Badge>
      <Badge icon={<Activity />}>{usageCount} uses</Badge>
      <Text muted>Last used: {lastUsed}</Text>
    </MetadataBar>
  </Content>
  <Actions>
    <Button onClick={onUse} variant="primary">
      Use Template
    </Button>
    <IconButton onClick={onPreview}>
      <Eye />
    </IconButton>
    <DropdownMenu>
      <MenuItem onClick={onEdit}>Edit</MenuItem>
      <MenuItem onClick={onClone}>Clone</MenuItem>
      <MenuItem onClick={onDelete} danger>Delete</MenuItem>
    </DropdownMenu>
  </Actions>
</TemplateCard>
```

#### Template Editor
```typescript
<TemplateEditor>
  <Form>
    <Input
      label="Template Name"
      required
      placeholder="e.g., Weekly Standup"
      value={name}
      onChange={setName}
    />
    <Textarea
      label="Description"
      placeholder="Brief description of what this template is for"
      rows={2}
      value={description}
      onChange={setDescription}
    />
    <Select label="Category" value={category} onChange={setCategory}>
      <Option value="meeting">Meeting Notes</Option>
      <Option value="project">Project Docs</Option>
      <Option value="code">Code Snippets</Option>
      <Option value="research">Research</Option>
    </Select>
    <MarkdownEditor
      label="Template Content"
      value={content}
      onChange={setContent}
      toolbar={
        <Toolbar>
          <Button onClick={onBold}>Bold</Button>
          <Button onClick={onItalic}>Italic</Button>
          <Button onClick={onInsertVariable}>
            Insert Variable {{x}}
          </Button>
        </Toolbar>
      }
    />
    <VariablesPanel>
      <Label>Detected Variables</Label>
      <ChipList>
        {variables.map(v => (
          <Chip key={v}>
            <Code>{`{{${v}}}`}</Code>
          </Chip>
        ))}
      </ChipList>
      {variables.length === 0 && (
        <EmptyState>
          No variables detected. Use {`{{variable_name}}`} syntax.
        </EmptyState>
      )}
    </VariablesPanel>
    <TagInput
      label="Default Tags"
      value={tags}
      onChange={setTags}
      placeholder="Add tags..."
    />
  </Form>
  <PreviewPane>
    <Label>Preview</Label>
    <MarkdownPreview content={content} />
  </PreviewPane>
</TemplateEditor>
```

#### Instantiation Modal
```typescript
<InstantiationModal template={template}>
  <ModalHeader>
    <Title>{template.name}</Title>
    <Description>{template.description}</Description>
  </ModalHeader>
  <ModalContent>
    <VariableForm>
      {template.variables.map(variable => (
        <FormField key={variable}>
          <Label>{formatVariableName(variable)}</Label>
          {getInputType(variable) === 'textarea' ? (
            <Textarea
              value={variableValues[variable]}
              onChange={v => setVariableValue(variable, v)}
              placeholder={getPlaceholder(variable)}
              rows={4}
            />
          ) : (
            <Input
              value={variableValues[variable]}
              onChange={v => setVariableValue(variable, v)}
              placeholder={getPlaceholder(variable)}
            />
          )}
        </FormField>
      ))}
    </VariableForm>
    <LivePreview>
      <PreviewHeader>
        <Label>Preview</Label>
        {isUpdating && <Spinner size="sm" />}
      </PreviewHeader>
      <MarkdownPreview
        content={substituteVariables(template.content, variableValues)}
      />
    </LivePreview>
  </ModalContent>
  <ModalActions>
    <Button onClick={onCancel} variant="secondary">
      Cancel
    </Button>
    <Button onClick={onCreateNote} variant="primary">
      Create Note
    </Button>
  </ModalActions>
</InstantiationModal>
```

### Accessibility Considerations

#### Keyboard Navigation
- **Tab**: Navigate form fields, buttons
- **Enter**: Submit form, save template
- **Ctrl+S**: Save template (in editor)
- **Escape**: Close modals
- **Ctrl+P**: Toggle preview pane

#### Screen Reader Support
- **Template Cards**: "Weekly Standup template, 5 variables, used 12 times"
- **Variable Form**: "Enter value for variable: date"
- **Preview**: "Live preview updates as you type"
- **Validation**: aria-invalid and error messages

#### Visual Accessibility
- **Variable Syntax**: Blue highlight for {{vars}} in editor
- **Preview Updates**: Subtle fade transition, not distracting
- **Required Fields**: Asterisk + aria-required

### Mobile Responsive Design

#### Mobile (< 640px)
- Template grid: 1 column (cards full width)
- Editor: Full-screen overlay
- Preview pane: Tabs (edit/preview toggle)
- Variable form: Full-screen, one field at a time

#### Tablet (640-1024px)
- Template grid: 2 columns
- Editor: 80% width modal
- Preview pane: Side-by-side (50/50 split)

### Error States
- **No Templates**: Empty state with "Create Template" CTA
- **Variable Missing Value**: "Please fill in all variables" warning
- **Save Failed**: "Could not save template. Try again."
- **Duplicate Name**: "Template name already exists. Choose another."

### Performance Considerations
- **Preview Debouncing**: 500ms delay on variable input
- **Markdown Parsing**: Cached, only re-parse on content change
- **Template List Pagination**: 24 templates per page, lazy load on scroll

---

## Cross-Feature Integration

### Navigation Integration
All six features integrated into HotM's existing sidebar navigation:

```
Hall of Mind (Main Nav)
├── Notes (Existing)
├── Search (Existing)
├── NEW: Memory Search ⭐
├── NEW: SKOS Concepts ⭐
├── NEW: Templates ⭐
├── Collections (Existing)
├── NEW: Knowledge Health ⭐
└── Settings (Existing)

Note View (Context Menu)
├── Edit (Existing)
├── Tags (Existing) → Integrates with SKOS
├── NEW: Attachments ⭐
├── NEW: History ⭐
└── Delete (Existing)
```

### Contextual Actions
Features accessible from multiple entry points:

| Feature | Primary Entry | Secondary Entry | Contextual Entry |
|---------|---------------|-----------------|------------------|
| SKOS Browser | Sidebar Nav | Note Tag Selector | Search Filters |
| Attachments | Note View Panel | Drag-and-drop overlay | Memory Search Results |
| Memory Search | Sidebar Nav | Attachment Map View | Search Results |
| Knowledge Health | Sidebar Nav | Settings Dashboard | Empty States |
| Version History | Note Toolbar | Note Context Menu | Conflict Resolution |
| Templates | Sidebar Nav | New Note Dialog | Quick Actions Menu |

### Data Flow Between Features

#### Example: Photo → Memory Search → Note
1. User attaches photo with GPS to note
2. User clicks location badge on attachment
3. System opens Memory Search with location pre-filled
4. User finds related notes from same location
5. User links notes via "Add Link" action

#### Example: SKOS → Knowledge Health
1. User tags notes with SKOS concepts
2. Knowledge Health dashboard shows improved tag coverage
3. User sees "Orphan Concepts" metric
4. User clicks action, opens SKOS browser filtered to orphans

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- **API Client Extensions**: Add Fortemi endpoint methods
- **UI Components**: Build shared components (Map, Timeline, Diff Viewer)
- **Accessibility**: Establish keyboard navigation patterns

### Phase 2: Core Features (Weeks 3-6)
- **Week 3**: File Attachments Panel (Upload, Preview, Metadata)
- **Week 4**: Version History (Timeline, View modes)
- **Week 5**: Template Management (CRUD, Instantiation)
- **Week 6**: SKOS Concept Browser (Tree view, Relationships)

### Phase 3: Advanced Features (Weeks 7-9)
- **Week 7**: Memory Search (Location picker, Time range)
- **Week 8**: Knowledge Health Dashboard (Metrics, Charts)
- **Week 9**: Integration testing, refinements

### Phase 4: Polish (Weeks 10-11)
- **Week 10**: Mobile responsive optimization
- **Week 11**: Accessibility audit, performance tuning

### Phase 5: Launch (Week 12)
- **Week 12**: User acceptance testing, documentation, rollout

---

## Testing & Validation

### Usability Testing Plan
1. **Moderated Sessions**: 5 users per persona (15 total)
2. **Tasks**: Complete key flows for each feature
3. **Metrics**: Task completion rate, time-on-task, error rate
4. **Success Criteria**: 80%+ completion, < 5 min/task, < 2 errors/task

### Accessibility Testing
1. **Screen Reader**: NVDA (Windows), VoiceOver (macOS)
2. **Keyboard Only**: All features navigable without mouse
3. **Color Blindness**: Protanopia, Deuteranopia simulators
4. **WCAG Audit**: Automated (axe DevTools) + manual review

### Performance Benchmarks
1. **Initial Load**: < 2s (3G network)
2. **Feature Interaction**: < 100ms response time
3. **Map Rendering**: < 500ms for 100 markers
4. **Diff Generation**: < 1s for 10,000 line diff

---

## Open Questions & Risks

### Design Decisions Pending
1. **SKOS Tree**: Virtualized scrolling for 1000+ concepts?
2. **Memory Search**: Map library choice (Leaflet vs Mapbox)?
3. **Attachments**: Image compression on upload (client vs backend)?
4. **Version History**: Max versions to display (performance)?

### Technical Risks
1. **API Rate Limits**: Fortemi API throttling on bulk operations
2. **Browser Compatibility**: IndexedDB for offline attachment caching
3. **Large Files**: Chunked upload reliability
4. **Map Performance**: Clustering algorithm efficiency

### User Experience Risks
1. **Complexity Overload**: Too many features overwhelming users
2. **Discoverability**: Users not finding new features
3. **Learning Curve**: SKOS concepts unfamiliar to non-technical users
4. **Mobile Performance**: Map + timeline interactions on small screens

---

## Appendix

### Design Assets
- **Figma Mockups**: [Link to design file]
- **Component Library**: [Storybook URL]
- **Icon Set**: Lucide React (https://lucide.dev)

### API Endpoints Reference
See [Fortemi API Documentation](https://git.integrolabs.net/Fortemi/fortemi/src/branch/main/docs/content/api.md)

### Accessibility Guidelines
- **WCAG 2.1 Level AA**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/

### User Research Repository
- **Personas**: [Link to research docs]
- **Journey Maps**: [Link to journey maps]
- **Usability Tests**: [Link to test reports]

---

**Document Approvals**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Design Lead | [Name] | [Date] | [Signature] |
| UX Researcher | [Name] | [Date] | [Signature] |
| Engineering Lead | [Name] | [Date] | [Signature] |
| Product Manager | [Name] | [Date] | [Signature] |

---

**Change History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-04 | Product Design | Initial comprehensive design |

---

*This document is a living specification and will be updated as design evolves through user feedback and technical constraints.*
