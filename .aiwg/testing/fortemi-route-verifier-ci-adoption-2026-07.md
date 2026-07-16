---
title: Fortemi Route Verifier CI Adoption Runbook - v2026.7.1
status: ci-wired-live-receipt-pending
date: 2026-07-15
artifact_type: verifier-ci-runbook
related_artifacts:
  - .aiwg/testing/scripts/fortemi-route-coverage.py
  - .aiwg/testing/scripts/verify-fortemi-route-inventory.sh
  - .aiwg/testing/fortemi-route-verifier-spec-2026-07.md
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json
  - .aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md
  - .aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json
  - .aiwg/gates/fortemi-api-integration-gate-2026-07-14.md
---

# Fortemi Route Verifier CI Adoption Runbook - v2026.7.1

## Purpose

Define how #253 moves the Fortemi route inventory verifier from local evidence into a repeatable CI control. The current HotM worktree wires the verifier into `.gitea/workflows/sdlc-gates.yml`; a live Gitea run receipt is still required before final tracker closure.

## Preconditions

| Requirement | Expected state |
| --- | --- |
| Fortemi checkout | Sibling repo at `../fortemi`, synced to the audited commit. |
| HotM checkout | Current working tree contains the route inventory generator and evidence map. |
| Python | `python3` available in the CI runner or local preflight environment. |
| Evidence map | `.aiwg/api/compatibility/fortemi-v2026-07-family-evidence-map.json` present. |
| Baseline counts | 200 routes, 36 route families, 0 gaps, 0 decision-needed routes. |

## Local Preflight

Run from the HotM checkout:

```bash
python3 .aiwg/testing/scripts/fortemi-route-coverage.py --check
```

Expected successful output includes:

```text
check passed: route inventory baseline, metadata, and evidence map are coherent
```

The command regenerates:

- `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json`
- `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.md`

For CI, PR closeout, or local gate evidence, prefer the wrapper:

```bash
.aiwg/testing/scripts/verify-fortemi-route-inventory.sh
```

The wrapper validates that `python3` and the sibling Fortemi checkout are present, runs the same `--check` command from the HotM root, and prints a one-line receipt with commit, tag, route count, family count, status counts, and verifier diagnostics.

## CI Wiring Options

| Option | Use when | Required behavior |
| --- | --- | --- |
| Gitea workflow job | HotM CI can checkout or mount the sibling Fortemi repo. | Run the local preflight after both repos are available; fail the job on non-zero exit. |
| Composite/local script | CI cannot reliably fetch the sibling repo yet. | Document the local preflight as required before closing #253 and attach command output to the issue or PR. |
| Scheduled drift audit | Fortemi changes independently of HotM. | Run after Fortemi release/sync events and file or update #253/#243 when drift appears. |

## Current Gitea Wiring

`.gitea/workflows/sdlc-gates.yml` now includes a `fortemi-route-inventory` job on pull requests. The job:

1. Checks out HotM using the same Gitea clone convention as the existing PR gate.
2. Clones `https://git.integrolabs.net/Fortemi/fortemi.git` to `../fortemi`.
3. Runs `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh`.

The job is wired locally but does not have a live run receipt in this environment because authenticated Gitea Actions access is unavailable.

## Suggested Gitea Job Shape

The exact workflow file can vary, but the job must do the following:

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Checkout Fortemi sibling
    run: |
      git clone --depth 1 "$FORTEMI_REPOSITORY_URL" ../fortemi
  - name: Verify Fortemi route inventory
    run: |
      .aiwg/testing/scripts/verify-fortemi-route-inventory.sh
```

If the actual CI runner cannot use `actions/checkout@v4`, keep the same semantics: HotM must be the working directory, Fortemi must be available at `../fortemi`, and the preflight command must be the failing check.

## Failure Handling

| Failure category | Meaning | Required response |
| --- | --- | --- |
| Metadata issue | Fortemi commit/tag could not be resolved. | Fix checkout wiring or document an explicit offline override in the gate report. |
| Unclassified route | Fortemi added a route without a family rule. | Add or update classification, capability matrix, issue mapping, and route inventory. |
| Status drift | Route count, family count, or status counts changed from baseline. | Treat as intentional only after updating planning artifacts and linked issues. |
| Evidence issue | Evidence map parity, tracker, source evidence, or referenced paths are invalid. | Update evidence map or implementation evidence before closing #253. |

## Required Artifacts on Failure

When the preflight fails, attach or preserve:

- Command output.
- Generated `verifier_diagnostics` from `.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json`.
- Fortemi commit and latest tag from the generated JSON.
- Any route rows implicated by `unclassified_routes` or `status_drift`.

## Closeout Criteria for #253

#253 can claim the verifier path is formally adopted only when:

- The preflight command has a passing CI run receipt, or the project explicitly accepts the local-preflight-only policy.
- The adopted command is `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh` unless the CI runner needs an equivalent inline sequence for checkout-path reasons.
- The generated JSON includes clean `verifier_diagnostics`.
- The generated Markdown includes the verifier diagnostics and route-level override sections.
- Status drift is either absent or reflected by intentional updates to route inventory, capability matrix, traceability, gate report, and linked issues.
- The gate report is refreshed with actual command output from the adopted path. Local command output is present; live CI receipt remains pending.

This runbook does not prove seamless integration. It proves the route inventory and evidence map have an enforceable adoption path.
