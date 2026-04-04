# CLAUDE.md


@AIWG.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

HotM (Hall of the Mind) is a React-based single-page application (SPA) providing a rich web interface for note-taking and analysis. The application consumes the Fortemi API for immutable note storage, NLP-powered revisions, and hybrid search capabilities.

## Tech Stack

- **Languages**: TypeScript/React
- **Runtime**: Node.js 18+
- **Package Manager**: npm
- **Framework**: React 19 + Vite
- **UI Libraries**: Radix UI, TailwindCSS, React Router
- **API Client**: Fetch-based client for Fortemi API
- **External API**: Fortemi (pronounced "for-TAY-mee") - Rust API providing storage, search, and NLP features

## Documentation Structure

Comprehensive documentation is available in the `docs/` directory:
- [Documentation Index](docs/index.md) - Complete navigation guide
- [Requirements](docs/requirements/) - Functional and non-functional requirements
- [Specifications](docs/specifications/) - API specification (v2)
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
1. Run `act_runner exec -j ui-quality-checks -W .gitea/workflows/ui-ci.yml` from repo root and wait for completion
2. Verify exit code 0 and all tests passing
3. Only push after confirming green local test runs
4. If any tests fail, fix issues and repeat from step 1

**No exceptions - even for "simple" fixes. act_runner tests are the single source of truth.**

#### Standard Test Commands (Use These)
- **Full frontend validation**: `act_runner exec -j ui-quality-checks -W .gitea/workflows/ui-ci.yml` (React tests, TypeScript build, coverage, security audit)
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

### React Application (SPA)
```bash
cd ui

# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests (use act_runner for full CI validation)
act_runner exec -j ui-quality-checks -W .gitea/workflows/ui-ci.yml
```

### Testing (Use act_runner - Authoritative Standard)
```bash
# STANDARD: Run full frontend test suite via Gitea act_runner (mirrors CI exactly)
act_runner exec -j ui-quality-checks -W .gitea/workflows/ui-ci.yml

# Quick local iteration only (not comprehensive)
cd ui && npm test -- --run     # Basic React unit tests only
```

## Architecture

### Core Components

**Web Application**: React SPA
- Location: `ui/src/`
- API client in `ui/src/api/`
- Component library in `ui/src/components/`
- React Router for navigation
- State management with React hooks and context

**External API**: Fortemi
- Rust-based HTTP API (separate repository)
- Provides storage, search, and NLP pipeline
- PostgreSQL backend with pgvector extension
- Ollama integration for embeddings and generation
- MCP server embedded for AI assistant integration

### Key Data Flow

1. **Note Creation**: User input -> API Client -> Fortemi API -> Background NLP pipeline
2. **NLP Pipeline**: (Handled by Fortemi) Chunk -> Summarize/Revise -> Extract tags/entities -> Detect links -> Compute embeddings -> Update indexes
3. **Search**: Query -> API Client -> Fortemi hybrid search (FTS + vector) -> Reciprocal Rank Fusion -> UI display
4. **Revision Display**: Fetch note from API -> Show revised by default -> Preserve link to immutable original
5. **MCP Integration**: AI Assistant -> MCP Tools -> Fortemi API -> Database

### API Client Integration

The application uses a TypeScript API client (`ui/src/api/`) to communicate with Fortemi:

- **Notes API**: Create, read, update note metadata and revisions
- **Search API**: Hybrid search, semantic search, filters
- **Tags API**: Tag management and filtering
- **Collections API**: Collection organization
- **Links API**: Dynamic linking between notes
- **Analytics API**: Usage metrics and provenance tracking

See [API Specification](docs/specifications/api-specification.md) for endpoint details.

## Project Structure

```
hotm/
├── ui/                 # React SPA
│   ├── src/
│   │   ├── api/        # Fortemi API client
│   │   ├── components/ # React components
│   │   ├── pages/      # Route pages
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utilities and helpers
│   │   └── styles/     # Global styles and theme
│   ├── public/         # Static assets
│   └── tests/          # E2E tests
├── docs/               # Architecture and design docs
├── .aiwg/              # SDLC artifacts (requirements, architecture, testing)
└── .github/            # CI/CD workflows
```

