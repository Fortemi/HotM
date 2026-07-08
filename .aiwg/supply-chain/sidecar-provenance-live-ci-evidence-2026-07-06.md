# Sidecar Provenance Live CI Evidence - 2026-07-06

## Purpose

Track the HUX-REQ-010 evidence gate for HotM enterprise demo builds. The requirement is not only that sidecar downloads are pinned locally, but that CI or release workflows verify the pinned manifest path before demo/release artifacts are trusted.

## Current Evidence

| Evidence item | Result | Receipt |
|---|---|---|
| Manifest present | Passed | `release/sidecar-provenance.json` pins `Fortemi/fortemi`, `sidecar-latest`, commit `5b389cb86e4e8d8a610955d2e68f7f3e0a5de371`, and per-target SHA-256 values. |
| Workflow enforcement present | Passed locally by file inspection | `.gitea/workflows/tauri-build.yml`, `.gitea/workflows/desktop-build-matrix.yml`, and `.gitea/workflows/desktop-release.yml` call `scripts/download-pinned-sidecar.sh` instead of downloading floating assets directly, and the suite preflight parses those workflows as YAML. |
| Local Linux sidecar verification | Passed | `scripts/download-pinned-sidecar.sh x86_64-unknown-linux-gnu /tmp/hotm-sidecar-provenance-check` downloaded and verified SHA-256 `66bb1f0d441220659e33471c3af72c3d0a3320cf0dcb5cf355f36fa10096a97c`, then wrote `/tmp/hotm-sidecar-provenance-check.provenance.json`. |
| Executable suite preflight | Blocked | `.aiwg/scripts/check-gitea-actions-live-evidence-preflight.sh` returned blocked with 7 readiness blockers: no Gitea token variable, no configured `tea` login, unauthenticated `gh`, unauthenticated Actions API access for `Fortemi/fortemi` and `Fortemi/HotM`, and local Fortemi/HotM live-evidence file changes not proven by a remote Actions run. Static Fortemi guard checks, HotM sidecar checks, HotM desktop/Tauri workflow YAML parsing, and HotM HUX checks passed. |
| Live Gitea workflow run receipt | Blocked in this environment | `curl -fsSL https://git.integrolabs.net/api/v1/repos/Fortemi/HotM/actions/runs?limit=10` requires authentication without a Gitea token in the environment. `GITEA_TOKEN`, `GITEA_ACCESS_TOKEN`, `GITHUB_TOKEN`, and `GH_TOKEN` were unset; `gh auth status` reported no login, and `tea logins list -o csv` returned no configured login rows. |

## Required Live CI Receipt

Capture one of the following after the sidecar provenance workflow changes are committed or pushed to a branch visible to Gitea Actions:

| Workflow | Trigger | Required receipt |
|---|---|---|
| `.gitea/workflows/tauri-build.yml` | Pull request, push, or `workflow_dispatch` | Run ID, branch/SHA, status `success`, job log lines for `Download pinned Fortemi sidecar (Linux x86_64)`, and provenance receipt path. |
| `.gitea/workflows/desktop-build-matrix.yml` | Push to `main` or `workflow_dispatch` | Run ID, branch/SHA, status `success`, Linux sidecar verification log, and macOS runner log if available. |
| `.gitea/workflows/desktop-release.yml` | `workflow_dispatch` for a release tag | Run ID, release tag, status `success`, Linux sidecar verification log, and macOS runner log if available. |

Minimum acceptable checkpoint receipt for HUX-REQ-010 is a successful `tauri-build.yml` run on the commit containing:

- `release/sidecar-provenance.json`
- `scripts/download-pinned-sidecar.sh`
- `.gitea/workflows/tauri-build.yml`

## Authenticated API Commands

Use a token with read access to `Fortemi/HotM` Actions:

```bash
curl -fsSL \
  -H "Authorization: token ${GITEA_TOKEN}" \
  "https://git.integrolabs.net/api/v1/repos/Fortemi/HotM/actions/runs?limit=20"
```

After selecting the run ID:

```bash
curl -fsSL \
  -H "Authorization: token ${GITEA_TOKEN}" \
  "https://git.integrolabs.net/api/v1/repos/Fortemi/HotM/actions/runs/<run-id>/jobs"
```

Record the run URL, run ID, head SHA, workflow name, job status, and log excerpts showing checksum verification.

## Gate Status

HUX-REQ-010 remains partially covered:

- Local manifest, workflow wiring, and Linux checksum verification are proven.
- Live CI evidence is blocked by missing token-based Gitea Actions API access and by the fact that the workflow changes are still local workspace changes, not yet a committed/pushed Actions run target. Run `.aiwg/scripts/check-gitea-actions-live-evidence-preflight.sh` from the suite root before attempting the live receipt.
