# HotM UI Redesign - Risk Register

**Project**: HotM UI Redesign (HOTM-013)
**Phase**: Elaboration
**Version**: 1.0
**Last Updated**: 2026-02-05
**Status**: BASELINED

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Risks Identified | 12 |
| Critical (20-25) | 0 |
| High (12-16) | 4 |
| Medium (6-11) | 6 |
| Low (1-5) | 2 |

### Critical Path Risks (Block Construction)
1. SCHED-003: Testing Coverage Bottleneck (Score: 16)
2. SCHED-001: Design Iteration Delays (Score: 12)
3. RSRC-001: Single Developer Bottleneck (Score: 12)

---

## Risk Matrix

| ID | Description | Category | L | I | Score | Status |
|----|-------------|----------|---|---|-------|--------|
| TECH-001 | Bundle Size Exceeds Target | Technical | 3 | 3 | 9 | Mitigating |
| TECH-002 | Third-Party Library Changes | Technical | 3 | 3 | 9 | Monitoring |
| TECH-003 | WebSocket Unavailability | Technical | 2 | 2 | 4 | Accepted |
| TECH-004 | Virtual Scrolling Performance | Technical | 3 | 3 | 9 | Identified |
| SCHED-001 | Design Iteration Delays | Schedule | 3 | 4 | 12 | Mitigating |
| SCHED-002 | Fortemi API Evolution | Schedule | 3 | 3 | 9 | Monitoring |
| SCHED-003 | Testing Coverage Bottleneck | Schedule | 4 | 4 | 16 | Identified |
| RSRC-001 | Single Developer Bottleneck | Resource | 3 | 4 | 12 | Mitigating |
| RSRC-002 | Design Expertise Gap | Resource | 3 | 4 | 12 | Mitigating |
| EXT-001 | Fortemi API Breaking Changes | External | 3 | 4 | 12 | Monitoring |
| EXT-002 | Browser Feature Deprecation | External | 2 | 3 | 6 | Monitoring |
| INT-001 | API Response Latency | Integration | 4 | 3 | 12 | Identified |

**Legend**: L=Likelihood (1-5), I=Impact (1-5), Score=L×I

---

## Detailed Risk Cards

### TECH-001: Bundle Size Exceeds Target

**Score**: 9 (Medium)
**Category**: Technical
**Owner**: Frontend Developer

**Description**:
New dependencies (Mermaid ~800KB, Cytoscape.js ~500KB, Leaflet ~200KB) may cause bundle to exceed 500KB gzipped target.

**Triggers**:
- Adding graph visualization library
- Adding map library
- Adding chart library for health dashboard

**Mitigation**:
1. Code splitting per route (Vite manualChunks)
2. Lazy loading for graph/map views
3. Tree-shaking unused Radix UI components
4. Bundle size monitoring in CI (bundlesize package)

**Status**: Mitigating - Code splitting configured in vite.config.ts

---

### TECH-002: Third-Party Library Breaking Changes

**Score**: 9 (Medium)
**Category**: Technical
**Owner**: Frontend Developer

**Description**:
Cytoscape.js or Leaflet.js may release breaking changes during the redesign period.

**Triggers**:
- Major version releases during development
- Security vulnerabilities requiring urgent updates

**Mitigation**:
1. Pin exact versions in package.json
2. Monitor changelogs for major libraries
3. Identify alternative libraries (vis.js, Sigma.js for graphs)
4. Maintain upgrade notes in docs

**Status**: Monitoring - Using Cytoscape 3.28.x, Leaflet 1.9.4

---

### TECH-003: WebSocket Unavailability Limitations

**Score**: 4 (Low)
**Category**: Technical
**Owner**: Architecture Lead

**Description**:
Fortemi API does not currently support WebSocket. Real-time features may be requested.

**Triggers**:
- User requests for live updates
- Knowledge health auto-refresh requirements

**Mitigation**:
1. Implement polling as fallback (already done)
2. VITE_DISABLE_WEBSOCKET environment variable
3. Document WebSocket as future enhancement
4. Design UI for graceful degradation

**Status**: Accepted - Polling implemented, WebSocket deferred to v2.0

---

### TECH-004: Virtual Scrolling Performance

**Score**: 9 (Medium)
**Category**: Technical
**Owner**: Frontend Developer

**Description**:
Timeline view with 1000+ notes may experience performance issues without proper virtualization.

**Triggers**:
- Large knowledge bases (>500 notes)
- Complex note cards with graphs
- Low-end devices

**Mitigation**:
1. Use react-window for virtual scrolling
2. Implement pagination in API calls
3. Add loading skeletons
4. Performance benchmarks in CI

**Status**: Identified - Performance strategy defined in HOTM-014

---

### SCHED-001: Design Iteration Delays

**Score**: 12 (High)
**Category**: Schedule
**Owner**: Project Lead

**Description**:
Wireframe and design approval cycles may extend beyond planned Elaboration phase.