## Version Management

### Version Consistency
Version is managed in:
- `ui/package.json` - Application version

### Version Commands
```bash
# Update version in package.json
npm version <major|minor|patch>
# Example: npm version patch (0.1.2 -> 0.1.3)
```

### Release Channels

Release channels allow community testing while maintaining clean package versions:

- **`alpha`**: Early development releases with experimental features
- **`beta`**: Pre-release builds for community testing (default)
- **`rc`**: Release candidates - stable builds awaiting final testing
- **`stable`**: Production releases

Channel configuration is stored in `release.json`.

## Environment Variables

Create a `.env` file in the `ui/` directory:

- `VITE_API_BASE_URL`: Fortemi API base URL (default: `http://localhost:3000`)
- `VITE_API_TIMEOUT`: API request timeout in milliseconds (default: `30000`)
- `VITE_APP_TITLE`: Application title (default: `HotM`)

Example `.env`:
```
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=30000
VITE_APP_TITLE=HotM
```

## Important Files

- `ui/package.json` - Frontend dependencies and scripts
- `ui/vite.config.ts` - Vite build configuration
- `ui/tailwind.config.js` - TailwindCSS styling
- `ui/tsconfig.json` - TypeScript configuration
- `.gitea/workflows/` - CI/CD pipelines
- `release.json` - Release channel configuration

## Configuration Files

| File | Purpose |
|------|---------|
| `ui/package.json` | Frontend dependencies and npm scripts |
| `ui/vite.config.ts` | Vite build configuration |
| `ui/tailwind.config.js` | TailwindCSS styling |
| `ui/tsconfig.json` | TypeScript configuration |
| `.gitea/workflows/*.yml` | Gitea Actions CI/CD |
| `.claude/settings.local.json` | Claude Code permissions |

---

## AIWG Framework Integration

This project uses the **AI Writing Guide SDLC framework** for software development lifecycle management.

### Installed Frameworks

| Framework | Version | Status |
|-----------|---------|--------|
| sdlc-complete | 1.0.0 | healthy |
| media-marketing-kit | 1.0.0 | healthy |

### Deployed Resources

- **Agents**: 57 SDLC role agents in `.claude/agents/`
- **Commands**: 73 slash commands in `.claude/commands/`
- **Artifacts**: `.aiwg/` directory with requirements, architecture, planning, testing

### Current Project State

- **Phase**: Construction (Iteration 1 complete)
- **Key Artifacts**:
  - `.aiwg/architecture/software-architecture-doc.md` - SAD
  - `.aiwg/architecture/ADR-*.md` - Architecture Decision Records
  - `.aiwg/planning/iteration-plan-*.md` - Iteration plans
  - `.aiwg/testing/master-test-plan.md` - Test strategy
  - `.aiwg/requirements/mvp-acceptance-criteria.md` - MVP criteria

### Claude Code Configuration

Local permissions configured in `.claude/settings.local.json`:
- Read/write access to project files
- Process management commands allowed

### Core Platform Orchestrator Role

**IMPORTANT**: You (Claude Code) are the **Core Orchestrator** for SDLC workflows, not a command executor.

When users request SDLC workflows (natural language or commands):

#### 1. Interpret Natural Language

Map user requests to flow templates:
- "Let's transition to Elaboration" -> `flow-inception-to-elaboration`
- "Start security review" -> `flow-security-review-cycle`
- "Create architecture baseline" -> Extract SAD generation from flow
- "Run iteration 5" -> `flow-iteration-dual-track` with iteration=5

#### 2. Read Flow Commands as Orchestration Templates

**NOT bash scripts to execute**, but orchestration guides containing:
- **Artifacts to generate**: What documents/deliverables
- **Agent assignments**: Who is Primary Author, who reviews
- **Quality criteria**: What makes a document "complete"
- **Multi-agent workflow**: Review cycles, consensus process
- **Archive instructions**: Where to save final artifacts

Flow commands are located in `.claude/commands/flow-*.md`

#### 3. Launch Multi-Agent Workflows via Task Tool

**Follow this pattern for every artifact**:

