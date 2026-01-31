# Desktop Era Archive

**Status**: Historical Reference
**Date Archived**: 2026-01-31
**Architecture**: Tauri Desktop Application (Windows 11)

---

## Overview

This directory contains documentation for the **HotM Desktop Application** architecture, which was the primary implementation from v0.1.0 through v0.1.x (2025-12 through 2026-01).

**Architecture Summary**: Tauri-based desktop application with embedded Rust API server, local PostgreSQL database, and local Ollama NLP processing.

## Why Archived

With the transition to the **React SPA architecture** (v0.2.0+), the desktop-specific components and documentation are no longer applicable to the current codebase. This archive preserves historical context for:

1. **Existing Desktop Users**: Reference documentation for users still running the desktop app during migration
2. **Architecture History**: Understanding the evolution from desktop to web
3. **Migration Context**: Supporting data migration from desktop to SPA
4. **Historical Decisions**: ADR context and technical choices made during desktop era

## Archived Documentation

### Installation and Setup

- **`packaging-windows.md`**: MSI installer build process, Tauri configuration, Windows Service setup
- **`installer-plan.md`**: Comprehensive installer design with PostgreSQL Docker setup, component options
- **`quickstart.md`**: Development setup for desktop app (PostgreSQL, Ollama, Rust, Node.js)
- **`first-run.md`**: Desktop first-run checklist (database setup, Ollama models, health checks)

### Deployment

- **`docker-deployment.md`**: Docker-based deployment for desktop API server (pgvector, Ollama containers)

### Architecture

Desktop architecture is **superseded** by current SPA architecture. See:
- `.aiwg/architecture/adr/ADR-004-spa-migration.md` for migration rationale
- `.aiwg/architecture/software-architecture-doc.md` for current SPA architecture

## Desktop Architecture Summary

```
┌─────────────────────┐
│  Tauri Desktop UI   │  Windows 11 native
│  React + TypeScript │  Global hotkey: Ctrl+Alt+H
│                     │  System tray integration
└──────────┬──────────┘
           │ HTTP (localhost:53211)
           ↓
┌─────────────────────┐
│   Axum API Server   │  Rust server (embedded in desktop app)
│   (HotM Server)     │  - Notes CRUD
│                     │  - Hybrid search
│                     │  - NLP orchestration
└──────┬──────────────┘
       │ SQLx          │ Reqwest
       ↓               ↓
┌────────────┐  ┌─────────────┐
│ PostgreSQL │  │   Ollama    │
│ (pgvector) │  │ (local AI)  │
│  Port 5433 │  │  Port 11434 │
└────────────┘  └─────────────┘
```

**Key Characteristics**:
- **Local-first**: All data on user's machine, full offline access
- **Single-user**: No authentication, no multi-user support
- **Windows 11 focused**: MSI installer, Windows Service, native styling
- **Manual setup**: User installs PostgreSQL, Ollama, desktop app separately
- **Desktop integration**: Global hotkey, system tray, auto-startup

## Desktop Components

### UI Layer (`ui/src-tauri/`)
- **Tauri Backend**: Rust desktop integration (window management, tray, hotkeys)
- **React Frontend**: TypeScript UI components (Radix UI, TailwindCSS)
- **MSI Installer**: WiX-based Windows installer with component options

### Server Layer (`server/`)
- **Axum API**: REST API server (port 53211)
- **SQLx**: PostgreSQL database client with compile-time query verification
- **Ollama Client**: Local LLM communication for NLP processing
- **Migrations**: Database schema management via SQLx migrations

### Database (`PostgreSQL 16+`)
- **pgvector Extension**: Vector embeddings for semantic search
- **Local Instance**: Typically port 5433 (via Docker or native install)
- **Schema**: Immutable notes, revisions, embeddings, tags, collections, provenance

### NLP (`Ollama`)
- **Models**: `gpt-oss:20b` (generation), `nomic-embed-text` (embeddings)
- **Local Inference**: All AI processing on user's machine
- **GPU Support**: CUDA acceleration if available

## Migration to SPA

Desktop users migrating to the web SPA should reference:

