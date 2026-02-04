# HotM UX Design Documentation

This directory contains user experience design specifications for HotM features.

## Available Documents

### [Fortemi Integration UX Design](./fortemi-integration-ux-design.md)
**Status**: Design Review
**Version**: 1.0
**Date**: 2026-02-04

Comprehensive UX design for six major Fortemi API features:

1. **SKOS Concept Browser** - Hierarchical taxonomy management with tree view, search, and relationship mapping
2. **File Attachments Panel** - Rich media management with EXIF extraction, location mapping, and preview capabilities
3. **Memory Search** - Spatiotemporal note discovery with location radius, time range, and combined filters
4. **Knowledge Health Dashboard** - System quality metrics with actionable insights and trend visualization
5. **Version History** - Temporal navigation with diff viewer and version restoration
6. **Template Management** - Content scaffolding with variable substitution and instantiation

## Design Principles

All HotM features follow these core principles:

1. **Progressive Disclosure** - Complex features revealed gradually to avoid overwhelming users
2. **Spatial Consistency** - Related features grouped logically in navigation and layout
3. **Feedback Clarity** - System state always visible with clear success/error messaging
4. **Graceful Degradation** - Features work without AI/network when possible
5. **Accessibility First** - WCAG 2.1 AA compliance, keyboard navigation, screen reader support

## Design System

### Technology Stack
- **UI Framework**: React 19 + TypeScript
- **Component Library**: Radix UI primitives
- **Styling**: TailwindCSS 3.x
- **Icons**: Lucide React
- **Layout**: Collapsible sidebar navigation

### Accessibility Standards
- **Keyboard Navigation**: All features fully keyboard-accessible
- **Screen Readers**: ARIA labels, live regions, semantic HTML
- **Visual**: WCAG 2.1 AA contrast ratios (4.5:1 minimum)
- **Focus Management**: Clear focus indicators (2px outline)

### Responsive Breakpoints
- **Mobile**: < 640px (full-screen modals, vertical stacks)
- **Tablet**: 640-1024px (side sheets, 2-column grids)
- **Desktop**: > 1024px (fixed panels, multi-column layouts)

## User Personas

### Research Rachel
**Role**: Academic researcher
**Key Features**: SKOS Browser, Knowledge Health, Version History
**Goal**: Organize literature with controlled vocabularies

### Creative Chris
**Role**: Content creator / journalist
**Key Features**: File Attachments, Memory Search
**Goal**: Capture context with photos and recall by location/time

### Manager Morgan
**Role**: Project manager
**Key Features**: Template Management, Knowledge Health
**Goal**: Maintain consistent documentation

### Developer Devon
**Role**: Software engineer
**Key Features**: Version History, SKOS Browser
**Goal**: Track code snippets and API documentation

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
API client extensions, shared UI components, accessibility patterns

### Phase 2: Core Features (Weeks 3-6)
File Attachments → Version History → Templates → SKOS Browser

### Phase 3: Advanced Features (Weeks 7-9)
Memory Search → Knowledge Health Dashboard → Integration testing

### Phase 4: Polish (Weeks 10-11)
Mobile optimization, accessibility audit, performance tuning

### Phase 5: Launch (Week 12)
User acceptance testing, documentation, rollout

## Testing Strategy

### Usability Testing
- **Participants**: 15 users (5 per primary persona)
- **Methods**: Moderated task-based sessions
- **Metrics**: Completion rate (80%+), time-on-task (<5 min), errors (<2 per task)

### Accessibility Testing
- **Tools**: NVDA, VoiceOver, axe DevTools
- **Coverage**: Keyboard navigation, screen reader, color blindness simulation
- **Standard**: WCAG 2.1 Level AA compliance

### Performance Benchmarks
- **Initial Load**: < 2s (3G network)
- **Interaction Response**: < 100ms
- **Map Rendering**: < 500ms (100 markers)
- **Diff Generation**: < 1s (10,000 lines)

## Cross-Feature Integration

### Navigation Structure
```
Hall of Mind (Sidebar)
├── Notes
├── Search
├── Memory Search (NEW)
├── SKOS Concepts (NEW)
├── Templates (NEW)
├── Collections
├── Knowledge Health (NEW)
└── Settings
```

### Contextual Entry Points
Features accessible from multiple locations:
- SKOS Browser: Sidebar, Tag selector, Search filters
- Attachments: Note panel, Drag-drop, Memory search
- Memory Search: Sidebar, Attachment map, Search results
- Version History: Note toolbar, Context menu, Conflicts

### Data Flow Examples

**Photo to Memory Search to Note**
1. Attach photo with GPS → 2. Click location badge → 3. Memory Search pre-filled → 4. Find related notes → 5. Link notes

**SKOS to Knowledge Health**
1. Tag notes with concepts → 2. Dashboard shows coverage → 3. View orphan concepts → 4. SKOS browser filtered

## Key Design Decisions

### Component Choices
- **Map Library**: Leaflet.js (lightweight, OSM tiles)
- **Diff Viewer**: Custom React component (side-by-side + unified)
- **Tree View**: Virtualized scrolling for large hierarchies
- **Date Picker**: Radix UI primitives with custom timeline

### Interaction Patterns
- **Drag and Drop**: File attachments, SKOS tree reordering
- **Inline Editing**: SKOS labels, template content
- **Lazy Loading**: Thumbnails, version history, search results
- **Debouncing**: Search (300ms), preview updates (500ms)

### Performance Optimizations
- **Virtual Scrolling**: Lists > 50 items
- **Image Optimization**: Progressive loading (blur → low-res → high-res)
- **Chunked Upload**: 5MB chunks with resume support
- **Result Pagination**: 50 items per page

## Open Questions

### Design Decisions Pending
1. SKOS tree virtualization threshold (500? 1000? 5000 concepts?)
2. Attachment compression strategy (client-side or server-side?)
3. Version history retention policy (max versions per note?)
4. Memory search default radius (500m? 1km? 5km?)

### Technical Risks
1. Fortemi API rate limits on bulk operations
2. Browser IndexedDB for offline attachment caching
3. Chunked upload reliability across networks
4. Map clustering performance with 1000+ markers

### User Experience Risks
1. Feature complexity overwhelming new users
2. Discoverability of new features in existing UI
3. SKOS learning curve for non-technical users
4. Mobile performance on low-end devices

## Resources

### External Links
- **Fortemi API**: [/mnt/dev-inbox/fortemi/fortemi/docs/content/api.md](../../fortemi/fortemi/docs/content/api.md)
- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Practices**: https://www.w3.org/WAI/ARIA/apg/
- **Lucide Icons**: https://lucide.dev
- **Radix UI**: https://www.radix-ui.com

### Internal Links
- **API Specification**: [../specifications/api-specification.md](../specifications/api-specification.md)
- **Architecture**: [../architecture/system-architecture.md](../architecture/system-architecture.md)
- **Testing Strategy**: [../implementation/testing-strategy.md](../implementation/testing-strategy.md)

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-04 | Product Design | Initial UX documentation |

## Next Steps

1. **Design Review**: Stakeholder feedback on comprehensive spec
2. **Prototype**: Build interactive Figma prototypes for usability testing
3. **Component Library**: Extend Storybook with new components
4. **User Testing**: Recruit participants, schedule sessions
5. **Implementation**: Begin Phase 1 (API client, shared components)

---

For questions or feedback, contact the Product Design team.
