# Repository Guidelines

## Project Structure & Module Organization
- `ui/`: Tauri + React/TypeScript app. Frontend in `ui/src/`; Tauri backend in `ui/src-tauri/`; Vite config in `ui/vite.config.ts`.
- `docs/`: Architecture, requirements, and implementation guides. Start at `docs/index.md`.
- `scripts/`: Utility scripts for UI/dev/release tasks.

## Build, Test, and Development Commands
- UI (Tauri/React): `cd ui && npm install` then `npm run dev` — start Vite dev. `npm run build` — production build. `npm run test` / `npm run test:coverage` — Vitest unit tests. `npm run typecheck` — TS checks.
- Optional containerized SPA deploy: `docker-compose -f docker-compose.prod.yml up -d`.

## Coding Style & Naming Conventions
- TypeScript: strict typing, functional components, hooks over classes; `PascalCase` components, `camelCase` variables; colocate component tests under `src/components/**/__tests__`.

## Testing Guidelines
- UI: Vitest + Testing Library. Place tests under `ui/src/**/__tests__` and name `*.test.ts(x)`. Run: `cd ui && npm run test`.

## Commit & Pull Request Guidelines
- Commits: Imperative mood, scoped prefix when helpful: `ui: fix editor lag`, `docs: update API spec`, `infra: adjust deploy config`.
- PRs: Include description, rationale, and links to issues; screenshots/GIFs for UI changes; checklist that `npm run test`, `npm run typecheck`, and `npm run build` pass.

## Security & Configuration Tips
- Configure API endpoint via `VITE_API_BASE_URL` (see `ui/.env.example`).
- Keep secrets out of code and logs.
