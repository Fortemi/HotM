/**
 * E2E Test: Note CRUD Operations
 *
 * Test Context
 * - Code to test: ui/src/components/HallOfMind.tsx quick note, note detail tabs, save,
 *   delete confirmation, star toggle, validation/error handling.
 * - Testing framework: Playwright.
 * - Coverage target: deterministic mocked browser coverage for core note CRUD paths in this file.
 * - Test types needed: mocked browser integration.
 * - External dependencies to mock: health probes, system compatibility, archives, inference status,
 *   notes CRUD endpoints, note concept/provenance metadata.
 * - Edge cases identified: quick note section starts collapsed, create requires non-empty content,
 *   mutation preflight compatibility, duplicate note title text across navigator/detail regions,
 *   destructive delete confirmation.
 */

import { test, expect, type Locator, type Page, type Route, type Request } from '@playwright/test';
import { fixtures, mockResponses } from '../fixtures/test-data';
import type { NoteFull, NoteSummary } from '../../src/services/api';

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

type NotesApiState = {
  notes: NoteFull[];
  createStatus?: number;
  createErrorBody?: unknown;
  createdPayloads: unknown[];
  patchPayloads: Array<{ noteId: string; body: unknown }>;
  statusPayloads: Array<{ noteId: string; body: unknown }>;
  deletedNoteIds: string[];
};

const cloneNote = (note: NoteFull): NoteFull => JSON.parse(JSON.stringify(note)) as NoteFull;

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

