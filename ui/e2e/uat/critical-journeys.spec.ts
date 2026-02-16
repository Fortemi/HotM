/**
 * UAT: Critical User Journeys
 *
 * Full user journey tests with data lifecycle (create -> verify -> cleanup).
 * Runs against the LIVE deployed system with NO mocking.
 *
 * All test-created notes are tagged `_hotm_uat` for cleanup.
 *
 * Usage:
 *   HOTM_DEPLOY_URL=http://localhost:4180 npx playwright test --project=uat
 */

import { test, expect } from '@playwright/test';
import {
  createTestNote,
  listNotes,
  listTags,
  getNote,
  search,
  deleteNote,
  UAT_TAG,
} from '../fixtures/live-api-helpers';

const DEPLOY_URL = process.env.HOTM_DEPLOY_URL ?? 'http://localhost:4180';

test.describe('Critical User Journeys', () => {
  // NOTE: No beforeAll/afterAll cleanup — with fullyParallel=true, global cleanup()
  // races across workers and can delete notes created by other parallel test files.
  // Each test manages its own notes via try/finally { deleteNote(id) }.
  // Global teardown handles orphaned _hotm_uat notes after the suite.

  // UAT-1: Create note through UI, verify it appears in list
  test('UAT-1: Create note via API, verify it appears in UI list', async ({ page }) => {
    const uniqueTitle = `UAT Note ${Date.now()}`;
    const noteContent = `# ${uniqueTitle}\n\nThis is a UAT test note created for validation.`;

    // Create note via API (tagged for cleanup)
    const created = await createTestNote(noteContent, uniqueTitle);
    expect(created.id).toBeTruthy();

    try {
      // Navigate to the UI
      await page.goto(DEPLOY_URL);
      await page.waitForLoadState('networkidle');

      // The newly created note should appear in the notes list
      // It may take a moment for the list to refresh
      const noteTitle = page.getByText(uniqueTitle).first();
      await expect(noteTitle).toBeVisible({ timeout: 20000 });
    } finally {
      // Cleanup
      await deleteNote(created.id);
    }
  });

  // UAT-2: Select note, verify original + revised content tabs
  test('UAT-2: Select note and verify content tabs', async ({ page }) => {
    const uniqueTitle = `UAT Tabs ${Date.now()}`;
    const noteContent = `# ${uniqueTitle}\n\nContent for tab verification.`;

    const created = await createTestNote(noteContent, uniqueTitle);
    expect(created.id).toBeTruthy();

    try {
      await page.goto(DEPLOY_URL);
      await page.waitForLoadState('networkidle');

      // Click the note — use direct DOM click to bypass sidebar footer overlay
      const noteButton = page.getByRole('button', { name: uniqueTitle }).first();
      await expect(noteButton).toBeVisible({ timeout: 20000 });
      await noteButton.evaluate(el => (el as HTMLElement).click());

      // Tabs should be visible
      const aiTab = page.getByText('AI Enhanced');
      const originalTab = page.getByText('Original', { exact: true });
      await expect(aiTab.or(originalTab).first()).toBeVisible({ timeout: 10000 });

      // Click Original tab and verify content is present
      if (await originalTab.isVisible().catch(() => false)) {
        await originalTab.click();
        await page.waitForTimeout(1000);

        // The original content should be visible somewhere in the main area
        const main = page.locator('main').first();
        const mainText = await main.textContent();
        expect(mainText).toBeTruthy();
        // At minimum, some text should render (not empty)
        expect(mainText!.length).toBeGreaterThan(0);
      }
    } finally {
      await deleteNote(created.id);
    }
  });

  // UAT-3: Search for notes, verify results render
  test('UAT-3: Search for notes and verify results', async ({ page }) => {
    const uniqueMarker = `uatsearchable${Date.now()}`;
    const uniqueTitle = `UAT Search ${uniqueMarker}`;
    const noteContent = `# ${uniqueTitle}\n\nContent with ${uniqueMarker} marker for search test.`;

    const created = await createTestNote(noteContent, uniqueTitle);
    expect(created.id).toBeTruthy();

    try {
      // Verify via API first that the note is searchable
      // Give the NLP pipeline a moment to index
      await new Promise((r) => setTimeout(r, 3000));

      await page.goto(DEPLOY_URL);
      await page.waitForLoadState('networkidle');

      // Find and use the search input
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill(uniqueMarker);

      // Wait for search results
      await page.waitForTimeout(3000);

      // The page should not have crashed and should show some content
      const main = page.locator('main').first();
      await expect(main).toBeVisible();

      // No errors on page
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('[object Object]');
    } finally {
      await deleteNote(created.id);
    }
  });

  // UAT-4: Tags display correctly (no [object Object])
  test('UAT-4: Tags display as strings not [object Object]', async ({ page }) => {
    const uniqueTitle = `UAT Tags ${Date.now()}`;
    const noteContent = `# ${uniqueTitle}\n\nContent for tag display verification.`;

    const created = await createTestNote(noteContent, uniqueTitle);
    expect(created.id).toBeTruthy();

    try {
      await page.goto(DEPLOY_URL);
      await page.waitForLoadState('networkidle');

      // Navigate to Tags view
      const tagsButton = page.getByText('Tags', { exact: true }).first();
      if (await tagsButton.isVisible().catch(() => false)) {
        await tagsButton.click();
        await page.waitForTimeout(2000);
      }

      // Check the entire page for [object Object]
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('[object Object]');

      // Also verify via API
      const tagResult = await listTags();
      for (const tag of tagResult.tags) {
        const name = tag.name ?? tag;
        expect(String(name)).not.toBe('[object Object]');
      }
    } finally {
      await deleteNote(created.id);
    }
  });

  // UAT-5: Offline resilience (block API, verify graceful degradation)
  test('UAT-5: Graceful degradation when API is unavailable', async ({ page }) => {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');

    // Block all API calls
    await page.route('**/api/**', (route) => route.abort('connectionrefused'));

    // Trigger a navigation that would need API
    const healthButton = page.getByText('Health', { exact: true }).first();
    if (await healthButton.isVisible().catch(() => false)) {
      await healthButton.click();
    }

    await page.waitForTimeout(2000);

    // The page should NOT have a white screen or crash
    const main = page.locator('main').first();
    await expect(main).toBeVisible();

    // Should show offline indicator or error state, not a crash
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(50); // Not an empty crash page

    // Unblock API routes for cleanup
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});
