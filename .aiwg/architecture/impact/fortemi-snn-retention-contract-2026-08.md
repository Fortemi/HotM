---
title: Fortemi SNN Retention Safety Consumer Impact
artifact_type: architecture-impact-assessment
status: implemented
date: 2026-08-28
producer_issue: "Fortemi/fortemi#1102"
consumer_issue: "Fortemi/HotM#287"
---

# Fortemi SNN Retention Safety Consumer Impact

## Authority and Scope

Fortemi's generated OpenAPI artifact remains the REST authority under
`Fortemi/fortemi` commit `e09578e67732d2bd26cf7642ae9038a44a9b9e6c`. HotM pins
that exact artifact with SHA-256
`f585c0f07ac477159ae86d42ac318e059a42b51f02c8c8a70d767c9fd1c5c9a1`
and semantic fingerprint
`84f38ae783d1e6652e3e94062c98fee0dd680d96b81154ffb16badf2c5ada479`.
The producer work is tracked by `Fortemi/fortemi#1102`; the existing HotM
umbrella consumer tracker is `Fortemi/HotM#287`.

This is an additive REST contract change at contract revision `1` and version
`2026.2.9`:

- `POST /api/v1/graph/snn/recompute` accepts
  `allow_aggressive_pruning` and returns the same typed `SnnResult` for normal
  `200` outcomes and retention-policy `409` outcomes.
- `SnnResult` names the execution status, planned retention, topology, policy,
  score histogram, safety reasons, and remediation.
- `POST /api/v1/graph/maintenance` accepts the same explicit override flag.

HotM now treats only the declared SNN `409` as a body-bearing result, applies
the existing bounded JSON read, and strictly decodes the result. Other `4xx`
responses retain the standard redacted `ApiError` behavior. The override is
never inferred from a failed operation; callers must set it explicitly.

## Inventory Boundary

The exact producer repin also adds two event-stream token operations. They are
classified in the refreshed 253-operation inventory but are not claimed as an
SNN consumer workflow or as live-conformant behavior. Route presence and a
vendored OpenAPI snapshot are inventory evidence only.

This change does not alter AIWG static-index data, Knowledge Shard `core-v1`,
`full-v1`, or `record-v1` state transfer, or Fortemi's live persistence schema.
It does not change the suite audit's `NO-GO` status and makes no full-parity,
complete-backup, or portability claim.

## Verification and Rollback

The consumer evidence consists of the exact OpenAPI receipt, the refreshed
route/operation projections, focused API client and decoder tests, and the
clean-destination contract verifiers. Producer tests establish that a rejected
plan leaves graph rows unchanged; HotM does not duplicate that persistence
claim.

Rollback is a coordinated consumer revert of the OpenAPI pin, accepted-409
client handling, typed decoder, projections, and tests. No HotM database
migration is involved. Reverting only the client handling while retaining the
new receipt would leave a declared consumer incompatible and is not an
acceptable rollback.
