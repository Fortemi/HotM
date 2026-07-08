# Development Guide

## Scope
This repository is client-only (HotM UI). Backend services are provided by Fortemi.

## Local Development
1. Configure API endpoint:

```env
# ui/.env.local
VITE_API_BASE_URL=http://localhost:3000
```

2. Start UI:

```bash
cd ui
npm install
npm run dev
```

## Quality Checks

Quick local iteration:
```bash
cd ui
npm run typecheck
npm run test -- --run
npm run test:hux-traceability
npm run build
```

Full CI-parity validation (authoritative — run before pushing):
```bash
act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml
```

The CI job runs `test:coverage` (all tests with coverage), `test:realtime` (WebSocket/SSE/event bus tests), and `test:hux-traceability` (HotM enterprise demo HUX requirement anchors) in addition to the typecheck and build. Use `npm run test:coverage`, `npm run test:realtime`, or `npm run test:hux-traceability` locally to target those suites.

## Notes
- Do not add backend runtime, migrations, or database bootstrap steps to this repo.
- If an API contract change is needed, implement/update it in the Fortemi repository and consume it from this client.
