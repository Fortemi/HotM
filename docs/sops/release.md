# SOP: Release Process

## Preconditions
- All PR checklists are green (build, tests, lint, docs).
- Any release-facing Fortemi compatibility claim has a green authority-owned
  suite aggregate whose manifest binds the exact Fortemi, React/core, HotM,
  sidecar, schema, and profile revisions used by the release.

## Client Release
1. Update and verify the client version:

   ```bash
   scripts/bump_version.sh <YYYY.M.PATCH>
   (cd ui && npm install --package-lock-only)
   scripts/check_versions.sh
   ```

   The release tag gate requires matching versions in `ui/package.json`,
   `ui/package-lock.json`, `ui/src-tauri/Cargo.toml`, and
   `ui/src-tauri/tauri.conf.json`.
2. Update the pinned Fortemi sidecar manifest if this release refreshes the bundled backend:
   - Select the immutable authority release `sidecar-<commit-prefix>`; do not
     record the moving `sidecar-latest` alias as release provenance.
   - Fetch metadata from
     `https://git.integrolabs.net/api/v1/repos/Fortemi/fortemi/releases/tags/<sidecar-release>`.
   - Fetch checksums from
     `https://git.integrolabs.net/Fortemi/fortemi/releases/download/<sidecar-release>/SHA256SUMS.txt`.
   - Update `release/sidecar-provenance.json` and
     `release/live-asset-receipt-sidecar-provenance.json` with the same upstream
     commit, release tag, published timestamp, asset sizes, and SHA-256 values.
   - Verify the assets used by the supported-platform contract:

     ```bash
     scripts/download-pinned-sidecar.sh x86_64-unknown-linux-gnu /tmp/hotm-sidecar-linux-x86_64
     scripts/download-pinned-sidecar.sh aarch64-unknown-linux-gnu /tmp/hotm-sidecar-linux-arm64
     scripts/download-pinned-sidecar.sh aarch64-apple-darwin /tmp/hotm-sidecar-macos-arm64
     ```
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
8. Before publishing supported-platform or portable-data language, verify the
   Fortemi authority matrix and its aggregate receipt. For HotM `2026.7.1`,
   the release-qualification inputs are:

   - Knowledge Shard authority: exact `2.0.0/full-v1`, schema commit
     `0c59bc6cb06cca0b1e00eba4c0fa493f3ef3b90b`, contract revision `21`.
   - Fortemi runtime and sidecar:
     `5ea08229c9f1565122df5f8e6906e89d98dc7e75` (`v2026.7.19`) and
     `sidecar-5ea08229c9f1`.
   - React/core consumer:
     `5cab4ea2d3d4bb985ea0d38f8bcb1ea790b32cf7`,
     `@fortemi/core@2026.7.15`, package tarball SHA-256
     `f407bff5c9fb1f0813ca92c3ab8c597f979fd9ee7bebc327b1ed285e1faabc5b`.
   - HotM consumer: the exact signed `v2026.7.1` peeled commit.
   - Required platforms: Linux x86_64, Linux arm64, and native macOS arm64.
     Windows remains deferred under
     [Fortemi #1096](https://git.integrolabs.net/Fortemi/fortemi/issues/1096).

   This evidence is profile- and revision-scoped. It does not support claims
   of all-platform or suite-wide portability, complete backup, launched
   GUI/native-dialog coverage, or one schema for every persistence plane.
9. Mirror the release only after the exact signed tag object and peeled commit
   match between Gitea and GitHub:

   ```bash
   tools/release/mirror-gitea-release-to-github.sh v<YYYY.M.PATCH>
   ```

   The script is idempotent and can be used to backfill historical releases
   from Gitea to GitHub. It synchronizes release metadata and assets, then
   downloads both copies and requires identical SHA-256 values.
10. Run the public, secret-free verification independently:

   ```bash
   tools/release/verify-release-mirror.sh v<YYYY.M.PATCH>
   ```

   The scheduled `Release Mirror Provenance` workflow runs the same check for
   the latest Gitea release. A lightweight tag, a different annotated tag
   object, a different peeled commit, metadata drift, an extra/missing asset,
   or any asset-byte difference fails the workflow.

## Rollback
- Use previous tag/build artifact.
- Document impact and follow incident SOP.
