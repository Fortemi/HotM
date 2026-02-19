# HotM — Hall of the Mind

[![Version](https://img.shields.io/badge/version-0.2.0-blue)]()
[![Channel](https://img.shields.io/badge/channel-beta-orange)]()
[![React](https://img.shields.io/badge/React-19-61dafb)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6)]()

A React single-page application for note-taking, knowledge exploration, and analysis. HotM provides a rich interface for capturing, organizing, and discovering connections within your notes — powered by the [Fortemi](https://github.com/Fortemi) API for immutable storage, NLP-powered revisions, and hybrid search.

## Features

### Notes & Editing
- Markdown editor with live preview, KaTeX math, Mermaid diagrams, and PlantUML rendering
- Immutable originals with NLP-generated revisions (summarization, rewriting)
- Metadata editing with title typing animation and edit locking
- Note templates for structured capture
- Context menus and keyboard shortcuts

### Search & Discovery
- **Hybrid search** — combines full-text search (PostgreSQL) with semantic vector search (pgvector)
- **Advanced search** — multi-field filters, tag/concept scoping, date ranges
- **Memory search** — AI-assisted contextual retrieval
- **Related notes** — automatic link discovery between notes

### Knowledge Graph
- Interactive graph explorer built on **Sigma.js** and **Graphology**
- ForceAtlas2 layout with hover labels and click-to-explore navigation
- Back/forward history navigation through node selections
- Filter sidebar with tag and concept scoping
- Node enrichment with per-note tags and extracted concepts

### Organization
- **Collections** — group notes into named collections
- **Tags** — hierarchical SKOS-based tag management
- **Concepts** — NLP-extracted concept browser
- **Archives** — multi-archive support with scoped views
- **Timeline** — chronological note browsing

### System & Operations
- **Dashboard** — overview with archive-scoped health summaries and notes workspace
- **Health monitoring** — API and system status with per-archive metrics
- **Job management** — background NLP pipeline monitoring with pause/resume controls
- **Realtime event bus** — SSE and WebSocket transport with automatic fallback
- **Attachments** — file attachments with PDF preview
- **Version history** — note revision tracking
- **Backup** — export and restore capabilities
- **Admin panel** — system configuration and diagnostics
- **Mobile read mode** — responsive layout for mobile devices

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- A running [Fortemi API](https://github.com/Fortemi) instance

### Install & Run
```bash
cd ui
npm install
npm run dev
```

The development server starts at `http://localhost:5173`.

### Configure API Endpoint
Create `ui/.env`:
```env
VITE_API_BASE_URL=https://memory.integrolabs.net
```

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | Fortemi API base URL |
| `VITE_API_TIMEOUT` | `30000` | API request timeout (ms) |
| `VITE_APP_TITLE` | `HotM` | Application title |
| `VITE_DISABLE_WEBSOCKET` | `false` | Disable WebSocket transport |

## Development

```bash
cd ui

# Development with hot reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests (quick local iteration)
npm test -- --run

# Full CI-parity test suite (authoritative)
gh act -j frontend-tests

# Production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```text
hotm/
├── ui/                          # React SPA
│   ├── src/
│   │   ├── api/                 # Fortemi API client (typed per-domain modules)
│   │   ├── components/          # React components
│   │   │   ├── admin/           # Admin panel
│   │   │   ├── archives/        # Archive management
│   │   │   ├── attachments/     # File attachments & PDF preview
│   │   │   ├── backup/          # Backup & restore
│   │   │   ├── collections/     # Collection management
│   │   │   ├── concepts/        # NLP concept browser
│   │   │   ├── graph/           # Knowledge graph (Sigma.js)
│   │   │   ├── health/          # System health monitoring
│   │   │   ├── memory/          # Memory search
│   │   │   ├── search/          # Advanced search
│   │   │   ├── tags/            # Tag management
│   │   │   ├── templates/       # Note templates
│   │   │   ├── timeline/        # Chronological browsing
│   │   │   ├── ui/              # Shared UI primitives (Radix)
│   │   │   └── versions/        # Version history
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utilities and helpers
│   │   ├── services/            # Event bus and transport
│   │   └── utils/               # Shared utilities
│   ├── public/                  # Static assets
│   └── tests/                   # E2E tests (Playwright)
├── docs/                        # Architecture, specs, SOPs
└── .aiwg/                       # SDLC artifacts
```

## Docker Deployment

```bash
# Build and run with defaults
docker compose -f docker-compose.prod.yml up -d --build

# Custom API endpoint
FORTEMI_API_URL=https://your-fortemi.example.com \
  docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f hotm-ui
```

The container serves the SPA on port **4180** via nginx.

## Documentation

- [Documentation Index](docs/index.md) — full navigation guide
- [Quick Start](docs/quick-start.md) — get running in minutes
- [Changelog](CHANGELOG.md) — version history
- [Release Notes](docs/releases/) — detailed release announcements
- [API Specification](docs/specifications/api-specification.md) — Fortemi API endpoints
- [Architecture](docs/architecture/) — system design and decisions
- [Testing Strategy](docs/implementation/testing-strategy.md) — test approach and coverage

## Contributing

1. Create a feature branch from `main`.
2. Add or update tests with your change.
3. Verify all checks pass:
   ```bash
   gh act -j frontend-tests
   ```
4. Open a PR with screenshots for UI changes.
