---
title: Mobile Expansion Planning — Artifact Index
type: index
created: 2026-05-17
status: Phase 0 (HMC planning defaults accepted)
---

# Mobile Expansion Planning — Artifact Index

Single entry-point for the SDLC + research artifacts produced for HotM's mobile expansion. All artifacts produced via a four-wave multi-agent orchestration on 2026-05-17.

## Decisions

| Artifact | Status | Notes |
|---|---|---|
| [ADR-MOBILE-001 — Mobile cloud architecture](../architecture/adr-mobile-cloud-architecture.md) | Accepted for planning (rev 2) | Seven decisions plus HMC accepted defaults. Reviewed by 4 agents; revisions merged. Hosted/mobile production proof remains gated. |
| [Manifest schema v1](../architecture/manifest-schema-v1.md) | Accepted for planning | The `GET /v1/manifest` API contract. Machine-readable JSON Schema companion exists at `../architecture/manifest-schema-v1.json` and is validated by `../testing/scripts/validate-manifest-schema.mjs`. |

## Plan

| Artifact | Status | Notes |
|---|---|---|
| [Mobile expansion phase plan](mobile-expansion-phase-plan.md) | Accepted for planning | Six phases. Agent-oriented units throughout (no time estimates). HMC planning defaults accepted on 2026-07-09. |

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

## Follow-up artifacts

These artifacts are referenced by the ADR and phase plan. Some are authored as draft evidence but still require review, implementation, or launch evidence before their gates close:

| Artifact | Gates at | Owner role | Notes |
|---|---|---|---|
| `cryptographic-decisions.md` | Phase 1 | applied-cryptographer | Authored draft exists; applied-cryptographer review and implementation/test evidence remain required. |
| `adr-mobile-002-hybrid-data-semantics.md` | Phase 2 | Architecture Designer | Local↔cloud mode-switch semantics (independent / cloud-authoritative / local-authoritative). |
| `manifest-schema-v1.json` | Phase 2 | API Designer | Authored companion schema exists; keep `node .aiwg/testing/scripts/validate-manifest-schema.mjs` passing and wire server/client contract tests when Phase 2 implementation starts. |
| `UC-MOBILE-001` through `UC-MOBILE-005` | Phase 3 | Requirements Analyst | Five launch use cases. |
| `nfr-modules/mobile-accessibility.md` | Phase 3 | UX Lead | VoiceOver/TalkBack/WCAG/dynamic-type. |
| `mobile-launch-readiness-checklist.md` | Phase 5 | Project Manager | Already embedded in phase plan §Phase 5; promote to standalone if it grows. |

## Accepted HMC Defaults And Remaining Evidence Gates

These were captured in the ADR and the phase plan. They were accepted as recommended HMC planning defaults on 2026-07-09. Pinned here so the defaults stay synchronized with the root decision record and the production proof gates do not get lost.

Checkpoint consolidation exists at suite-root `.aiwg/decisions/hotm-mobile-cloud-operator-questions-2026-07-07.md` as the operator response surface for these questions. Keep this list and that root decision artifact synchronized now that the rows are answered.

1. Auth provider final choice: Clerk for hosted preview; Keycloak/self-host later enterprise option.
2. Hosting provider for `matric-api`: managed preview host; exact provider remains evidence-gated before production.
3. Free tier vs paid-only at launch: fixture-backed preview only; no public paid/free-tier claim until pricing and abuse limits are accepted.
4. Domain authority: `api.hotm.fortemi.io` remains provisional until DNS/CDN/cert evidence exists.
5. Telemetry stance: off/opt-in until product/legal approves a backend and copy.
6. Self-hosted multi-tenant option for privacy-focused users: post-launch follow-up, not first demo or launch commitment.
7. Compliance posture: no HIPAA or SOC2 claims; GDPR data-subject rights stay in hosted planning.
8. Pricing model: undecided; no public plan, quota, or paid-tier claim can depend on placeholder values.
9. i18n posture at launch: deferred from first enterprise demo and represented as a later planning item if launch scope changes.
10. Local↔cloud mode-switch data semantics: ADR-MOBILE-002 required before Phase 2 acceptance.

Accepted HMC defaults do not close `Fortemi/HotM#251`, do not authorize hosted/mobile production claims, and do not replace hosted/gateway/CI manifest launch-rate proof.

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
