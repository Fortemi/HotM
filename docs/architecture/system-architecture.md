# System Architecture

HotM is a client system that integrates with the Fortemi platform.

## High-Level Diagram
1. HotM Client (React/Tauri)
2. Fortemi API
3. Managed backend services (owned by Fortemi)

## Design Priorities
- Configurable API base URI (`VITE_API_BASE_URL`)
- Clear separation between client concerns and backend ownership
- Resilient API adapters for response-shape differences and compatibility
- Frontend test coverage and reliable build pipeline
