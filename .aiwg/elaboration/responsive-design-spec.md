# Responsive Design Specification

**Project**: HotM (Hall of the Mind)
**Document Type**: Technical Specification
**Phase**: Elaboration
**Version**: 1.0
**Date**: 2026-02-05
**Author**: UX Lead
**Status**: Draft

---

## 1. Executive Summary

This document defines the responsive design specifications for the HotM UI Redesign project, ensuring optimal user experience across desktop, tablet, and mobile devices. The specification aligns with NFR-003 requirements and leverages React 19, TailwindCSS, and Radix UI primitives.

### 1.1 Design Goals

- **Desktop-First Workflow**: Full-featured note-taking and knowledge management on desktop (1024px+)
- **Tablet Adaptation**: Responsive layouts with collapsible navigation for tablet devices (768px-1023px)
- **Mobile Essential Features**: Core functionality accessible on mobile devices (320px-767px)
- **Touch-Friendly**: All interactive elements meet accessibility standards (44x44px minimum)
- **Progressive Enhancement**: Features gracefully adapt based on viewport size

---

## 2. Breakpoint System

### 2.1 Defined Breakpoints

The HotM application uses a mobile-first breakpoint system aligned with TailwindCSS defaults:

| Breakpoint | Min Width | Max Width | Device Target | Feature Set |
|------------|-----------|-----------|---------------|-------------|
| `mobile` (default) | 0px | 767px | Smartphones | Essential features |
| `tablet` (`md`) | 768px | 1023px | Tablets, small laptops | Adapted layouts |
| `desktop` (`lg`) | 1024px | 1439px | Standard desktops | Full features |
| `desktop-xl` (`xl`) | 1440px | 1919px | Large monitors | Enhanced spacing |
| `desktop-2xl` (`2xl`) | 1920px+ | ∞ | Ultra-wide displays | Multi-column layouts |

### 2.2 TailwindCSS Configuration

Update `/home/roctinam/dev/HotM/ui/tailwind.config.js` to include responsive utilities:

```javascript
module.exports = {
  theme: {
    screens: {
      // Mobile-first (default, no prefix needed)
      'sm': '640px',  // Small devices (not used for major breakpoints)
      'md': '768px',  // Tablet
      'lg': '1024px', // Desktop
      'xl': '1440px', // Large desktop
      '2xl': '1920px', // Ultra-wide
    },
    extend: {
      // Touch-friendly sizing
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

### 2.3 Behavior Changes at Breakpoints

| Viewport Change | UI Adaptation |
|-----------------|---------------|
| **Mobile → Tablet (768px)** | Sidebar becomes collapsible; two-column note list; larger touch targets remain |
| **Tablet → Desktop (1024px)** | Sidebar always visible; three-column layout (sidebar + list + editor); enhanced metadata panel |
| **Desktop → Large Desktop (1440px)** | Increased whitespace; wider content max-width; multi-panel views |
| **Large → Ultra-wide (1920px)** | Split-screen note editing; side-by-side comparison views |

---

## 3. Layout Patterns

### 3.1 Desktop Layout (1024px+)

**Primary Pattern**: Three-column layout with persistent sidebar.

```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar: 240-280px] │ [List: 320-400px] │ [Editor: Flex] │
├──────────────────────┼───────────────────┼─────────────────┤
│                      │                   │                 │
│ - Global Search      │ - Note Cards      │ - Editor        │
│ - Collections        │ - Metadata        │ - Preview       │
│ - Tags               │ - Quick Actions   │ - Metadata      │
│ - Settings           │                   │ - Related Notes │
│ - Job Queue          │                   │                 │
│                      │                   │                 │
└──────────────────────┴───────────────────┴─────────────────┘
```

**Implementation**:
```tsx
<div className="flex h-screen">
  {/* Sidebar */}
  <aside className="w-64 border-r bg-sidebar lg:w-72 xl:w-80">
    <Sidebar />
  </aside>

  {/* Note List */}
  <section className="w-96 border-r overflow-y-auto xl:w-[400px]">
    <NoteList />
  </section>

  {/* Editor */}
  <main className="flex-1 overflow-y-auto">
    <NoteEditor />
  </main>
