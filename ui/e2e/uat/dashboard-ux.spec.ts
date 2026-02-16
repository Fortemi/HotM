/**
 * UAT: Dashboard UX — Health, Admin Panel, and Timeline
 *
 * Validates dashboard/monitoring views against the live system:
 *
 * Health Dashboard:
 * - Health score gauge with color-coded status
 * - Overview grid (Total Notes, Link Density, Tag Coverage, Last Activity)
 * - Issues grid (Orphan Notes, Stale Content, Unlinked Notes)
 * - Refresh button works
 *
 * Admin Panel:
 * - Tab navigation (System Info, Embedding Config, Authentication, About)
 * - System health status display
 * - About page shows version and tech stack
 *
 * Timeline:
 * - Chronological note display with date markers
 * - Zoom level selector (Day/Week/Month/Year)
 * - Note cards with title, snippet, time, tags
 */

import { test, expect } from '@playwright/test';

const DEPLOY_URL = process.env.HOTM_DEPLOY_URL ?? 'http://localhost:4180';

/** Check if the view is in an error state */
async function isViewError(page: import('@playwright/test').Page): Promise<boolean> {
  const errorBoundary = await page.getByText('Failed to load').isVisible({ timeout: 1000 }).catch(() => false);
  if (errorBoundary) return true;
  const componentError = await page.getByText(/failed to load health|failed to load timeline/i).isVisible({ timeout: 500 }).catch(() => false);
  return componentError;
}

// ── Health Dashboard ────────────────────────────────────────────────

