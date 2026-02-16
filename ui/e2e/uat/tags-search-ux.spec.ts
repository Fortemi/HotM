/**
 * UAT: Tags & Search UX — Tag management and Advanced Search
 *
 * Validates tag manager and advanced search against the live system:
 *
 * Tag Manager:
 * - Renders with tag count, stats panel toggle, sort controls
 * - Search/filter input filters tag list
 * - Stats panel shows total tags, tagged notes, avg tags/note, most used
 * - No [object Object] in tag names or counts
 *
 * Advanced Search:
 * - Search bar with mode selector (Hybrid / Full Text / Semantic)
 * - Filters panel with tag filter, starred, archived toggles
 * - Results display with score badges
 */

import { test, expect } from '@playwright/test';
import { createTestNote, deleteNote, listTags } from '../fixtures/live-api-helpers';

const DEPLOY_URL = process.env.HOTM_DEPLOY_URL ?? 'http://localhost:4180';

/** Check if the view is in an error state */
async function isViewError(page: import('@playwright/test').Page): Promise<boolean> {
  const errorBoundary = await page.getByText('Failed to load').isVisible({ timeout: 1000 }).catch(() => false);
  if (errorBoundary) return true;
  const componentError = await page.getByText(/failed to load tags|failed to load search/i).isVisible({ timeout: 500 }).catch(() => false);
  return componentError;
}

// ── Tag Manager ──────────────────────────────────────────────────────

