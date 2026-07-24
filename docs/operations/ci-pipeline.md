# CI/CD Pipeline Reference

## Overview

All workflows live in `.gitea/workflows/`. The pipeline is split into distinct, purpose-scoped workflows rather than a single monolithic CI file.

| Workflow | Trigger | Runner | What it does | Artifacts / Side-effects |
|---|---|---|---|---|
| `ui-ci.yml` | push to `main`/`develop`, PR to `main`, `v*` tag, manual | `node-20`, `titan` | Quality gates (UI + agent-proxy), publish agent-proxy Docker image | agent-proxy images on Gitea + GHCR |
| `tauri-build.yml` | push/PR to `main` touching `ui/src-tauri/**` or `ui/src/**`, manual | `ubuntu-latest` (container) | Linux-only Tauri compile check | `.deb` + `.AppImage` as CI artifacts |
| `tauri-build-cross.yml` | manual only | `windows-latest`, `macos-latest` (GitHub Actions) | Windows + macOS Tauri builds on demand | `.exe`/`.msi` + `.dmg` as CI artifacts |
| `desktop-build-matrix.yml` | push to `main` touching `ui/**`, manual | `ubuntu-22.04` + mutsu (SSH) | Rolling dev desktop builds for Linux and macOS | Assets attached to `dev-latest` prerelease on Gitea |
| `desktop-release.yml` | `v*` tag, manual | `ubuntu-22.04` + mutsu (SSH) | Versioned desktop release | `.AppImage`, `.deb`, `.dmg`, `SHA256SUMS*` on Gitea release + mirrored to GitHub |
| `publish-dist.yml` | push to `main` touching `ui/**`, `v*` tag, manual | `node-20` | Build React SPA, package as tarball | `hotm-ui-dist.tar.gz` on `hotm-latest` rolling release (main) or versioned release (tag) |
| `publish-hotm-ui-image.yml` | push to `main` touching `ui/**`/`docker/ui/**`, `v*` tag, manual | `ubuntu-22.04` | Build and push multi-stage nginx Docker image | Images on `ghcr.io/fortemi/hotm-ui` + `git.integrolabs.net/fortemi/hotm-ui` |
| `sdlc-gates.yml` | PR opened/edited/synchronized | `ubuntu-latest` | Validate PR template sections and reviewer assignment | Fails PR if template is incomplete |
| `post-deploy-validation.yml` | manual only | `ubuntu-latest` | Playwright smoke and UAT tests against a live URL | Test reports as artifacts |
| `mutsu-verify.yml` | manual only | `ubuntu-22.04` (SSH to mutsu) | Verify mutsu Mac build environment | Health script installed at `/Volumes/build/hotm/health.sh` on mutsu |
| `docs-link-check.yml` | push/PR touching `docs/**`, `README.md`, `AGENTS.md`, `CLAUDE.md` | `ubuntu-latest` (container) | Offline internal link validation with lychee | Fails if internal markdown links are broken |

---

## Quality Gate (`ui-ci.yml`)

### What it validates

The `quality-gate` job runs on every push to `main`/`develop` and every PR to `main`. It covers the React SPA in `ui/`:

1. **TypeScript compilation** — `npm run typecheck` (strict mode, no emitted output)
2. **Unit tests with coverage** — `npm run test:coverage -- --run` via Vitest
3. **Realtime convergence suite** — `npm run test:realtime` (separate Vitest config targeting realtime/WebSocket paths)
4. **HUX traceability anchors** — `npm run test:hux-traceability` verifies HUX-REQ-001 through HUX-REQ-013 remain anchored in HotM tests/scripts
4. **Security audit** — `npm audit --audit-level high` (non-blocking: exits `|| true`, reported in logs only)
5. **SBOM generation** — CycloneDX SBOM written to `ui/sbom.json`

A parallel `agent-proxy-quality-gate` job runs the same typecheck + test + audit cycle against `agent-proxy/`.

Both jobs must pass before any publish job (dev image, release image) runs.

### Running locally

The authoritative local equivalent that mirrors CI exactly:

```bash
act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml
```

For fast iteration during development (unit tests only, no SBOM):

```bash
cd ui && npm test -- --run
```

---

## Tauri Desktop CI (`tauri-build.yml`)

**Purpose**: Verify the Tauri app compiles on Linux on every push and PR. This is a compile check, not a release build.

**Why Linux-only**: Gitea act_runner infrastructure only has Linux runners available for continuous CI. Windows and macOS runners are not attached to the Gitea instance. Cross-platform builds require either GitHub Actions runners (`tauri-build-cross.yml`) or the SSH-to-mutsu pattern used by the desktop build workflows.

