# System Constraints

## Scope

HotM is a **client-only React SPA**. Constraints are labeled:

- **CLIENT**: Applies to HotM frontend
- **BACKEND**: Applies to Fortemi API (documented for context, owned by Fortemi)

## Technical Constraints

### Client Platform (CLIENT)

- **Runtime**: Modern web browser with ES2020+ support
- **Display**: Minimum 320px viewport (responsive), recommended 1280x720+
- **Node.js**: 20+ for development
- **Package Manager**: npm 10+
- **Build Tool**: Vite 7+
- **Framework**: React 19 with TypeScript 5.8+ strict mode

### Backend Platform (BACKEND)

- **PostgreSQL**: 14.0+ with pgvector extension
- **Ollama**: Required for NLP features (embedding, revision, tagging)
- **Rust**: Axum HTTP server (Fortemi repository)

### Development Constraints (CLIENT)

- **TypeScript**: Strict mode enabled, no implicit `any`
- **Testing**: Vitest + React Testing Library, `act_runner` as authoritative CI
- **Linting**: ESLint enforced
- **Build**: Must produce static assets servable by any HTTP server

## Business Constraints

### Licensing

- **License**: BUSL-1.1 (Business Source License 1.1)
- **Dependencies**: Must use compatible open-source licenses
- **UI Components**: Radix UI (MIT), TailwindCSS (MIT)

### Budget

- **Development**: Self-funded
- **Infrastructure**: User provides hosting (Docker, static server, or Tauri desktop)
- **Third-Party Services**: None required — all local

### Timeline

- **2026.1.x**: Core SPA with note management and search
- **2026.2.x**: Feature views (graph, concepts, templates, capture)
- **Post-MVP**: Authentication, PWA, dark mode

## Design Constraints

### Architectural Patterns (CLIENT)

- **SPA Architecture**: Single page application, no server-side rendering
- **API-Driven**: All data operations via Fortemi REST API
- **Component-Based**: Reusable React components with Radix UI primitives
- **Hooks Pattern**: React hooks for state management (no Redux/MobX)
- **Event-Driven**: Realtime updates via SSE/WebSocket transport

### Data Model (BACKEND)

- **Immutable Originals**: Never modify source content
- **Revision History**: All edits create new revisions
- **UTC Timestamps**: All dates stored in UTC, displayed in local time
- **Soft Deletes**: Data preserved for recovery

### API Design (BACKEND)

- **RESTful**: `/api/v1/*` endpoints
- **Snake Case**: All API response fields use `snake_case`
- **Versioned**: URL path versioning
- **Idempotent**: Safe retry semantics for mutations

## Operational Constraints

### Deployment (CLIENT)

- **Docker**: Primary deployment via `docker compose` with nginx
- **Static**: Vite production build servable by any HTTP server
- **Tauri**: Optional desktop shell for native features
- **Port**: Default 4180 (nginx container)

### Configuration (CLIENT)

- **Environment Variables**: `VITE_API_BASE_URL`, `VITE_DISABLE_WEBSOCKET`, `VITE_SENTRY_DSN`
- **No Build-Time Secrets**: All config via environment variables
- **Sticky Settings**: User preferences persisted in localStorage

### Maintenance

- **Backward Compatibility**: API client handles response shape variations
- **CalVer Versioning**: `YYYY.M.PATCH` format, no leading zeros
- **CI/CD**: Gitea Actions workflows, `act_runner` for local validation

## Security Constraints

### Client (CLIENT)

- **No Credentials Storage**: No API keys or tokens in frontend bundle
- **Input Sanitization**: All user input validated before display and API submission
- **CSP**: Content Security Policy headers via nginx
- **Dependency Auditing**: `npm audit` in CI pipeline

### Backend (BACKEND)

- **Authentication**: Deferred to post-MVP (Keycloak OIDC planned)
- **TLS**: Required for non-localhost deployments
- **No Telemetry**: Zero external calls

## Accessibility Constraints (CLIENT)

- **WCAG 2.1**: Level AA compliance target
- **Keyboard Navigation**: Full functionality without mouse
- **Screen Reader**: ARIA attributes on all interactive elements
- **Focus Management**: Visible focus indicators, logical tab order
- **Touch Targets**: 44px minimum on mobile viewports
- **Color Contrast**: 4.5:1 for text, 3:1 for UI components

## External Interface Constraints

### API Communication

- **Protocol**: HTTP/1.1 minimum, HTTPS for production
- **Data Format**: JSON with UTF-8 encoding
- **Date Format**: ISO 8601
- **File Upload**: Multipart form data for attachments
- **Realtime**: WebSocket or SSE for event streaming

### Integration Points (BACKEND)

| Service | Protocol | Port | Purpose |
|---------|----------|------|---------|
| Fortemi API | HTTP REST | 3000 | All data operations |
| WebSocket | WS | 3000 | Realtime events |
| Ollama | HTTP REST | 11434 | NLP processing |

## Quality Constraints

### Code Quality (CLIENT)

- **Linting**: ESLint must pass
- **Type Safety**: TypeScript strict mode, zero `any` in new code
- **Test Coverage**: 60-80% target
- **CI Gates**: `act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml` exit code 0 before push

### Testing (CLIENT)

- **Unit Tests**: Vitest with React Testing Library
- **Integration**: API client contract tests with mocked HTTP
- **E2E**: Playwright for critical user journeys (optional)
- **Security**: `npm audit` in CI pipeline
