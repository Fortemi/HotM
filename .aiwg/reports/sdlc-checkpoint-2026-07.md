# HotM SDLC Checkpoint - 2026-07

## Phase Read

HotM is entering an enterprise demo planning phase. The existing SDLC corpus is strong for earlier Fortemi integration and UI redesign work, but the product now needs a focused UX update for hosted auth, realtime/streaming visibility, premium components, and backoffice tooling.

## Key Findings

- `docs/ux/fortemi-integration-ux-design.md` covers six API feature integrations from February 2026, before the current hosted/enterprise push.
- `.aiwg/api/compatibility/` and `.aiwg/architecture/impact/` already show HotM has a history of API-contract drift work.
- The July suite audit flags missing cross-repo API compatibility and floating sidecar provenance as delivery risks.

## Required Work

- Adopt the suite plan in `.aiwg/planning/hotm-ux-enterprise-update-plan-2026-07.md` or copy the relevant parts into this repo.
- Use `HotM/.aiwg/architecture/adr/ADR-009-enterprise-capability-driven-ux.md` as the decision record for capability-driven enterprise UX.
- Use `HotM/.aiwg/planning/enterprise-demo-scenarios-2026-07.md` as the first demo-scenario plan; it recommends tenant admin as the initial persona.
- Use `HotM/.aiwg/requirements/enterprise-demo-requirements-2026-07.md` and `HotM/.aiwg/testing/enterprise-demo-test-plan-2026-07.md` for implementation acceptance criteria and verification.
- Use filed issues `Fortemi/HotM#243` through `#250` as the enterprise UX tracker set.
- Keep enterprise surfaces gated by backend capability discovery until Fortemi contracts are stable.
- Keep the fixture-backed product sequence constrained by the accepted OP-2026-07-001 through OP-2026-07-006 defaults while HUX-REQ-012 waits for the dated dry-run receipt and while live CI, private registry, hosted production, public/legal, HMC, binary parity/export, and suite graph gates remain open.

## Implementation Progress

