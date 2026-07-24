# SOP: Release Process

## Preconditions
- All PR checklists are green (build, tests, lint, docs).

## Client Release
1. Update version in `ui/package.json`.
2. Update the pinned Fortemi sidecar manifest if this release refreshes the bundled backend:
   - Fetch upstream release metadata from `https://git.integrolabs.net/api/v1/repos/Fortemi/fortemi/releases/tags/sidecar-latest`.
   - Fetch upstream checksums from `https://git.integrolabs.net/Fortemi/fortemi/releases/download/sidecar-latest/SHA256SUMS.txt`.
   - Update `release/sidecar-provenance.json` with the upstream commit, published timestamp, asset sizes, and SHA-256 values.
   - Verify at least the Linux asset with `scripts/download-pinned-sidecar.sh x86_64-unknown-linux-gnu /tmp/hotm-sidecar-provenance-check`.
3. Update `CHANGELOG.md` with all changes, breaking notes, sidecar pin, and manual steps.
4. Create release notes in `docs/releases/v<version>.md`.
5. Create and verify the stable tag with the vaulted release key, then push
   only that exact tag:

   ```bash
   tools/release/cut-tag.sh <YYYY.M.PATCH> -m "HotM <YYYY.M.PATCH>"
   git push origin v<YYYY.M.PATCH>
   ```

   Do not create unsigned release tags or use a broad `git push --tags`.
6. Build artifacts:
   - Web SPA: `cd ui && npm ci && npm run build`
   - Docker: `docker compose -f docker-compose.prod.yml build`
7. Verify environment config for target backend (`VITE_API_BASE_URL`).
8. Verify the Gitea release and GitHub release contain the same downloadable assets. The CI mirror path uses:

   ```bash
   tools/release/mirror-gitea-release-to-github.sh v<YYYY.M.PATCH>
   ```

   The script is idempotent and can be used to backfill historical releases from Gitea to GitHub.

## Rollback
- Use previous tag/build artifact.
- Document impact and follow incident SOP.
