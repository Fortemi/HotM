# Protocol/Transport Strategy (Synthetic Links)

## Problem
Minimize frontend changes between Tauri and browser dev. Explore using a `protocol://api` style while retaining standard dev ergonomics.

## Reality Check
- Tauri commands are invoked via `window.__TAURI__.invoke` (not available in a normal browser).
- Custom URI schemes (e.g., `hotm://...`) can deep-link to the app on Windows/macOS, but they are not a general JSON transport.
- ServiceWorkers cannot proxy to Tauri commands. For browser dev, HTTP remains the portable option.

## Strategy
- Introduce `ApiTransport` abstraction in UI:
  - `HttpTransport`: uses `fetch` to `/api/v1`.
  - `TauriTransport`: uses `invoke('cmd', args)` and subscribes to Tauri events for push updates.
- Optional: register a URL protocol (`hotm://`) for one-shot deep links (open note, import file). Treat this as UX enhancement, not a data API.

## Edge/WebView2 Considerations (Windows)
- WebView2 (Tauri) can load via `tauri://localhost` for assets; functions still use `invoke`.
- You can expose a lightweight in-process Axum on a loopback port only when `HTTP_API_ENABLED=1`, preserving the browser path with no FE rewrite.

## Minimal Frontend Changes
- Centralize API calls behind `ApiClient` using `ApiTransport`.
- Switch transport at boot based on `VITE_TRANSPORT` (default `tauri`, override to `http` for browser dev).

