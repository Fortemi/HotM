# Cross-Platform Dev: Browser UI + Headless App

## Goals
- Keep the ability to run the React UI in a traditional browser for cross-platform development.
- Support a headless TSR mode that can start the API (Axum) on demand.

## Modes
- Tauri mode (default): UI uses `invoke` to call `#[tauri::command]`; job updates via Tauri events.
- HTTP mode (headless/dev): start Axum (in-process or external `hotm-httpd`); UI uses `fetch` to `http://localhost:<port>/api/v1`.

## Switches
- Env flags:
  - `HTTP_API_ENABLED=1` (start Axum in-process, choose port via `HTTP_API_PORT`)
  - `VITE_TRANSPORT=http|tauri` (UI selects transport implementation)

## Dev Commands (shell)
```bash
# Run server only (HTTP)
cd server && cargo run

# Run UI in browser (HTTP transport)
cd ui && VITE_TRANSPORT=http npm run dev

# Headless app mode: start TSR + HTTP API
# (tauri command with envs; windows shortcut can set them)
HTTP_API_ENABLED=1 HTTP_API_PORT=53211 npm run tauri
```

## Notes
- Keep API parity between Tauri commands and HTTP routes by calling shared services.
- For CI/e2e, prefer HTTP mode and the `hotm-httpd` binary for stability.