- 2026-07-06: Added initial Fortemi compatibility discovery consumption for `Fortemi/HotM#244`.
- HotM now exposes `api.systemCompatibility.get()` for `GET /api/v1/system/compatibility`.
- `ApiCapabilitiesPanel` renders compatibility contract/deployment/auth metadata when available and falls back to legacy health metadata when unreachable.
- Focused verification passed: `npm run test -- src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`.
- 2026-07-06: Added the first compatibility-driven Enterprise Preview section for `Fortemi/HotM#248` and `Fortemi/HotM#249`.
- The preview covers hosted auth, realtime activity, premium components, backoffice console, audit posture, quota status, KMS status, and MCP scope gate with disabled-by-default production status.
- Focused verification passed: `npm run test -- src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx --run`; `npm run typecheck`.
- 2026-07-06: Added the HUX-DEMO-002 Hosted Auth Preview state matrix for `Fortemi/HotM#247`.
- The matrix distinguishes local/private mode, hosted sign-in availability, tenant context, admin authorization preview, insufficient-role fixtures, and fixed auth-failure handling without rendering tokens or raw provider diagnostics.
- Focused verification passed: `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`.
- 2026-07-06: Added the HUX-DEMO-004 Premium Components Catalog for `Fortemi/HotM#248`.
- The catalog covers available, unavailable, license-required, admin-required, preview-only, and unknown states; it keeps actions gated by compatibility, tenant context, licensing, role, and backend contract readiness.
- Focused verification passed: `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`.
- 2026-07-06: Added the HUX-DEMO-005 Backoffice Console Preview for `Fortemi/HotM#249`.
- The preview covers tenant health, audit posture, quota status, KMS status, and support diagnostics with production actions disabled until backend contract, role/scope, audit, and fixture gates pass.
- Focused verification passed: `npm run test -- src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx --run`; `npm run typecheck`.
- Browser-backed verification passed: `npx playwright test e2e/tests/enterprise-preview.spec.ts --project=e2e-mocked`; screenshots captured in `.aiwg/evidence/hotm-enterprise-preview-desktop.png` and `.aiwg/evidence/hotm-enterprise-preview-mobile.png`. The smoke now covers Enterprise Preview, Hosted Auth Preview, Premium Components Catalog, and Backoffice Console Preview.
- 2026-07-06: Added sidecar provenance gate for `Fortemi/HotM#245`.
- Desktop CI/release workflows now use `scripts/download-pinned-sidecar.sh` with `release/sidecar-provenance.json` instead of raw floating sidecar downloads.
- Sidecar verification passed: `scripts/download-pinned-sidecar.sh x86_64-unknown-linux-gnu /tmp/hotm-sidecar-provenance-check`; manifest parse, shell syntax, HotM desktop/Tauri workflow YAML parse, and HUX checks passed locally.
- HUX-REQ-010 remains a live-evidence gate: suite-root preflight still lacks token-based Gitea Actions access and remote workflow receipts, so local manifest/downloader/workflow YAML/HUX checks are proof of fixture/readiness only, not production CI completion.
- 2026-07-07: Added local manifest launch-rate preflight evidence for HUX-REQ-013 and `Fortemi/HotM#251`.
- `node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs` proves local `GET /v1/manifest` `200`, `304`, `405`, and `429` semantics, `Retry-After`, cache-header non-bypass, and redacted telemetry.
- The local fixture proof is preflight evidence only; hosted/mobile production readiness still requires hosted/gateway/CI enforcement-layer proof before `Fortemi/HotM#251` can close.
- 2026-07-07: Refreshed the HotM repo-local AIWG index for checkpoint inventory evidence.
- `aiwg index stats --json` now reports 148 indexed artifacts, 100% `.aiwg` file coverage, 6 dependency edges, and 141 orphaned artifacts for HotM; this is local inventory evidence only, not hosted/mobile production closure.
- 2026-07-06: Added sanitized realtime activity classification for `Fortemi/HotM#246`.
- `RealtimeEventInspector` now renders fixed activity categories and summaries from `ui/src/services/realtimeActivity.ts` instead of exposing raw event identifiers or sensitive backend details.
- `HallOfMind` now exposes a persistent Activity button that opens the sanitized realtime drawer from the shell header.
- Focused verification passed: `npm run test:realtime` from `HotM/ui` now covers the sanitized activity classifier, event bus, API event stream, shell drawer, and attachment realtime regressions; latest local run on 2026-07-08 passed 5 test files and 84 tests. `npm run typecheck` remains the paired type gate.
- 2026-07-06: Root tracker receipts through `Fortemi/fortemi#1021` comment `#80638` confirm the gate/signoff, claim-control, process-playbook, auth posture, completion audit, handoff, review-batch, checkpoint-gate, repo-local report, issue-draft, Enterprise package-flow alignment, evidence-ledger refresh, executive checkpoint boundary alignment, historical pre-transfer `fortemi-react` ownership boundary, handoff-gate cleanup, HotM direct-traceability alignment, HotM traceability-verifier alignment, UI quality-gate wiring, HotM demo evidence alignment, operator decision support matrix, OP synchronization checklist, executable OP sync verifier, dynamic receipt checking, private Cargo registry preflight, `Fortemi-Enterprise/*` receipt parsing, executable Gitea live-evidence preflight, checkpoint evidence consistency verification, corrected `tea` login detection, executable public-claim verification, conditional checkpoint readiness verification, operator-decision application runbook, accepted operator-decision verifier, workspace manifest verifier, blocker-ledger verifier, handoff-suite verifier, manifest-verifier inventory correction, handoff-validation verifier, issue-traceability verifier, HotM UX enterprise-plan verifier, Enterprise repo readiness verifier, checkpoint review-batch verifier, loose-end correction verifier, enterprise objective-audit verifier, enterprise phase-impact verifier, hosted production gate verifier, Gitea Actions live-evidence verifier, generated Python cache hygiene, stale compile-evidence wording guard, tracker-comment index verifier, July 7 checkpoint revalidation, tracker revalidation-surface guard, enterprise next-action register, live tracker revalidation, operator response template, and enterprise claim approval verifier around OP-2026-07-001 through OP-2026-07-006, live CI evidence, hosted production evidence, and legal/product claim approval.
- 2026-07-08: Root tracker receipts through `Fortemi/fortemi-react#252` comment `#80963` now also include `Fortemi/fortemi-react#252` comment `#80888` for React npm/Gitea publish proof, `Fortemi/fortemi#1013` comment `#80889` for binary projection local proof, `Fortemi/HotM#251` comment `#80890` for manifest launch-rate local fixture proof, `Fortemi/aiwg-fortemi-skills#2` comment `#80891` for AIWG provider-context proof, and `#80963` for completed React local metadata/docs reconciliation tracker update. These comments are proof/update handoffs only; OP answers, live CI, private registry, hosted/gateway/CI production evidence, reviewer acceptance, and `Fortemi/fortemi-react#252` acceptance/closure remain open.
- 2026-07-09: Accepted OP receipts are indexed through `Fortemi/HotM#243` comment `#81235` and `Fortemi/HotM#250` comment `#81236`. These accept the HotM desktop-plus-enterprise product sequence for fixture-backed preview only; HUX-REQ-012 remains partial until a completed dated dry-run receipt is attached.