</div>
```

### 3.2 Tablet Layout (768px-1023px)

**Primary Pattern**: Two-column with collapsible sidebar.

```
┌───────────────────────────────────────────┐
│ [☰] [List: 320px] │ [Editor: Flex]       │
├───────────────────┼──────────────────────┤
│                   │                      │
│ - Note Cards      │ - Editor             │
│ - Compact Meta    │ - Preview Toggle     │
│ - Swipe Actions   │ - Floating Metadata  │
│                   │                      │
└───────────────────┴──────────────────────┘
```

**Sidebar**: Overlay drawer triggered by hamburger menu.

**Implementation**:
```tsx
<div className="flex h-screen">
  {/* Collapsible Sidebar Overlay */}
  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
    <SheetContent side="left" className="w-64">
      <Sidebar />
    </SheetContent>
  </Sheet>

  {/* Header with Menu Toggle */}
  <div className="flex flex-col flex-1">
    <header className="border-b p-4 flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>
      <SearchBar />
    </header>

    {/* Content Area */}
    <div className="flex flex-1 overflow-hidden">
      <section className="w-80 border-r overflow-y-auto">
        <NoteList />
      </section>
      <main className="flex-1 overflow-y-auto">
        <NoteEditor />
      </main>
    </div>
  </div>
</div>
```

### 3.3 Mobile Layout (320px-767px)

**Primary Pattern**: Single-column stack with bottom navigation.

```
┌─────────────────────────────────────┐
│ [Header: Search + Actions]          │
├─────────────────────────────────────┤
│                                     │
│ [Content: Full Width]               │
│                                     │
│ - Note List (default view)          │
│ - Note Editor (when note selected)  │
│ - Search Results                    │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ [Bottom Nav: Home|Search|New|Menu]  │
└─────────────────────────────────────┘
```

**View Stack**:
1. **List View** (default): Full-screen scrollable note cards
2. **Editor View**: Full-screen note editing
3. **Search View**: Full-screen search interface
4. **Menu View**: Drawer with settings and organization

**Implementation**:
```tsx
<div className="flex flex-col h-screen">
  {/* Mobile Header */}
  <header className="border-b p-4 flex items-center gap-2 sticky top-0 bg-background z-10">
    <Button variant="ghost" size="icon" onClick={() => setMobileView('menu')}>
      <Menu className="h-5 w-5" />
    </Button>
    <div className="flex-1">
      <SearchBar mobile />
    </div>
  </header>

  {/* Content Area */}
  <main className="flex-1 overflow-y-auto pb-16">
    {mobileView === 'list' && <NoteList mobile />}
    {mobileView === 'editor' && <NoteEditor mobile />}
    {mobileView === 'search' && <SearchView mobile />}
  </main>

  {/* Bottom Navigation */}
  <nav className="fixed bottom-0 left-0 right-0 border-t bg-background flex justify-around p-2">
    <Button variant="ghost" size="icon" onClick={() => setMobileView('list')}>
      <Home className="h-6 w-6" />
    </Button>
    <Button variant="ghost" size="icon" onClick={() => setMobileView('search')}>
      <Search className="h-6 w-6" />
    </Button>
    <Button variant="default" size="icon" onClick={createNewNote}>
      <Plus className="h-6 w-6" />
    </Button>
    <Button variant="ghost" size="icon" onClick={() => setMobileView('menu')}>
      <Menu className="h-6 w-6" />
    </Button>
  </nav>
</div>
```

### 3.4 Grid Systems

**Desktop Note Grid** (Collection/Archive Views):
```tsx
<div className="grid gap-4 p-4
  grid-cols-1
  md:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
  2xl:grid-cols-5">
  {notes.map(note => <NoteCard key={note.id} note={note} />)}
</div>
```

**Tablet Note Grid**:
```tsx
<div className="grid gap-3 p-3 grid-cols-2">
  {notes.map(note => <NoteCard key={note.id} note={note} compact />)}
</div>
```

**Mobile Note Stack**:
```tsx
<div className="flex flex-col gap-2 p-2">
  {notes.map(note => <NoteCard key={note.id} note={note} mobile />)}
