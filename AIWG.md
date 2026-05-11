# AIWG.md
<!-- aiwg-managed -->
<!-- Regenerated 2026-05-11. Edit provider override files for operator additions. -->

This file provides shared AIWG framework context for agents working in this
repository.

## Repository Purpose

HotM (Hall of the Mind) is a React-based single-page application that provides
a rich web interface for note-taking, analysis, search, and revision workflows.
The application consumes the Fortemi API for immutable note storage,
NLP-powered revisions, attachments, hybrid search, and realtime job events.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js with npm
- **Application framework**: React 19 + Vite 7
- **Desktop/mobile shell**: Tauri 2
- **Testing**: Vitest, Testing Library, Playwright
- **Styling/UI**: TailwindCSS, Radix UI, lucide-react
- **Data and visualization**: React Router, graphology, sigma, Leaflet, Mermaid, KaTeX
- **API integration**: Fetch-based Fortemi API client, websocket/realtime services, TUS uploads
- **CI/CD**: Gitea Actions workflows under `.gitea/workflows/`

## Documentation Structure

Comprehensive documentation is available in the `docs/` directory:

- [Documentation Index](docs/index.md) - Complete navigation guide
- [Requirements](docs/requirements/) - Functional and non-functional requirements
- [Specifications](docs/specifications/) - API specification
- [Architecture](docs/architecture/) - System design
- [Implementation](docs/implementation/) - Development and testing guides
- [UX Design](docs/ux/) - Wireframes, accessibility, feature specs
- [Operations](docs/sops/) - Release, governance, incident response SOPs

---

## Team Directives & Standards

<!-- PRESERVED SECTION - Content maintained across regeneration -->

### Testing Discipline

**Gitea act_runner is the AUTHORITATIVE standard for all testing**

Before pushing ANY changes:
1. Run `act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml` from repo root and wait for completion
2. Verify exit code 0 and all tests passing
3. Only push after confirming green local test runs
4. If any tests fail, fix issues and repeat from step 1

**No exceptions - even for "simple" fixes. act_runner tests are the single source of truth.**

#### Standard Test Commands (Use These)

- **Full frontend validation**: `act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml` (React tests, TypeScript build, coverage, security audit)
- **Quick local iteration**: `cd ui && npm test -- --run`

All shell-based test scripts have been removed - use `act_runner` for consistent CI/CD parity.

### Key Technical Decisions

1. **Immutable Originals**: Never modify original note content; all edits create new revisions (handled by Fortemi API)
2. **SPA Architecture**: React application consuming external Fortemi API
3. **Hybrid Search**: Combines PostgreSQL full-text search with pgvector semantic search (via API)
4. **API-Driven**: All data operations delegated to Fortemi API
5. **Modular Components**: Reusable UI components with Radix UI primitives
6. **Type Safety**: Full TypeScript coverage with strict mode
7. **Responsive Design**: Mobile-first approach with TailwindCSS

### Testing Approach

- **Target Coverage**: 60-80% overall
- **Unit Tests**: Component logic and utilities
- **Integration Tests**: API client and data flows
- **E2E Tests**: Critical user journeys
- **Test Organization**: Tests colocated with source in `__tests__` directories

See [Testing Strategy](docs/implementation/testing-strategy.md) for comprehensive testing guide.

<!-- /PRESERVED SECTION -->

---

## Development Commands

### React Application

```bash
cd ui
npm install
npm run dev
npm run build
npm run preview
npm run typecheck
```

### Tests

```bash
# Authoritative full validation, mirrors Gitea CI
act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml

# Quick local iteration only
cd ui && npm test -- --run

# Additional local test surfaces
cd ui && npm run test:coverage
cd ui && npm run test:e2e
cd ui && npm run test:realtime
```

### Tauri

```bash
cd ui
npm run tauri:dev
npm run tauri:build
```

## Architecture

### Core Components

**Web application**:

- Location: `ui/src/`
- API client in `ui/src/api/`
- Component library in `ui/src/components/`
- Realtime and upload services in `ui/src/services/`
- Custom hooks in `ui/src/hooks/`
- Utilities in `ui/src/lib/`

**External API: Fortemi**:

- Rust-based HTTP API in a separate repository
- Provides storage, search, NLP pipeline, attachments, and job status
- PostgreSQL backend with pgvector extension
- Ollama integration for embeddings and generation
- MCP server integration for assistant workflows

### Key Data Flow

1. **Note creation**: User input -> API client -> Fortemi API -> background NLP pipeline
2. **NLP pipeline**: Fortemi chunks, revises, summarizes, extracts metadata, detects links, computes embeddings, and updates indexes
3. **Search**: Query -> API client -> Fortemi hybrid search -> ranked UI display
4. **Revision display**: Fetch note from API -> show revised content by default -> preserve immutable original access
5. **Realtime events**: Fortemi job events -> websocket/event services -> UI status and inspector surfaces
6. **Attachments**: UI upload client -> Fortemi attachment endpoints -> metadata and status rendering

## Project Structure

