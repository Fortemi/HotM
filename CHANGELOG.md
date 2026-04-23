# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2026.4.0] - 2026-04-22

### Added

- **Embedded AI agent** — conversational AI assistant powered by Fortemi's local LLM stack, with tool execution, session management, and full note integration
  - XState v5 intent-driven flow machine with conversational-first behavior (tools withheld on first turn to encourage natural dialogue)
  - Dynamic model selection from Fortemi API with default model `qwen3:14b`
  - Server-side tool execution via Vercel AI SDK — archive/notes search, concept lookup, attachment access
  - Attachment-aware tools with inline preview cards (thumbnails, action buttons, media players)
  - Session management: create, export, restore; save session JSON as a note attachment
  - Multi-session UX with clean handoff between conversations
  - Agent proxy service bundled as a Docker image, published alongside the UI image
- **Native desktop app** — HotM now ships as a standalone Tauri application bundling the Fortemi sidecar
  - Fortemi `matric-api` sidecar bundled as an `externalBin`; spawned on a free loopback port at launch
  - `sidecar:ready` event signals the React SPA when the backend is accepting connections
  - Host-proxy pattern: `hotm_fetch` and `hotm_sse_connect` Tauri commands proxy HTTP/SSE through the Rust reqwest backend, bypassing WebKit2GTK network restrictions
  - `CmdOrCtrl+Alt+H` global shortcut to toggle window visibility from anywhere on the desktop
  - `--minimized` / `/minimized` launch flag for autostart-on-login scenarios
  - System tray with Show/Hide/Quit menu items; close-to-tray behaviour (sidecar stays alive)
  - `get_app_config` / `save_app_config` Tauri commands for persistent configuration
  - macOS `.dmg` and Linux `.AppImage` + `.deb` packages built on every push to `main`
- **`__HOTM_HOST__` adapter** — embedding shell protocol for third-party integration
  - Shells inject `window.__HOTM_HOST__` with `network.fetch` and `network.sse` overrides
  - Standalone Tauri mode injects its own adapter automatically at startup
  - Web/Docker mode falls through to native `fetch`/`EventSource`
- **Inference settings panel** — configure local and cloud LLM providers from the Admin panel
  - Connection test button with live provider health check
  - Provider status indicator in the main nav
  - llama.cpp provider support alongside Ollama
  - Granular regeneration controls: model, revision mode, context filter, processing steps, job types