</div>
```

---

## 4. Navigation Patterns

### 4.1 Desktop Navigation

**Pattern**: Persistent left sidebar with hierarchical menu.

**Components**:
- Global search bar (top)
- Primary navigation (Collections, Tags, Archive)
- Job queue indicator (bottom)
- Settings/profile (bottom)

**Implementation**:
```tsx
<Sidebar className="hidden lg:flex">
  <SidebarHeader>
    <div className="flex items-center gap-2 px-4 py-2">
      <Brain className="h-6 w-6" />
      <span className="font-semibold text-lg">HotM</span>
    </div>
    <div className="px-2">
      <SearchBar />
    </div>
  </SidebarHeader>

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Collections</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Star />All Notes
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* More menu items */}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>

  <SidebarFooter>
    <JobQueueIndicator />
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton>
          <Settings />Settings
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarFooter>
</Sidebar>
```

### 4.2 Tablet Navigation

**Pattern**: Collapsible drawer with hamburger trigger.

**Behavior**:
- Hamburger icon in top-left corner
- Drawer slides in from left (320px wide)
- Backdrop overlay when open
- Close on navigation item click or backdrop tap

**Implementation**:
```tsx
<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="md:inline-flex lg:hidden">
      <Menu className="h-5 w-5" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-80 p-0">
    <Sidebar onNavigate={() => setSidebarOpen(false)} />
  </SheetContent>
</Sheet>
```

### 4.3 Mobile Navigation

**Pattern**: Bottom tab bar with primary actions.

**Tabs**:
1. **Home**: Note list view
2. **Search**: Full-screen search
3. **New Note**: Quick capture (FAB-style, elevated)
4. **Menu**: Settings and organization

**Touch Targets**: 60px height, 80px width minimum.

**Implementation**:
```tsx
<nav className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
  <div className="flex justify-around items-center h-16">
    <NavButton
      icon={Home}
      label="Home"
      active={view === 'list'}
      onClick={() => setView('list')}
    />
    <NavButton
      icon={Search}
      label="Search"
      active={view === 'search'}
      onClick={() => setView('search')}
    />
    <button
      className="flex flex-col items-center justify-center w-20 -mt-6"
      onClick={createNewNote}
    >
      <div className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg">
        <Plus className="h-6 w-6" />
      </div>
    </button>
    <NavButton
      icon={Menu}
      label="Menu"
      active={view === 'menu'}
      onClick={() => setView('menu')}
    />
  </div>
</nav>

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      className={cn(
        "flex flex-col items-center justify-center gap-1 w-20 h-full",
        active && "text-primary"
      )}
      onClick={onClick}
    >
      <Icon className="h-6 w-6" />
      <span className="text-xs">{label}</span>
    </button>
  );
}
```

### 4.4 Breadcrumbs (Desktop/Tablet)

For nested navigation (Collection → Note):

```tsx
<Breadcrumb className="hidden md:flex p-4 border-b">
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/collections">Collections</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/collections/work">Work</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Meeting Notes</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

## 5. Component Adaptations

### 5.1 Note Cards

**Desktop** (320px wide in list):
```tsx
<Card className="hover:shadow-md transition-shadow">
  <CardHeader>
    <div className="flex items-start justify-between">
      <CardTitle className="line-clamp-2">{note.title}</CardTitle>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Archive</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <CardDescription className="line-clamp-3">
      {note.content}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex flex-wrap gap-1 mb-2">
      {note.tags.map(tag => (
        <Badge key={tag} variant="secondary">{tag}</Badge>
      ))}
    </div>
    <div className="flex items-center text-xs text-muted-foreground">
      <Clock className="h-3 w-3 mr-1" />
      {formatDate(note.updatedAt)}
    </div>
  </CardContent>
</Card>
```

**Tablet** (compact, 2-column grid):
```tsx
<Card className="hover:bg-accent transition-colors">
  <CardHeader className="p-3">
    <CardTitle className="text-sm line-clamp-1">{note.title}</CardTitle>
    <CardDescription className="text-xs line-clamp-2">
      {note.content}
    </CardDescription>
  </CardHeader>
  <CardContent className="p-3 pt-0">
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{note.tags.length} tags</span>
      <span>{formatRelativeDate(note.updatedAt)}</span>
    </div>
  </CardContent>
</Card>
```

**Mobile** (full-width, touch-optimized):
```tsx
<Card
  className="active:bg-accent transition-colors"
  onClick={() => openNote(note.id)}
>
  <CardHeader className="p-4 pb-2">
    <div className="flex items-start justify-between gap-2">
      <CardTitle className="text-base line-clamp-2 flex-1">
        {note.title}
      </CardTitle>
      <Button
        variant="ghost"
        size="icon"
        className="min-w-touch min-h-touch -mr-2"
        onClick={(e) => {
          e.stopPropagation();
          showContextMenu(note);
        }}
      >
        <MoreVertical className="h-5 w-5" />
      </Button>
    </div>
    <CardDescription className="text-sm line-clamp-3 mt-1">
      {note.content}
    </CardDescription>
  </CardHeader>
  <CardContent className="p-4 pt-2">
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Hash className="h-3 w-3" />
        <span>{note.tags.length}</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span>{formatRelativeDate(note.updatedAt)}</span>
      </div>
    </div>
  </CardContent>
</Card>
```