- **Migration Guide**: `.aiwg/migration/user-data-migration.md`
- **ADR-004**: `.aiwg/architecture/adr/ADR-004-spa-migration.md`
- **Security Assessment**: `.aiwg/security/migration-security-assessment.md`

## Desktop App Availability

The desktop app remains available for users who prefer local-first operation:

- **Source Code**: Tagged releases `v0.1.0` through `v0.1.x` in Git history
- **Binaries**: MSI installers available in GitHub Releases (if published)
- **Support**: Limited to critical bugs only; no new features

**Recommendation**: Migrate to web SPA for ongoing feature updates and support.

## Trade-Offs: Desktop vs. SPA

| Feature | Desktop (v0.1.x) | SPA (v0.2.0+) |
|---------|------------------|---------------|
| **Installation** | Complex (MSI + PostgreSQL + Ollama) | None (browser access) |
| **Platform** | Windows 11 only | Any device with browser |
| **Data Location** | Local machine | matric-memory server |
| **Privacy** | Local-first (all data on user's machine) | Server-based (data on matric-memory) |
| **Offline Access** | Full offline capability | Requires network connection |
| **Multi-User** | Single-user only | Multi-user with OIDC auth |
| **Desktop Integration** | Global hotkey, system tray, auto-startup | None (browser-based) |
| **NLP Processing** | Local Ollama (user's GPU) | Server-side Ollama (shared) |
| **Updates** | MSI reinstall required | Instant (static asset refresh) |
| **Scalability** | One user per installation | 100+ users on shared server |
| **Maintenance** | User manages PostgreSQL, Ollama | Zero client-side maintenance |

## Related ADRs

### Superseded Decisions

- **ADR-001: Client-Server Architecture** - Established Tauri + Axum separation, superseded by SPA migration
- **ADR-002: Greenfield Database Schema Rebuild** - Local PostgreSQL management, no longer applicable to SPA
- **ADR-003: Local-First Privacy** - Modified by SPA migration (see trade-offs in ADR-004)

### Active Decisions

- **ADR-004: SPA Migration** - Current architecture, rationale for moving from desktop to web

## Desktop Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1.0 | 2025-12-01 | Initial desktop app release |
| v0.1.1 | 2025-12-10 | MSI installer improvements, PostgreSQL setup automation |
| v0.1.2 | 2025-12-15 | Hybrid search optimization, NLP pipeline enhancements |
| v0.1.3 | 2026-01-05 | Job queue UI, provenance history viewer |
| v0.1.x | 2026-01-30 | Final desktop release, migration prep |

## Technical Debt (Desktop Era)

Issues that existed in the desktop architecture and are resolved in SPA:

1. **PostgreSQL Setup Complexity**: Required Docker or manual installation, pgvector compilation issues on Windows
2. **Ollama Model Management**: Users had to manually pull large model files, GPU compatibility issues
3. **Port Conflicts**: Server (53211), PostgreSQL (5433), Ollama (11434) could conflict with other services
4. **SQLx Offline Mode**: Required `cargo sqlx prepare` after schema changes, confusing for contributors
5. **MSI Build Process**: Complex WiX configuration, Windows-specific toolchain, slow build times
6. **Single-User Limitation**: No authentication, no sharing, no collaboration features
7. **Update Process**: Required MSI reinstall, risk of database migration failures

**SPA Resolution**: All of the above are eliminated by moving backend to matric-memory (production-managed) and frontend to static web assets (no installation).

## Preservation Rationale

This documentation is preserved for:

- **Reference**: Users maintaining desktop installations during transition
- **Historical Context**: Understanding architectural evolution decisions
- **Migration Support**: Desktop-specific data formats and export procedures
- **Lessons Learned**: Technical choices and trade-offs for future reference

**Not Maintained**: This documentation is frozen as of 2026-01-31 and will not receive updates. Refer to current SPA documentation in main `/docs` directory for active information.

---

**Archive Date**: 2026-01-31
**Archived By**: HotM Development Team
**Status**: Historical reference only
**Last Desktop Version**: v0.1.x