**Triggers**:
- Stakeholder feedback requiring major revisions
- Accessibility audit findings
- Responsive design complexity

**Mitigation**:
1. Weekly design reviews
2. Design freeze at end of Elaboration
3. Parallel Construction for approved components
4. Clear acceptance criteria for wireframes

**Status**: Mitigating - Wireframes complete (p1-wireframes.md), responsive spec done

---

### SCHED-002: Fortemi API Evolution During Redesign

**Score**: 9 (Medium)
**Category**: Schedule
**Owner**: Architecture Lead

**Description**:
Fortemi API may add or change endpoints during UI development, requiring rework.

**Triggers**:
- New Fortemi release with API changes
- Missing endpoints requiring workarounds

**Mitigation**:
1. API endpoint verification completed (HOTM-011)
2. Client-side workarounds documented (tag bulk ops)
3. API contract tests in test suite
4. Coordination with Fortemi team

**Status**: Monitoring - 88% endpoint coverage verified

---

### SCHED-003: Testing Coverage Bottleneck

**Score**: 16 (High)
**Category**: Schedule
**Owner**: Test Architect

**Description**:
Achieving 60% coverage target with 10 new features may create testing bottleneck.

**Triggers**:
- Complex integration tests for graph/map features
- E2E test maintenance overhead
- Accessibility testing requirements

**Mitigation**:
1. Test-driven development approach
2. Coverage gates in CI (blocking)
3. Parallel E2E test execution
4. Prioritize critical path testing
5. Performance strategy includes test plan (HOTM-014)

**Status**: Identified - Performance strategy defines testing approach

---

### RSRC-001: Single Developer Bottleneck

**Score**: 12 (High)
**Category**: Resource
**Owner**: Project Lead

**Description**:
Solo developer working on complex features may become bottleneck for schedule.

**Triggers**:
- Graph visualization learning curve
- Parallel feature development needs
- Code review delays

**Mitigation**:
1. Time-box learning (2 days max per new library)
2. Use existing examples and templates
3. Code review checklist for self-review
4. Prioritize P1 features first

**Status**: Mitigating - Feature priorities established

---

### RSRC-002: Design Expertise Gap

**Score**: 12 (High)
**Category**: Resource
**Owner**: UX Lead

**Description**:
Responsive design for complex views (health dashboard, graph, map) requires specialized expertise.

**Triggers**:
- Mobile-first design for data visualizations
- Accessibility compliance (WCAG 2.1 AA)
- Touch interaction design

**Mitigation**:
1. Use design patterns from Radix UI
2. WCAG compliance checklist
3. Reference existing responsive specs
4. Usability testing with real users

**Status**: Mitigating - Responsive spec and wireframes complete

---

### EXT-001: Fortemi API Breaking Changes

**Score**: 12 (High)
**Category**: External
**Owner**: Architecture Lead

**Description**:
Active Fortemi development may introduce breaking changes to API contracts.

**Triggers**:
- Fortemi v1.1 or v2.0 release
- Authentication implementation changes
- Response schema changes

**Mitigation**:
1. API versioning in client (v1 path prefix)
2. Contract tests for all used endpoints
3. Early notification channel with API team
4. Graceful error handling for schema changes

**Status**: Monitoring - Using v1 API with documented endpoints

---

### EXT-002: Browser Feature Deprecation

**Score**: 6 (Medium)
**Category**: External
**Owner**: Frontend Developer

**Description**:
Browser features used by map/location features may be deprecated or restricted.

**Triggers**:
- Geolocation API privacy changes
- IndexedDB quota limits
- Third-party cookie restrictions

**Mitigation**:
1. Feature detection before using APIs
2. Graceful degradation for missing features
3. Monitor browser release notes
4. Test on all supported browsers

**Status**: Monitoring - Browser support defined in NFR-004

---

### INT-001: API Response Latency Perception

**Score**: 12 (High)
**Category**: Integration
**Owner**: Frontend Developer

**Description**:
Network latency (50-200ms) may make app feel slow without proper UX patterns.

**Triggers**:
- Remote Fortemi API calls
- Large search results
- Graph data fetching

**Mitigation**:
1. React Query for caching and deduplication
2. Optimistic UI updates
3. Skeleton loading states
4. Progressive data loading
5. Background prefetching

**Status**: Identified - Performance strategy addresses this

---

## Review Schedule

| Review | Date | Focus |
|--------|------|-------|
| Elaboration Gate | 2026-02-05 | High risks status |
| Construction Week 2 | TBD | Technical risks |
| Construction Week 4 | TBD | Schedule risks |
| IOC Gate | TBD | All risks retired/monitored |

---

## Risk Escalation Procedure

1. **Score increase >4**: Immediate review with stakeholders
2. **New Critical risk**: Stop and reassess timeline
3. **Mitigation failure**: Escalate to Project Lead within 24h
4. **External blocker**: Document and communicate impact

---

*Document Version: 1.0*
*Created: 2026-02-05*
*Status: BASELINED*
