# HotM UI Redesign - Vision Document

## Executive Summary

This document outlines the vision for a complete redesign of the HotM (Hall of the Mind) user interface to fully expose all Fortemi API capabilities. The redesign will transform HotM from a basic note-taking application into a comprehensive **Personal Knowledge Management System** with spatial awareness, knowledge health insights, and powerful organizational tools.

## Problem Statement

The current HotM UI implements only **45% of available Fortemi API capabilities**. Users cannot:
- Search notes by location or time (Memory Search)
- Visualize their knowledge graph
- Manage collections effectively
- Monitor knowledge base health
- Use templates for common note types
- Access administrative features

This limits the system's value proposition as a "second brain" tool.

## Vision Statement

> **HotM will become the most complete interface for AI-enhanced personal knowledge management**, exposing 100% of Fortemi's capabilities through an intuitive, responsive, and visually distinctive design that supports knowledge workers, teams, and power users alike.

## Target User Personas

### 1. Knowledge Worker (Primary)
- **Profile**: Researcher, writer, student, professional
- **Needs**: Quick capture, powerful search, organization
- **Goals**: Build and maintain a personal knowledge base
- **Technical Level**: Intermediate

### 2. Power User (Secondary)
- **Profile**: Developer, data scientist, system integrator
- **Needs**: API access, bulk operations, customization
- **Goals**: Integrate with workflows, automation
- **Technical Level**: Advanced

### 3. Team Lead (Tertiary)
- **Profile**: Manager, coordinator, team organizer
- **Needs**: Shared collections, overview dashboards
- **Goals**: Team knowledge management
- **Technical Level**: Basic to Intermediate

## Core Design Principles

### 1. Progressive Disclosure
- Simple by default, powerful when needed
- Advanced features accessible but not overwhelming
- Contextual help and onboarding

### 2. Spatial Awareness
- Location and time as first-class navigation
- Map and timeline views for spatial-temporal exploration
- Geographic clustering of related notes

### 3. Knowledge Visualization
- Graph views for relationship exploration
- Health metrics for quality awareness
- Activity timelines for context

### 4. Responsive First
- Mobile-optimized from day one
- Touch-friendly interactions
- Offline capability (PWA future)

### 5. Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support

## Feature Scope

### Must Have (MVP)
1. **Complete Note Management** - All CRUD operations with original/revised views
2. **Hybrid Search** - Full-text + semantic with all filters
3. **Collections Management** - Create, organize, browse collections
4. **Knowledge Health Dashboard** - Metrics, orphans, stale notes
5. **Memory Search** - Spatiotemporal search with map/timeline
6. **Tag Management** - Hierarchical tags with bulk operations

### Should Have (v1.1)
7. **Graph Explorer** - Interactive knowledge graph visualization
8. **Template System** - Create and use note templates
9. **Admin Panel** - Authentication, API keys, settings
10. **Timeline View** - Chronological note browsing

### Could Have (v1.2)
11. **Advanced Concept Browser** - Full SKOS hierarchy management
12. **Embedding Configuration** - Model selection, custom sets
13. **Analytics Dashboard** - Usage trends, link analysis
14. **Export/Import Wizard** - Bulk data operations

### Won't Have (v1.x)
- Real-time collaboration (future)
- Mobile native apps (future)
- Voice input (future)

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| API Coverage | 45% | 95% | Feature audit |
| Page Load (LCP) | ~3.5s | <2.5s | Lighthouse |
| Search Latency | ~800ms | <500ms | APM |
| User Task Completion | Unknown | >90% | Usability testing |
| Accessibility Score | Unknown | 95+ | axe-core |

## Technical Constraints

1. **Existing Stack**: React 19, TypeScript, Vite, TailwindCSS, Radix UI
2. **API**: Fortemi REST API (port 3000), no WebSocket support currently
3. **Browser Support**: Chrome/Firefox/Safari (last 2 versions), Edge
4. **Bundle Size**: Target <500KB gzipped
5. **No Backend Changes**: UI-only implementation

## Timeline Overview

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Inception | 1 week | Vision, requirements, wireframes |
| Elaboration | 2 weeks | Architecture, detailed designs, prototypes |
| Construction 1 | 3 weeks | Core features (collections, health, memory) |
| Construction 2 | 3 weeks | Advanced features (graph, templates, admin) |
| Transition | 1 week | Testing, documentation, deployment |

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| API endpoint missing | High | Low | Verify all endpoints exist before design |
| Performance degradation | Medium | Medium | Incremental loading, virtualization |
| Scope creep | High | Medium | Strict MVP definition, phased releases |
| Browser compatibility | Low | Low | Use established libraries, polyfills |

## Approvals

- [ ] Product Owner
- [ ] Technical Lead
- [ ] UX Designer
- [ ] Development Team

---

*Document Version: 1.0*
*Created: 2026-02-05*
*Status: Draft for Review*
