/**
 * E2E Test: Tag Management
 *
 * Deterministic mocked coverage for current tag APIs:
 * - GET /api/v1/tags -> { tags: [{ name, count }] }
 * - POST /api/v1/tags -> { name }
 * - PATCH /api/v1/tags/{name} -> { name }
 * - DELETE /api/v1/tags/{name} -> 204
 */

import { expect, test, type Page, type Route } from '@playwright/test';
import { fixtures, mockResponses } from '../fixtures/test-data';
import type { Tag } from '../../src/api';

const compatibility = {
  schema_version: 1,
  contract_revision: '2026-07-06',
  api: {
    name: 'fortemi',
    version: '2026.7.0',
    minimum_hotm_enterprise_client: '2026.7.1',
    git_sha_present: true,
    build_date_present: true,
  },
  deployment: {
    mode: 'local',
    edition: 'community',
    hosted_multi_tenant_ready: false,
  },
  auth: {
    required: false,
    mode: 'anonymous_local',
    oauth_issuer_configured: false,
    tenant_context_available: false,
  },
  capabilities: {},
  links: {
    openapi: '/api/v1/operator/openapi.yaml',
    asyncapi: '/api/v1/operator/asyncapi.yaml',
    health: '/health',
    streaming_health: '/api/v1/health/stream',
  },
};

const statsFromTags = (tags: Tag[]) => ({
  total_tags: tags.length,
  total_tagged_notes: tags.reduce((sum, tag) => sum + tag.count, 0),
  avg_tags_per_note: tags.length ? 2.5 : 0,
  most_used: [...tags].sort((a, b) => b.count - a.count).slice(0, 10),
});

async function installShellMocks(page: Page) {
  const fulfillHealthyRoot = async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy' }) });
  };
  await page.route(
    (url) => url.origin === 'http://localhost:3000' && (url.pathname === '/health' || url.pathname.startsWith('/health/')),
    fulfillHealthyRoot
  );
  await page.route('**/api/v1/health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.healthySystem) });
  });
  await page.route('**/api/v1/system/compatibility', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(compatibility) });
  });
  await page.route('**/api/v1/archives**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/notes?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResponses.listNotes([])) });
  });
}

async function installTagMocks(page: Page, tags: Tag[]) {
  await page.route('**/api/v1/tags**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname.endsWith('/tags/stats')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statsFromTags(tags)) });
      return;
    }

    if (url.pathname.endsWith('/tags') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tags }) });
      return;
    }

    if (url.pathname.endsWith('/tags') && method === 'POST') {
      const body = await route.request().postDataJSON();
      const name = String(body.name);
      tags.push({ name, count: 0 });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name }) });
      return;
    }

    if (method === 'PATCH') {
      const oldName = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      const body = await route.request().postDataJSON();
      const newName = String(body.new_name);
      const tag = tags.find((item) => item.name === oldName);
      if (tag) {
        tag.name = newName;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: newName }) });
      return;
    }

    if (method === 'DELETE') {
      const name = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      const index = tags.findIndex((tag) => tag.name === name);
      if (index >= 0) {
        tags.splice(index, 1);
      }
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Unhandled tag mock' }) });
  });
}

async function openSidebar(page: Page) {
  const sidebarHeading = page.getByText('Hall of the Mind', { exact: true });
  if (await sidebarHeading.isVisible().catch(() => false)) {
    return;
  }

  const toggle = page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).first();
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(sidebarHeading).toBeVisible();
}

async function closeMobileSidebar(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 768) {
    return;
  }

  await page.keyboard.press('Escape');
  await expect(page.getByText('Hall of the Mind', { exact: true })).not.toBeVisible();
}

async function openTagManager(page: Page) {
  await page.goto('/');
  await openSidebar(page);
  const tagsNav = page.getByRole('button', { name: /^Tags$/ });
  if (!(await tagsNav.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^Navigate$/ }).click();
  }
  await expect(tagsNav).toBeVisible();
  await tagsNav.click();
  await closeMobileSidebar(page);
  await expect(page.getByRole('region', { name: 'Tag Management' })).toBeVisible();
}

