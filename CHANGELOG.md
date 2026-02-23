# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

[2026.2.4]: https://github.com/Fortemi/HotM/compare/v2026.2.3-alpha...v2026.2.4
[2026.2.3]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.3
[2026.2.2]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.2
[2026.2.0]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.0
