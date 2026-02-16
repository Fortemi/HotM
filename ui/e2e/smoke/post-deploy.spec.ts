/**
 * Smoke Tests: Post-Deploy Validation
 *
 * 8 non-destructive tests that run against the LIVE deployed system.
 * No mocking — these hit the real UI + Fortemi API.
 *
 * Catches the exact class of bugs we found post-deploy:
 * - Health check showing "Offline" despite connected API (response format mismatch)
 * - Notes list not populating (serial API call issues)
 * - Labels returned as objects instead of strings
 *
 * Usage:
 *   HOTM_DEPLOY_URL=http://localhost:4180 npx playwright test --project=smoke
 */

import { test, expect } from '@playwright/test';
import { checkHealth, listNotes, listTags } from '../fixtures/live-api-helpers';

const DEPLOY_URL = process.env.HOTM_DEPLOY_URL ?? 'http://localhost:4180';

test.describe('Post-Deploy Smoke Tests', () => {

  // S1: UI loads and renders main layout
  test('S1: UI loads with sidebar and content area', async ({ page }) => {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('domcontentloaded');

    // Sidebar should be present with navigation items
    const sidebar = page.locator('aside, [data-sidebar], nav').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    // Main content area should exist
    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 10000 });

    // At least one sidebar navigation button should be visible
    // Current UI shows note count (e.g., "Notes (12)"), so match by prefix.
    const notesButton = page.getByText(/^Notes\b/);
    await expect(notesButton).toBeVisible({ timeout: 10000 });
  });

  // S2: Health check shows "API Connected"
  test('S2: Health indicator shows API Connected', async ({ page }) => {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');

    // The UI should show "API Connected" (not "Offline Mode")
    const connected = page.getByText('API Connected');
    const offline = page.getByText('Offline Mode');

    // Wait for health check to resolve
    await expect(connected.or(offline).first()).toBeVisible({ timeout: 15000 });

    // Assert it's connected, not offline
    await expect(connected).toBeVisible();
    await expect(offline).not.toBeVisible();
  });

  // S3: Notes list populates with items
  test('S3: Notes list populates with items', async ({ page }) => {
    // First verify API has notes
    const apiNotes = await listNotes(5);

    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');

    if (apiNotes.total > 0) {
      // Notes should appear in the sidebar or main content area
      // Look for note titles or a notes list container
      const noteItems = page.locator(
        '[data-testid="note-item"], [data-testid="note-list"] > *, .note-item, [role="listitem"]'
      );

      // If there are notes in the API, at least one should render in the UI
      // Use a generous timeout since the list may load asynchronously
      await expect(noteItems.first().or(page.getByText(apiNotes.notes[0]?.title as string ?? '')).first()).toBeVisible({
        timeout: 15000,
      });
    } else {
      // If no notes exist, verify the empty state renders cleanly (no crash)
      const main = page.locator('main').first();
      await expect(main).toBeVisible();
    }
  });

  // S4: Clicking a note loads content with tabs
  test('S4: Clicking a note loads content with AI Enhanced/Original tabs', async ({ page }) => {
    const apiNotes = await listNotes(5);
    test.skip(apiNotes.total === 0, 'No notes available to click');

    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');

    // Wait for notes to render, then click the first one
    const firstNoteTitle = apiNotes.notes[0]?.title as string;
    if (firstNoteTitle) {
      // Notes are buttons in the sidebar list — use role selector for reliability
      const noteButton = page.getByRole('button', { name: firstNoteTitle }).first();
      await expect(noteButton).toBeVisible({ timeout: 15000 });

      // Sidebar footer can overlay note buttons, so use direct DOM click
      // to bypass any overlapping elements
      await noteButton.evaluate(el => (el as HTMLElement).click());

      // Wait for note content to load from API
      await page.waitForTimeout(3000);

      // Verify note was actually selected — "No note selected" should disappear
      await expect(page.getByText('No note selected')).not.toBeVisible({ timeout: 10000 });

      // Content tabs should appear (AI Enhanced / Original)
      const aiTab = page.getByText('AI Enhanced');
      const originalTab = page.getByText('Original', { exact: true });

      await expect(aiTab.or(originalTab).first()).toBeVisible({ timeout: 15000 });
    }
  });

  // S5: Search input accepts query without errors
  test('S5: Search input accepts query without errors', async ({ page }) => {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');

    // Find and interact with the search input
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type a query
    await searchInput.fill('test');

    // No unhandled errors should appear
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Wait a moment for any search to trigger
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });

  // S6: Tags/labels endpoint returns valid data
  test('S6: Tags/labels return strings not [object Object]', async ({ page }) => {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');

    // Verify API-level: tags should be objects with a `name` string field
    const tagResult = await listTags();
    for (const tag of tagResult.tags) {
      const name = tag.name ?? tag;
      expect(typeof name).toBe('string');
      expect(String(name)).not.toBe('[object Object]');
    }

    // Verify UI-level: no [object Object] anywhere on the page
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('[object Object]');
  });

  // S7: Feature navigation works
  test('S7: Feature navigation renders views without crash', async ({ page }) => {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');

    // Click through key feature nav items and verify no crash
    const featureButtons = ['Collections', 'Tags', 'Graph', 'Timeline', 'Health'];

    for (const feature of featureButtons) {
      // Feature buttons are in the sidebar navigation list
      const button = page.getByRole('button', { name: feature, exact: true }).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        // Wait for view to render — some views (Graph, Timeline) need extra time
        await page.waitForTimeout(2000);

        // Main content should still be visible (no white screen / crash)
        const main = page.locator('main').first();
        await expect(main).toBeVisible({ timeout: 10000 });

        // No [object Object] pollution
        const bodyText = await page.textContent('body');
        expect(bodyText).not.toContain('[object Object]');
      }
    }
  });

  // S8: API response format validation
  test('S8: API response formats are correct', async () => {
    // Health endpoint
    const health = await checkHealth();
    expect(health.ok).toBe(true);
    expect(health.status).toBe(200);
    // Health response should have recognizable status fields
    const body = health.body;
    expect(body).toBeDefined();
    // Must have some kind of status indicator
    const hasStatus =
      'status' in body ||
      'ok' in body ||
      'database' in body ||
      'db' in body;
    expect(hasStatus).toBe(true);

    // Notes list endpoint
    const notes = await listNotes(5);
    expect(Array.isArray(notes.notes)).toBe(true);
    if (notes.notes.length > 0) {
      const note = notes.notes[0];
      // Each note summary should have id and title as strings
      expect(typeof note.id).toBe('string');
      expect(typeof note.title).toBe('string');
    }

    // Tags endpoint
    const tags = await listTags();
    expect(Array.isArray(tags.tags)).toBe(true);
    for (const tag of tags.tags) {
      // Tags must have a name field that is a string
      const name = tag.name;
      expect(typeof name).toBe('string');
      expect(name).not.toBe('[object Object]');
    }
  });
});