### 5.2 Modals/Dialogs

**Desktop**: Centered modal with backdrop (max-width: 600px).

**Tablet**: Centered modal with backdrop (max-width: 90vw).

**Mobile**: Full-screen slide-up sheet.

```tsx
function ResponsiveDialog({ open, onOpenChange, title, children }) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh]">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
```

### 5.3 Tables

**Desktop**: Standard table with all columns.

**Tablet**: Hide less critical columns, add expand button.

**Mobile**: Convert to card list view.

```tsx
function ResponsiveTable({ notes }) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {notes.map(note => (
          <Card key={note.id}>
            <CardContent className="p-4">
              <div className="font-medium">{note.title}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {formatDate(note.createdAt)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          {!isTablet && <TableHead>Tags</TableHead>}
          <TableHead>Created</TableHead>
          {!isTablet && <TableHead>Updated</TableHead>}
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notes.map(note => (
          <TableRow key={note.id}>
            <TableCell className="font-medium">{note.title}</TableCell>
            {!isTablet && (
              <TableCell>
                <div className="flex gap-1">
                  {note.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
                </div>
              </TableCell>
            )}
            <TableCell>{formatDate(note.createdAt)}</TableCell>
            {!isTablet && <TableCell>{formatDate(note.updatedAt)}</TableCell>}
            <TableCell>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 5.4 Forms

**Desktop**: Two-column layout for related fields.

**Tablet/Mobile**: Single-column stack.

```tsx
<form className="space-y-4">
  <div className="grid gap-4 md:grid-cols-2">
    <div className="space-y-2">
      <Label htmlFor="title">Title</Label>
      <Input id="title" placeholder="Note title" />
    </div>
    <div className="space-y-2">
      <Label htmlFor="collection">Collection</Label>
      <Select>
        <SelectTrigger id="collection">
          <SelectValue placeholder="Select collection" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="work">Work</SelectItem>
          <SelectItem value="personal">Personal</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>

  <div className="space-y-2">
    <Label htmlFor="content">Content</Label>
    <Textarea
      id="content"
      placeholder="Write your note..."
      className="min-h-[200px]"
    />
  </div>

  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
    <Button variant="outline" type="button" className="sm:w-auto">
      Cancel
    </Button>
    <Button type="submit" className="sm:w-auto">
      Save Note
    </Button>
  </div>
</form>
```

### 5.5 Search Interface

**Desktop**: Inline search bar with dropdown results.

**Tablet**: Full-width search bar with overlay results.

**Mobile**: Dedicated full-screen search view.

```tsx
function ResponsiveSearch() {
  const [query, setQuery] = useState('');
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes..."
              className="pl-10 pr-10 h-12"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setQuery('')}
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <SearchResults query={query} />
        </ScrollArea>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-muted-foreground">
          <Search className="h-4 w-4 mr-2" />
          Search notes...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search notes..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Recent Notes">
              <SearchResults query={query} />
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

---

## 6. Touch Interactions

### 6.1 Touch Target Sizing

**Minimum Touch Target**: 44x44px (WCAG 2.1 Level AAA)
**Recommended Touch Target**: 48x48px
**Comfortable Touch Target**: 56x56px (primary actions)

**Implementation**:
```css
/* Global touch-friendly classes */
.touch-target {
  @apply min-w-touch min-h-touch;
}

.touch-target-comfortable {
  @apply min-w-[48px] min-h-[48px];
}

.touch-target-primary {
  @apply min-w-[56px] min-h-[56px];
}
```

### 6.2 Button Spacing

**Mobile Button Groups**:
```tsx
<div className="flex gap-3">
  <Button className="min-w-touch min-h-touch">Action 1</Button>
  <Button className="min-w-touch min-h-touch">Action 2</Button>
</div>
```

**Floating Action Button (FAB)**:
```tsx
<Button
  size="lg"
  className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg md:hidden"
  onClick={createNewNote}
>
  <Plus className="h-6 w-6" />
</Button>
```

