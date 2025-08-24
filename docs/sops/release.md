# SOP: Release Process

## Preconditions
- All PR checklists are green (build, tests, lint, docs).
- DB migrations reviewed and applied on dev database.

## Stage 1 (MVP – Local Only)
1. Update version: `server/Cargo.toml` and `ui/package.json` (keep in sync with `release.json`).
2. Changelog: Summarize changes, breaking notes, and manual steps.
3. Tag: `git tag v0.<minor>.<patch>-alpha.N && git push --tags`.
4. Build artifacts:
   - Server: `cd server && cargo build --release`.
   - UI: `cd ui && npm ci && npm run build && npm run tauri build`.
5. Verify Docker: `docker-compose up -d` and sanity-check at `http://localhost:53211`.

## Stage 2 (Paid Sync/Inference)
1. Ensure feature flags for remote sync/inference are behind config.
2. Run e2e smoke tests across multi-device scenarios.
3. Tag `-beta` then promote to stable after burn-in.
4. Publish installers and server images; update documentation and billing links.

## Rollback
- Use previous tag; revert migrations with `sqlx migrate revert` if needed.
- Document impact and follow incident SOP.