- **Overhauled Regenerate AI panel** — fine-grained control over NLP reprocessing with real-time job progress (#165)
- **Runtime API URL configuration for Docker** — `window.__RUNTIME_CONFIG__` injected by the nginx entrypoint; API base URL is never baked into the bundle at build time
- **Automated installer** — setup manifest and shell scripts for unattended Fortemi+HotM deployment
- **CI: `publish-dist` workflow** — packages `ui/dist` as `hotm-ui-dist.tar.gz` and publishes to the `hotm-latest` rolling Gitea release on every push to `main`; consumed by downstream CI

### Changed

- API base URL resolution is now purely runtime: Tauri config → Docker runtime config → `VITE_API_BASE_URL` → `http://localhost:3000/api/v1`. Build-time baking removed.
- Large file uploads (≥ 50 MB) in Capture panel now route through TUS automatically
- Attachment uploads queued through `uploadStore` for consistent background-transfer behaviour
- Agent proxy: upgraded from direct OpenAI Responses API to Chat Completions API for broader provider compatibility
- Admin system info tab uses `healthCheck()` endpoint (resolves 404 regression from `/api/v1` base URL change)
- Offline detector decoupled from Fortemi inference capabilities — inference unavailability no longer incorrectly marks the app as offline
- Default Ollama generation model updated from `qwen3.5:9b` to `qwen3:14b`

### Fixed

- WebSocket fallback URL now includes the `/api/v1` prefix
- `InferenceStatusIndicator` guards against undefined providers
- Agent: tool execution pipeline, session serialization, search result navigation, and response cutoffs
- Agent: `useRef` strict initialization for React 19 compatibility
- Capture: `save-as-note` surfaces attachment failures as partial state rather than a hard error
- CI: Gitea registry publishing uses `BUILD_REPO_TOKEN` for authentication
- CI: sidecar download corrected to `Fortemi/fortemi@sidecar-latest` (previous workflows referenced a non-existent `Fortemi/matric-api` repository)
- CI: macOS DMG build uses Tauri-produced bundle directly; custom ad-hoc re-signing of `matric-api` was failing strict codesign validation on the build host due to dylib paths baked in by Fortemi CI

## [2026.2.18] - 2026-02-24

### Changed

- **API base URL refactor** — moved hardcoded `/api/v1/` prefix from 196 occurrences across 24 API modules into `VITE_API_BASE_URL` configuration. The default is now `http://localhost:3000/api/v1`. Deployments behind reverse proxies or future API versions can change the path at config time without code changes. Added `getServerRoot()` utility for OAuth/health endpoints at the server root. (Closes #114)
- CI/CD pipeline migrated from GitHub Actions to Gitea Actions workflows
- Release pipeline hardened with file-based response parsing and jq-based JSON body generation
- Internal domain references removed from all defaults and examples

## [2026.2.4] - 2026-02-22

### Added

- **Persistent pop-out media player** — floating video/audio player that stays mounted across view navigation
  - MINI mode (280×210 video, 280×68 audio) with always-visible controls
  - EXPANDED mode (480×398 video, 400×80 audio) with minimize button
  - Fullscreen mode with custom controls and seek bar thumbnail previews
  - Drag-to-move with snap-to-corners (persists position to localStorage)
  - Global keyboard shortcuts: Alt+P (play/pause), Alt+←/→ (skip ±10s), Alt+M (mute), Alt+Shift+P (dismiss), Alt+Shift+E (cycle size)
  - Pop-out button on VideoControls and StreamingMedia (PictureInPicture2 icon)
  - Blob URL lifecycle management with ownership transfer to context provider
  - Double-click video to toggle fullscreen
- **Rich media previews** — tabbed preview dialog with streaming video, 3D model viewer, audio player, and file info bar
  - Native browser streaming via Fortemi download endpoints with Range request support
  - Blob download fallback when direct URL playback fails (e.g. memory routing headers)
  - 3D model preview using model-viewer for compressed GLB files
  - Error boundary to prevent UI crashes from unsupported media
- **Custom video controls** — scrubbar with seek-preview thumbnails, play/pause, volume, CC toggle, fullscreen
- **Expert mode overlay** — real-time playback stats (bitrate, resolution, codec) for video and audio players
- **SRT/subtitle support** — VTT/SRT transcript display with interactive seek-to-segment panel and default captions
- **Embedding set management** — dedicated view for managing embedding configurations with criteria editor
- **Job Queue view** — centralized job event store with pending queue, API-seeded recent activity, and note ID display
- **Background upload queue** — global transfer status indicator with concurrent upload management
- **TUS resumable uploads** — resumable uploads for files >= 50 MB via tus protocol
- **Linked notes tab** — in attachments browser with dedup key for cross-note references
- **Unified search** — concept, temporal, and location filter support with renamed search view
- **Capture processing options** — version history UX and media optimize toggle during upload
- **Attachment extraction status** — display extraction progress and AI-generated descriptions

### Changed

- SSE event system overhauled for Fortemi v2026.2.10 compatibility
- Attachment API client updated for new Fortemi download/streaming endpoints
- Replaced Three.js with model-viewer for compressed GLB support (smaller bundle, better compat)
- Replaced Radix ScrollArea with native overflow for job activity list (jsdom compat)
- Tauri reqwest bumped to 0.13 to resolve tauri-plugin-http conflicts

### Fixed

- Video controls overlay and fullscreen layout — controls now overlay video bottom edge instead of rendering below; fullscreen fills viewport without 500px cap
- Mini player close button — drag handler no longer intercepts button clicks in title bar
- Video CORS blocking with audio transcript support
- Media preview bugs with transcript and scene display
- GLB model preview uses direct download URL
- Embeddings screen crash from API response format mismatch
- Empty memory search results — API field mapping and title fetching corrected
- Real error messages surfaced for failed attachment uploads
- Recent activity card normalized to match pending queue design
- Blob playback reliability with subtitle endpoint fallback
- Missing graphology-types peer dependency

## [2026.2.3] - 2026-02-20

### Added

- **Quick Capture** — dedicated note entry view with sticky classification settings
  - Archive, collection, concept, and tag selection persisted via localStorage
  - AI enhancement level selector (Full / Light / None)
  - Document type classification selector (auto-detect or explicit)
  - File attachment support with drag-and-drop and file picker
  - "Attachment-as-note" — submit files with auto-generated content from filenames
  - Session log showing captured notes with metadata
  - Keyboard shortcuts (Shift+Enter to commit, Escape to clear)
- **Regenerate AI dropdown** — select enhancement level (Full / Light / None) when regenerating a note
- **Standalone attachments browser** — browse all attachments from sidebar navigation
- **Standalone concept browser** — full-width SKOS concept browser with scheme tabs
- **Note titles in related notes** panel

### Changed

- Sidebar navigation: removed Quick Access and Tag Filter sections
- ConceptBrowser converted from modal to full-width standalone view
- Related notes use `/related` endpoint with LLM context

### Fixed

- Black screen crash when navigating to Capture (document-types API response shape mismatch)
- Links API response shape (incoming not backlinks)
- SSE auto-reconnection preserved with native EventSource
- Title derivation in notesFromSummaries
- License updated to BSL-1.1 in About page
- Version and commit SHA injected at build time
- System Info tab shows real Fortemi API data

## [2026.2.2] - 2026-02-19

### Added

- Admin panel: API endpoint and config source display on System Info tab
- Tauri v2 research report

### Fixed

- Tauri HTTP plugin routing for compat API, WebSocket, and SSE
- Compat API reinitialization after Tauri config loads
- Attachment preview and graph layout in Tauri desktop shell

## [2026.2.0] - 2026-02-19

First formal release of HotM as a standalone React SPA.

### Added

- **Dashboard** with archive-scoped health summaries and notes workspace
- **Graph Explorer** built on Sigma.js and Graphology with ForceAtlas2 layout
  - Click-to-explore, double-click-to-open note navigation
  - Back/forward history for node selections
  - Label backgrounds and hover-only label display
  - Filter sidebar with tag and concept scoping
  - Node enrichment with per-note tags and concepts from API
  - Sparse graph fallback for small datasets
- **Realtime event bus** with SSE and WebSocket transports and automatic fallback
- **Realtime debug inspector** for monitoring event streams
- **Archive management** with job pause/resume controls and scoped job counts
- **Memory search** — AI-assisted contextual retrieval
- **Concept browser** — NLP-extracted concept navigation
- **Advanced search** — multi-field filters, tag/concept scoping, date ranges
- **Note templates** for structured capture
- **Attachments panel** with PDF preview
- **Mobile read mode** with responsive layout
- **Note provenance** display in metadata panel
- **Metadata edit lock** and title typing animation
- **Federated search** across multiple Fortemi archives
- **Job queue monitoring** with stalled WebSocket detection
- **Docker deployment** via `docker-compose.prod.yml` with nginx serving
- **Playwright E2E test suite** for critical user journeys
- **CI/CD pipelines** — GitHub Actions and Gitea runners for tests, builds, and image publishing

### Changed

- **Architecture**: migrated from Tauri desktop wrapper to pure React SPA consuming Fortemi API
- **Graph renderer**: migrated from custom canvas renderer to Sigma.js/Graphology stack
- **API client**: complete rewrite as typed per-domain modules (notes, search, tags, collections, health, etc.)
- **Embedding config**: hardened parsing with flexible field mapping
- **Note list**: paginated with total counts
- **Health panel**: archive-scoped summaries instead of global-only view

### Fixed

- Graph dense cluster readability with sqrt-blend density spreading
- Stale closure bugs in graph node/edge reducers via ref-based state
- Sidebar pointer event capture by Sigma canvas
- Keyboard event propagation from graph filter sidebar
- SSE event stream stability with proper fallback
- Concept list deduplication
- Note refresh on background job completion
- WebGL global stubs in test setup for Sigma compatibility

[2026.4.0]: https://github.com/Fortemi/HotM/compare/v2026.2.18...v2026.4.0
[2026.2.18]: https://github.com/Fortemi/HotM/compare/v2026.2.4...v2026.2.18
[2026.2.4]: https://github.com/Fortemi/HotM/compare/v2026.2.3-alpha...v2026.2.4
[2026.2.3]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.3
[2026.2.2]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.2
[2026.2.0]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.0