**What it does**:
1. Installs Rust stable targeting `x86_64-unknown-linux-gnu`
2. Installs WebKit2GTK and GTK system dependencies (required by Tauri on Linux)
3. Downloads the Fortemi sidecar binary (`matric-api-x86_64-unknown-linux-gnu`) through `scripts/download-pinned-sidecar.sh`, using `release/sidecar-provenance.json` for the pinned upstream commit and SHA-256 verification — this binary is required at build time and is not checked into the repo
4. Runs `npx tauri build`
5. Uploads `.deb` and `.AppImage` bundles as CI artifacts (retained briefly; not published to any release)

**Cross-platform on demand** (`tauri-build-cross.yml`): Manual workflow that builds Windows (`x86_64-pc-windows-msvc`) and macOS (`aarch64-apple-darwin`) using GitHub Actions hosted runners. Accepts a `platforms` input (`all`, `windows`, `macos`). Uses `tauri-apps/tauri-action@v0` and `swatinem/rust-cache@v2`. Artifacts are uploaded to the workflow run but not published to any release — use `desktop-release.yml` for versioned releases.

---

## Rolling Releases

### Desktop builds — `desktop-build-matrix.yml`

Triggers on every push to `main` that touches `ui/**`. Produces rolling dev builds and attaches them to the `dev-latest` prerelease on Gitea (tag `dev-latest`).

**Linux job** (`build-linux`, runs on `ubuntu-22.04`):
- Installs Node 20, Rust stable, and all WebKit/GTK dependencies with mirror-fallback retry logic for flaky Ubuntu apt mirrors
- Downloads `matric-api-x86_64-unknown-linux-gnu` sidecar through `scripts/download-pinned-sidecar.sh`; the script reads `release/sidecar-provenance.json`, verifies SHA-256, and writes a sidecar provenance receipt beside the staged binary
- Builds Tauri; produces `.AppImage` and `.deb`
- Upserts the `dev-latest` Gitea release (creates if missing, replaces stale assets of the same name)

**macOS job** (`build-macos`, runs on `ubuntu-22.04` but builds via SSH on mutsu):
- An `ubuntu-22.04` runner orchestrates the build by SSHing to mutsu (Apple M4 Mac mini at `10.0.42.41`)
- Clones the repo at the current SHA into `/Volumes/build/hotm/builds/run-<RUN_ID>/` on mutsu
- Downloads `matric-api-aarch64-apple-darwin` sidecar, runs `npm ci && npx tauri build`
- Ad-hoc codesigns the `.app` with `codesign --force --deep --sign -` (self-signed, no notarization)
- Repacks the signed `.app` into a new DMG via `hdiutil create`
- SCPs the DMG back to the Linux runner, then uploads to the `dev-latest` release
- Always cleans up the build directory on mutsu (`rm -rf`), even on failure

### UI dist tarball — `publish-dist.yml`

Triggers on every push to `main` touching `ui/**`. Provides the built React SPA as a tarball for downstream consumers.

**What it produces**: `hotm-ui-dist.tar.gz` — a gzip tarball containing a `dist/` directory with `index.html` and all hashed JS/CSS bundles.

**Rolling release** (main branch): Deletes and recreates the `hotm-latest` Gitea release from scratch on each run, ensuring only the current build is present. The tarball is verified before upload: it must extract to `dist/` and contain `index.html`.

**Versioned release** (tag push): Waits up to 25 seconds for the versioned release to exist (created by `ui-ci.yml`), then attaches the tarball to it.

**Downstream consumer**: A downstream CI pipeline downloads `hotm-ui-dist.tar.gz` from `hotm-latest` and extracts it. The `env-config.js` file is injected post-extract by the consumer; it is not included in the tarball.

### Container images — `publish-hotm-ui-image.yml`

Every main push and `v*` tag builds and publishes two images to GHCR and the
Gitea registry:

- `hotm-ui`: the backwards-compatible nginx static UI for external Fortemi
  deployments.
- `hotm-bundle`: the supported all-in-one HotM UI plus digest-pinned Fortemi
  PostgreSQL/API/MCP runtime.

Main publishes `latest` and `sha-<7char>`; release tags publish `latest` and the
numbered version. Registry credentials are fetched through the existing Vault
AppRole boundary. The job uploads
`hotm-container-publication-receipt.json`, recording both pushed digests, the
HotM commit/version, and the Fortemi image/revision embedded in the bundle.

The bundle build uses `docker/bundle/Dockerfile`. CI must not replace its
Fortemi digest with a mutable tag. Local smoke verification requires both
`/healthz` on port 4180 and Fortemi `/livez` on port 3000.

Backfill is shape-aware: the first numbered bundle release begins with the
release containing this contract. Older versions are not relabeled as bundles.
Any missing legacy `hotm-ui` tag must be rebuilt from its matching immutable Git
tag and checked by digest before publication.

