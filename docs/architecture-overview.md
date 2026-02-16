# Architecture Overview

## Current Architecture
- HotM UI: React/TypeScript client
- Delivery: web SPA and optional Tauri desktop shell
- Backend dependency: Fortemi API (configured with `VITE_API_BASE_URL`)

## Responsibilities
- This repository:
  - UI features and UX flows
  - API client adapters and contract handling
  - Frontend tests and build pipeline
- Fortemi repository:
  - API implementation
  - data storage and processing
  - operational backend concerns

## Integration Contract
- All network communication from this repo goes through the API client in `ui/src/api`.
- Base URI must remain configurable per environment.
