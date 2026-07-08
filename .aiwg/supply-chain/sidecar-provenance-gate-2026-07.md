# Sidecar Provenance Gate - 2026-07

## Purpose

Close `Fortemi/HotM#245` for the enterprise demo checkpoint by replacing floating sidecar downloads with a pinned manifest and checksum verification path.

## Pinned Source

| Field | Value |
|---|---|
| Source repo | `Fortemi/fortemi` |
| Release tag used as transport | `sidecar-latest` |
| Pinned commit | `5b389cb86e4e8d8a610955d2e68f7f3e0a5de371` |
| Published at | `2026-07-04T19:25:21-04:00` |
| Manifest | `release/sidecar-provenance.json` |
| Downloader/verifier | `scripts/download-pinned-sidecar.sh` |
| Live CI evidence note | `.aiwg/supply-chain/sidecar-provenance-live-ci-evidence-2026-07-06.md` |

The tag remains `sidecar-latest` as a download location, but HotM no longer treats it as authoritative. The authoritative values are the pinned asset name, upstream commit, and SHA-256 in `release/sidecar-provenance.json`.

## Assets

| Target | Asset | SHA-256 |
|---|---|---|
| `x86_64-unknown-linux-gnu` | `matric-api-x86_64-unknown-linux-gnu` | `66bb1f0d441220659e33471c3af72c3d0a3320cf0dcb5cf355f36fa10096a97c` |
| `aarch64-apple-darwin` | `matric-api-aarch64-apple-darwin` | `fc39931180ce8c9f6102420da8d37148f7c543e7dd3c920a9f26e216383bd79d` |
| `x86_64-apple-darwin` | `matric-api-x86_64-apple-darwin` | `6ec7935d6d00890f62d025ec1c3af468fa5ee77e318258a682c8cdfa41e5eea6` |

## Workflow Enforcement

- `.gitea/workflows/tauri-build.yml` uses `scripts/download-pinned-sidecar.sh`.
- `.gitea/workflows/desktop-build-matrix.yml` uses `scripts/download-pinned-sidecar.sh` for Linux and macOS builds.
- `.gitea/workflows/desktop-release.yml` uses `scripts/download-pinned-sidecar.sh` for Linux and macOS release builds.
- The script fails the build if the downloaded binary hash differs from the manifest.
- The script writes `<destination>.provenance.json` beside the staged sidecar binary.

## Update Procedure

1. Fetch the upstream release metadata:
   `curl -fsSL https://git.integrolabs.net/api/v1/repos/Fortemi/fortemi/releases/tags/sidecar-latest`.
2. Fetch upstream checksums:
   `curl -fsSL https://git.integrolabs.net/Fortemi/fortemi/releases/download/sidecar-latest/SHA256SUMS.txt`.
3. Update `release/sidecar-provenance.json` with the new `target_commitish`, `published_at`, asset sizes, and SHA-256 values.
4. Run:
   `scripts/download-pinned-sidecar.sh x86_64-unknown-linux-gnu /tmp/hotm-sidecar-provenance-check`.
5. Commit the manifest and workflow changes together with release notes that name the pinned Fortemi commit.

## Remaining Caveat

This gate verifies the asset bytes against a pinned checksum. It does not yet verify an upstream cryptographic release signature because the current upstream sidecar release only publishes `SHA256SUMS.txt`.

## Live CI Evidence Status

Local Linux verification passed again on 2026-07-06 with:

```bash
scripts/download-pinned-sidecar.sh x86_64-unknown-linux-gnu /tmp/hotm-sidecar-provenance-check
```

The script verified SHA-256 `66bb1f0d441220659e33471c3af72c3d0a3320cf0dcb5cf355f36fa10096a97c` and wrote `/tmp/hotm-sidecar-provenance-check.provenance.json`.

Live CI receipt remains open. The latest suite preflight found no Gitea token variable, no configured `tea` login, unauthenticated `gh`, token-based Actions API access unavailable for `Fortemi/HotM`, and HotM workflow/provenance changes still local rather than proven by a pushed Actions run. See `.aiwg/supply-chain/sidecar-provenance-live-ci-evidence-2026-07-06.md` for the required run receipt fields and authenticated API commands.

The suite-level preflight `.aiwg/scripts/check-gitea-actions-live-evidence-preflight.sh` now reproduces this readiness gate alongside the Fortemi CI live-evidence gate. Its latest run kept the live receipt blocked while confirming the local manifest, downloader, workflow wiring, and HUX traceability anchors.
