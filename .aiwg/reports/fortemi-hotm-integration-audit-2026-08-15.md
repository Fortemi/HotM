---
title: Fortemi-HotM Integration Audit - 2026-08-15
status: open-findings
date: 2026-08-15
artifact_type: integration-audit
related_artifacts:
  - .aiwg/architecture/sad-fortemi-integration-addendum-2026-07.md
  - .aiwg/architecture/adr/ADR-010-fortemi-v2026-07-api-coverage.md
  - .aiwg/requirements/fortemi-api-integration-requirements-2026-07.md
  - .aiwg/testing/api-contract-test-plan-addendum-2026-07.md
  - .aiwg/reports/fortemi-v2026-07-api-integration-traceability.md
---

# Fortemi-HotM Integration Audit - 2026-08-15

## Scope

This audit evaluates whether HotM remains a fully functional and verifiable
consumer and umbrella interface after Fortemi schema and route refactors. It
audits the HotM revision
`bf00c6c5334707621e8c6fd96bfcff908ee1f770` against the Fortemi checkout at
`48bc0a0b`. Route inventory is treated only as route-disposition evidence.

## Authority Snapshot

| Contract | HotM consumer state | Audit disposition |
| --- | --- | --- |
| OpenAPI | Producer `5ea08229c9f1565122df5f8e6906e89d98dc7e75`, SHA-256 `9d2d5ea05f21a71d416d713a5cadd2c4f76086a3494105280d50ec328c4056fd`, revision `1`, version `2026.2.9`, 193 paths and 251 operations | The current Fortemi artifact is byte-identical to the pin. The exact artifact gate passes, but typed success coverage is not operation-complete. |
| AsyncAPI | Producer `5ea08229c9f1565122df5f8e6906e89d98dc7e75`, SHA-256 `1ec4a4477431caf60a62ace48f80186bf732408476a24c8d9cd32dba41957ea4`, 48 event names | The current artifact is byte-identical to the pin. Catalog/envelope identity passes; per-event payload and authenticated transport conformance remain open in #285 and #288. |
| Route inventory | Fortemi source `48bc0a0b`, 202 declarations, 188 covered dispositions, 14 documented exclusions | This is not request, response, auth, event, UI, agent, or live conformance. Operation-level evidence is open in #290. |
| Knowledge Shard `core-v1` | Revision 19 with schema window `1.0.0` through `1.2.0` | Historical migration evidence remains bounded to `core-v1`. |
| Knowledge Shard `full-v1` | Exact `2.0.0/full-v1` receipt at revision 20 | Current Fortemi authority is revision 21. Re-pin and replacement live evidence are open in #292. `record-v1` remains unsupported. |
| Compatibility | Parser accepts schema `1` and revision `2026-07-06` | Producer artifact pinning, server API revision enforcement, runtime admission, and SemVer precedence are open in #286. |
| Authentication | Node fixtures exist | `fortemi-auth` remains specification-only. Mandatory agent-proxy middleware, release identity, shared Rust/Node receipts, and context forwarding remain open in #231. |

## Verification Snapshot

| Check | Result | Meaning |
| --- | --- | --- |
| UI unit suite | Passed: 121 files, 1,633 tests | Focused client and component behavior is healthy. |
| Agent-proxy suite | Passed: 15 files, 263 tests | Existing proxy unit behavior is healthy; runtime auth and privilege enforcement are not established by this result. |
| Typecheck/build | Passed | Static and production-build gates are healthy. |
| Mocked Playwright suite | Failed: 36 unexpected failures of 46 tests; 10 passed/expected | Browser integration is not a reliable release gate; tracked in #291. |
| Live Fortemi tests | Not run; no service was available at the configured local endpoints | Historical receipts remain revision-bound and cannot substitute for a current run. |
| Tauri Rust tests | Environment-blocked by missing GTK/WebKit development libraries | No new native-platform claim is made. |
| Agent-proxy dependency audit | Two high and one moderate transitive advisories | Remediation and reachability analysis are tracked in #289. |

## Findings And Owners

| Severity | Finding | Owner |
| --- | --- | --- |
| High | Realtime connections do not preserve REST authentication, memory, and tenant context. | #285 |
| High | Compatibility is displayed but not enforced before remote mutations. | #286 |
| High | The umbrella UI does not expose or intentionally dispose every supported Fortemi operation. | #287 |
| High | AsyncAPI event names are pinned, but each event payload is not schema-validated on both transports. | #288 |
| High | Route-prefix and file-existence evidence overstates operation-level integration. | #290 |
| High | The mocked browser integration gate has broad regressions. | #291 |
| High | Knowledge Shard authority is stale at revision 20 and the current live recovery receipt fails the current verifier. | #292 |
| High | Agent privilege mode is not enforced at the server tool-execution boundary. | #123 |
| High | Agent-proxy JWT conformance is not installed as mandatory runtime middleware. | #231 |
| Medium | Agent-proxy transitive dependency advisories remain open. | #289 |

## Release Disposition

The audit does not support a claim that HotM is currently a fully verified
umbrella interface for all Fortemi capabilities. Existing receipts remain
valid only for their exact producer/consumer revisions and named profiles.
Release closure requires the independent route, OpenAPI, AsyncAPI, realtime
context, Knowledge Shard, compatibility, auth/privilege, browser, and live
receipt gates to pass. Local-only workflows must remain available when remote
compatibility or auth gates fail.
