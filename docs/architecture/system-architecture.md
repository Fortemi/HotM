# System Architecture

> Note: The `.aiwg/architecture/software-architecture-doc.md` contains a legacy architecture document
> describing a previous Axum/embedded-backend design that was superseded by the current SPA+Fortemi model.
> That document requires a full rebuild. This file is the authoritative architecture reference.

---

## System Overview

HotM (Hall of the Mind) is a React SPA that provides a rich web interface for note-taking and analysis.
The UI is a pure client — all data persistence, NLP processing, search, and storage are delegated to the
**Fortemi API** (a separate Rust service, pronounced "for-TAY-mee").

HotM ships in two deployment modes that share the same React codebase:

### Web / Docker Mode

The React build output is served as static files (via nginx or any static host). The browser's native
`fetch` and `EventSource` APIs are used directly. The Fortemi API is a remote service reachable at a
URL configured through one of the API URL resolution sources (see below).

### Desktop Mode (Tauri)

The React SPA is wrapped in a Tauri desktop shell (`ui/src-tauri/`). Tauri spawns a `matric-api`
sidecar binary (the Fortemi server) on a randomly-selected free loopback port at startup. Network
requests from the WebView are routed through a Rust-backed HTTP proxy rather than the WebKit2GTK
network stack, which blocks loopback HTTP on Linux.

A `window.__HOTM_HOST__` adapter is injected into every page before the React bundle executes. This
adapter provides `network.fetch` and `network.sse.connect` backed by `reqwest` in the host process
(`hotm_fetch` and `hotm_sse_connect` Tauri commands in `lib.rs`). The React app always calls through
`getTauriFetch()` / `getHostAdapter()` in `lib/tauri.ts`, which resolves to the right implementation
for the current runtime.

---

## Component Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                     Deployment Environment                         │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   React SPA (WebView / Browser)              │  │
│  │                                                              │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │  Components │  │  React hooks │  │  Pages / Router   │   │  │
│  │  │  (Radix UI) │  │  + Context   │  │  (React Router)   │   │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘   │  │
│  │         │                │                    │              │  │
│  │  ┌──────▼────────────────▼────────────────────▼──────────┐   │  │
│  │  │              API Client Layer  (ui/src/api/)           │   │  │
│  │  │   notes · search · tags · collections · events · ...  │   │  │
│  │  └──────────────────────┬────────────────────────────────┘   │  │
│  │                         │                                     │  │
│  │  ┌──────────────────────▼────────────────────────────────┐   │  │
│  │  │          Host Adapter Layer  (ui/src/lib/tauri.ts)     │   │  │
│  │  │                                                        │   │  │
│  │  │  getHostAdapter()   getTauriFetch()   isTauri()        │   │  │
│  │  │                                                        │   │  │
│  │  │  window.__HOTM_HOST__  ──────────────────────────────┐ │   │  │
│  │  │  (injected by Tauri initScript OR external shell)    │ │   │  │
│  │  └──────────────────────────────────────────────────────┼─┘   │  │
│  └─────────────────────────────────────────────────────────┼─────┘  │
│                                                            │        │
│  ┌────── Desktop only ────────────────────────────────┐   │        │
│  │  Tauri Host Process (Rust)                         │   │        │
│  │                                                    │   │        │
│  │  hotm_fetch / hotm_sse_connect (reqwest) ◄─────────┘   │        │
│  │  get_app_config / save_app_config                       │        │
│  │  render_plantuml / ensure_plantuml                      │        │
│  │                          │                             │        │
│  │                          │ spawns                      │        │
│  │                          ▼                             │        │
│  │  ┌───────────────────────────────────────────────┐    │        │
│  │  │  matric-api sidecar (Fortemi, Rust binary)    │    │        │
│  │  │  http://127.0.0.1:<random-port>/api/v1        │    │        │
│  │  │  DATABASE_URL · PORT · FILE_STORAGE_PATH      │    │        │
│  │  └───────────────────────────────────────────────┘    │        │
│  └────────────────────────────────────────────────────────┘        │
│                                                                    │
│  ┌────── Web / Docker only ──────────────────────────────────────┐ │
│  │  Remote Fortemi API                                           │ │
│  │  (configured via VITE_API_BASE_URL or window.__RUNTIME_CONFIG__)│ │
│  └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### 1. Host Adapter Pattern (`window.__HOTM_HOST__`)

The host adapter is a `network` contract published on `window` before the React bundle loads.
It provides two methods: `network.fetch` (HTTP) and `network.sse.connect` (Server-Sent Events).

- **Standalone Tauri** — `lib.rs` injects an `initializationScript` that sets `window.__HOTM_HOST__`
  pointing at the `hotm_fetch` and `hotm_sse_connect` Tauri commands (backed by `reqwest`).
  This bypasses WebKit2GTK's network stack, which blocks loopback connections on Linux.
- **External shell (bt6-arsenal, iframes)** — the shell injects its own adapter before HotM loads.
  The guard `if(!window.__HOTM_HOST__)` in the init script means an existing adapter is never
  overwritten by the Tauri injection.
- **Web / Docker / dev browser** — no `__HOTM_HOST__` is set; `getHostAdapter()` returns `null`
  and `getTauriFetch()` returns native `window.fetch`. `EventSource` is used for SSE.

The adapter contract is documented in full at `docs/host-adapter.md`.

### 2. API URL Resolution Priority

`getApiBaseUrl()` in `ui/src/api/index.ts` resolves in this order:

1. **Tauri runtime config** — `~/.config/com.hotm.app/config.json` (`api_base_url` field).
   Loaded at startup via `get_app_config` Tauri command; cached synchronously via `getCachedConfig()`.
   In desktop mode the sidecar port is written here after spawn.