---

## Versioned Releases — `desktop-release.yml`

**Trigger**: Push a `v*` tag (e.g., `git tag v2026.2.1 && git push origin v2026.2.1`) or manual dispatch with a tag input.

**Jobs** (run in parallel, both 60-minute timeout):

**`build-linux`** (`ubuntu-22.04`):
- Same build process as the rolling Linux job
- Generates `SHA256SUMS.txt` covering the `.AppImage` and `.deb`
- Creates (or reuses) the versioned Gitea release, uploads `.AppImage`, `.deb`, and `SHA256SUMS.txt`

**`build-macos`** (`ubuntu-22.04` → SSH to mutsu):
- Same SSH-to-mutsu pattern as the rolling build
- Clones at the release tag ref (`refs/tags/<tag>`) rather than a SHA
- Generates `SHA256SUMS-macos.txt`
- Uploads DMG and `SHA256SUMS-macos.txt` to the same versioned Gitea release

**`publish-github`** (runs after both build jobs, succeeds if either succeeds):
- Downloads all assets from the Gitea release
- Creates a matching release on `github.com/Fortemi/HotM` via `gh` CLI using `GH_PUBLISH_TOKEN`
- Uploads all assets to the GitHub release

**Secrets required**:
- `MUTSU_SSH_KEY` — SSH private key for `manitcor@10.0.42.41`
- `GH_PUBLISH_TOKEN` — GitHub PAT with `repo` + `write:releases` scope

---

## Docker Image Publishing — `publish-hotm-ui-image.yml`

Builds and publishes two image shapes to both registries:

- `hotm-bundle`: the supported self-contained image. It combines the HotM
  React UI with the digest-pinned Fortemi PostgreSQL/API/MCP bundle.
- `hotm-ui`: the backwards-compatible UI-only nginx image for operators who
  intentionally provide Fortemi separately.

**Registries and tags**:

| Event | Tags applied |
|---|---|
| Push to `main` | `:latest`, `:sha-<7char>` |
| `v*` tag push | `:latest`, `:<version>` (e.g. `:2026.2.1`) |

Both registries receive identical tags on each event. The workflow also
uploads `hotm-container-publication-receipt`, which records the source commit,
all published tags, both image digests, and the immutable Fortemi base image
and runtime revision.

**Registries**:
- `ghcr.io/fortemi/hotm-ui`
- `ghcr.io/fortemi/hotm-bundle`
- `git.integrolabs.net/fortemi/hotm-ui`
- `git.integrolabs.net/fortemi/hotm-bundle`

**Supported bundled runtime**:
```bash
docker run --env-file .env \
  -p 127.0.0.1:4180:4180 \
  -p 127.0.0.1:3000:3000 \
  -p 127.0.0.1:3001:3001 \
  -v hotm-postgres:/var/lib/postgresql/data \
  -v hotm-files:/var/lib/matric/files \
  -v hotm-backups:/var/backups/matric-memory \
  ghcr.io/fortemi/hotm-bundle:latest
```

**Secrets required**:
- `GH_PUBLISH_TOKEN` — GitHub PAT with `write:packages` scope
- `BUILD_REPO_TOKEN` — Gitea PAT with `write:package` scope

The trigger is `push` for `main` and `v*` tags. A main push restores
`:latest`; a numbered tag creates the matching immutable version tag.
Historical versions predating the bundle contract are not relabeled as
bundled releases. A legacy UI-only backfill must build from the corresponding
immutable Git tag and be verified by digest before publication.

**Agent-proxy image** (`fortemi/hotm-agent-proxy`): Published by `ui-ci.yml` (not this workflow). Dev images (`:main`, `:latest`, `:sha-<7char>`) go to Gitea only on main branch push. Release images additionally push to GHCR on tag.

---

## Infrastructure — mutsu (Mac Build Runner)

mutsu is an Apple M4 Mac mini used as the macOS build machine for all Tauri desktop builds.

| Property | Value |
|---|---|
| Hostname | `mutsu` (SSH alias) |
| IP | `10.0.42.41` |
| User | `manitcor` |
| Architecture | `aarch64` (Apple Silicon) |
| Build volume | `/Volumes/build/` |
| HotM build path | `/Volumes/build/hotm/builds/run-<GITHUB_RUN_ID>/` |
| Cargo home | `/Volumes/build/hotm/cargo` |
| Rust target | `aarch64-apple-darwin` |

**How it works**: There is no act_runner agent on mutsu. Instead, a Linux runner (`ubuntu-22.04`) establishes an SSH connection using the `MUTSU_SSH_KEY` secret and drives the build remotely via heredoc scripts. The build directory is always cleaned up after the run (including on failure).

**Health check**: A script is installed at `/Volumes/build/hotm/health.sh` on mutsu. Run it anytime to verify the environment:

