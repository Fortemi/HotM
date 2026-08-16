import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

const compatibilityResponse = {
  schema_version: 1,
  contract_revision: '2026-07-06',
  api: {
    name: 'fortemi',
    version: '2026.7.12',
    minimum_hotm_enterprise_client: '2026.5.0',
    git_sha_present: true,
    build_date_present: true,
  },
  deployment: { mode: 'local_sidecar', edition: 'community', hosted_multi_tenant_ready: false },
  auth: {
    required: false,
    mode: 'anonymous_local',
    oauth_issuer_configured: false,
    tenant_context_available: false,
  },
  capabilities: { core_notes: { state: 'available' } },
  links: {
    openapi: '/operator/openapi.yaml',
    asyncapi: '/operator/asyncapi.yaml',
    health: '/health',
    streaming_health: '/api/v1/health/streaming',
  },
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockFortemi(page: Page) {
  await page.route('**/operator/*.yaml', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/yaml', body: 'schema: bounded' });
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path === '/api/v1/system/compatibility') return fulfillJson(route, compatibilityResponse);
    if (path === '/api/v1/inference/complete' && method === 'POST') {
      return fulfillJson(route, {
        content: 'raw provider secret must not render',
        finish_reason: 'stop',
        model: 'private-model-name',
        provider_id: 'private-provider-id',
      });
    }
    if (path === '/api/v1/inference/config') return fulfillJson(route, { default_backend: 'ollama', providers: ['ollama'] });
    if (path === '/api/v1/inference/config/audit') return fulfillJson(route, { entries: [], total: 0 });
    if (path === '/api/v1/inference/providers') return fulfillJson(route, { providers: [{ server_configured: true, capabilities: ['generation', 'embedding'] }] });
    if (path === '/api/v1/models') return fulfillJson(route, { models: [{ slug: 'model-a', capabilities: [] }], providers: [{ health: 'healthy' }], defaults: { language: 'model-a', embedding: 'model-a' } });
    if (path === '/api/v1/graph/topology/stats') return fulfillJson(route, { total_notes: 12, total_links: 18, isolated_nodes: 0, connected_components: 1, avg_degree: 3, max_degree: 5 });
    if (path === '/api/v1/graph/diagnostics') return fulfillJson(route, { status: 'ok' });
    if (path === '/api/v1/graph/diagnostics/history') return fulfillJson(route, []);
    if (path === '/api/v1/graph/cold-spots') return fulfillJson(route, { summary: { cold_access_count: 0 } });
    if (path === '/api/v1/health/knowledge') return fulfillJson(route, { total_notes: 12, orphan_notes: 0, stale_notes: 0, unlinked_notes: 0, avg_links_per_note: 3, tag_coverage: 1 });
    if (path === '/api/v1/health/streaming') return fulfillJson(route, { status: 'healthy', sse: {}, rtp: {}, chat: {}, ingest: {}, inbound: {} });
    if (path === '/api/v1/health/access-frequency') return fulfillJson(route, { notes: [], count: 0 });
    if (path === '/api/v1/health/orphan-tags') return fulfillJson(route, []);
    if (path === '/api/v1/health/stale-notes') return fulfillJson(route, []);
    if (path === '/api/v1/health/unlinked-notes') return fulfillJson(route, { notes: [] });
    if (path === '/api/v1/health/tag-cooccurrence') return fulfillJson(route, { pairs: [] });
    if (path === '/api/v1/memory/info') return fulfillJson(route, { percent_used: 32 });
    if (path === '/api/v1/rate-limit/status') return fulfillJson(route, { limit: 100, remaining: 90 });
    if (path === '/api/v1/extraction/stats') return fulfillJson(route, { total_jobs: 4 });
    if (path === '/api/v1/jobs/stats') return fulfillJson(route, { pending: 0, processing: 0, completed_last_hour: 2, failed_last_hour: 0, total: 2 });
    if (path === '/api/v1/jobs/status') return fulfillJson(route, { global: 'running', archives: {} });
    if (path === '/api/v1/jobs') return fulfillJson(route, { jobs: [], total: 0 });
    if (path === '/api/v1/webhooks') return fulfillJson(route, []);
    if (path === '/api/v1/webhooks/incoming') return fulfillJson(route, []);
    if (path === '/api/v1/inbound-sources') return fulfillJson(route, []);
    if (path === '/api/v1/backup/status') return fulfillJson(route, { status: 'idle' });
    if (path === '/api/v1/backup/list') return fulfillJson(route, { backups: [] });
    if (path === '/api/v1/archives' || path === '/api/v1/memories') return fulfillJson(route, []);
    if (path === '/api/v1/embedding-configs') return fulfillJson(route, [{ id: 'cfg-1', name: 'Local', model: 'embed-v2', dimensions: 768, is_default: true, created_at: '2026-08-16T00:00:00Z' }]);
    if (path === '/api/v1/embedding-configs/default') return fulfillJson(route, { id: 'cfg-1', name: 'Local', model: 'embed-v2', dimensions: 768, is_default: true, created_at: '2026-08-16T00:00:00Z' });
    if (path === '/api/v1/embedding-sets') return fulfillJson(route, []);
    if (path === '/api/v1/notes') return fulfillJson(route, { notes: [], total: 0 });
    if (path === '/api/v1/health') return fulfillJson(route, { status: 'healthy', database: 'ok' });
    return fulfillJson(route, {});
  });
  await page.route('**/health/live', (route) => fulfillJson(route, { status: 'live', db: true }));
  await page.route('**/health', (route) => fulfillJson(route, { status: 'healthy', db: true, vector: true }));
}