### 6.3 Swipe Gestures (Mobile)

**Note Card Swipe Actions**:
- **Swipe Right**: Archive note
- **Swipe Left**: Delete note
- **Long Press**: Show context menu

```tsx
import { useSwipeable } from 'react-swipeable';

function SwipeableNoteCard({ note, onArchive, onDelete }) {
  const handlers = useSwipeable({
    onSwipedRight: () => onArchive(note.id),
    onSwipedLeft: () => onDelete(note.id),
    preventScrollOnSwipe: true,
    trackMouse: false,
  });

  return (
    <div {...handlers} className="relative overflow-hidden">
      {/* Swipe reveal backgrounds */}
      <div className="absolute inset-0 bg-green-500 flex items-center justify-start pl-4">
        <Archive className="h-5 w-5 text-white" />
      </div>
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4">
        <Trash className="h-5 w-5 text-white" />
      </div>

      {/* Card content */}
      <Card className="relative bg-background">
        <CardContent>{/* Note content */}</CardContent>
      </Card>
    </div>
  );
}
```

### 6.4 Pull-to-Refresh (Mobile)

Implement pull-to-refresh on note list:

```tsx
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

function NoteList() {
  const { isRefreshing, refresh } = useNotes();
  const { pullDistance, isPulling } = usePullToRefresh({
    onRefresh: refresh,
    threshold: 80,
  });

  return (
    <div className="relative">
      {/* Pull indicator */}
      {isPulling && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center py-4 transition-transform"
          style={{ transform: `translateY(${Math.min(pullDistance, 80)}px)` }}
        >
          <RefreshCw
            className={cn(
              "h-5 w-5 text-muted-foreground",
              pullDistance > 80 && "animate-spin"
            )}
          />
        </div>
      )}

      {/* Note list */}
      <ScrollArea>
        {notes.map(note => <NoteCard key={note.id} note={note} />)}
      </ScrollArea>
    </div>
  );
}
```

### 6.5 Long-Press Actions

**Context Menu on Long Press**:
```tsx
import { useLongPress } from '@/hooks/useLongPress';

function NoteCard({ note }) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const longPressHandlers = useLongPress(
    () => setContextMenuOpen(true),
    { threshold: 500 }
  );

  return (
    <>
      <Card {...longPressHandlers}>
        <CardContent>{/* Note content */}</CardContent>
      </Card>

      <ContextMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <ContextMenuContent>
          <ContextMenuItem>Edit</ContextMenuItem>
          <ContextMenuItem>Archive</ContextMenuItem>
          <ContextMenuItem>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
```

### 6.6 Haptic Feedback (Progressive Enhancement)

```typescript
// utils/haptics.ts
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'medium') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
    };
    navigator.vibrate(patterns[type]);
  }
}

// Usage
<Button
  onClick={() => {
    triggerHaptic('medium');
    createNewNote();
  }}
>
  Create Note
</Button>
```

---

## 7. Typography Scale

### 7.1 Responsive Font Sizes

| Element | Mobile | Tablet | Desktop | Line Height |
|---------|--------|--------|---------|-------------|
| Display Heading | 2rem (32px) | 2.5rem (40px) | 3rem (48px) | 1.2 |
| H1 (Page Title) | 1.75rem (28px) | 2rem (32px) | 2.25rem (36px) | 1.3 |
| H2 (Section) | 1.5rem (24px) | 1.75rem (28px) | 2rem (32px) | 1.3 |
| H3 (Card Title) | 1.25rem (20px) | 1.375rem (22px) | 1.5rem (24px) | 1.4 |
| H4 (Subsection) | 1.125rem (18px) | 1.25rem (20px) | 1.25rem (20px) | 1.4 |
| Body Large | 1rem (16px) | 1.0625rem (17px) | 1.125rem (18px) | 1.6 |
| Body | 0.875rem (14px) | 0.9375rem (15px) | 1rem (16px) | 1.6 |
| Body Small | 0.8125rem (13px) | 0.875rem (14px) | 0.875rem (14px) | 1.5 |
| Caption | 0.75rem (12px) | 0.8125rem (13px) | 0.8125rem (13px) | 1.4 |

