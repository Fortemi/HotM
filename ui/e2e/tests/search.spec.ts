/**
 * E2E Test: Search Functionality
 *
 * Deterministic mocked coverage for the current Fortemi search contract:
 * GET /api/v1/search -> { results, total }.
 */

import { expect, test, type Page, type Route } from '@playwright/test';
import { fixtures, mockResponses, noteSummaryFactory, searchHitFactory } from '../fixtures/test-data';
import type { NoteFull, NoteSummary, SearchHit } from '../../src/services/api';

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

const noteById = (noteId: string, title: string, tags: string[] = []): NoteFull => ({
  ...fixtures.standardNote,
  note: {
    ...fixtures.standardNote.note,
    id: noteId,
    title,
  },
  original: {
    ...fixtures.standardNote.original,
    content: `# ${title}\n\n${title} body content for e2e search.`,
  },
  tags,
});

const summaryFromNote = (note: NoteFull): NoteSummary =>
  noteSummaryFactory.build({
    id: note.note.id,
    title: note.note.title ?? 'Untitled',
    snippet: note.original.content,
    created_at_utc: note.note.created_at_utc,
    updated_at_utc: note.note.updated_at_utc,
    starred: note.note.starred ?? false,
    archived: note.note.archived ?? false,
    tags: note.tags,
  });

async function installShellMocks(page: Page, notes: NoteSummary[] = []) {
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
  await page.route('**/api/v1/tags**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tags: [] }) });
  });
  await page.route('**/api/v1/archives**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/notes?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResponses.listNotes(notes)) });
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
  await page.goto('/');
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

async function submitSearch(page: Page, query: string) {
  const searchRegion = page.getByRole('region', { name: 'Search' });
  await searchRegion.getByPlaceholder('Search notes...').fill(query);
  await searchRegion.getByRole('button', { name: /^Search$/ }).click();
}

test.describe('Search Functionality', () => {
  test('renders full search controls', async ({ page }) => {
    await installShellMocks(page);
    await openSearchPage(page);

    const searchRegion = page.getByRole('region', { name: 'Search' });
    await expect(searchRegion.getByPlaceholder('Search notes...')).toBeVisible();
    await expect(searchRegion.getByRole('button', { name: /^hybrid$/i })).toBeVisible();
    await expect(searchRegion.getByRole('button', { name: /full text/i })).toBeVisible();
    await expect(searchRegion.getByRole('button', { name: /^semantic$/i })).toBeVisible();
  });

  test('sends current contract query params and displays result titles, snippets, and scores', async ({ page }) => {
    const hit = searchHitFactory.build({
      note_id: 'search-contract-001',
      score: 0.91,
      snippet: 'Deterministic result snippet',
    });
    const note = noteById(hit.note_id, 'Contract Search Result', ['contract']);
    const searchRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/v1/search') && url.searchParams.get('q') === 'contract query';
    });

    await installShellMocks(page, [summaryFromNote(note)]);
    await page.route('**/api/v1/search?*', async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('q')).toBe('contract query');
      expect(url.searchParams.get('mode')).toBe('hybrid');
      expect(url.searchParams.get('limit')).toBe('50');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [hit], total: 1 }),
      });
    });
    await page.route(`**/api/v1/notes/${hit.note_id}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(note) });
    });

    await openSearchPage(page);
    await submitSearch(page, 'contract query');

    await searchRequest;
    const searchRegion = page.getByRole('region', { name: 'Search' });
    await expect(searchRegion.getByText('1 result')).toBeVisible();
    await expect(searchRegion.getByText('Contract Search Result')).toBeVisible();
    await expect(searchRegion.getByText('Deterministic result snippet')).toBeVisible();
    await expect(searchRegion.getByText('91%')).toBeVisible();
  });

  test('passes selected tag filters with search requests', async ({ page }) => {
    const hit = searchHitFactory.build({ note_id: 'tag-filtered-001', score: 0.8, snippet: 'Tagged search result' });
    const note = noteById(hit.note_id, 'Tagged Search Result', ['important']);

    await installShellMocks(page, [summaryFromNote(note)]);
    await page.route('**/api/v1/tags**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tags: [{ name: 'important', count: 2 }, { name: 'archive', count: 1 }] }),
      });
    });
    await page.route('**/api/v1/search?*', async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('tags')).toBe('important');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [hit], total: 1 }) });
    });
    await page.route(`**/api/v1/notes/${hit.note_id}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(note) });
    });

    await openSearchPage(page);
    const searchRegion = page.getByRole('region', { name: 'Search' });
    await searchRegion.getByRole('button', { name: /filters/i }).click();
    await searchRegion.getByPlaceholder('Add tag filter...').fill('imp');
    await searchRegion.getByRole('button', { name: /important/i }).click();
    await submitSearch(page, 'filtered query');

    await expect(searchRegion.getByRole('button', { name: /tagged search result.*80%/i })).toBeVisible();
  });

  test('displays empty state for successful zero-result response', async ({ page }) => {
    await installShellMocks(page);
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], total: 0 }) });
    });

    await openSearchPage(page);
    await submitSearch(page, 'absent');

    await expect(page.getByRole('region', { name: 'Search' }).getByText('No results found')).toBeVisible();
  });

  test('clears stale results when a later search returns no results', async ({ page }) => {
    const firstHit = searchHitFactory.build({ note_id: 'clear-results-001', score: 0.73, snippet: 'First result' });
    const note = noteById(firstHit.note_id, 'First Result Title');

    await installShellMocks(page, [summaryFromNote(note)]);
    await page.route('**/api/v1/search?*', async (route) => {
      const url = new URL(route.request().url());
      const results = url.searchParams.get('q') === 'first query' ? [firstHit] : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results, total: results.length }) });
    });
    await page.route(`**/api/v1/notes/${firstHit.note_id}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(note) });
    });

    await openSearchPage(page);
    await submitSearch(page, 'first query');
    await expect(page.getByRole('region', { name: 'Search' }).getByRole('button', { name: /first result.*73%/i })).toBeVisible();

    await submitSearch(page, 'second query');
    await expect(page.getByText('No results found')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Search' }).getByRole('button', { name: /first result.*73%/i })).not.toBeVisible();
  });

  test('shows server error text without retaining previous results', async ({ page }) => {
    const firstHit: SearchHit = { note_id: 'error-after-success-001', score: 0.66, snippet: 'Result before failure' };
    const note = noteById(firstHit.note_id, 'Result Before Failure');

    await installShellMocks(page, [summaryFromNote(note)]);
    await page.route('**/api/v1/search?*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('q') === 'working query') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [firstHit], total: 1 }) });
        return;
      }
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Search failed after previous result' }),
      });
    });
    await page.route(`**/api/v1/notes/${firstHit.note_id}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(note) });
    });

    await openSearchPage(page);
    await submitSearch(page, 'working query');
    await expect(page.getByRole('region', { name: 'Search' }).getByRole('button', { name: /result before failure.*66%/i })).toBeVisible();

    await submitSearch(page, 'failing query');
    const searchRegion = page.getByRole('region', { name: 'Search' });
    await expect(searchRegion.getByText(/bad request|api request failed|search failed/i)).toBeVisible();
    await expect(searchRegion.getByRole('button', { name: /result before failure.*66%/i })).not.toBeVisible();
  });
});