async function openOperatorConsole(page: Page, mobile: boolean) {
  await page.goto('/');
  await expect(page.getByPlaceholder('Search your mind...')).toBeVisible();

  if (mobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  const sidebar = page.locator('[data-sidebar="sidebar"]:visible');
  await expect(sidebar).toBeVisible();
  const admin = sidebar.getByRole('button', { name: 'Admin', exact: true });
  if (!(await admin.isVisible().catch(() => false))) await sidebar.getByRole('button', { name: 'Navigate' }).click();
  await admin.scrollIntoViewIfNeeded();
  await admin.click();
  if (mobile) await page.keyboard.press('Escape');

  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  const operatorTab = page.getByRole('tab', { name: 'Operator' });
  await operatorTab.scrollIntoViewIfNeeded();
  await operatorTab.click();
  await expect(page.getByTestId('operator-console')).toBeVisible();
  await expect(page.getByText('admitted', { exact: true })).toBeVisible();
}

async function attachReceipt(page: Page, testInfo: TestInfo, viewportName: string) {
  const path = testInfo.outputPath(`operator-console-${viewportName}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`operator-console-${viewportName}`, { path, contentType: 'image/png' });
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const) {
  test(`operator console produces a redacted confirmed receipt on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockFortemi(page);
    let completionRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/inference/complete') completionRequests += 1;
    });

    await openOperatorConsole(page, viewport.name === 'mobile');
    const panel = page.getByTestId('operator-console');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    await panel.getByLabel('Model').first().fill('model-a');
    await panel.getByRole('button', { name: 'Probe completion' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('fixed, eight-token inference completion probe');
    expect(completionRequests).toBe(0);
    await page.getByRole('button', { name: 'Confirm' }).click();

    const receipt = panel.getByTestId('action-receipt');
    await expect(receipt).toContainText('content characters');
    await expect(receipt).toContainText('35');
    await expect(panel).not.toContainText('raw provider secret');
    await expect(panel).not.toContainText('private-model-name');
    await expect(panel).not.toContainText('private-provider-id');
    expect(completionRequests).toBe(1);
    await attachReceipt(page, testInfo, viewport.name);
  });
}
