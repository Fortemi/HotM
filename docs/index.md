# HotM Documentation Index

## Overview
HotM is a local-first notes and analysis tool with immutable originals, NLP-powered revisions, and hybrid search. Built with Rust (Axum API) and Tauri (React/TypeScript) for Windows 11.

## Table of Contents
- Requirements: `requirements/`
  - Functional, Non-functional, Constraints
- Specifications: `specifications/`
  - API (v1/v2), Data model, MCP tools, UI spec
- Architecture: `architecture/` and `architecture-overview.md`
  - System design, NLP pipeline
  - Stage 2: `architecture/stage-2-architecture.md` (sync, auth/billing, encryption, device model)
  - Client Sync Agent interfaces: `architecture/client-sync-agent.md`
  - Decisions: `adr/ADR-001-journal-sync-lww.md`
- Implementation: `implementation/`
  - Development guide, Testing strategy
- Data Model: `data-model-pg.sql`
- Deployment: `deployment/` 
  - Current Docker deployment: `deployment/docker-deployment.md`
  - **Unified Runtime (v0.2.0+)**: Complete deployment architecture refactor
    - Overview: `deployment/unified-runtime-deployment-guide.md`
    - Architecture: `deployment/unified-runtime-architecture.md` 
    - Scenarios: `deployment/deployment-scenarios.md`
    - Diagrams: `deployment/deployment-architecture-diagrams.md`
    - Configuration: `deployment/unified-runtime-configuration.md`
    - Migration & Security: `deployment/migration-and-security-guide.md`
  - Storage: `storage-documentdb.md`
- Guides: `quickstart.md`, `first-run.md`, `packaging-windows.md`, `installer-plan.md`
- Testing: `testing-framework.md`
- Policies & SDLC: `OPERATING_POLICIES.md`, `SDLC.md`, `sops/`, `agent-profiles.md`
- Other: `openapi.json`, `mcp_tools.json`, `prompts/`

## Plans
- Consolidation: `plans/consolidation.md`
- Cross-platform & headless: `plans/cross-platform.md`
- Protocol/transport strategy: `plans/protocol-bridge.md`

## Agents
- Profiles index: `agent-profiles.md`
- All agents: `agents/`

## Quick Links
- Project README: `../README.md`
- API Health Check: http://127.0.0.1:53211/api/v1/health

## Version
Current: 0.1.x (Alpha)
Last Updated: 2025-08-24
