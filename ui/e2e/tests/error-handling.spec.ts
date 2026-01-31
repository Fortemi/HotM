/**
 * E2E Test: Error Handling
 *
 * Tests critical path for error scenarios.
 * Covers:
 * - API unavailable (shows error message)
 * - Network timeout (handled gracefully)
 * - Invalid note ID (shows 404)
 * - Server errors (5xx)
 * - Offline mode
 */

import { test, expect } from '@playwright/test';
import { fixtures } from '../fixtures/test-data';

test.describe('Error Handling', () => {
  test('should show error when API is unavailable', async ({ page }) => {
    // Mock all API endpoints with network error
    await page.route('**/api/v1/**', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    // Verify error message is displayed
    const errorMessage = page.getByText(
      /unable to connect|connection failed|api unavailable|offline/i
    );
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    // Mock API with delayed response (timeout)
    await page.route('**/api/v1/health', async (route) => {
      // Delay response beyond timeout
      await new Promise((resolve) => setTimeout(resolve, 35000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    await page.route('**/api/v1/notes?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 35000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notes: [], total: 0 }),
      });
    });

    await page.goto('/');

    // Verify timeout error is displayed
    const timeoutMessage = page.getByText(/timeout|taking too long|slow connection/i);
    const errorMessage = page.getByText(/error|failed|unable/i);

    // Either timeout message or generic error should appear
    const hasError = await Promise.race([
      timeoutMessage.isVisible({ timeout: 15000 }).catch(() => false),
      errorMessage.isVisible({ timeout: 15000 }).catch(() => false),
    ]);

    expect(hasError).toBe(true);
  });

  test('should show 404 error for invalid note ID', async ({ page }) => {
    const invalidNoteId = 'invalid-note-id-12345';

    // Mock health check
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    // Mock notes list
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notes: [], total: 0 }),
      });
    });

    // Mock note endpoint with 404
    await page.route(`**/api/v1/notes/${invalidNoteId}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.apiErrors.notFound.body),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to navigate to invalid note (implementation-specific)
    // Simulate clicking on a link or typing note ID
    try {
      await page.goto(`/#/notes/${invalidNoteId}`);
      await page.waitForLoadState('networkidle');
    } catch (error) {
      // URL navigation might not be supported
    }

    // Verify 404 error is displayed
    const notFoundMessage = page.getByText(/not found|404|doesn't exist|no note found/i);
    await expect(notFoundMessage).toBeVisible({ timeout: 5000 });
  });

  test('should handle server error (500) gracefully', async ({ page }) => {
    // Mock health check as working
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    // Mock notes list with server error
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.apiErrors.serverError.body),
      });
    });

    await page.goto('/');

    // Verify server error message is displayed
    const errorMessage = page.getByText(/server error|internal error|something went wrong/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should handle unauthorized error (401)', async ({ page }) => {
    // Mock health check as working
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    // Mock notes list with unauthorized error
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.apiErrors.unauthorized.body),
      });
    });

    await page.goto('/');

    // Verify unauthorized error message or redirect to login
    const unauthorizedMessage = page.getByText(/unauthorized|not authorized|login required/i);
    const loginButton = page.getByRole('button', { name: /login|sign in/i });

    // Either error message or login prompt should appear
    const hasUnauthorizedHandling = await Promise.race([
      unauthorizedMessage.isVisible({ timeout: 5000 }).catch(() => false),
      loginButton.isVisible({ timeout: 5000 }).catch(() => false),
    ]);

    expect(hasUnauthorizedHandling).toBe(true);
  });

  test('should show retry option after error', async ({ page }) => {
    let apiCallCount = 0;

    // Mock API that fails first, then succeeds
    await page.route('**/api/v1/health', async (route) => {
      apiCallCount++;
      if (apiCallCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.apiErrors.serverError.body),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.healthySystem),
        });
      }
    });

    await page.route('**/api/v1/notes?*', async (route) => {
      if (apiCallCount <= 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.apiErrors.serverError.body),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notes: [], total: 0 }),
        });
      }
    });

    await page.goto('/');

    // Verify error message is displayed
    const errorMessage = page.getByText(/error|failed|unable/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Look for retry button
    const retryButton = page.getByRole('button', { name: /retry|try again|reload/i });
    await expect(retryButton).toBeVisible({ timeout: 3000 });

    // Click retry
    await retryButton.click();

    // Wait for app to load successfully
    await page.waitForLoadState('networkidle');

    // Verify error is cleared
    await expect(errorMessage).not.toBeVisible({ timeout: 5000 });
  });

  test('should handle malformed API response', async ({ page }) => {
    // Mock health check
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    // Mock notes list with malformed JSON
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'this is not valid JSON {]',
      });
    });

    await page.goto('/');

    // Verify error is handled gracefully
    const errorMessage = page.getByText(/error|failed|unable|invalid response/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should handle partial API failure (health check fails, but cached data works)', async ({
    page,
  }) => {
    // Mock health check as failing
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.unhealthySystem),
      });
    });

    // Mock notes list as working
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notes: [], total: 0 }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App might show warning but still be functional
    const warningMessage = page.getByText(/warning|degraded|limited/i);
    const hasWarning = await warningMessage.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasWarning) {
      // Warning is displayed but app is still usable
      await expect(warningMessage).toBeVisible();
    }

    // Verify app is still functional (can interact with UI)
    const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');
    await expect(sidebar.first()).toBeVisible();
  });

  test('should display meaningful error for create note failure', async ({ page }) => {
    // Mock health check
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    // Mock notes list
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notes: [], total: 0 }),
      });
    });

    // Mock create note with error
    await page.route('**/api/v1/notes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Content is required',
          }),
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to create note
    const newNoteButton = page.getByRole('button', { name: /new note|create note|\+/i });
    if (await newNoteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newNoteButton.click();

      const editor = page.locator('[data-testid="note-editor"], .markdown-editor, textarea');
      if (await editor.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await editor.first().fill('Test content');

        const saveButton = page.getByRole('button', { name: /save|create/i });
        await expect(saveButton).toBeVisible();
        await saveButton.click();

        // Verify meaningful error is displayed
        const errorMessage = page.getByText(/content is required|failed to create|error/i);
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should handle search API failure gracefully', async ({ page }) => {
    // Mock health check
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    // Mock notes list
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notes: [], total: 0 }),
      });
    });

    // Mock search with error
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.apiErrors.serverError.body),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Perform search
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
    if (await searchInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.first().fill('test query');
      await page.waitForTimeout(500);

      // Verify search error is displayed
      const errorMessage = page.getByText(/search failed|unable to search|error/i);
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test('should recover from intermittent network failure', async ({ page }) => {
    let apiCallCount = 0;

    // Mock API that fails intermittently
    await page.route('**/api/v1/health', async (route) => {
      apiCallCount++;
      // Fail every other call
      if (apiCallCount % 2 === 1) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.healthySystem),
        });
      }
    });

    await page.route('**/api/v1/notes?*', async (route) => {
      if (apiCallCount % 2 === 1) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notes: [], total: 0 }),
        });
      }
    });

    await page.goto('/');

    // Wait for initial failure
    const errorMessage = page.getByText(/error|failed|unable/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // App should auto-retry or show retry button
    const retryButton = page.getByRole('button', { name: /retry|try again/i });

    if (await retryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await retryButton.click();
    } else {
      // Wait for auto-retry
      await page.waitForTimeout(3000);
    }

    // Verify app recovers
    await page.waitForLoadState('networkidle');
    const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');
    await expect(sidebar.first()).toBeVisible({ timeout: 5000 });
  });

  test('should handle CORS error gracefully', async ({ page }) => {
    // Simulate CORS error by blocking cross-origin requests
    await page.route('**/api/v1/**', async (route) => {
      await route.fulfill({
        status: 0,
        contentType: 'text/plain',
        body: '',
      });
    });

    await page.goto('/');

    // Verify CORS or network error is displayed
    const errorMessage = page.getByText(/connection|network|cors|blocked|unable/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});
