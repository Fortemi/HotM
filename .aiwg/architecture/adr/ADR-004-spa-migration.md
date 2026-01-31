# ADR-004: SPA Migration and matric-memory Integration

**Status**: Accepted
**Date**: 2026-01-30
**Deciders**: Development Team
**Context**: Architecture evolution from Tauri desktop app to web-based SPA

---

## Context and Problem Statement

HotM started as a test system for memory tooling and evolved into a full-stack Tauri desktop application with an embedded Rust API server, PostgreSQL database, and local Ollama NLP processing. Over time, the memory server functionality matured into the separate **matric-memory** repository with a comprehensive, production-ready REST API.

The current HotM architecture presents several challenges:

1. **Architectural Redundancy**: HotM duplicates orchestration logic and routing that now properly belongs in the matric-memory server
2. **Deployment Complexity**: Tauri desktop apps require MSI packaging, Windows-specific builds, and users must install multiple components (PostgreSQL, Ollama, HotM server, HotM client)
3. **Limited Reach**: Desktop-only deployment restricts access to Windows users with local installation capability
4. **Maintenance Burden**: Two full stacks (HotM and matric-memory) require parallel development and testing

We need to decide how to evolve HotM's architecture to eliminate redundancy while supporting the target of 100+ external users.

## Decision Drivers

### Primary Drivers

1. **Eliminate Architectural Redundancy**: matric-memory API already provides all needed backend functionality (notes CRUD, search, NLP processing, embeddings)

2. **Target 100+ External Users**: Desktop-only deployment cannot scale to this audience; web access enables broader reach across devices and platforms

3. **Leverage Existing Production API**: matric-memory server is production-deployed with comprehensive endpoints, mature architecture, and ongoing support

4. **Simplify Deployment Model**: Static SPA served via Nginx requires no client-side installation, no desktop dependencies, instant access via browser

5. **Preserve UI Investment**: Existing React/TypeScript codebase with Radix UI components represents significant development effort worth preserving

### Secondary Drivers

- **Team Focus**: Frontend team should focus on UX, not backend infrastructure duplication
- **Development Velocity**: Single codebase (frontend-only) enables faster iteration
- **Cross-Device Access**: Web SPA accessible from any device with a browser
- **Existing Nginx Pipeline**: Static site deployment infrastructure already exists

## Considered Options

### Option 1: Maintain Tauri Desktop Architecture (Status Quo)

**Approach**: Continue with embedded Rust API server, PostgreSQL, Ollama as local components

