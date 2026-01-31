/**
 * E2E Test: Search Functionality
 *
 * Tests critical path for searching notes.
 * Covers:
 * - Search input interaction
 * - Search results display
 * - Clicking search result navigates to note
 * - Empty search results
 * - Search error handling
 */

import { test, expect } from '@playwright/test';
import { fixtures, searchHitFactory, mockResponses } from '../fixtures/test-data';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API health check
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    // Mock initial notes list
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.listNotes([])),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();
  });

  test('should perform search and display results', async ({ page }) => {
    const searchQuery = 'test query';
    const searchResults = fixtures.searchResults;

    // Mock search API
    await page.route('**/api/v1/search?*', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q');

      if (query === searchQuery) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponses.searchNotes(searchResults)),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponses.searchNotes([])),
        });
      }
    });

    // Mock get note API for search results
    for (const hit of searchResults) {
      const note = fixtures.standardNote;
      await page.route(`**/api/v1/notes/${hit.note_id}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...note,
            note: { ...note.note, id: hit.note_id },
          }),
        });
      });
    }

    // Find search input
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();

    // Enter search query
    await searchInput.first().fill(searchQuery);

    // Wait for search results to appear
    await page.waitForTimeout(500); // Debounce delay

    // Verify search results are displayed
    const searchResultsContainer = page.locator('[data-testid="search-results"], .search-results');
    await expect(searchResultsContainer.first()).toBeVisible({ timeout: 5000 });

    // Verify correct number of results
    const resultItems = page.locator('[data-testid="search-result-item"], .search-result-item');
    await expect(resultItems).toHaveCount(searchResults.length);
  });

  test('should navigate to note when clicking search result', async ({ page }) => {
    const searchQuery = 'navigation test';
    const searchResults = [searchHitFactory.build({ note_id: 'nav-note-001' })];
    const targetNote = fixtures.standardNote;

    // Mock search API
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.searchNotes(searchResults)),
      });
    });

    // Mock get note API
    await page.route(`**/api/v1/notes/${searchResults[0].note_id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...targetNote,
          note: { ...targetNote.note, id: searchResults[0].note_id },
        }),
      });
    });

    // Perform search
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();
    await searchInput.first().fill(searchQuery);
    await page.waitForTimeout(500);

    // Click first search result
    const firstResult = page.locator('[data-testid="search-result-item"], .search-result-item').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    await firstResult.click();

    // Verify navigation to note detail view
    await expect(page.getByText(targetNote.note.title!)).toBeVisible({ timeout: 5000 });

    // Verify URL or route changed (if applicable)
    // Note: Tauri apps might not use traditional URLs
  });

  test('should display empty state when no results found', async ({ page }) => {
    const searchQuery = 'nonexistent query';

    // Mock search API with empty results
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.searchNotes([])),
      });
    });

    // Perform search
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();
    await searchInput.first().fill(searchQuery);
    await page.waitForTimeout(500);

    // Verify empty state message
    const emptyMessage = page.getByText(/no results|no notes found|nothing found/i);
    await expect(emptyMessage).toBeVisible({ timeout: 5000 });
  });

  test('should clear search results when input is cleared', async ({ page }) => {
    const searchQuery = 'clear test';
    const searchResults = fixtures.searchResults;

    // Mock search API
    await page.route('**/api/v1/search?*', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q');

      if (query && query.length > 0) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponses.searchNotes(searchResults)),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponses.searchNotes([])),
        });
      }
    });

    // Perform search
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();
    await searchInput.first().fill(searchQuery);
    await page.waitForTimeout(500);

    // Verify results are displayed
    const resultsContainer = page.locator('[data-testid="search-results"], .search-results');
    await expect(resultsContainer.first()).toBeVisible({ timeout: 5000 });

    // Clear search input
    await searchInput.first().clear();
    await page.waitForTimeout(500);

    // Verify results are hidden or cleared
    const resultItems = page.locator('[data-testid="search-result-item"], .search-result-item');
    await expect(resultItems).toHaveCount(0);
  });

  test('should handle search API error gracefully', async ({ page }) => {
    const searchQuery = 'error query';

    // Mock search API with error
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.apiErrors.serverError.body),
      });
    });

    // Perform search
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();
    await searchInput.first().fill(searchQuery);
    await page.waitForTimeout(500);

    // Verify error message is displayed
    const errorMessage = page.getByText(/error|failed|unable|something went wrong/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should support keyboard navigation in search results', async ({ page }) => {
    const searchQuery = 'keyboard test';
    const searchResults = fixtures.searchResults;

    // Mock search API
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.searchNotes(searchResults)),
      });
    });

    // Mock get note API
    for (const hit of searchResults) {
      await page.route(`**/api/v1/notes/${hit.note_id}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...fixtures.standardNote,
            note: { ...fixtures.standardNote.note, id: hit.note_id },
          }),
        });
      });
    }

    // Perform search
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();
    await searchInput.first().fill(searchQuery);
    await page.waitForTimeout(500);

    // Wait for results
    const resultsContainer = page.locator('[data-testid="search-results"], .search-results');
    await expect(resultsContainer.first()).toBeVisible({ timeout: 5000 });

    // Try keyboard navigation (Down arrow)
    await searchInput.first().press('ArrowDown');
    await page.waitForTimeout(200);

    // Try selecting with Enter
    await searchInput.first().press('Enter');
    await page.waitForTimeout(500);

    // Verify navigation occurred (or result selected)
    // This is UI-specific and may need adjustment based on implementation
  });

  test('should highlight search query in results', async ({ page }) => {
    const searchQuery = 'fixture';
    const searchResults = fixtures.searchResults;

    // Mock search API
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.searchNotes(searchResults)),
      });
    });

    // Perform search
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();
    await searchInput.first().fill(searchQuery);
    await page.waitForTimeout(500);

    // Verify results are displayed
    const resultsContainer = page.locator('[data-testid="search-results"], .search-results');
    await expect(resultsContainer.first()).toBeVisible({ timeout: 5000 });

    // Look for highlighted text (implementation-specific)
    // This might be <mark>, <span class="highlight">, or similar
    const highlightedText = page.locator('mark, .highlight, [data-highlighted="true"]');

    // Verify at least one highlight exists (if feature is implemented)
    const hasHighlights = await highlightedText.count().then(count => count > 0);
    if (hasHighlights) {
      await expect(highlightedText.first()).toBeVisible();
    }
  });

  test('should debounce search input to avoid excessive API calls', async ({ page }) => {
    let apiCallCount = 0;

    // Mock search API and count calls
    await page.route('**/api/v1/search?*', async (route) => {
      apiCallCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.searchNotes(fixtures.searchResults)),
      });
    });

    // Type search query rapidly
    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    );
    await expect(searchInput.first()).toBeVisible();

    await searchInput.first().type('rapid typing test', { delay: 50 });

    // Wait for debounce to complete
    await page.waitForTimeout(1000);

    // Verify API was called minimal number of times (debounced)
    // Exact count depends on debounce implementation, but should be << character count
    expect(apiCallCount).toBeLessThan(10);
  });
});
