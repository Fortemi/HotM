---
title: Mobile Expansion Planning — Artifact Index
type: index
created: 2026-05-17
status: Phase 0 (decisions locked)
---

# Mobile Expansion Planning — Artifact Index

Single entry-point for the SDLC + research artifacts produced for HotM's mobile expansion. All artifacts produced via a four-wave multi-agent orchestration on 2026-05-17.

## Decisions

| Artifact | Status | Notes |
|---|---|---|
| [ADR-MOBILE-001 — Mobile cloud architecture](../architecture/adr-mobile-cloud-architecture.md) | Proposed (rev 1) | Seven decisions. Reviewed by 4 agents; revisions merged. |
| [Manifest schema v1](../architecture/manifest-schema-v1.md) | Proposed | The `GET /v1/manifest` API contract. JSON Schema file (`manifest-schema-v1.json`) to be authored alongside Phase 2 implementation. |

## Plan

| Artifact | Status | Notes |
|---|---|---|
| [Mobile expansion phase plan](mobile-expansion-phase-plan.md) | Proposed (rev 1) | Six phases. Agent-oriented units throughout (no time estimates). |

## Research

| Artifact | Topic | GRADE baseline |
|---|---|---|
| [Tauri 2 mobile production patterns and pitfalls](../research/findings/mobile-tauri2-production-patterns.md) | Framework readiness, plugin matrix, sidecar gap, build/distribute reality | MODERATE |
| [Multi-tenant SaaS + BYO-LLM patterns](../research/findings/mobile-multitenant-byo-llm.md) | Isolation models, RLS, BYO-LLM proxy, secret storage, auth, ops floor | MODERATE |
| [Mobile remote-config and manifest delivery patterns](../research/findings/mobile-manifest-remote-config.md) | Firebase/LaunchDarkly/Statsig comparison, schema design, anti-patterns | MODERATE |

## Reviews

| Reviewer | File | Verdict |
|---|---|---|
| Security Architect | [review-security-architect.md](../working/mobile-planning/review-security-architect.md) | APPROVED_WITH_CHANGES |
| Test Architect | [review-test-architect.md](../working/mobile-planning/review-test-architect.md) | APPROVED_WITH_CHANGES |
| Requirements Analyst | [review-requirements-analyst.md](../working/mobile-planning/review-requirements-analyst.md) | APPROVED_WITH_CHANGES |
| Technical Writer | [review-technical-writer.md](../working/mobile-planning/review-technical-writer.md) | APPROVED_WITH_CHANGES |
| **Synthesis** | [review-synthesis.md](../working/mobile-planning/review-synthesis.md) | 11 HIGH / 13 MEDIUM / 25 LOW findings. Top-priority HIGH findings merged into the ADR + phase plan revisions. |

## Required follow-up artifacts

These artifacts are referenced by the ADR and phase plan but have not yet been authored. Each is gated to a specific phase:

| Artifact | Gates at | Owner role | Notes |
|---|---|---|---|
| `cryptographic-decisions.md` | Phase 1 | applied-cryptographer | AEAD primitive, KDF, wrap mode, HKDF info labels. |
| `adr-mobile-002-hybrid-data-semantics.md` | Phase 2 | Architecture Designer | Local↔cloud mode-switch semantics (independent / cloud-authoritative / local-authoritative). |
| `manifest-schema-v1.json` | Phase 2 | API Designer | Actual JSON Schema file for CI validation. |
| `UC-MOBILE-001` through `UC-MOBILE-005` | Phase 3 | Requirements Analyst | Five launch use cases. |
| `nfr-modules/mobile-accessibility.md` | Phase 3 | UX Lead | VoiceOver/TalkBack/WCAG/dynamic-type. |
| `mobile-launch-readiness-checklist.md` | Phase 5 | Project Manager | Already embedded in phase plan §Phase 5; promote to standalone if it grows. |

## Open strategic questions (for operator)

These were captured in the ADR (§Open questions) and the phase plan (§Open questions). Pinned here so they don't get lost:

1. Auth provider final choice (Clerk vs Auth0 vs Keycloak vs roll-your-own).
2. Hosting provider for `matric-api` (Fly.io vs Render vs Railway vs Hetzner vs self-host).
3. Free tier vs paid-only at launch.
4. Domain authority (`api.hotm.fortemi.io` confirmed?).
5. Telemetry stance.
6. Self-hosted multi-tenant option for privacy-focused users — launch feature, Phase 6, or never?
7. Compliance posture (HIPAA/SOC2 claims at launch — no by default; GDPR data-subject rights are required).
8. Pricing model if any.
9. i18n posture at launch (Wave-3 Requirements Finding 6).
10. Local↔cloud mode-switch data semantics (Wave-3 Test Architect 4 + Requirements 3 — gates Phase 2 acceptance via ADR-MOBILE-002).

## Cross-linked HotM issues

| Issue | Relationship to mobile plan |
|---|---|
| **#2** OAuth2/API Key Auth | **Blocks** Phase 2 completion. Only P0 in queue. |
| #222 postinst trim + first-run wizard | Overlaps Phase 1 backend extraction. |
| #31 First-Run Onboarding Flow | Intersects Phase 3 mobile UX work. |
| #30 One-Click Personal Install Experience | Desktop local install only; cloud mode has different onboarding. |
| #173 Reprocess no-op on media notes | Watch for regression; uses same job pipeline mobile-cloud users hit. |
| #15 Branding: matric-memory → Fortemi | Must close before public launch (Phase 5 readiness checklist). |

## Orchestration metadata

- **Approach**: Four-wave multi-agent orchestration per AIWG SDLC orchestration pattern.
- **Wave 1 (research)**: 3 parallel Technical Researchers — all hit autocompact-thrashing failures. Recovery: research executed directly with targeted WebFetch/WebSearch; three findings docs written.
- **Wave 2 (drafting)**: 3 parallel authors — Architecture Designer succeeded (3,098-word ADR). API Designer hit 1M-context-quota error; Project Manager hit autocompact. Recovery: manifest schema + phase plan authored directly.
- **Wave 3 (review)**: 4 parallel reviewers — Security Architect succeeded (substantial review with HIGH/MEDIUM/LOW findings). Test Architect succeeded (file written before its post-fact autocompact warning). Requirements Analyst + Technical Writer both hit 1M-context-quota errors. Recovery: their reviews authored directly.
- **Wave 4 (synthesis)**: Synthesis written; HIGH-severity changes merged into ADR + phase plan. Three follow-up artifacts named for future authoring.

The agent infrastructure delivered ~30% of the artifact bytes; the rest was authored directly. The orchestration framework was useful for distributing focus areas across "voices" even when individual agents failed — the review pass produced 49 distinct findings across four perspectives, which a single-author approach would not have surfaced as cleanly.
