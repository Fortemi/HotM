/**
 * E2E Test: Navigation and Routing
 *
 * Test Context
 * - Code to test: ui/src/components/HallOfMind.tsx navigation shell, notes navigator, search dropdown.
 * - Testing framework: Playwright.
 * - Coverage target: deterministic mocked browser coverage for the critical navigation paths in this file.
 * - Test types needed: mocked browser integration.
 * - External dependencies to mock: health probes, system compatibility, archives, inference status,
 *   notes list/detail endpoints, search endpoint, note concept/provenance metadata.
 * - Edge cases identified: repeated note title text in detail/list regions, collapsed feature navigation,
 *   sidebar/navigator collapse state, route-less direct hash navigation, no selected note state.
 */

import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { fixtures, mockResponses } from '../fixtures/test-data';
import type { NoteFull, NoteSummary } from '../../src/services/api';

const notesForNavigation = [
  fixtures.standardNote,
  fixtures.starredNote,
  fixtures.taggedNote,
] as NoteFull[];

const toSummary = (note: NoteFull): NoteSummary => ({
  id: note.note.id,
  title: note.note.title!,
  snippet: note.original.content.substring(0, 100),
  created_at_utc: note.note.created_at_utc,
  updated_at_utc: note.note.updated_at_utc,
  starred: note.note.starred!,
  archived: note.note.archived!,
  tags: note.tags,
  has_revision: Boolean(note.revised?.content),
  metadata: {},
});

const compatibilityResponse = {
  schema_version: 1,
  contract_revision: '2026-07-06',
  api: {
    name: 'fortemi',
    version: '2026.7.0',
    minimum_hotm_enterprise_client: '0.1.0',
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
  capabilities: {
    notes: { state: 'available' },
    mutation: { state: 'available' },
  },
  links: {
    openapi: '/api/v1/operator/openapi.yaml',
    asyncapi: '/api/v1/operator/asyncapi.yaml',
    health: '/health',
    streaming_health: '/api/v1/events',
  },
};

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
};

async function mockAppShell(page: Page) {
  await page.route('**/health/live', (route) => fulfillJson(route, { status: 'live', db: true }));
  await page.route('**/health', (route) =>
    fulfillJson(route, { status: 'healthy', database: 'ok', ollama: 'mocked', db: true, vector: true })
  );
  await page.route('**/healthz', (route) => fulfillJson(route, { status: 'healthy', db: true }));
  await page.route('**/api/v1/health', (route) =>
    fulfillJson(route, { status: 'healthy', database: 'ok', ollama: true, db: true, vector: true })
  );
  await page.route('**/api/v1/system/compatibility', (route) => fulfillJson(route, compatibilityResponse));
  await page.route('**/api/v1/archives', (route) => fulfillJson(route, []));
  await page.route('**/api/v1/inference/config', (route) =>
    fulfillJson(route, { providers: [], ollama: null, openai: null })
  );
  await page.route('**/api/v1/inference/test-connection', (route) =>
    fulfillJson(route, { reachable: false })
  );
  await page.route('**/api/v1/notes/*/concepts', (route) => fulfillJson(route, []));
  await page.route('**/api/v1/notes/*/provenance', (route) => fulfillJson(route, null));
}

async function mockNotes(page: Page, notes: NoteFull[]) {
  await page.route('**/api/v1/notes?*', (route) =>
    fulfillJson(route, mockResponses.listNotes(notes.map(toSummary)))
  );

  for (const note of notes) {
    await page.route(`**/api/v1/notes/${note.note.id}`, (route) => fulfillJson(route, note));
  }
}