```bash
ssh mutsu /Volumes/build/hotm/health.sh
```

**Verifying the runner** (`mutsu-verify.yml`): Manual-only workflow that:
- Tests SSH connectivity
- Creates/verifies the build directory with correct permissions
- Verifies (and installs if missing) the `aarch64-apple-darwin` Rust target
- Checks Node/npm/git availability
- Validates SSD permissions are enforced (SSH key requires `chmod` to work; if the build volume has "Ignore permissions" enabled in Disk Utility, builds will fail)
- Checks power management (`sleep=0` recommended)
- Installs or refreshes the health check script

Run this after any mutsu maintenance or before a release if the machine has been offline:

```bash
# Trigger via Gitea UI: Actions → Verify Mutsu Mac Runner → Run workflow
```

---

## SDLC Gates — `sdlc-gates.yml`

Runs on every PR event (`opened`, `edited`, `synchronize`). Enforces two rules:

1. **PR template compliance**: The PR body must contain all four sections: `## Summary`, `## Checklists`, `### Security & Privacy`, `## Testing Notes`. The body must also have at least one checked item (`- [x]`) under the `### UI (React SPA)` checklist. Missing sections or an empty checklist cause the job to fail and block merge.

2. **Reviewer assignment**: If no reviewers are requested, a warning is posted. This is non-blocking (CODEOWNERS auto-assignment handles the common case) but surfaces missing manual requests.

---

## Post-Deploy Validation — `post-deploy-validation.yml`

Manual-only workflow. Run after deploying to any environment to verify the deployment is healthy.

**Inputs**:
- `deploy_url` (required, default: `http://localhost:4180`) — the URL of the deployed application
- `run_uat` (boolean, default: `false`) — whether to run the full UAT suite after smoke tests

**Jobs**:

`smoke-tests`: Installs Playwright Chromium, runs `npx playwright test --project=smoke` against the target URL. Uploads the Playwright report as an artifact (14-day retention).

`uat-tests` (only when `run_uat=true`): Runs after smoke tests pass. Executes `npx playwright test --project=uat`. Separate report artifact uploaded.

**Typical usage after deploying a new version**:
```
Actions → Post-Deploy Validation → Run workflow
  deploy_url: https://hotm.example.com
  run_uat: false   (true for release candidates)
```

---

## Docs Link Check — `docs-link-check.yml`

Runs on push and PR when `docs/**`, `README.md`, `AGENTS.md`, or `CLAUDE.md` change. Uses lychee in `--offline` mode to validate internal markdown links only (no external HTTP checks). Fails the workflow if any internal link target does not exist.

---

## Running CI Locally

**Full CI validation** (mirrors the Gitea runner exactly — use this before pushing):

```bash
act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml
```

**Agent-proxy gate only**:

```bash
act_runner exec -j agent-proxy-quality-gate -W .gitea/workflows/ui-ci.yml
```

**Quick unit tests** (for fast iteration, not comprehensive):

```bash
cd ui && npm test -- --run
```

**With coverage**:

```bash
cd ui && npm run test:coverage -- --run
```

**Realtime suite only**:

```bash
cd ui && npm run test:realtime
```

**HotM enterprise demo traceability only**:

```bash
cd ui && npm run test:hux-traceability
```

---

## Required Secrets Summary

| Secret | Used by | Purpose |
|---|---|---|
| `MUTSU_SSH_KEY` | `desktop-build-matrix.yml`, `desktop-release.yml`, `mutsu-verify.yml` | SSH private key for `manitcor@10.0.42.41` |
| `GH_PUBLISH_TOKEN` | `ui-ci.yml`, `desktop-release.yml`, `publish-hotm-ui-image.yml` | GitHub PAT with `repo` + `write:releases` + `write:packages` |
| `BUILD_REPO_TOKEN` | `ui-ci.yml`, `publish-hotm-ui-image.yml` | Gitea PAT with `write:package` scope |

---

## Release Checklist

See [docs/sops/release.md](../sops/release.md) for the full release SOP. Pipeline summary:

1. Merge all work to `main` — quality gate and rolling builds run automatically
2. Update `ui/package.json` version and `CHANGELOG.md`
3. Push tag: `git tag v<YYYY.M.PATCH> && git push origin v<YYYY.M.PATCH>`
4. Verify `desktop-release.yml`, `publish-dist.yml`, `publish-hotm-ui-image.yml`, and `ui-ci.yml` (release image jobs) all complete successfully
5. Confirm Gitea release has `.AppImage`, `.deb`, `.dmg`, `SHA256SUMS*.txt`, and `hotm-ui-dist.tar.gz`
6. Confirm GitHub mirror release has the same assets
7. Optionally run post-deploy validation against the production URL