```text
hotm/
├── ui/                 # React SPA and Tauri app
│   ├── src/
│   │   ├── api/        # Fortemi API client
│   │   ├── components/ # React components
│   │   ├── services/   # Realtime, upload, job event management
│   │   ├── hooks/      # Custom React hooks
│   │   └── lib/        # Utilities and helpers
│   ├── public/         # Static assets
│   └── tests/          # E2E tests
├── docs/               # Architecture, design, implementation, ops docs
├── .aiwg/              # SDLC artifacts and AIWG workspace data
├── .claude/            # Claude provider agents, skills, and rules
├── .codex/             # Codex provider agents
└── .gitea/             # Gitea Actions CI/CD workflows
```

## Version Management

Version is managed in `ui/package.json`. The current UI package version is
`2026.5.6`.

Release channel configuration is stored in `release.json`:

- `alpha`: early development releases with experimental features
- `beta`: pre-release builds for community testing
- `rc`: release candidates awaiting final testing
- `stable`: production releases

## Environment Variables

Create a `.env` or `.env.local` file in `ui/` (`.env.local` is preferred for
local overrides and is gitignored by Vite):

- `VITE_API_BASE_URL`: Fortemi API base URL, default `http://localhost:3000`
- `VITE_DISABLE_WEBSOCKET`: set to `true` to disable websocket realtime events
- `VITE_SENTRY_DSN`: optional Sentry DSN
- `VITE_ENABLE_REALTIME_INSPECTOR`: set to `true` for the realtime event inspector in development
- `VITE_GIT_SHA`: override embedded git SHA in builds
- `TAURI_DEV_HOST`: remote host for Tauri dev server

## Important Files

- `ui/package.json` - Frontend dependencies and npm scripts
- `ui/vite.config.ts` - Vite build configuration
- `ui/tailwind.config.js` - TailwindCSS styling
- `ui/tsconfig.json` - TypeScript configuration
- `.gitea/workflows/ui-ci.yml` - authoritative UI quality gate
- `.gitea/workflows/*.yml` - CI/CD and release workflows
- `release.json` - release channel configuration
- `AGENTS.md` - Codex/generic provider hook file
- `CLAUDE.md` - Claude provider hook file
- `AIWG.md` - shared AIWG context

---

## AIWG Framework Integration

This project uses AIWG for software development lifecycle management and
cross-provider agent context.

### Installed Frameworks

| Framework | Status |
|-----------|--------|
| sdlc-complete | healthy |
| media-marketing-kit | healthy |

### Workspace State

- **Workspace path**: `.aiwg/`
- **Structure**: framework-scoped
- **Migration status**: partial mixed structure
- **Recommended maintenance**: `aiwg migrate-workspace`

### Deployed Resources

- **Claude agents**: 197 registered from `.claude/agents/`
- **Claude skills**: 16 registered from `.claude/skills/`
- **Claude commands**: 0 registered; this is expected for the current Claude setup
- **Provider hook files**: `AGENTS.md` and `CLAUDE.md` point agents to `AIWG.md`
- **Artifact index**: rebuilt at `.aiwg/.index/framework/`

### Core Platform Orchestrator Role

When users request SDLC workflows in natural language or command-like phrasing,
interpret the request as an orchestration task, not as a shell command to run
blindly.

Map requests to AIWG capabilities:

- "Let's transition to Elaboration" -> `flow-inception-to-elaboration`
- "Start security review" -> `flow-security-review-cycle`
- "Create architecture baseline" -> SAD and ADR workflow extraction
- "Run iteration 5" -> `flow-iteration-dual-track` with `iteration=5`
- "Regenerate context" -> `aiwg-regenerate`
- "Refresh AIWG" -> `aiwg-refresh`

For substantial SDLC artifacts, use the pattern:

```text
Primary Author -> Parallel Reviewers -> Synthesizer -> Archive
```

Track progress clearly and write SDLC artifacts under `.aiwg/` subdirectories.
Maintain traceability from requirements to architecture, code, tests, and
deployment.

### AIWG-Specific Rules

1. **Artifact location**: Create SDLC artifacts in `.aiwg/` subdirectories unless the user explicitly asks otherwise.
2. **Agent orchestration**: Use multi-agent patterns where supported by the active provider.
3. **Phase gates**: Validate gate criteria before transitioning lifecycle phases.
4. **Traceability**: Preserve links from requirements to code, tests, and deployment evidence.
5. **Testing authority**: Respect the team directive that Gitea `act_runner` is the authoritative validation path.
6. **Provider hooks**: Keep provider context files small and point them at `AIWG.md`.

## Troubleshooting

**Artifact index missing**:

```bash
aiwg index build --graph framework
```

**Command or skill not found**:

```bash
aiwg discover "<intent>"
aiwg list
```

**Workspace reports partial migration**:

```bash
aiwg migrate-workspace
```

**API connection issues**:

- Verify Fortemi API is running at `VITE_API_BASE_URL`
- Check CORS configuration on the Fortemi API
- Verify websocket settings when realtime events are expected

## Resources

- **AIWG Repository**: https://github.com/jmagly/ai-writing-guide
- **Project Documentation**: [docs/index.md](docs/index.md)
- **API Specification**: [docs/specifications/api-specification.md](docs/specifications/api-specification.md)
- **Architecture**: [docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)

---

<!--
  USER NOTES
  Add team-specific directives, conventions, or notes below.
  Use PRESERVE markers for content that must survive regeneration.
-->
