# HotM Documentation Index

## Overview
HotM is a client application (React/Tauri UI) that consumes the Fortemi API.

## Active Docs
- `quick-start.md`
- `implementation/development-guide.md`
- `implementation/testing-strategy.md`
- `OPERATING_POLICIES.md`
- `sops/`
- `ux/`
- `ui/src/api/README.md` (API client usage)

## Architecture
- Frontend: HotM UI (this repo)
- Backend: Fortemi API (separate repo/service)

## Scope Rules
- No backend runtime, migration, or bootstrap procedures are maintained in this repo.
- Backend contracts and operations belong to Fortemi.

## Legacy Material
Desktop-era and backend-heavy references are historical only and should not drive current implementation decisions.