### 7.2 TailwindCSS Typography Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontSize: {
        // Mobile-first base sizes
        'display': ['2rem', { lineHeight: '1.2' }],
        'h1': ['1.75rem', { lineHeight: '1.3' }],
        'h2': ['1.5rem', { lineHeight: '1.3' }],
        'h3': ['1.25rem', { lineHeight: '1.4' }],
        'h4': ['1.125rem', { lineHeight: '1.4' }],
        'body-lg': ['1rem', { lineHeight: '1.6' }],
        'body': ['0.875rem', { lineHeight: '1.6' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5' }],
        'caption': ['0.75rem', { lineHeight: '1.4' }],
      },
    },
  },
}
```

### 7.3 Responsive Typography Classes

```tsx
{/* Display heading */}
<h1 className="text-display md:text-[2.5rem] lg:text-[3rem] font-bold">
  Hall of the Mind
</h1>

{/* Page title */}
<h1 className="text-h1 md:text-[2rem] lg:text-[2.25rem] font-semibold">
  Your Notes
</h1>

{/* Section heading */}
<h2 className="text-h2 md:text-[1.75rem] lg:text-[2rem] font-semibold">
  Recent Activity
</h2>

{/* Card title */}
<h3 className="text-h3 md:text-[1.375rem] lg:text-[1.5rem] font-medium">
  Meeting Notes
</h3>

{/* Body text */}
<p className="text-body md:text-[0.9375rem] lg:text-base">
  Note content with readable line height for optimal reading experience.
</p>

{/* Caption/metadata */}
<span className="text-caption md:text-[0.8125rem] text-muted-foreground">
  Updated 2 hours ago
</span>
```

### 7.4 Reading Width (Content Max-Width)

Optimal reading line length: 50-75 characters (approximately 600-800px).

```tsx
{/* Note editor content area */}
<div className="prose prose-sm md:prose-base lg:prose-lg mx-auto max-w-3xl">
  <MarkdownPreview content={note.content} />
</div>
```

### 7.5 Dynamic Font Scaling

For long content, use `clamp()` for fluid typography:

```css
.fluid-heading {
  font-size: clamp(1.5rem, 4vw, 2.25rem);
}

.fluid-body {
  font-size: clamp(0.875rem, 2vw, 1rem);
}
```

---

## 8. Media Queries & Utilities

### 8.1 Custom React Hooks

**useMediaQuery Hook**:
```typescript
// hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// Usage
const isMobile = useMediaQuery('(max-width: 767px)');
const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
const isDesktop = useMediaQuery('(min-width: 1024px)');
```

**useBreakpoint Hook**:
```typescript
// hooks/useBreakpoint.ts
import { useMediaQuery } from './useMediaQuery';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'desktop-xl' | 'desktop-2xl';

export function useBreakpoint(): Breakpoint {
  const is2xl = useMediaQuery('(min-width: 1920px)');
  const isXl = useMediaQuery('(min-width: 1440px)');
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isMd = useMediaQuery('(min-width: 768px)');

  if (is2xl) return 'desktop-2xl';
  if (isXl) return 'desktop-xl';
  if (isLg) return 'desktop';
  if (isMd) return 'tablet';
  return 'mobile';
}

// Usage
const breakpoint = useBreakpoint();
const showSidebar = breakpoint !== 'mobile';
```

### 8.2 Responsive Visibility Classes

```tsx
{/* Show only on mobile */}
<div className="block md:hidden">Mobile only</div>

{/* Show only on tablet */}
<div className="hidden md:block lg:hidden">Tablet only</div>

{/* Show only on desktop */}
<div className="hidden lg:block">Desktop only</div>

{/* Hide on mobile */}
<div className="hidden md:block">Tablet and desktop</div>

{/* Hide on desktop */}
<div className="block lg:hidden">Mobile and tablet</div>
```

### 8.3 Container Queries (Future)

For component-level responsive design:

```tsx
<div className="@container">
  <div className="grid @md:grid-cols-2 @lg:grid-cols-3 gap-4">
    {items.map(item => <Card key={item.id} {...item} />)}
  </div>
</div>
```

---

## 9. Accessibility Considerations

### 9.1 Focus Management

**Keyboard Navigation**: Ensure all interactive elements are keyboard-accessible.

```tsx
<Button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }}
>
  Action
</Button>
```

### 9.2 Screen Reader Support

**ARIA Labels for Icon-Only Buttons**:
```tsx
<Button variant="ghost" size="icon" aria-label="Open menu">
  <Menu className="h-5 w-5" />
