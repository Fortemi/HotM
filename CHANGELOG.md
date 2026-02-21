# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

[2026.2.3]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.3
[2026.2.2]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.2
[2026.2.0]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.0
