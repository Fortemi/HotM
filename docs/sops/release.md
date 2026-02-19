# SOP: Release Process

## Preconditions
- All PR checklists are green (build, tests, lint, docs).

## Client Release
1. Update version in `ui/package.json`.
2. Update `CHANGELOG.md` with all changes, breaking notes, and manual steps.
3. Create release notes in `docs/releases/v<version>.md`.
4. Tag: `git tag v0.<minor>.<patch>[-channel] && git push --tags`.
5. Build artifacts:
   - Web SPA: `cd ui && npm ci && npm run build`
   - Docker: `docker compose -f docker-compose.prod.yml build`
6. Verify environment config for target backend (`VITE_API_BASE_URL`).

## Rollback
- Use previous tag/build artifact.
- Document impact and follow incident SOP.
