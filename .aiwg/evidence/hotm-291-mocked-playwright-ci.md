# HotM #291 Mocked Playwright CI Evidence

## Test Context

- **Code to test**: `ui/e2e/tests/**/*.spec.ts` through `ui/scripts/playwright-mocked-ci.config.cjs`
- **Testing framework**: Playwright
- **Coverage target**: CI presence and artifact receipt for the required mocked browser gate; unit coverage remains in `quality-gate`
- **Test types needed**: mocked browser E2E at desktop and mobile widths
- **External dependencies to mock**: Fortemi API calls are mocked by the existing `ui/e2e/tests` route fixtures
- **Edge cases identified**: desktop layout width, mobile layout width, failed-test artifacts, SHA mismatch, fixture contract drift

## CI Contract

- Required job: `mocked-playwright-ci`
- Clean install: removes `ui/node_modules` and runs `npm ci`
- Browser install: `npx playwright install chromium --with-deps`
- Mocked widths: `1280x900` and `390x900`
- Receipt: `ui/test-results/mocked-ci/receipt.json`
- Fixture contract digest: SHA-256 over `ui/e2e/fixtures/test-data.ts` and mocked `ui/e2e/tests/*.spec.ts`
- Failure artifacts: `ui/playwright-report/mocked-ci/` and `ui/test-results/mocked-ci/artifacts/`; the receipt remains at the parent path so Playwright cleanup cannot remove it

## Separation

The mocked CI gate does not execute live Fortemi asset tests or Tauri desktop tests. Live asset receipt remains in the existing opt-in `live-asset-receipt` job, and Tauri gates remain in dedicated desktop workflows.
