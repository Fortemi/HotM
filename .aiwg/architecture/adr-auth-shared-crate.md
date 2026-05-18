---
adr_id: ADR-AUTH-001
title: OAuth via shared private Rust crate (canonical source private)
status: Migrated to private repo
date: 2026-05-17
canonical_source: "Fortemi/fortemi-auth (private — Gitea)"
related_artifacts:
  - .aiwg/architecture/adr-mobile-cloud-architecture.md
  - .aiwg/architecture/manifest-schema-v1.md
  - .aiwg/planning/mobile-expansion-phase-plan.md
related_issues:
  - "#2 OAuth2/API Key Authentication"
  - "#224 Mobile expansion epic"
  - "#1 Fortemi Integration epic"
  - "#116 Embedded AI Assistant epic"
---

# ADR-AUTH-001 — migrated to private repo

The canonical specification, decision rationale, alternatives considered, and implementation outline for this ADR have been moved to the private `Fortemi/fortemi-auth` repository:

- `docs/adr/adr-001-shared-crate-architecture.md` (private)

This stub exists in the public repo only because other public artifacts (ADR-MOBILE-001, the manifest schema doc, the mobile expansion phase plan, and the comment thread on issue #2) reference `ADR-AUTH-001` by ID and path. Leaving those references resolvable matters; the implementation details do not need to be public.

## Public summary

OAuth 2.0 + PKCE authentication is implemented as a shared Rust crate. The crate is consumed by `matric-api` via Cargo `git = "..."` dependency. Provider abstraction enables future IdP swaps without changes to consuming code.

All other detail — provider choice, claim contracts, tenant extraction logic, CI deploy-key setup, KMS posture, scopes model — lives in the private repo and is gated by Gitea collaborator access.

## Why this is private

The detailed ADR contains IdP-specific configuration shape, tenant-claim mapping logic, and operational specifics that benefit from access control. Re-evaluate post-launch — if the contents become purely-glue, consider open-sourcing.

## Cross-references

- `Fortemi/fortemi-auth` — private repo (Gitea)
- HotM #2 — original P0 OAuth umbrella issue; the comment thread links here and to the private repo
- HotM #224 — mobile expansion epic; Phase 2 consumes this crate
- Fortemi/#707 — matric-api integration epic