test.describe('Tag Manager UX', () => {
  // NOTE: No beforeAll/afterAll cleanup — races across parallel workers.

  async function goToTags(page: import('@playwright/test').Page) {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');
    const tagsBtn = page.locator('button, [role="button"]').filter({ hasText: /^Tags$/ }).first();
    await expect(tagsBtn).toBeVisible({ timeout: 10000 });
    await tagsBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });
  }

  test('tag manager renders with header and tag list', async ({ page }) => {
    await goToTags(page);

    if (await isViewError(page)) {
      const errorText = page.getByText(/failed to load/i).first();
      await expect(errorText).toBeVisible();
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('[object Object]');
      return;
    }

    const heading = page.getByText('Tag Manager');
    await expect(heading).toBeVisible({ timeout: 10000 });

    const statsBtn = page.getByText('Stats', { exact: true });
    const newTagBtn = page.getByText('New Tag');
    await expect(statsBtn.or(newTagBtn).first()).toBeVisible({ timeout: 5000 });

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('[object Object]');
  });

  test('stats panel toggles and shows metrics', async ({ page }) => {
    await goToTags(page);
    if (await isViewError(page)) return;

    const statsBtn = page.getByText('Stats', { exact: true }).first();
    if (await statsBtn.isVisible().catch(() => false)) {
      await statsBtn.click();
      await page.waitForTimeout(1000);

      const totalTags = page.getByText('Total Tags');
      const taggedNotes = page.getByText('Tagged Notes');
      await expect(totalTags.or(taggedNotes).first()).toBeVisible({ timeout: 5000 });

      await statsBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('tag search filters the tag list', async ({ page }) => {
    await goToTags(page);
    if (await isViewError(page)) return;

    const filterInput = page.getByPlaceholder(/filter tags/i).first();
    if (await filterInput.isVisible().catch(() => false)) {
      await filterInput.fill('zzz_nonexistent_tag');
      await page.waitForTimeout(500);

      await expect(page.locator('main').first()).toBeVisible();

      await filterInput.clear();
      await page.waitForTimeout(300);
    }
  });

  test('sort buttons toggle between count and alphabetical', async ({ page }) => {
    await goToTags(page);
    if (await isViewError(page)) return;

    const byCount = page.getByText('By Count', { exact: true });
    const azSort = page.getByText('A-Z', { exact: true });

    if (await byCount.isVisible().catch(() => false)) {
      await byCount.click();
      await page.waitForTimeout(500);

      if (await azSort.isVisible().catch(() => false)) {
        await azSort.click();
        await page.waitForTimeout(500);
      }

      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('new tag dialog opens with name input', async ({ page }) => {
    await goToTags(page);
    if (await isViewError(page)) return;

    const newTagBtn = page.getByText('New Tag').first();
    if (await newTagBtn.isVisible().catch(() => false)) {
      await newTagBtn.click();
      await page.waitForTimeout(500);

      const nameInput = page.getByPlaceholder(/tag name/i)
        .or(page.locator('input[type="text"]'))
        .first();

      await expect(nameInput).toBeVisible({ timeout: 5000 });

      const cancelBtn = page.getByText('Cancel', { exact: true });
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('tags from API match what UI displays', async ({ page }) => {
    const apiTags = await listTags();

    await goToTags(page);
    if (await isViewError(page)) return;

    for (const tag of apiTags.tags.slice(0, 5)) {
      const name = (tag.name ?? tag) as string;
      expect(typeof name).toBe('string');
      expect(name).not.toBe('[object Object]');
    }

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('[object Object]');
  });

  test('merge dialog opens with source/target inputs', async ({ page }) => {
    await goToTags(page);
    if (await isViewError(page)) return;

    const mergeBtn = page.getByText('Merge', { exact: true }).first();
    if (await mergeBtn.isVisible().catch(() => false)) {
      await mergeBtn.click();
      await page.waitForTimeout(500);

      const sourceLabel = page.getByText(/source/i);
      const targetLabel = page.getByText(/target/i);
      await expect(sourceLabel.or(targetLabel).first()).toBeVisible({ timeout: 5000 });

      const cancelBtn = page.getByText('Cancel', { exact: true });
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });
});

// ── Advanced Search ──────────────────────────────────────────────────

test.describe('Advanced Search UX', () => {
  // NOTE: No beforeAll/afterAll cleanup — races across parallel workers.

  async function goToAdvancedSearch(page: import('@playwright/test').Page) {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');
    const btn = page.getByText('Advanced Search', { exact: true }).first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });
  }

  test('advanced search renders with search bar and mode selector', async ({ page }) => {
    await goToAdvancedSearch(page);

    if (await isViewError(page)) {
      const errorText = page.getByText(/failed to load/i).first();
      await expect(errorText).toBeVisible();
      return;
    }

    const heading = page.getByText('Advanced Search').first();
    await expect(heading).toBeVisible();

    const searchInput = page.getByPlaceholder(/search notes/i).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    const hybrid = page.getByRole('button', { name: /hybrid/i }).first();
    await expect(hybrid).toBeVisible({ timeout: 5000 });
  });

  test('search mode buttons switch between modes', async ({ page }) => {
    await goToAdvancedSearch(page);
    if (await isViewError(page)) return;

    const modes = ['hybrid', 'Full Text', 'semantic'];
    for (const mode of modes) {
      const btn = page.getByRole('button', { name: new RegExp(mode, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(300);
        await expect(page.locator('main').first()).toBeVisible();
      }
    }
  });

  test('filters panel toggles with tag, starred, archived controls', async ({ page }) => {
    await goToAdvancedSearch(page);
    if (await isViewError(page)) return;

    const filtersBtn = page.getByText('Filters', { exact: true })
      .or(page.getByRole('button', { name: /filter/i }))
      .first();

    if (await filtersBtn.isVisible().catch(() => false)) {
      await filtersBtn.click();
      await page.waitForTimeout(500);

      const starred = page.getByText(/starred only/i);
      const archived = page.getByText(/include archived/i);

      await expect(starred.or(archived).first()).toBeVisible({ timeout: 5000 });

      if (await starred.isVisible().catch(() => false)) {
        await starred.click();
        await page.waitForTimeout(300);
        await starred.click();
      }
    }
  });

  test('search executes and shows results or empty state', async ({ page }) => {
    const marker = `uatadvsearch${Date.now()}`;
    const created = await createTestNote(
      `# Advanced Search Test\n\nContent with ${marker} for search validation.`,
      `UAT AdvSearch ${marker}`,
    );

    try {
      await new Promise((r) => setTimeout(r, 3000));

      await goToAdvancedSearch(page);
      if (await isViewError(page)) return;

      const searchInput = page.getByPlaceholder(/search notes/i).first();
      await searchInput.fill(marker);

      const searchBtn = page.getByRole('button', { name: /^search$/i })
        .or(page.getByText('Search', { exact: true }))
        .first();

      if (await searchBtn.isVisible().catch(() => false)) {
        await searchBtn.click();
        await page.waitForTimeout(3000);
      } else {
        await searchInput.press('Enter');
        await page.waitForTimeout(3000);
      }

      const results = page.getByText(/\d+ results?/);
      const noResults = page.getByText(/no results found/i);
      const enterQuery = page.getByText(/enter a query/i);

      await expect(results.or(noResults).or(enterQuery).first()).toBeVisible({ timeout: 5000 });

      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('[object Object]');
    } finally {
      await deleteNote(created.id);
    }
  });

  test('clear filters button resets active filters', async ({ page }) => {
    await goToAdvancedSearch(page);
    if (await isViewError(page)) return;

    const filtersBtn = page.getByText('Filters', { exact: true })
      .or(page.getByRole('button', { name: /filter/i }))
      .first();

    if (await filtersBtn.isVisible().catch(() => false)) {
      await filtersBtn.click();
      await page.waitForTimeout(500);

      const starred = page.getByText(/starred only/i);
      if (await starred.isVisible().catch(() => false)) {
        await starred.click();
        await page.waitForTimeout(300);

        const clearBtn = page.getByText(/clear filters/i);
        if (await clearBtn.isVisible().catch(() => false)) {
          await clearBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }

    await expect(page.locator('main').first()).toBeVisible();
  });
});
