# Non-Functional Requirements

## Scope

HotM is a **client-only React SPA**. Requirements are split into:

- **CLIENT (HotM)**: Frontend performance, usability, accessibility
- **BACKEND (Fortemi)**: API performance, data integrity, NLP processing, storage

Requirements marked **(Fortemi)** are documented here for context but owned by the Fortemi repository.

## Performance Requirements

### Client (HotM)

| Metric | Target | Notes |
|--------|--------|-------|
| Initial page load (FCP) | < 2s on broadband | Vite production build, gzip |
| Bundle size | < 300KB gzipped | Code splitting for feature views |
| View transition | < 100ms | React state-driven, no route reload |
| UI interaction response | < 50ms | Button clicks, input focus |
| Search input debounce | 200ms | Prevents excessive API calls |
| Textarea auto-grow | < 16ms | Within single animation frame |

### Backend (Fortemi)

| Metric | Target | Notes |
|--------|--------|-------|
| API response (simple) | < 200ms P95 | Note fetch, tag list |
| Search response (hybrid) | < 1.5s P95 | FTS + semantic + RRF fusion |
| Note creation | < 500ms | Returns note_id before pipeline |
| NLP processing | < 10s async | Revision, tagging, embedding |
| Attachment upload | < 5s for 10MB | Multipart form upload |

### Resource Usage (Client)

- **Browser memory**: < 150MB typical usage
- **Network**: API calls only — no background polling except SSE/WebSocket
- **localStorage**: < 1MB for sticky settings and cache

## Reliability Requirements

### Client (HotM)

- **Error Boundaries**: React error boundaries prevent full-page crashes
- **Retry Logic**: API client with exponential backoff for transient failures
- **Content Preservation**: User input preserved on commit failure
- **Graceful Degradation**: Features degrade individually (e.g., graph fails without affecting notes)
- **Offline Detection**: Show clear connection status when API unavailable

### Backend (Fortemi)

- **ACID Compliance**: All database operations
- **Immutable Originals**: Write-once guarantee on note content
- **Graceful Degradation**: System functional without Ollama (no NLP, note CRUD works)
- **Data Integrity**: Foreign key constraints, soft deletes for recovery

## Security Requirements

### Client (HotM)

- **Input Validation**: Client-side validation framework (`ui/src/utils/validation.ts`)
- **XSS Prevention**: React's built-in escaping + sanitization on user input
- **No Secrets in Client**: API keys and tokens not stored in frontend code
- **CSP Headers**: Content Security Policy via nginx configuration
- **Dependency Auditing**: `npm audit` in CI pipeline

### Backend (Fortemi)

- **Authentication**: Deferred to post-MVP (Keycloak OIDC planned)
- **API Rate Limiting**: Configurable per-endpoint
- **TLS**: Required for non-localhost deployments
- **CORS**: Configured for allowed origins only

### Privacy

- **No Telemetry**: Zero external calls from client
- **Local-First**: All data stays within configured Fortemi API endpoint
- **No Third-Party Services**: No analytics, tracking, or CDN dependencies

## Usability Requirements

### User Interface

- **Responsive Design**: Mobile (< 640px), tablet (640-1024px), desktop (> 1024px)
- **Keyboard Navigation**: Full keyboard support for all features
- **Accessibility**: WCAG 2.1 Level AA compliance target
- **Touch Targets**: 44px minimum on mobile
- **Focus Management**: Visible focus indicators, logical tab order

### User Experience

- **Learning Curve**: < 5 minutes to basic note capture
- **Error Messages**: Clear, actionable guidance with retry options
- **Sticky Settings**: Remember user preferences across sessions
- **Quick Capture**: < 3 actions from open to committed note

## Compatibility Requirements

### Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

### Platform Support

- **Web**: Any modern browser (primary)
- **Desktop**: Tauri 2 shell (optional, for native features)
- **Mobile**: Responsive web design, dedicated mobile read view at `/mobile`

### API Compatibility

- **Fortemi API**: v1 REST endpoints (`/api/v1/*`)
- **WebSocket**: RFC 6455 for realtime events
- **SSE**: Server-Sent Events as WebSocket fallback
- **JSON**: Primary data format, UTF-8 encoding

## Scalability Requirements

### Client

- **Note List**: Performant with 1000+ notes in view (virtual scrolling)
- **Graph**: Sigma.js handles 500+ nodes with WebGL rendering
- **Search Results**: Paginated, 50 results per page default

### Backend (Fortemi)

- **Notes**: Support 1M+ notes per instance
- **Concurrent Users**: 100+ web users
- **Embeddings**: pgvector HNSW index for 10M+ vectors

## Maintainability Requirements

### Code Quality

- **TypeScript**: Strict mode, no `any` in new code
- **Test Coverage**: 60-80% target (Vitest + React Testing Library)
- **Linting**: ESLint with project configuration
- **CI Gates**: `act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml` must pass before push

### Deployment

- **Docker**: `docker compose -f docker-compose.prod.yml up -d --build`
- **Static Assets**: Nginx serving Vite production build
- **Environment Config**: `VITE_API_BASE_URL` and related env vars
- **CalVer Versioning**: `YYYY.M.PATCH` format (e.g., 2026.2.3)

## Quality Attributes Priority

| Attribute | Priority | Rationale |
|-----------|----------|-----------|
| Reliability | Critical | Data integrity and content preservation |
| Usability | High | Quick capture requires minimal friction |
| Performance | High | Responsive UI for productive workflows |
| Security | High | Personal knowledge requires protection |
| Accessibility | High | WCAG 2.1 AA compliance |
| Maintainability | Medium | Long-term sustainability |
| Scalability | Medium | Multi-user web deployment |
