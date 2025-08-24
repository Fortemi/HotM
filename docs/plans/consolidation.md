# Backend Consolidation Plan (Tauri-Hosted)

## Objective
Run backend logic inside the Tauri TSR to remove the default local HTTP dependency, while keeping an optional HTTP API for dev/CI and external browser workflows.

## Approach
- Core crate (`hotm-core`): extract services from `server/src/{db,job_queue,ollama,models}` behind traits (`Db`, `AiClient`, `EventBus`).
- Dual frontends:
  - Tauri IPC: `#[tauri::command]` for UI calls; emit job events via `app.emit_all`.
  - HTTP (optional): Axum routes compiled as `hotm-httpd` or started in-process when enabled.
- Event abstraction: `EventBus` impls for WebSocket (HTTP mode) and Tauri events (TSR mode).

## Phases
1) Introduce `EventBus` trait (no UI changes).
2) Create `hotm-core` and move business logic; keep Axum handlers thin.
3) Add Tauri commands for health, notes, search; UI adds `TauriTransport`.
4) Replace WS with Tauri events; migrate remaining endpoints.
5) Keep optional HTTP server for dev/CI/MCP.

## Notes
- DB remains PostgreSQL/DocumentDB; config via `.env`.
- MCP: prefer stdio/pipe adapter in-process; HTTP adapter remains for compatibility.