test.describe('Tag Management', () => {
  test('loads tags with counts and stats from current contract shape', async ({ page }) => {
    const tags: Tag[] = [
      { name: 'research', count: 4 },
      { name: 'important', count: 2 },
      { name: 'archive', count: 1 },
    ];

    await installShellMocks(page);
    await installTagMocks(page, tags);

    await openTagManager(page);
    const manager = page.getByRole('region', { name: 'Tag Management' });
    await expect(manager.getByText('3 tags')).toBeVisible();
    await expect(manager.getByText('research')).toBeVisible();
    await expect(manager.getByText('4')).toBeVisible();

    await manager.getByRole('button', { name: /stats/i }).click();
    await expect(manager.getByText('Total Tags')).toBeVisible();
    await expect(manager.getByText('Tagged Notes')).toBeVisible();
    await expect(manager.getByText('research', { exact: true }).first()).toBeVisible();
  });

  test('filters tags locally without issuing another list request', async ({ page }) => {
    let listCallCount = 0;
    const tags: Tag[] = [
      { name: 'research', count: 4 },
      { name: 'important', count: 2 },
      { name: 'archive', count: 1 },
    ];

    await installShellMocks(page);
    await page.route('**/api/v1/tags**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/tags/stats')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statsFromTags(tags)) });
        return;
      }
      if (url.pathname.endsWith('/tags')) {
        listCallCount += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tags }) });
        return;
      }
      await route.fulfill({ status: 404 });
    });

    await openTagManager(page);
    await expect(page.getByText('research')).toBeVisible();

    const beforeFilter = listCallCount;
    await page.getByPlaceholder('Filter tags...').fill('imp');
    await expect(page.getByText('important')).toBeVisible();
    await expect(page.getByText('research')).not.toBeVisible();
    expect(listCallCount).toBe(beforeFilter);
  });

  test('creates a tag through POST /tags and reloads the list', async ({ page }) => {
    const tags: Tag[] = [{ name: 'existing', count: 1 }];
    const createRequest = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/v1/tags'));

    await installShellMocks(page);
    await installTagMocks(page, tags);

    await openTagManager(page);
    await page.getByRole('button', { name: /new tag/i }).click();
    await page.getByPlaceholder('Tag name').fill('newly-created-tag');
    await page.getByRole('button', { name: /^Create$/ }).click();

    const request = await createRequest;
    expect(await request.postDataJSON()).toEqual({ name: 'newly-created-tag' });
    await expect(page.getByText('newly-created-tag')).toBeVisible();
  });

  test('renames a tag through PATCH /tags/{name}', async ({ page }) => {
    const tags: Tag[] = [{ name: 'research', count: 3 }];
    const renameRequest = page.waitForRequest((request) => request.method() === 'PATCH' && new URL(request.url()).pathname.endsWith('/api/v1/tags/research'));

    await installShellMocks(page);
    await installTagMocks(page, tags);

    await openTagManager(page);
    await page.getByLabel('Rename research').click();
    const renameInput = page.getByRole('region', { name: 'Tag Management' }).getByRole('textbox').nth(1);
    await renameInput.fill('research-notes');
    await renameInput.press('Enter');

    const request = await renameRequest;
    expect(await request.postDataJSON()).toEqual({ new_name: 'research-notes' });
    await expect(page.getByText('research-notes')).toBeVisible();
    await expect(page.getByText('research', { exact: true })).not.toBeVisible();
  });

  test('deletes a tag after confirmation', async ({ page }) => {
    const tags: Tag[] = [{ name: 'archive', count: 1 }];
    const deleteRequest = page.waitForRequest((request) => request.method() === 'DELETE' && new URL(request.url()).pathname.endsWith('/api/v1/tags/archive'));

    await installShellMocks(page);
    await installTagMocks(page, tags);

    page.on('dialog', (dialog) => dialog.accept());
    await openTagManager(page);
    await page.getByLabel('Delete archive').click();

    await deleteRequest;
    await expect(page.getByText('No tags yet')).toBeVisible();
    await expect(page.getByText('archive', { exact: true })).not.toBeVisible();
  });

  test('surfaces tag list API failure and retries successfully', async ({ page }) => {
    let shouldFail = true;
    const tags: Tag[] = [{ name: 'recovered', count: 1 }];

    await installShellMocks(page);
    await page.route('**/api/v1/tags**', async (route) => {
      const url = new URL(route.request().url());
      if (shouldFail) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Tag list unavailable' }) });
        return;
      }
      if (url.pathname.endsWith('/tags/stats')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statsFromTags(tags)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tags }) });
    });

    await openTagManager(page);
    await expect(page.getByText('Failed to load tags')).toBeVisible();

    shouldFail = false;
    await page.getByRole('button', { name: /retry/i }).click();
    await expect(page.getByText('recovered')).toBeVisible();
  });
});
