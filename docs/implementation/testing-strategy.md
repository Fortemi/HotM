# Testing Strategy

## Scope
Testing in this repo covers client code only.

## Test Types
- Unit/component tests: Vitest + Testing Library (`ui/src/**/__tests__`)
- API client contract behavior: mocked HTTP tests under `ui/src/api/__tests__`
- Optional e2e/browser checks: Playwright in `ui/e2e`

## Required Checks
```bash
cd ui
npm run typecheck
npm run test -- --run
npm run test:hux-traceability
npm run build
```

## Non-Goals
- No backend integration test execution in this repo.
- No database migration or backend process bootstrap in this repo.