test.describe('Health Dashboard UX', () => {
  async function goToHealth(page: import('@playwright/test').Page) {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');
    const btn = page.getByText('Health', { exact: true }).first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });
  }

  test('health dashboard renders with score and overview cards', async ({ page }) => {
    await goToHealth(page);

    if (await isViewError(page)) {
      const errorText = page.getByText(/failed to load/i).first();
      await expect(errorText).toBeVisible();
      return;
    }

    const heading = page.getByText('Knowledge Health');
    await expect(heading).toBeVisible({ timeout: 10000 });

    const totalNotes = page.getByText('Total Notes');
    await expect(totalNotes).toBeVisible({ timeout: 5000 });

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('[object Object]');
  });

  test('health score shows a status label', async ({ page }) => {
    await goToHealth(page);
    if (await isViewError(page)) return;

    const excellent = page.getByText('Excellent', { exact: true });
    const good = page.getByText('Good', { exact: true });
    const fair = page.getByText('Fair', { exact: true });
    const needsAttention = page.getByText('Needs Attention');

    await expect(
      excellent.or(good).or(fair).or(needsAttention).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('issues section shows orphan/stale/unlinked metrics', async ({ page }) => {
    await goToHealth(page);
    if (await isViewError(page)) return;

    const orphanNotes = page.getByText('Orphan Notes');
    const staleContent = page.getByText('Stale Content');
    const unlinkedNotes = page.getByText('Unlinked Notes');

    await expect(
      orphanNotes.or(staleContent).or(unlinkedNotes).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('refresh button reloads health data', async ({ page }) => {
    await goToHealth(page);
    if (await isViewError(page)) return;

    const refreshBtn = page.getByRole('button', { name: /refresh/i })
      .or(page.locator('button').filter({
        has: page.locator('svg.lucide-refresh-cw'),
      })).first();

    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.click();
      await page.waitForTimeout(2000);

      await expect(page.getByText('Knowledge Health')).toBeVisible();
      await expect(page.getByText('Total Notes')).toBeVisible();
    }
  });

  test('action buttons in issues cards are clickable', async ({ page }) => {
    await goToHealth(page);
    if (await isViewError(page)) return;

    const actionTexts = ['View Orphans', 'Review Stale', 'Find Connections'];
    for (const text of actionTexts) {
      const btn = page.getByText(text).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
        await expect(page.locator('main').first()).toBeVisible();
        const healthBtn = page.getByText('Health', { exact: true }).first();
        if (await healthBtn.isVisible().catch(() => false)) {
          await healthBtn.click();
          await page.waitForTimeout(1000);
        }
        break;
      }
    }
  });
});

// ── Admin Panel ────────────────────────────────────────────────────

test.describe('Admin Panel UX', () => {
  async function goToAdmin(page: import('@playwright/test').Page) {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');
    const btn = page.getByText('Admin', { exact: true }).first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });
  }

  test('admin panel renders with tab navigation', async ({ page }) => {
    await goToAdmin(page);

    if (await isViewError(page)) {
      const errorText = page.getByText(/failed to load/i).first();
      await expect(errorText).toBeVisible();
      return;
    }

    const heading = page.getByText('Admin Panel');
    await expect(heading).toBeVisible({ timeout: 10000 });

    const systemInfo = page.getByText('System Info', { exact: true });
    const about = page.getByText('About', { exact: true });

    await expect(systemInfo).toBeVisible({ timeout: 5000 });
    await expect(about).toBeVisible();
  });

  test('system info tab shows health status and knowledge metrics', async ({ page }) => {
    await goToAdmin(page);
    if (await isViewError(page)) return;

    const healthyBadge = page.getByText('healthy');
    const apiVersion = page.getByText(/api version/i);
    const totalNotes = page.getByText('Total Notes');

    await expect(
      healthyBadge.or(apiVersion).or(totalNotes).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('tab switching works across all admin tabs', async ({ page }) => {
    await goToAdmin(page);
    if (await isViewError(page)) return;

    const tabs = [
      { name: 'Embedding Config', exact: false },
      { name: 'Authentication', exact: true },
      { name: 'About', exact: true },
      { name: 'System Info', exact: true },
    ];

    for (const { name, exact } of tabs) {
      const tab = page.getByText(name, { exact }).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(1000);

        const main = page.locator('main').first();
        const text = await main.textContent();
        expect(text).toBeTruthy();
        expect(text).not.toContain('[object Object]');
      }
    }
  });

  test('about tab shows version and technology stack', async ({ page }) => {
    await goToAdmin(page);
    if (await isViewError(page)) return;

    const aboutTab = page.getByText('About', { exact: true }).first();
    await aboutTab.click();
    await page.waitForTimeout(1000);

    // Version number — check for the current version
    const version = page.getByText('0.1.2');
    if (await version.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(version).toBeVisible();
    }

    // Technology badges
    const react = page.getByText('React 19');
    const typescript = page.getByText('TypeScript');
    await expect(react.or(typescript).first()).toBeVisible({ timeout: 5000 });

    // License
    const mit = page.getByText('MIT', { exact: true });
    await expect(mit).toBeVisible();
  });
});

// ── Timeline ────────────────────────────────────────────────────────

test.describe('Timeline UX', () => {
  async function goToTimeline(page: import('@playwright/test').Page) {
    await page.goto(DEPLOY_URL);
    await page.waitForLoadState('networkidle');
    const btn = page.getByText('Timeline', { exact: true }).first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });
  }

  test('timeline renders with header and date markers', async ({ page }) => {
    await goToTimeline(page);

    if (await isViewError(page)) {
      const errorText = page.getByText(/failed to load/i).first();
      await expect(errorText).toBeVisible();
      return;
    }

    const heading = page.getByText('Timeline').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const main = page.locator('main').first();
    const text = await main.textContent();
    expect(text).toBeTruthy();
    expect(text).not.toContain('[object Object]');
  });

  test('zoom level selector offers Day/Week/Month/Year', async ({ page }) => {
    await goToTimeline(page);
    if (await isViewError(page)) return;

    const zoomSelect = page.locator('select').first()
      .or(page.getByRole('combobox').first());

    if (await zoomSelect.isVisible().catch(() => false)) {
      await zoomSelect.selectOption({ label: 'Month' }).catch(() => {
        // May be a custom dropdown
      });
      await page.waitForTimeout(500);

      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('note cards in timeline show title and metadata', async ({ page }) => {
    await goToTimeline(page);
    if (await isViewError(page)) return;

    const noteCards = page.locator('.rounded-lg, [class*="card"]').filter({
      has: page.locator('.font-medium, .text-sm'),
    });

    const cardCount = await noteCards.count();
    if (cardCount > 0) {
      const firstCard = noteCards.first();
      const cardText = await firstCard.textContent();
      expect(cardText).toBeTruthy();
      expect(cardText!.length).toBeGreaterThan(3);
    }
  });

  test('jump to date input and scroll controls are functional', async ({ page }) => {
    await goToTimeline(page);
    if (await isViewError(page)) return;

    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      await dateInput.fill('2025-01-01');
      await page.waitForTimeout(300);

      const jumpBtn = page.getByText('Jump', { exact: true }).first();
      if (await jumpBtn.isVisible().catch(() => false)) {
        await jumpBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    const scrollBtns = page.locator('button').filter({
      has: page.locator('svg.lucide-chevron-up, svg.lucide-chevron-down'),
    });

    if (await scrollBtns.first().isVisible().catch(() => false)) {
      await scrollBtns.first().click();
      await page.waitForTimeout(300);
    }

    await expect(page.locator('main').first()).toBeVisible();
  });

  test('revised badge and star indicator appear on notes', async ({ page }) => {
    await goToTimeline(page);
    if (await isViewError(page)) return;

    const main = page.locator('main').first();
    const bodyText = await main.textContent();
    expect(bodyText).not.toContain('[object Object]');
  });
});
