# Documentation Sync Report

**Date:** 2026-07-29
**Direction:** code-to-docs
**Mode:** bounded audit, dry-run first
**Repository:** `Fortemi/HotM`
**Baseline:** `v2026.7.0` (`55fa684440aba637dd39c95c50319096482b40a7`)
**Audited head:** `1b220c1e1735314e70e610d84951db960742da35`

## Scope

The audit started from the 43 commits since the latest stable tag and
changed-file inventories. It examined release-facing
documentation, the Fortemi integration SAD addendum, ADR-010, committed
consumer receipts, sidecar provenance, and the authority-owned suite platform
matrix. Fortemi issue #1096 and the released Fortemi and React/core inputs
were checked directly.

Release publication and tag creation remain delivery operations outside this
documentation audit.

## Findings

| # | Finding | Resolution |
|---|---|---|
| 1 | No release changelog entry described the three-platform qualification contract. | Added exact runtime, React/core, and sidecar inputs, `2.0.0/full-v1` scope, and prohibited broad claims. |
| 2 | The SAD named the required platforms but not the release inputs. | Bound it to the released authority, React/core, and immutable sidecar revisions. |
| 3 | ADR-010 described authority-owned pinning without recording the release inputs. | Added exact inputs while preserving HotM's consumer-only role. |
| 4 | Windows was deferred without linking its separate authority story. | Linked open Fortemi issue #1096 in release and architecture docs. |
| 5 | The release SOP used moving `sidecar-latest` provenance and omitted current matrix evidence. | Documented immutable sidecar selection, both provenance manifests, three required assets, and the authority aggregate gate. |
| 6 | HotM has no `.aiwg/release.config`. | Not created: required CI workflow names, publication assets, and release-entry automation are not fully defined by the SOP. Encoding them would require invention. |

## Changed Files

- `.aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md`
- `.aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md`
- `.aiwg/reports/doc-sync-20260729-code-to-docs.md`
- `.aiwg/reports/doc-sync-last-run.json`
- `CHANGELOG.md`
- `docs/sops/release.md`

## Validation

- PASS: `.aiwg/testing/scripts/verify-fortemi-route-inventory.sh` against
  Fortemi `5ea08229` (`v2026.7.19`).
- PASS: `node .aiwg/testing/scripts/verify-fortemi-event-catalog.mjs`.
- PASS: `node .aiwg/testing/scripts/verify-fortemi-knowledge-shard-contract.mjs`.
- PASS: `node .aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs ../fortemi`.
- PASS: `node .aiwg/testing/scripts/validate-manifest-schema.mjs`.
- PASS: targeted live-asset receipt matrix tests, 17/17.
- PASS: matrix-to-doc identities, JSON/provenance equality, and changed
  Markdown local links.
- PASS: `git diff --check`, six-file scope, and report length (395 words before
  this final validation update; still below 600 words).
- PASS: `python3 .aiwg/testing/scripts/verify-fortemi-closeout-package.py`.

## Human Review

1. Decide the exact HotM CI workflows, release asset inventory, and automated
   release-entry behavior before creating `.aiwg/release.config`.
2. Require the exact authority aggregate before publishing the release tag.

No commit or push was performed.