**Pros**:
- Desktop integration features (global hotkey Ctrl+Alt+H, system tray, native Windows styling)
- Offline-first operation (no network dependency)
- Local-first privacy (all data on user's machine)

**Cons**:
- **Duplicates matric-memory functionality**: Redundant API server, routing, NLP orchestration
- **Complex deployment**: MSI installer, PostgreSQL setup, Ollama installation, port management
- **Limited reach**: Windows-only, desktop-only, requires local installation
- **Maintenance burden**: Two parallel backends to maintain and evolve
- **Scaling challenges**: Cannot easily support 100+ external users

### Option 2: Hybrid Approach (Desktop + Web)

**Approach**: Maintain Tauri desktop app AND create web SPA, both consuming matric-memory API

**Pros**:
- Desktop users retain native features (hotkey, tray)
- Web users get browser-based access
- Shared API backend (matric-memory)

**Cons**:
- **Double maintenance**: Two client codebases (Tauri + web SPA)
- **Feature divergence**: Desktop and web may drift apart
- **Complexity**: Must ensure both clients work with same API
- **Deferred simplification**: Still maintaining desktop complexity

### Option 3: React SPA Consuming matric-memory API (Selected)

**Approach**: Migrate HotM to a lightweight React/TypeScript SPA that serves as a web-based frontend for the matric-memory API server

**Pros**:
- **Eliminates redundancy**: No Rust server code, no database management, no NLP orchestration in HotM
- **Simple deployment**: Static files served by Nginx (existing pipeline)
- **Broad reach**: Accessible from any device with a browser
- **Preserves UI**: Existing React components adapted to matric-memory API
- **Single backend**: matric-memory team owns all backend concerns
- **Scalable**: Can support 100+ users with proper authentication
- **Fast iteration**: Frontend-only changes deploy immediately

**Cons**:
- **Loses desktop features**: No global hotkey, no system tray integration
- **Network dependency**: Requires matric-memory API availability
- **Privacy model change**: Data stored on server (matric-memory) rather than local device
- **API dependency**: Frontend blocked if matric-memory API unavailable
- **Authentication required**: Must integrate OIDC for multi-user access (deferred to post-MVP)

## Decision Outcome

**Chosen Option**: **React SPA Consuming matric-memory API** (Option 3)

### Rationale

1. **matric-memory API Maturity**: The production-ready API provides all needed endpoints (notes CRUD, hybrid search, semantic search, tags, collections, provenance). Duplicating this in HotM serves no purpose.

2. **100+ User Target**: Desktop-only deployment cannot serve this audience. Web SPA enables instant access via browser from any device.

3. **Deployment Simplification**: Moving from "MSI installer + PostgreSQL + Ollama + Rust server + Tauri client" to "npm build + copy to Nginx" dramatically reduces operational complexity.

4. **UI Preservation**: The existing React/TypeScript codebase with Radix UI and TailwindCSS can be adapted with minimal changes. Only the API integration layer changes.

5. **Architecture Clarity**: Clean separation of concerns - matric-memory owns all backend (data, NLP, search), HotM SPA owns all frontend (UI, UX, client-side state).

### Trade-Offs Accepted

- **Desktop Features Lost**: Global hotkey (Ctrl+Alt+H) and system tray integration will not be available in web SPA. If demand exists, a minimal Electron wrapper could be considered post-migration.

- **Privacy Model Change**: Data moves from user's local PostgreSQL to matric-memory server. This is acceptable given the target audience (100+ external users who need web access) and the existing production deployment model.

- **API Dependency**: Frontend becomes fully dependent on matric-memory API availability. Mitigated by React Query caching, graceful error handling, and API health monitoring.

## Consequences

### Positive

- **Simplified Architecture**: Single frontend codebase, no backend to maintain
- **Faster Deployment**: Static assets deploy in seconds via Nginx
- **Broader Reach**: Web-accessible from any device and platform
- **Shared API Backend**: Leverage matric-memory team's ongoing development
- **Reduced Testing Surface**: Only frontend tests needed (Jest/Vitest, Playwright)
- **Cost Efficiency**: No need for PostgreSQL, Ollama, or Rust toolchain per user
- **Development Velocity**: Frontend changes ship independently of backend
- **Team Focus**: Frontend team can focus purely on UX optimization

### Negative

- **Lost Desktop Integration**: No system tray, no global hotkey, no Windows 11 native styling
- **Network Requirement**: Cannot work offline (unlike previous local-first design)
- **API Coupling**: Frontend tightly coupled to matric-memory API contract
- **Single Point of Failure**: matric-memory API outage = HotM SPA unusable
- **CORS Coordination**: Must coordinate with matric-memory team on CORS policy

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| matric-memory API unavailable | Medium | High | React Query caching (stale-while-revalidate), graceful error states, health check endpoint |
| API contract changes break frontend | Medium | Medium | API versioning (/api/v1/), integration tests against real API, version compatibility checks |
| CORS blocking API calls | Low | High | Coordinate with matric-memory team early, test in dev environment before production |
| User data migration from desktop HotM | High | High | Create export tool, coordinate import API with matric-memory, migration guide for users |
| Authentication complexity (OIDC) | Medium | Medium | Use proven libraries (oidc-client-ts), defer auth to post-MVP, mock auth for initial development |

## Implementation Plan

### Phase 1: Core Migration (MVP)

**Scope**: Feature parity with current HotM UI, no authentication

**Components to Remove**:
- `server/` directory (all Rust backend code)
- `ui/src-tauri/` directory (Tauri desktop integration)
- Desktop-specific dependencies (`@tauri-apps/api`)
- Desktop-specific workflows (MSI builds, Windows Service)

**Components to Add**:
- `ui/src/api/` (centralized matric-memory API client)
- React Router v6 (client-side SPA routing)
- React Query (API data fetching and caching)
- Environment-based API URL configuration

**Updated CI/CD**:
- Remove `backend-tests.yml` (no Rust backend)
- Remove MSI release workflow
- Add `deploy.yml` (build static assets, deploy to Nginx)

### Phase 2: Authentication (Post-MVP)

**Scope**: Multi-user access via Keycloak OIDC

**Components to Add**:
- OIDC client library (`oidc-client-ts` or `react-oidc-context`)
- Bearer token injection in API client
- Automatic token refresh
- Login/logout UI flows

### Phase 3: User Migration

**Scope**: Migrate existing HotM desktop users to web SPA

**Deliverables**:
- Export tool for current HotM local data
- Import API in matric-memory (bulk import)
- Migration guide for users
- Data validation and verification

## Architecture Comparison

### Before (Tauri Desktop App)

```
┌─────────────────────┐
│  Tauri Desktop UI   │  Windows 11 native
│  React + TypeScript │
└──────────┬──────────┘
           │ HTTP (localhost)
           ↓
┌─────────────────────┐
│   Axum API Server   │  Rust (Port 53211)
│   (HotM Server)     │
└──────┬──────────────┘
       │ SQLx          │ Reqwest
       ↓               ↓
┌────────────┐  ┌─────────────┐
│ PostgreSQL │  │   Ollama    │
│ (pgvector) │  │ (local AI)  │
└────────────┘  └─────────────┘
```

### After (React SPA)

```
┌─────────────────────┐
│   React SPA (Web)   │  Any browser, any device
│  TypeScript + Vite  │  Deployed via Nginx
└──────────┬──────────┘
           │ HTTPS
           ↓
┌─────────────────────┐
│ matric-memory API   │  Production server
│   (REST API)        │  (separate repo)
└──────────┬──────────┘
           │ (internal)
           ↓
┌─────────────────────┐
│ PostgreSQL + Ollama │  Server-side
│ (managed services)  │
└─────────────────────┘
```

## Impact on Prior ADRs

### ADR-001: Client-Server Architecture

**Status**: Superseded by this ADR

ADR-001 established the client-server separation between Tauri client and Axum server. This ADR evolves that decision further: the "server" is now external (matric-memory), and the "client" is a web SPA rather than desktop app.

### ADR-002: Greenfield Database Schema Rebuild

**Status**: No longer applicable to HotM

ADR-002 defined database schema management for local PostgreSQL. With migration to SPA, HotM no longer manages any database - that responsibility moves entirely to matric-memory.

### ADR-003: Local-First Privacy Architecture

**Status**: Modified

ADR-003 established local-first privacy as the #1 priority. This ADR represents a conscious trade-off: to serve 100+ external users via web, we accept that data lives on the matric-memory server rather than each user's local device. The privacy model shifts from "local-only" to "centralized server under user's control" (for self-hosted deployments) or "trusted server" (for hosted deployments).

This trade-off is acceptable because:
1. matric-memory can be self-hosted for privacy-conscious users
2. The target audience (100+ external users) needs web access
3. Desktop HotM remains available (archived) for users who prefer local-only

## Related Decisions

- **ADR-001**: Client-Server Architecture (superseded)
- **ADR-002**: Database Schema Rebuild (no longer applicable)
- **ADR-003**: Local-First Privacy (modified)
- **Future ADR-005**: Authentication Strategy (Keycloak OIDC integration)
- **Future ADR-006**: User Data Migration (export/import for desktop users)

## References

- **Updated Project Intake**: `.aiwg/intake/project-intake.md`
- **matric-memory API**: [To be documented - API specification location]
- **Current UI Codebase**: `/mnt/dev-inbox/jmagly/hotm/ui/src/`
- **Deployment Target**: Nginx static file serving (existing pipeline)

## Decision Log

- **2026-01-30**: Initial proposal - SPA migration to matric-memory API
- **2026-01-30**: Status changed to ACCEPTED

---

**Approved by**: Development Team
**Implementation Target**: v0.2.0 (Post-Migration SPA)
**Review Date**: After initial SPA deployment or 2026-Q2 (whichever comes first)