function notesNavigator(page: Page) {
  return page
    .getByText('Notes Navigator', { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
}

function noteButton(page: Page, title: string) {
  return notesNavigator(page).getByRole('button', { name: title });
}

function notesNavigatorToggle(page: Page) {
  return page
    .getByText('Notes Navigator', { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "flex")][1]/following-sibling::button[1]');
}

function isMobileViewport(page: Page) {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

function visibleAppSidebar(page: Page) {
  return page.locator('[data-sidebar="sidebar"]:visible');
}

async function openAppSidebar(page: Page): Promise<Locator> {
  const sidebar = visibleAppSidebar(page);
  if (isMobileViewport(page) && (await sidebar.count()) === 0) {
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  }
  await expect(sidebar).toBeVisible();
  return sidebar;
}

async function closeMobileSidebar(page: Page) {
  if (!isMobileViewport(page)) return;

  await page.keyboard.press('Escape');
  await expect(visibleAppSidebar(page)).toHaveCount(0);
}

async function selectNote(page: Page, note: NoteFull) {
  await noteButton(page, note.note.title!).click();
  await expect(page.getByRole('tab', { name: 'AI Enhanced' })).toHaveAttribute('data-state', 'active');
  await expect(page.getByLabel('AI Enhanced').getByText(note.note.title!, { exact: true })).toBeVisible();
}

async function openFeatureNavigation(page: Page): Promise<Locator> {
  const sidebar = await openAppSidebar(page);
  const navigateDisclosure = sidebar.getByRole('button', { name: 'Navigate' });
  await expect(navigateDisclosure).toBeVisible();
  if (!(await sidebar.getByRole('button', { name: 'Dashboard' }).isVisible().catch(() => false))) {
    await navigateDisclosure.click();
  }
  await expect(sidebar.getByRole('button', { name: 'Dashboard' })).toBeVisible();
  return sidebar;
}

test.describe('Navigation and Routing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('hotm.notesNavigatorExpanded.desktop');
      window.localStorage.removeItem('hotm.notesNavigatorExpanded.mobile');
    });
    await mockAppShell(page);
    await mockNotes(page, notesForNavigation);

    await page.goto('/');
    await expect(page.getByPlaceholder('Search your mind...')).toBeVisible();
    await expect(notesNavigator(page)).toBeVisible();
    await expect(noteButton(page, fixtures.standardNote.note.title!)).toBeVisible();
  });

  test('selects a note from the navigator and loads its detail content', async ({ page }) => {
    await selectNote(page, fixtures.standardNote);

    await page.getByRole('tab', { name: 'Original' }).click();
    await expect(page.getByLabel('Original').getByText('This is a fixture note for testing.')).toBeVisible();
  });

  test('switches between notes without relying on duplicate title text', async ({ page }) => {
    await selectNote(page, fixtures.standardNote);
    await selectNote(page, fixtures.starredNote);

    await expect(page.getByLabel('AI Enhanced').getByText(fixtures.starredNote.note.title!)).toBeVisible();
    await expect(page.getByLabel('AI Enhanced').getByText(fixtures.standardNote.note.title!)).toHaveCount(0);
  });

  test('collapses and reopens the notes navigator', async ({ page }) => {
    const toggle = notesNavigatorToggle(page);

    await toggle.click();
    await expect(page.getByText('Notes Navigator', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: fixtures.standardNote.note.title! })).toHaveCount(0);

    if (isMobileViewport(page)) {
      await page.getByRole('button', { name: 'Open Notes Navigator' }).click();
    } else {
      await page.locator('main').getByRole('button').first().click();
    }
    await expect(notesNavigator(page)).toBeVisible();
    await expect(noteButton(page, fixtures.standardNote.note.title!)).toBeVisible();
  });

  test('uses sidebar feature navigation and returns to notes', async ({ page }) => {
    let sidebar = await openFeatureNavigation(page);

    await sidebar.getByRole('button', { name: 'Dashboard' }).click();
    await closeMobileSidebar(page);
    await expect(page.getByRole('heading', { name: 'System Dashboard' })).toBeVisible();
    await expect(page.getByText('notes loaded: 3')).toBeVisible();

    sidebar = await openFeatureNavigation(page);
    await sidebar.getByRole('button', { name: 'Notes' }).click();
    await closeMobileSidebar(page);
    await expect(page.getByText('Notes Workspace')).toBeVisible();
    await expect(noteButton(page, fixtures.starredNote.note.title!)).toBeVisible();
  });

  test('changes note detail tabs through accessible tab controls', async ({ page }) => {
    await selectNote(page, fixtures.taggedNote);

    await page.getByRole('tab', { name: 'Original' }).click();
    await expect(page.getByRole('tab', { name: 'Original' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByLabel('Original').getByText('This note has multiple tags and labels.')).toBeVisible();

    await page.getByRole('tab', { name: 'Edit' }).click();
    await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('data-state', 'active');
    await page.getByRole('tab', { name: 'Raw Markdown' }).click();
    await expect(page.getByPlaceholder('Write in Markdown format...')).toHaveValue(fixtures.taggedNote.original.content);
  });

  test('uses browser history state to restore the previously selected note', async ({ page }) => {
    await selectNote(page, fixtures.standardNote);
    await page.waitForFunction(() => window.history.state?.noteId === 'fixture-note-001');

    await selectNote(page, fixtures.starredNote);
    await page.waitForFunction(() => window.history.state?.noteId === 'fixture-note-002');

    await page.evaluate(() => {
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: { noteId: 'fixture-note-001', tab: 'preview', searchQuery: '' },
        })
      );
    });

    await expect(page.getByLabel('AI Enhanced').getByText(fixtures.standardNote.note.title!)).toBeVisible();
  });

  test('selects a search dropdown result and clears search UI state', async ({ page }) => {
    await page.route('**/api/v1/search?*', (route) =>
      fulfillJson(route, { results: [{ note_id: fixtures.starredNote.note.id, score: 0.98, snippet: 'This note is starred.' }] })
    );

    const searchInput = page.getByPlaceholder('Search your mind...');
    const searchResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/search') && response.status() === 200
    );
    await searchInput.fill('starred');
    await searchResponse;
    await expect(page.getByRole('button', { name: /Important Note/i })).toBeVisible();

    await page.getByRole('button', { name: /Important Note/i }).click();
    await expect(page.getByLabel('AI Enhanced').getByText(/Important Note/).first()).toBeVisible();
    await expect(searchInput).toHaveValue('');
    await expect(page.getByRole('button', { name: /Important Note/i })).toHaveCount(0);
  });

  test('direct hash navigation leaves the app in the notes workspace without fetching a fake deep link', async ({ page }) => {
    const requestedNoteIds: string[] = [];
    page.on('request', (request) => {
      const match = request.url().match(/\/api\/v1\/notes\/([^/?]+)/);
      if (match) requestedNoteIds.push(match[1]);
    });

    await page.goto('/#/notes/nonexistent-note-id');
    await expect(page.getByText('Notes Workspace')).toBeVisible();
    expect(requestedNoteIds).not.toContain('nonexistent-note-id');
  });
});
