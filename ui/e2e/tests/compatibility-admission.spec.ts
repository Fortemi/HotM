import { expect, test } from '@playwright/test';

test.describe('Runtime compatibility admission', () => {
  test('blocks a remote mutation before dispatch while local navigation remains usable', async ({ page }) => {
    let noteMutationCount = 0;

    await page.route('**/api/v1/system/compatibility', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 1,
          contract_revision: '2026-07-06',
          api: {
            name: 'fortemi',
            version: '2027.0.0',
            minimum_hotm_enterprise_client: '0.0.0-checkpoint',
          },
          auth: { required: false, mode: 'anonymous_local' },
          capabilities: {},
        }),
      });
    });
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'healthy', database: 'connected' }),
      });
    });
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notes: [], total: 0 }),
      });
    });
    await page.route('**/api/v1/notes', async (route) => {
      if (route.request().method() === 'POST') noteMutationCount += 1;
      await route.fulfill({ status: 500, body: 'mutation must not be dispatched' });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const quickNote = page.getByRole('button', { name: 'Quick Note' });
    await expect(quickNote).toBeVisible();
    await quickNote.click();

    const editor = page.getByPlaceholder(/Quick note/);
    await expect(editor).toBeVisible();
    await editor.fill('Local draft remains editable');

    await page.getByRole('button', { name: /save|create/i }).click();
    await page.waitForTimeout(250);
    expect(noteMutationCount).toBe(0);

    const sidebarToggle = page.getByRole('button', { name: /toggle sidebar/i });
    await expect(sidebarToggle).toBeEnabled();
    await sidebarToggle.click();
    await expect(page.locator('main')).toBeVisible();
    await expect(editor).toHaveValue('Local draft remains editable');
  });
});
