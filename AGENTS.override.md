# Operator Instructions

## Issue Tracking

Gitea is the authoritative issue tracker for this repository. File repository issues, vulnerability follow-up, audit findings, and address-issues work in Gitea via the `origin` remote. Do not file GitHub issues unless the user explicitly asks for a GitHub mirror. If an issue is accidentally filed on GitHub, comment with the Gitea replacement link and close the GitHub issue as not planned.

## Fortemi Integration Contract

When changing Fortemi integration code or claims:

- Treat route inventory as route-disposition evidence only. Do not infer request/response, event, portable-data, compatibility, or auth conformance from a matching path.
- Consume Fortemi-owned OpenAPI, AsyncAPI, Knowledge Shard schema/profile, and compatibility artifacts at a pinned revision.
- Preserve the canonical realtime event envelope. Unknown events remain unknown; never coerce them into a known type such as `QueueStatus`.
- Knowledge Shard claims must name `core-v1`, `full-v1`, or `record-v1`. Do not
  call a shard portable or lossless until the corresponding cross-repository
  golden round trips, including bytes where required, pass.
- Fail closed on unknown compatibility contract revisions, unmet minimum-client requirements, and unsupported auth claim-contract versions while preserving local-only workflows.
- Treat `fortemi-auth` as specification-only until its Rust workspace, CI, release, and shared Rust/Node fixture receipts exist.
- Update the SAD addendum, ADR-010, requirements, test plan, and traceability together when any integration contract changes.
