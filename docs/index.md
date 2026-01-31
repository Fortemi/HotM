# HotM Documentation Index

## Overview
HotM is a web-based notes and analysis tool built as a React Single Page Application (SPA) consuming the matric-memory API. Provides hybrid search, NLP-powered content enhancement, and AI-assisted knowledge management.

**Current Architecture**: React SPA (v0.2.0+) with matric-memory backend
**Previous Architecture**: Tauri desktop app (v0.1.x) - see [Desktop Era Archive](.aiwg/archive/desktop-era/)

## Table of Contents

### Requirements
- `requirements/`
  - Functional, Non-functional, Constraints

### Specifications
- `specifications/`
  - API (v1/v2), Data model, MCP tools, UI spec

### Architecture
- `architecture/` and `architecture-overview.md`
  - System design, NLP pipeline
  - **ADR-004: SPA Migration**: `.aiwg/architecture/adr/ADR-004-spa-migration.md`
  - Cloud Sync Architecture: `architecture/cloud-sync-architecture.md`
  - Stage 2: `architecture/stage-2-architecture.md` (sync, auth/billing, encryption, device model)
  - Client Sync Agent interfaces: `architecture/client-sync-agent.md`
  - Decisions: `adr/ADR-001-journal-sync-lww.md`

### Implementation
- `implementation/`
  - Development guide, Testing strategy

### Data Model
- `data-model-pg.sql` (reference only - backend managed by matric-memory)

### Deployment
- **Current (SPA)**: Static assets served via Nginx, backend managed by matric-memory repository
- **Archived (Desktop)**: `.aiwg/archive/desktop-era/docker-deployment.md`

### Guides
- **Active**:
  - None (SPA deployment TBD)
- **Archived (Desktop)**:
  - `quickstart.md` (desktop development setup)
  - `first-run.md` (desktop first-run checklist)
  - `packaging-windows.md` (MSI installer build)
  - `installer-plan.md` (installer design)

### Migration
- **User Data Migration**: `.aiwg/migration/user-data-migration.md`
  - Export notes from desktop HotM
  - Import to matric-memory API
  - Data format compatibility
  - Rollback procedures

### Testing
- `testing-framework.md`

### Policies & SDLC
- `OPERATING_POLICIES.md`, `SDLC.md`, `sops/`, `agent-profiles.md`

### Other
- `openapi.json`, `mcp_tools.json`, `prompts/`

## Plans
- Consolidation: `plans/consolidation.md`
- Cross-platform & headless: `plans/cross-platform.md`
- Protocol/transport strategy: `plans/protocol-bridge.md`

## Agents
- Profiles index: `agent-profiles.md`
- All agents: `agents/`

## Quick Links
- Project README: `../README.md`
- matric-memory API: [To be added - API documentation URL]
- Migration Guide: `.aiwg/migration/user-data-migration.md`
- Desktop Archive: `.aiwg/archive/desktop-era/`

## Architecture Overview

### Current (v0.2.0+): React SPA

```
┌─────────────────────┐
│   React SPA (Web)   │  Any browser, any device
│  TypeScript + Vite  │  Deployed via Nginx
└──────────┬──────────┘
           │ HTTPS
           ↓
┌─────────────────────┐
│ matric-memory API   │  Production REST API
│   (Remote Server)   │  (separate repository)
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ PostgreSQL + Ollama │  Server-side data & NLP
│ (managed services)  │
└─────────────────────┘
```

**Key Characteristics**:
- **Frontend**: React SPA with TypeScript, Vite, TailwindCSS, Radix UI
- **Backend**: matric-memory API (separate repository)
- **Storage**: Server-side PostgreSQL with pgvector (managed by matric-memory)
- **NLP**: Server-side Ollama (managed by matric-memory)
- **Deployment**: Static assets via Nginx, no client installation
- **Access**: Web-based, any device with browser
- **Multi-User**: OIDC authentication via Keycloak (post-MVP)

### Previous (v0.1.x): Tauri Desktop App [ARCHIVED]

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

**Key Characteristics**:
- **Frontend**: Tauri desktop app (Windows 11 focus)
- **Backend**: Embedded Rust Axum server (local)
- **Storage**: Local PostgreSQL database
- **NLP**: Local Ollama service
- **Deployment**: MSI installer with PostgreSQL/Ollama setup
- **Access**: Desktop-only (Windows)
- **Single-User**: No authentication

**Status**: Archived 2026-01-31
**Documentation**: `.aiwg/archive/desktop-era/`
**Migration Path**: `.aiwg/migration/user-data-migration.md`

## Version

| Version | Architecture | Status |
|---------|--------------|--------|
| v0.1.x | Tauri Desktop App | Archived (2026-01-31) |
| v0.2.0+ | React SPA | Current (Active Development) |

Last Updated: 2026-01-31

## Archived Documentation

Desktop-specific documentation has been archived and is available for reference:

- **Location**: `.aiwg/archive/desktop-era/`
- **Contents**:
  - `packaging-windows.md` - MSI installer build process
  - `installer-plan.md` - Installer design and components
  - `quickstart.md` - Desktop development setup guide
  - `first-run.md` - Desktop first-run checklist
  - `docker-deployment.md` - Docker deployment for desktop API server
  - `README.md` - Desktop architecture overview and rationale

**Note**: Archived documentation is frozen as of 2026-01-31 and will not receive updates. Refer to current SPA documentation for active development.

## Migration Support

Users migrating from the desktop app to the web SPA should reference:

1. **Migration Guide**: `.aiwg/migration/user-data-migration.md`
   - Export notes from local PostgreSQL
   - Import to matric-memory API
   - Data format compatibility
   - Verification procedures
   - Rollback options

2. **ADR-004: SPA Migration**: `.aiwg/architecture/adr/ADR-004-spa-migration.md`
   - Architecture rationale
   - Trade-offs (desktop features vs. web accessibility)
   - Implementation plan

3. **Security Assessment**: `.aiwg/security/migration-security-assessment.md`
   - Privacy model changes
   - Authentication requirements
   - Data location considerations
