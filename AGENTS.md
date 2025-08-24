# Repository Guidelines

## Project Structure & Module Organization
- `server/`: Rust Axum API. Key areas: `src/routes/`, `src/nlp/`, `src/mcp/` (planned), `src/workers/`, DB code in `src/db.rs`. Integration tests in `server/tests/`; SQL migrations in `server/migrations/`.
- `ui/`: Tauri + React/TypeScript app. Frontend in `ui/src/`; Tauri backend in `ui/src-tauri/`; Vite config in `ui/vite.config.ts`.
- `docs/`: Architecture, requirements, and implementation guides. Start at `docs/index.md`.
- `scripts/`: Utility scripts (e.g., `server/setup_ci_db.sh`). Root `.env.example` lists important vars.

## Build, Test, and Development Commands
- Server (Rust): `cd server && cargo run` — start API. `cargo test` — run unit/integration tests. `cargo watch -x run` — dev autoreload (if installed). `cargo fmt` / `cargo clippy` — format/lint.
- UI (Tauri/React): `cd ui && npm install` then `npm run dev` — start Vite dev. `npm run build` — production build. `npm run test` / `npm run test:coverage` — Vitest unit tests. `npm run typecheck` — TS checks.
- Docker: `docker-compose up -d` — run full stack locally.

## Coding Style & Naming Conventions
- Rust: `rustfmt` defaults; prefer small, focused modules; snake_case for files/functions; `CamelCase` for types/traits. Run `cargo fmt && cargo clippy` before PRs.
- TypeScript: strict typing, functional components, hooks over classes; `PascalCase` components, `camelCase` variables; colocate component tests under `src/components/**/__tests__`.
- API routes live under `server/src/routes/*` with one file per domain (e.g., `notes.rs`, `search.rs`).

## Testing Guidelines
- Server: Unit tests in-module with `#[cfg(test)]`; integration tests in `server/tests/`. Use `TEST_DATABASE_URL` for isolated DBs (see `setup_ci_db.sh`). Run: `cd server && cargo test`.
- UI: Vitest + Testing Library. Place tests under `ui/src/**/__tests__` and name `*.test.ts(x)`. Run: `cd ui && npm run test`.

## Commit & Pull Request Guidelines
- Commits: Imperative mood, scoped prefix when helpful: `server: add vector search endpoint`, `ui: fix editor lag`, `docs: update API spec`.
- PRs: Include description, rationale, and links to issues; screenshots/GIFs for UI changes; DB migration notes when applicable; checklist that `cargo test`, `npm run test`, and linters pass.

## Security & Configuration Tips
- Create `.env` from `.env.example`. Required: `DATABASE_URL`. Common: `TEST_DATABASE_URL`, `RUST_LOG`, `OLLAMA_URL`, `OLLAMA_*_MODEL`.
- Keep data local. No secrets in code or logs. For search features, ensure `pgvector` is enabled: `psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"`.
