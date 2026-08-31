import { expect, test, type Page, type Route } from '@playwright/test';

const compatibilityResponse = {
  schema_version: 1,
  contract_revision: '2026-07-06',
  api: {
    name: 'fortemi',
    version: '2026.7.1',
    minimum_hotm_enterprise_client: '2026.7.1',
    git_sha_present: true,
    build_date_present: true,
  },
  deployment: { mode: 'local', edition: 'community', hosted_multi_tenant_ready: false },
  auth: {
    required: false,
    mode: 'anonymous_local',
    oauth_issuer_configured: false,
    tenant_context_available: false,
  },
  capabilities: {
    notes: { state: 'available' },
    mutation: { state: 'available' },
    provenance: { state: 'available' },
    collections: { state: 'available' },
    templates: { state: 'available' },
    document_types: { state: 'available' },
    jobs: { state: 'available' },
    concepts: { state: 'available' },
    graph: { state: 'available' },
  },
  links: {
    openapi: '/api/v1/operator/openapi.yaml',
    asyncapi: '/api/v1/operator/asyncapi.yaml',
    health: '/health',
    streaming_health: '/api/v1/health/streaming',
  },
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockFortemi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/system/compatibility') return fulfillJson(route, compatibilityResponse);
    if (path === '/api/v1/notes/note-1/purge' && request.method() === 'POST') {
      return fulfillJson(route, { status: 'queued', job_id: 'job-1', note_id: 'note-1' });
    }
    if (path === '/api/v1/collections/collection-1/notes' && request.method() === 'GET') {
      return fulfillJson(route, []);
    }
    if (path === '/api/v1/templates/template-1/instantiate' && request.method() === 'POST') {
      return fulfillJson(route, { id: 'note-created', status: 'created' });
    }
    if (path === '/api/v1/document-types/detect' && request.method() === 'POST') {
      return fulfillJson(route, null);
    }
    if (path === '/api/v1/jobs/stats' && request.method() === 'GET') {
      return fulfillJson(route, {
        pending: 2, processing: 1, completed_last_hour: 4, failed_last_hour: 1,
        total: 8, delayed: 0, dead: 0, incompatible: 0,
      });
    }
    if (path === '/api/v1/jobs/pause/research' && request.method() === 'POST') {
      return fulfillJson(route, { status: 'paused', scope: 'archive', archive: 'research' });
    }
    if (path === '/api/v1/concepts/concept-1/narrower' && request.method() === 'POST') {
      return fulfillJson(route, { success: true });
    }
    if (path === '/api/v1/concepts/concept-1/narrower/concept-2' && request.method() === 'DELETE') {
      return fulfillJson(route, {});
    }
    if (path === '/api/v1/graph/topology/stats' && request.method() === 'GET') {
      return fulfillJson(route, {
        total_notes: 10, total_links: 8, isolated_nodes: 2, connected_components: 3,
        avg_degree: 1.6, max_degree: 4, linking_strategy: 'hybrid', effective_k: 8,
      });
    }
    if (path === '/api/v1/graph/snn/recompute' && request.method() === 'POST') {
      return fulfillJson(route, {
        status: 'dry_run',
        total_edges: 8,
        retained: 7,
        updated: 4,
        pruned: 1,
        retention_ratio: 0.875,
        node_count: 5,
        retained_mean_degree: 2.8,
        k_used: 8,
        threshold_used: 0.2,
        dry_run: true,
        snn_score_distribution: [0, 1, 2, 3, 2, 0, 0, 0, 0, 0],
        minimum_retention_ratio: 0.05,
        minimum_retained_mean_degree: 1,
        aggressive_pruning_override: false,
        safety_reasons: [],
        remediation: null,
      });
    }
    if (path === '/api/v1/health') {
      return fulfillJson(route, { status: 'healthy', version: '2026.7.1', database: 'ok' });
    }
    if (path === '/api/v1/health/knowledge') {
      return fulfillJson(route, { total_notes: 0, orphan_notes: 0, stale_notes: 0, unlinked_notes: 0 });
    }
    if (path === '/api/v1/notes') return fulfillJson(route, { notes: [], total: 0 });
    if (path === '/api/v1/archives' || path === '/api/v1/memories') return fulfillJson(route, []);
    if (path === '/api/v1/inference/config') return fulfillJson(route, { providers: [], ollama: null, openai: null });
    return fulfillJson(route, {});
  });
  await page.route('**/health/live', (route) => fulfillJson(route, { status: 'live', db: true }));
  await page.route('**/health', (route) => fulfillJson(route, { status: 'healthy', db: true, vector: true }));
}

