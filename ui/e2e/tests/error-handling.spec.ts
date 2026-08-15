/**
 * E2E Test: Error Handling
 *
 * Deterministic mocked coverage for current UI error surfaces:
 * - health/offline state in the sidebar
 * - degraded API state
 * - malformed note list payloads logged without breaking navigation
 * - create note failure alert
 * - Search page API failure message
 */

import { expect, test, type Page, type Route } from '@playwright/test';
import { fixtures, mockResponses } from '../fixtures/test-data';

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

async function installBaseMocks(page: Page) {
  await page.route('**/api/v1/system/compatibility', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(compatibility) });
  });
  await page.route('**/api/v1/archives**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/tags**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tags: [] }) });
  });
  await page.route('**/api/v1/notes?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResponses.listNotes([])) });
  });
}

async function installHealthyMocks(page: Page) {
  const fulfillHealthyRoot = async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy', db: true }) });
  };
  await page.route(
    (url) => url.origin === 'http://localhost:3000' && (url.pathname === '/health' || url.pathname.startsWith('/health/')),
    fulfillHealthyRoot
  );
  await page.route('**/api/v1/health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.healthySystem) });
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

async function openSearchPage(page: Page) {
  await openSidebar(page);
  const searchNav = page.getByRole('button', { name: /^Search$/ });
  if (!(await searchNav.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^Navigate$/ }).click();
  }
  await expect(searchNav).toBeVisible();
  await searchNav.click();
  await closeMobileSidebar(page);
  await expect(page.getByRole('region', { name: 'Search' })).toBeVisible();
}

async function expandQuickNote(page: Page) {
  await openSidebar(page);
  const quickNote = page.getByPlaceholder('Quick note... (Ctrl+Enter to save)');
  if (!(await quickNote.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^Quick Note$/ }).click();
  }
  await expect(quickNote).toBeVisible();
  return quickNote;
}

test.describe('Error Handling', () => {
  test('shows offline mode and disables create when health probes fail', async ({ page }) => {
    await installBaseMocks(page);
    const abortHealth = async (route: Route) => {
      await route.abort('failed');
    };
    await page.route(
      (url) => url.origin === 'http://localhost:3000' && (url.pathname === '/health' || url.pathname.startsWith('/health/')),
      abortHealth
    );
    await page.route('**/api/v1/health', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    await openSidebar(page);
    await expect(page.getByText('Offline Mode')).toBeVisible();
    const quickNote = await expandQuickNote(page);
    await quickNote.fill('Cannot be created while offline');
    await expect(page.getByRole('button', { name: /create note/i })).toBeDisabled();
  });

  test('shows degraded state when the API is reachable but inference is unavailable', async ({ page }) => {
    await installBaseMocks(page);
    const fulfillDegradedRoot = async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          db: true,
          capabilities: { chat: { available: false } },
        }),
      });
    };
    await page.route(
      (url) => url.origin === 'http://localhost:3000' && (url.pathname === '/health' || url.pathname.startsWith('/health/')),
      fulfillDegradedRoot
    );
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          db: true,
          ollama: false,
          vector: true,
          capabilities: { chat: { available: false } },
        }),
      });
    });

    await page.goto('/');

    await openSidebar(page);
    await expect(page.getByText('Degraded')).toBeVisible();
    await expandQuickNote(page);
    await expect(page.getByRole('button', { name: /create note/i })).toBeDisabled();
  });

  test('logs malformed note list responses without breaking app navigation', async ({ page }) => {
    await installHealthyMocks(page);
    await installBaseMocks(page);
    const malformedListRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/v1/notes') && url.searchParams.get('limit') === '100';
    });
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'this is not valid JSON {]',
      });
    });

    await page.goto('/');

    await malformedListRequest;
    await expect(page.getByText('Notes Workspace')).toBeVisible();
    await openSidebar(page);
    await expect(page.getByText('API Connected')).toBeVisible();
    const tagsNav = page.getByRole('button', { name: /^Tags$/ });
    if (!(await tagsNav.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /^Navigate$/ }).click();
    }
    await expect(tagsNav).toBeVisible();
  });

  test('surfaces create note failures through the current alert flow', async ({ page }) => {
    await installHealthyMocks(page);
    await installBaseMocks(page);
    await page.route('**/api/v1/notes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Content is required' }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/');
    await openSidebar(page);
    await expect(page.getByText('API Connected')).toBeVisible();

    const alertPromise = page.waitForEvent('dialog');
    const quickNote = await expandQuickNote(page);
    await quickNote.fill('Create failure note');
    await page.getByRole('button', { name: /create note/i }).click();

    const alert = await alertPromise;
    expect(alert.message()).toContain('Failed to create note');
    await alert.accept();
  });

  test('shows full Search page error for search API failures', async ({ page }) => {
    await installHealthyMocks(page);
    await installBaseMocks(page);
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Search failed for failure query' }),
      });
    });

    await page.goto('/');
    await openSearchPage(page);
    const searchRegion = page.getByRole('region', { name: 'Search' });
    await searchRegion.getByPlaceholder('Search notes...').fill('failure query');
    await searchRegion.getByRole('button', { name: /^Search$/ }).click();

    await expect(searchRegion.getByText(/bad request|api request failed|search failed/i)).toBeVisible();
    await expect(searchRegion.getByText('No results found')).not.toBeVisible();
  });
});
