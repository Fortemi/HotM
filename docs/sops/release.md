# SOP: Release Process

## Preconditions
- All PR checklists are green (build, tests, lint, docs).

## Client Release
1. Update version: `ui/package.json` (and `ui/src-tauri/*` when desktop packaging is used).
2. Changelog: Summarize changes, breaking notes, and manual steps.
3. Tag: `git tag v0.<minor>.<patch>[-channel] && git push --tags`.
4. Build artifacts:
   - Web SPA: `cd ui && npm ci && npm run build`
   - Optional desktop bundle: `cd ui && npm run tauri build`
5. Verify environment config for target backend (`VITE_API_BASE_URL`).

## Rollback
- Use previous tag/build artifact.
- Document impact and follow incident SOP.