async function openLifecycle(page: Page, mobile: boolean) {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto('/');
  await page.waitForTimeout(250);
  expect(browserErrors, 'application startup errors').toEqual([]);
  await expect(page.getByPlaceholder('Search your mind...')).toBeVisible();

  if (mobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  const sidebar = page.locator('[data-sidebar="sidebar"]:visible');
  await expect(sidebar).toBeVisible();
  const admin = sidebar.getByRole('button', { name: 'Admin', exact: true });
  if (!(await admin.isVisible().catch(() => false))) {
    await sidebar.getByRole('button', { name: 'Navigate' }).click();
  }
  await admin.scrollIntoViewIfNeeded();
  await admin.click();
  if (mobile) await page.keyboard.press('Escape');

  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  const lifecycleTab = page.getByRole('tab', { name: 'Content Lifecycle' });
  await lifecycleTab.scrollIntoViewIfNeeded();
  await lifecycleTab.click();
  await expect(page.getByTestId('core-content-lifecycle')).toBeVisible();
  await expect(page.getByText('Pinned Fortemi operation admission')).toBeVisible();
  await expect(page.getByText('compatible', { exact: true })).toBeVisible();
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const) {
  test(`core content workflows are responsive and auditable on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockFortemi(page);
    const requests: Array<{ method: string; path: string; body: unknown }> = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (!path.startsWith('/api/v1/')) return;
      requests.push({ method: request.method(), path, body: request.postDataJSON() ?? null });
    });

    await openLifecycle(page, viewport.name === 'mobile');
    const panel = page.getByTestId('core-content-lifecycle');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);

    await page.getByLabel('Note ID').fill('note-1');
    await page.getByRole('button', { name: 'Purge note' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Permanently purge note?');
    expect(requests.filter((request) => request.path === '/api/v1/notes/note-1/purge')).toHaveLength(0);
    await page.getByRole('button', { name: 'Queue purge' }).click();

    await expect(page.getByText('purge_note', { exact: true })).toBeVisible();
    await expect(page.getByText('Purge queued; job job-1 for note note-1.')).toBeVisible();

    await page.getByRole('tab', { name: 'Content tools' }).click();
    await page.getByLabel('Collection ID').fill('collection-1');
    await page.getByRole('button', { name: 'Load collection notes' }).click();
    await expect(page.getByText('Collection has no notes.')).toBeVisible();
    await page.getByLabel('Template ID').fill('template-1');
    await page.getByLabel('Template variables').fill('topic=contracts');
    await page.getByRole('button', { name: 'Instantiate template' }).click();
    expect(requests.filter((request) => request.path.includes('/templates/template-1/instantiate'))).toHaveLength(0);
    await page.getByRole('button', { name: 'Create note' }).click();
    await expect(page.getByText('Created note note-created from template; status=created.')).toBeVisible();
    await page.getByLabel('Detection filename').fill('unknown.bin');
    await page.getByRole('button', { name: 'Detect type' }).click();
    await expect(page.getByText('Unknown document type').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Jobs' }).click();
    await page.getByRole('button', { name: 'Queue stats' }).click();
    await expect(page.getByText('partial', { exact: true })).toBeVisible();
    await page.getByLabel('Job archive').fill('research');
    await page.getByRole('button', { name: 'Pause archive jobs' }).click();
    expect(requests.filter((request) => request.path === '/api/v1/jobs/pause/research')).toHaveLength(0);
    await page.getByRole('button', { name: 'Pause archive' }).click();
    await expect(page.getByText('research jobs paused.')).toBeVisible();

    await page.getByRole('tab', { name: 'SKOS' }).click();
    await page.getByLabel('Concept ID', { exact: true }).fill('concept-1');
    await page.getByLabel('Target concept ID').fill('concept-2');
    await page.getByLabel('Relationship').selectOption('narrower');
    await page.getByRole('button', { name: 'Add relationship' }).click();
    await expect(page.getByText('Added narrower relation from concept-1 to concept-2.')).toBeVisible();
    await page.getByRole('button', { name: 'Remove relationship' }).click();
    expect(requests.filter((request) => request.method === 'DELETE' && request.path.endsWith('/narrower/concept-2'))).toHaveLength(0);
    await page.getByRole('button', { name: 'Remove relation' }).click();
    await expect(page.getByText('Removed narrower relation from concept-1 to concept-2.')).toBeVisible();

    await page.getByRole('tab', { name: 'Graph' }).click();
    await page.getByRole('button', { name: 'Topology stats' }).click();
    await expect(page.getByText('3 components; 2 isolated; average degree 1.6.')).toBeVisible();
    await page.getByRole('button', { name: 'Recompute SNN' }).click();
    expect(requests.filter((request) => request.path === '/api/v1/graph/snn/recompute')).toHaveLength(0);
    await page.getByRole('button', { name: 'Run preview' }).click();
    await expect(page.getByText('4 updated, 1 pruned; dry_run=true.')).toBeVisible();

    expect(requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'POST', path: '/api/v1/notes/note-1/purge' }),
      { method: 'GET', path: '/api/v1/collections/collection-1/notes', body: null },
      { method: 'POST', path: '/api/v1/templates/template-1/instantiate', body: { variables: { topic: 'contracts' }, tags: null, collection_id: null, revision_mode: null } },
      { method: 'POST', path: '/api/v1/document-types/detect', body: { filename: 'unknown.bin' } },
      { method: 'GET', path: '/api/v1/jobs/stats', body: null },
      { method: 'POST', path: '/api/v1/jobs/pause/research', body: null },
      { method: 'POST', path: '/api/v1/concepts/concept-1/narrower', body: { target_id: 'concept-2' } },
      { method: 'DELETE', path: '/api/v1/concepts/concept-1/narrower/concept-2', body: null },
      { method: 'GET', path: '/api/v1/graph/topology/stats', body: null },
      { method: 'POST', path: '/api/v1/graph/snn/recompute', body: { dry_run: true } },
    ]));

    const finalBox = await panel.boundingBox();
    expect(finalBox).not.toBeNull();
    expect(finalBox!.x).toBeGreaterThanOrEqual(0);
    expect(finalBox!.x + finalBox!.width).toBeLessThanOrEqual(viewport.width + 1);

    const receiptPath = testInfo.outputPath(`core-content-lifecycle-${viewport.name}.png`);
    await page.screenshot({ path: receiptPath, fullPage: true });
    await testInfo.attach(`core-content-lifecycle-${viewport.name}`, {
      path: receiptPath,
      contentType: 'image/png',
    });
  });
}
