# HotM Enterprise Preview Evidence - 2026-07-06

## Scope

Browser-backed smoke verification for the compatibility-driven enterprise demo surfaces in the Admin Panel API Surface tab.

## Evidence Files

| Viewport | Screenshot |
|---|---|
| Desktop, 1440x1000 | `.aiwg/evidence/hotm-enterprise-preview-desktop.png` |
| Mobile, 390x900 | `.aiwg/evidence/hotm-enterprise-preview-mobile.png` |

## Verified Behavior

- The HallOfMind shell opens the Admin Panel through the normal navigation path.
- The API Surface tab renders compatibility contract metadata from `GET /api/v1/system/compatibility`.
- Enterprise Preview renders hosted auth, realtime activity, premium, backoffice, audit, quota, KMS, and MCP capability cards.
- Hosted Auth Preview renders local/sign-in/tenant/admin/failure state rows without exposing tokens or provider diagnostics.
- Premium Components Catalog renders licensed server, backoffice, MCP, hosted auth, and KMS catalog rows with coarse state only.
- Backoffice Console Preview renders tenant health, audit posture, quota status, KMS status, and support diagnostics panels.
- `premium_components`, `backoffice_api`, `kms_status`, and related enterprise states show disabled-by-default production posture when the compatibility state or backend gate is not production-ready.
- Backoffice production actions, including support export, remain disabled while RLS, KMS, audit, role/scope, and fixture gates are open.
- Desktop and mobile widths render nonblank, navigable API Surface views.

## Commands

```bash
npx playwright test e2e/tests/enterprise-preview.spec.ts --project=e2e-mocked
npm run test -- src/api/__tests__/index.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx --run
npm run test:hux-traceability
npm run typecheck
```

## Result

- Playwright: 2 passed.
- Vitest: 3 files, 33 tests passed.
- HUX traceability: current anchors are present for HUX-REQ-001 through HUX-REQ-014; this screenshot evidence remains fixture-backed preview evidence only.
- Manifest launch boundary: `scripts/verify-manifest-launch-boundary.sh` passes for HUX-REQ-013, while hosted/mobile production-readiness claims remain blocked on `Fortemi/HotM#251`.
- TypeScript: passed.