```text
Primary Author -> Parallel Reviewers -> Synthesizer -> Archive
     |                 |                    |           |
  Draft v0.1    Reviews (3-5)      Final merge    .aiwg/archive/
```

**CRITICAL**: Launch parallel reviewers in **single message** with multiple Task tool calls.

#### 4. Track Progress and Communicate

Update user throughout with clear indicators:
- Complete
- In progress
- Error/blocked
- Warning/attention needed

### Available Commands (Key Categories)

**Intake & Inception**:
- `/intake-wizard` - Generate or complete intake forms interactively
- `/intake-from-codebase` - Analyze existing codebase to generate intake
- `/intake-start` - Validate intake and kick off Inception phase
- `/flow-concept-to-inception` - Execute Concept -> Inception workflow

**Phase Transitions**:
- `/flow-inception-to-elaboration` - Transition to Elaboration phase
- `/flow-elaboration-to-construction` - Transition to Construction phase
- `/flow-construction-to-transition` - Transition to Transition phase

**Continuous Workflows**:
- `/flow-risk-management-cycle` - Risk identification and mitigation
- `/flow-requirements-evolution` - Living requirements refinement
- `/flow-architecture-evolution` - Architecture change management
- `/flow-test-strategy-execution` - Test suite execution and validation
- `/flow-security-review-cycle` - Security validation and threat modeling

**Quality & Gates**:
- `/flow-gate-check <phase-name>` - Validate phase gate criteria
- `/project-status` - Current phase, milestone progress, next steps
- `/project-health-check` - Overall project health metrics

**Team & Process**:
- `/flow-team-onboarding <member> [role]` - Onboard new team member
- `/flow-knowledge-transfer <from> <to> [domain]` - Knowledge transfer workflow
- `/flow-retrospective-cycle <type> [iteration]` - Retrospective facilitation

**Deployment & Operations**:
- `/flow-deploy-to-production` - Production deployment
- `/flow-incident-response <incident-id> [severity]` - Production incident triage

### AIWG-Specific Rules

1. **Artifact Location**: All SDLC artifacts MUST be created in `.aiwg/` subdirectories (not project root)
2. **Agent Orchestration**: Follow multi-agent patterns (Primary Author -> Parallel Reviewers -> Synthesizer -> Archive)
3. **Phase Gates**: Validate gate criteria before transitioning phases (use `flow-gate-check`)
4. **Traceability**: Maintain traceability from requirements -> code -> tests -> deployment
5. **Parallel Execution**: Launch independent agents in single message with multiple Task calls

### Phase Overview

**Inception** (4-6 weeks):
- Validate problem, vision, risks
- Architecture sketch, ADRs
- **Milestone**: Lifecycle Objective (LO)

**Elaboration** (4-8 weeks):
- Detailed requirements (use cases, NFRs)
- Architecture baseline (SAD, component design)
- **Milestone**: Lifecycle Architecture (LA)

**Construction** (8-16 weeks):
- Feature implementation
- Automated testing (unit, integration, E2E)
- **Milestone**: Initial Operational Capability (IOC)

**Transition** (2-4 weeks):
- Production deployment
- User acceptance testing
- **Milestone**: Product Release (PR)

---

## Troubleshooting

**Template Not Found**:
- Verify AIWG installation at `~/.local/share/ai-writing-guide`
- Check `.claude/settings.local.json` has read access to AIWG path

**Agent Access Denied**:
- Verify path uses absolute path (not `~` shorthand for user home)

**Command Not Found**:
- Run `/aiwg-refresh` to redeploy commands

**API Connection Issues**:
- Verify Fortemi API is running at configured `VITE_API_BASE_URL`
- Check CORS configuration on Fortemi API
- Verify network connectivity

## Resources

- **AIWG Repository**: https://github.com/jmagly/ai-writing-guide
- **Project Documentation**: [docs/index.md](docs/index.md)
- **API Specification**: [docs/specifications/api-specification.md](docs/specifications/api-specification.md)
- **Architecture**: [docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)
- **Fortemi API**: (Separate repository - consult API documentation)

---

<!--
  USER NOTES
  Add team-specific directives, conventions, or notes below.
  Use <!-- PRESERVE --> markers for content that must survive regeneration.
-->