const buildNote = (id: string, content: string, overrides: Partial<NoteFull['note']> = {}): NoteFull => {
  const firstHeading = content
    .split('\n')
    .map((line) => line.trim().replace(/^#+\s*/, '').trim())
    .find(Boolean);

  return {
    note: {
      id,
      format: 'markdown',
      source: 'manual',
      created_at_utc: '2026-08-15T18:00:00Z',
      updated_at_utc: '2026-08-15T18:00:00Z',
      starred: false,
      archived: false,
      title: firstHeading || 'Untitled',
      ...overrides,
    },
    original: {
      content,
      hash: `${id}-hash`,
    },
    revised: {
      content,
      last_revision_id: `${id}-rev-001`,
    },
    tags: [],
    links: [],
    labels: [],
  };
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

async function mockNotesApi(page: Page, state: NotesApiState) {
  await page.route('**/api/v1/notes**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const noteIdMatch = path.match(/\/api\/v1\/notes\/([^/]+)$/);
    const statusMatch = path.match(/\/api\/v1\/notes\/([^/]+)\/status$/);

    if (path === '/api/v1/notes' && method === 'GET') {
      await fulfillJson(route, mockResponses.listNotes(state.notes.map(toSummary)));
      return;
    }

    if (path === '/api/v1/notes' && method === 'POST') {
      state.createdPayloads.push(await request.postDataJSON());
      if (state.createStatus && state.createStatus >= 400) {
        await fulfillJson(route, state.createErrorBody ?? { error: 'create failed' }, state.createStatus);
        return;
      }

      const payload = state.createdPayloads[state.createdPayloads.length - 1] as { content: string; title?: string };
      const created = buildNote('created-note-001', payload.content, { title: payload.title || 'Created Note' });
      state.notes = [created, ...state.notes];
      await fulfillJson(route, { note_id: created.note.id, status: 'created' }, 201);
      return;
    }

    if (statusMatch && method === 'PATCH') {
      const noteId = statusMatch[1];
      const body = await request.postDataJSON();
      state.statusPayloads.push({ noteId, body });
      state.notes = state.notes.map((note) =>
        note.note.id === noteId
          ? { ...note, note: { ...note.note, ...(body.starred !== undefined ? { starred: body.starred } : {}) } }
          : note
      );
      await fulfillJson(route, { success: true });
      return;
    }

    if (noteIdMatch && method === 'GET') {
      const note = state.notes.find((candidate) => candidate.note.id === noteIdMatch[1]);
      if (note) {
        await fulfillJson(route, note);
      } else {
        await fulfillJson(route, { error: 'Note not found' }, 404);
      }
      return;
    }

    if (noteIdMatch && method === 'PATCH') {
      const noteId = noteIdMatch[1];
      const body = await request.postDataJSON();
      state.patchPayloads.push({ noteId, body });
      state.notes = state.notes.map((note) =>
        note.note.id === noteId && typeof body.content === 'string'
          ? {
              ...note,
              note: {
                ...note.note,
                updated_at_utc: '2026-08-15T18:05:00Z',
                title: body.content.split('\n')[0].replace(/^#+\s*/, '').trim() || note.note.title,
              },
              original: { ...note.original, content: body.content },
            }
          : note
      );
      await fulfillJson(route, { success: true });
      return;
    }

    if (noteIdMatch && method === 'DELETE') {
      state.deletedNoteIds.push(noteIdMatch[1]);
      state.notes = state.notes.filter((note) => note.note.id !== noteIdMatch[1]);
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fallback();
  });
}

function notesNavigator(page: Page) {
  return page
    .getByText('Notes Navigator', { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
}

function noteButton(page: Page, title: string) {
  return notesNavigator(page).getByRole('button', { name: title });
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

async function openQuickNote(page: Page) {
  const sidebar = await openAppSidebar(page);
  const quickNoteDisclosure = sidebar.getByRole('button', { name: 'Quick Note' });
  const draft = sidebar.getByPlaceholder('Quick note... (Ctrl+Enter to save)');
  const createButton = sidebar.getByRole('button', { name: 'Create Note' });
  await expect(quickNoteDisclosure).toBeVisible();
  if (!(await draft.isVisible().catch(() => false))) {
    await quickNoteDisclosure.click();
  }
  await expect(draft).toBeVisible();
  return { draft, createButton };
}

async function selectNote(page: Page, note: NoteFull) {
  await noteButton(page, note.note.title!).click();
  await expect(page.getByLabel('AI Enhanced').getByText(note.note.title!, { exact: true })).toBeVisible();
}

async function editSelectedOriginal(page: Page, content: string) {
  await page.getByRole('tab', { name: 'Edit' }).click();
  await page.getByRole('tab', { name: 'Raw Markdown' }).click();
  const markdownEditor = page.getByPlaceholder('Write in Markdown format...');
  await expect(markdownEditor).toBeVisible();
  await markdownEditor.fill(content);
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
}

async function expectAlert(page: Page, action: () => Promise<void>, message: RegExp) {
  const dialogPromise = page.waitForEvent('dialog');
  await action();
  const dialog = await dialogPromise;
  expect(dialog.message()).toMatch(message);
  await dialog.accept();
}

test.describe('Note CRUD Operations', () => {
  let state: NotesApiState;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('hotm.notesNavigatorExpanded.desktop');
      window.localStorage.removeItem('hotm.notesNavigatorExpanded.mobile');
    });
    state = {
      notes: [],
      createdPayloads: [],
      patchPayloads: [],
      statusPayloads: [],
      deletedNoteIds: [],
    };

    await mockAppShell(page);
    await mockNotesApi(page, state);
    await page.goto('/');
    await expect(page.getByPlaceholder('Search your mind...')).toBeVisible();
    await expect(notesNavigator(page)).toBeVisible();
  });

  test('creates a note from quick note content and selects the created note', async ({ page }) => {
    const { draft, createButton } = await openQuickNote(page);
    await draft.fill('# My New Note\n\nThis is my first note.');
    await createButton.click();
    await closeMobileSidebar(page);

    await expect(page.getByRole('heading', { name: 'My New Note' })).toBeVisible();
    await expect(noteButton(page, 'My New Note')).toBeVisible();
    expect(state.createdPayloads).toHaveLength(1);
    expect(state.createdPayloads[0]).toMatchObject({
      content: '# My New Note\n\nThis is my first note.',
      title: 'My New Note',
      format: 'markdown',
      source: 'manual',
    });
  });

  test('reads and updates an existing note original body', async ({ page }) => {
    state.notes = [cloneNote(fixtures.standardNote)];
    await page.reload();
    await expect(noteButton(page, fixtures.standardNote.note.title!)).toBeVisible();

    await selectNote(page, fixtures.standardNote);
    await editSelectedOriginal(page, '# Updated Note\n\nThis content has been edited.');

    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Original' }).click();
    await expect(page.getByLabel('Original').getByText('This content has been edited.')).toBeVisible();
    expect(state.patchPayloads).toEqual([
      {
        noteId: fixtures.standardNote.note.id,
        body: { content: '# Updated Note\n\nThis content has been edited.' },
      },
    ]);
  });

  test('deletes a selected note through the confirmation dialog', async ({ page }) => {
    state.notes = [cloneNote(fixtures.standardNote)];
    await page.reload();
    await expect(noteButton(page, fixtures.standardNote.note.title!)).toBeVisible();

    await selectNote(page, fixtures.standardNote);
    await noteButton(page, fixtures.standardNote.note.title!).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toContainText(`"${fixtures.standardNote.note.title!}"`);
    await page.getByRole('button', { name: 'Delete Note' }).click();

    await expect(noteButton(page, fixtures.standardNote.note.title!)).toHaveCount(0);
    await expect(page.getByText('Notes Workspace')).toBeVisible();
    expect(state.deletedNoteIds).toEqual([fixtures.standardNote.note.id]);
  });

  test('stars and unstars a note with persisted status payloads', async ({ page }) => {
    state.notes = [cloneNote(fixtures.standardNote)];
    await page.reload();
    await selectNote(page, fixtures.standardNote);

    const starButton = page.getByLabel('AI Enhanced').getByRole('button', { name: '' }).first();
    await starButton.click();
    await expect(noteButton(page, fixtures.standardNote.note.title!).locator('svg.fill-yellow-500')).toBeVisible();

    await starButton.click();
    await expect(noteButton(page, fixtures.standardNote.note.title!).locator('svg.fill-yellow-500')).toHaveCount(0);
    expect(state.statusPayloads).toEqual([
      { noteId: fixtures.standardNote.note.id, body: { starred: true } },
      { noteId: fixtures.standardNote.note.id, body: { starred: false } },
    ]);
  });

  test('keeps empty quick note content client-side and does not call create', async ({ page }) => {
    const { createButton } = await openQuickNote(page);
    await expect(createButton).toBeDisabled();
    expect(state.createdPayloads).toHaveLength(0);
  });

  test('surfaces create failures and leaves the draft in place', async ({ page }) => {
    state.createStatus = 500;
    state.createErrorBody = fixtures.apiErrors.serverError.body;

    const { draft, createButton } = await openQuickNote(page);
    await draft.fill('# Failing Note\n\nThis should remain a draft.');

    await expectAlert(
      page,
      async () => {
        await createButton.click();
      },
      /Failed to create note/
    );
    await expect(draft).toHaveValue('# Failing Note\n\nThis should remain a draft.');
    await expect(noteButton(page, 'Failing Note')).toHaveCount(0);
    expect(state.createdPayloads).toHaveLength(4);
    for (const payload of state.createdPayloads) {
      expect(payload).toMatchObject({
        content: '# Failing Note\n\nThis should remain a draft.',
        title: 'Failing Note',
        format: 'markdown',
        source: 'manual',
      });
    }
  });
});