2. **Docker runtime config** — `window.__RUNTIME_CONFIG__` injected by the container entrypoint.
3. **`VITE_API_BASE_URL`** build-time env var — only available in dev server builds.
4. **Same-origin `/api/v1`** — default for deployed web mode (nginx proxies `/api` to Fortemi).
5. **`http://localhost:3000/api/v1`** — final fallback for local development.

### 3. Sidecar Lifecycle (Desktop)

On startup, `lib.rs` checks whether `config.database_url` is non-empty. If so, it:

1. Finds a free ephemeral TCP port via `TcpListener::bind("127.0.0.1:0")`.
2. Spawns `binaries/matric-api` (bundled with the app) with env vars
   `DATABASE_URL`, `HOST=127.0.0.1`, `PORT`, and `FILE_STORAGE_PATH`.
3. Polls `http://127.0.0.1:<port>/health` every 500 ms (30-second deadline),
   emits the `sidecar:ready` Tauri event when the sidecar passes its health check.
4. Writes the resolved `http://127.0.0.1:<port>/api/v1` URL into `config.json`
   so the frontend reads it via `get_app_config`.
5. On Quit (tray menu), kills the child process before exit.

If `database_url` is empty, no sidecar is launched and the app connects to an
external Fortemi instance at the configured `api_base_url`.

### 4. Immutable Originals

Notes are append-only. The React UI never sends a destructive edit to original note content.
All content changes create new revisions, handled entirely by the Fortemi NLP pipeline.
The UI shows the revised content by default while preserving a link to the immutable original.

### 5. Real-Time Events (SSE)

The events client (`ui/src/api/events.ts`) uses one of three transport paths, selected at
connection time:

| Runtime | Transport |
|---------|-----------|
| Host adapter present | `connectHostProxy` — SSE events forwarded via `postMessage` |
| Standalone Tauri (no adapter) | `connectFetch` — fetch-based SSE reader via `getTauriFetch()` |
| Web / browser | `connectNative` — native `EventSource` |

All three paths converge on the same `dispatchEvent` function and support the SSE
`Last-Event-ID` resume cursor. The `realtimeEventBus` service (`ui/src/services/realtimeEventBus.ts`)
distributes events to subscribers across the UI. The `websocket.ts` service wraps the events client
with additional state tracking (queue status, job progress, connection health).

---

## State Management

HotM uses React's built-in primitives — no Redux or external state library.

- **Local component state** — `useState` / `useReducer` for UI-specific state.
- **Cross-component state** — React Context for shared data (active note, selected view, auth).
- **Real-time state** — `realtimeEventBus` (pub/sub singleton) receives SSE events and notifies
  hook subscribers. Components subscribe via `useWebSocket` / custom hooks.
- **API config cache** — `_cachedConfig` in `lib/tauri.ts` holds the runtime app config; the
  `api` singleton in `src/api/index.ts` is recreated via `reinitializeApi()` after the Tauri
  config loads.
- **Memory context** — `api/memory-context.ts` tracks the active memory/archive selection.

---

## Directory Map

```
ui/
├── src/
│   ├── api/                # Fortemi API client modules
│   │   ├── index.ts        # Entry: createApi(), getApiBaseUrl(), api singleton
│   │   ├── client.ts       # createApiClient() — base fetch wrapper
│   │   ├── events.ts       # SSE events client (three transport paths)
│   │   ├── notes.ts        # Notes CRUD
│   │   ├── search.ts       # Hybrid search
│   │   ├── tags.ts         # Tag management
│   │   ├── collections.ts  # Collection organization
│   │   ├── memory.ts       # Memory/archive context
│   │   ├── chat.ts         # Chat / LLM inference
│   │   └── ...             # Other domain clients (jobs, links, provenance, etc.)
│   │
│   ├── components/         # Reusable UI components (Radix UI + Tailwind)
│   ├── pages/              # Route-level page components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Shared singleton services
│   │   ├── websocket.ts    # useWebSocket hook + connection state management
│   │   ├── realtimeEventBus.ts  # In-process pub/sub for SSE events
│   │   ├── api.ts          # Legacy compat shim
│   │   └── ...
│   ├── lib/                # Utilities and platform abstractions
│   │   ├── tauri.ts        # Host adapter, isTauri(), getTauriFetch(), loadAppConfig()
│   │   ├── runtime-config.ts   # Docker window.__RUNTIME_CONFIG__ reader
│   │   └── ...
│   └── utils/              # Pure helper functions
│
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs          # Tauri app setup, sidecar spawn, hotm_fetch/hotm_sse_connect
│   │   └── config.rs       # AppConfig struct, load_config/save_config
│   ├── tauri.conf.json     # App metadata, CSP, sidecar bundle path
│   └── binaries/           # matric-api sidecar binary (downloaded in CI)
│
├── public/                 # Static assets
└── tests/                  # E2E tests
```

---

## Deployment Modes Summary

| Aspect | Web / Docker | Desktop (Tauri) |
|--------|-------------|-----------------|
| Renderer | Browser | WebKit2GTK / WebView2 / WKWebView |
| Network | Native `fetch` / `EventSource` | `reqwest` via `hotm_fetch` / `hotm_sse_connect` |
| Fortemi | Remote (configured URL) | `matric-api` sidecar on loopback |
| Config | `VITE_API_BASE_URL` or `__RUNTIME_CONFIG__` | `~/.config/com.hotm.app/config.json` |
| Host adapter | Not set | Injected by Tauri `initializationScript` |
| System tray | No | Yes (show/hide/quit) |
| Global shortcut | No | `Ctrl+Alt+H` toggle |