</Button>
```

**Live Regions for Dynamic Content**:
```tsx
<div aria-live="polite" aria-atomic="true">
  {isLoading ? 'Loading notes...' : `${notes.length} notes loaded`}
</div>
```

### 9.3 Skip Links (Mobile)

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground"
>
  Skip to main content
</a>
```

---

## 10. Performance Optimizations

### 10.1 Lazy Loading Images

```tsx
<img
  src={note.coverImage}
  alt={note.title}
  loading="lazy"
  className="w-full h-48 object-cover"
/>
```

### 10.2 Virtual Scrolling (Large Lists)

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualNoteList({ notes }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <NoteCard note={notes[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 10.3 Responsive Images

```tsx
<img
  srcSet="
    /images/note-small.webp 320w,
    /images/note-medium.webp 768w,
    /images/note-large.webp 1024w
  "
  sizes="
    (max-width: 767px) 100vw,
    (max-width: 1023px) 50vw,
    33vw
  "
  src="/images/note-large.webp"
  alt="Note preview"
/>
```

---

## 11. Testing Strategy

### 11.1 Responsive Testing Checklist

- [ ] Test all breakpoints (320px, 375px, 768px, 1024px, 1440px, 1920px)
- [ ] Verify touch target sizes (44x44px minimum)
- [ ] Test landscape and portrait orientations
- [ ] Verify text readability at all sizes
- [ ] Check navigation patterns work at each breakpoint
- [ ] Test swipe gestures on touch devices
- [ ] Verify keyboard navigation on desktop
- [ ] Test screen reader compatibility
- [ ] Verify print styles

### 11.2 Automated Visual Regression Tests

```typescript
// e2e/responsive.spec.ts
import { test, expect } from '@playwright/test';

const breakpoints = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const { name, width, height } of breakpoints) {
  test(`renders correctly on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page).toHaveScreenshot(`homepage-${name}.png`);
  });
}
```

### 11.3 Manual Testing Devices

**Recommended Test Devices**:
- **Mobile**: iPhone 14 (390x844), Samsung Galaxy S23 (360x800)
- **Tablet**: iPad Air (820x1180), Samsung Galaxy Tab (768x1024)
- **Desktop**: 1920x1080, 2560x1440

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Configure TailwindCSS breakpoints
- [ ] Implement `useMediaQuery` and `useBreakpoint` hooks
- [ ] Create responsive layout containers
- [ ] Establish touch target sizing standards

### Phase 2: Navigation (Week 2-3)
- [ ] Build desktop persistent sidebar
- [ ] Implement tablet collapsible drawer
- [ ] Create mobile bottom navigation
- [ ] Add breadcrumbs for desktop/tablet

### Phase 3: Component Adaptations (Week 3-5)
- [ ] Adapt note cards for all breakpoints
- [ ] Implement responsive modals/dialogs
- [ ] Create responsive table/list views
- [ ] Build responsive forms
- [ ] Adapt search interface

### Phase 4: Touch Interactions (Week 5-6)
- [ ] Implement swipe gestures
- [ ] Add pull-to-refresh
- [ ] Implement long-press actions
- [ ] Add haptic feedback

### Phase 5: Polish & Testing (Week 6-7)
- [ ] Optimize typography scale
- [ ] Performance optimizations
- [ ] Accessibility audit
- [ ] Visual regression testing
- [ ] User acceptance testing

---

## 13. Appendix

### 13.1 Common Responsive Patterns

**Responsive Grid**:
```tsx
<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
```

**Responsive Flex Direction**:
```tsx
<div className="flex flex-col md:flex-row gap-4">
```

**Responsive Spacing**:
```tsx
<div className="p-4 md:p-6 lg:p-8">
```

**Responsive Text Alignment**:
```tsx
<h1 className="text-center md:text-left">
```

### 13.2 Resources

- **TailwindCSS Responsive Design**: https://tailwindcss.com/docs/responsive-design
- **Radix UI Primitives**: https://www.radix-ui.com/primitives
- **React ARIA**: https://react-spectrum.adobe.com/react-aria/
- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **Mobile UX Patterns**: https://mobbin.com/

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-02-05 |
| Last Updated | 2026-02-05 |
| Version | 1.0 |
| Author | UX Lead |
| Reviewers | Product Designer, Implementer |
| Status | Draft |
| Next Review | Post-implementation validation |

---

*End of Responsive Design Specification v1.0*
