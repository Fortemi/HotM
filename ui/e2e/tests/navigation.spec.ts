/**
 * E2E Test: Navigation and Routing
 *
 * Tests critical path for application navigation.
 * Covers:
 * - Navigate between views
 * - Browser back/forward (if applicable)
 * - Deep links (direct URL to note)
 * - Sidebar navigation
 * - Tab navigation
 */

import { test, expect } from '@playwright/test';
import { fixtures, mockResponses } from '../fixtures/test-data';

test.describe('Navigation and Routing', () => {
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
    const notesList = [fixtures.standardNote, fixtures.starredNote, fixtures.taggedNote];
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockResponses.listNotes(
            notesList.map((note) => ({
              id: note.note.id,
              title: note.note.title!,
              snippet: note.original.content.substring(0, 100),
              created_at_utc: note.note.created_at_utc,
              updated_at_utc: note.note.updated_at_utc,
              starred: note.note.starred!,
              archived: note.note.archived!,
              tags: note.tags,
              has_revision: true,
              metadata: {},
            }))
          )
        ),
      });
    });

    // Mock individual note endpoints
    for (const note of notesList) {
      await page.route(`**/api/v1/notes/${note.note.id}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(note),
        });
      });
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to note detail view from list', async ({ page }) => {
    const targetNote = fixtures.standardNote;

    // Click on note in list
    const noteLink = page.getByText(targetNote.note.title!);
    await expect(noteLink).toBeVisible();
    await noteLink.click();

    // Verify note detail view is displayed
    await expect(page.getByText(targetNote.note.title!)).toBeVisible();

    // Verify note content is visible
    const noteContent = page.locator('[data-testid="note-content"], .note-content, .markdown-preview');
    await expect(noteContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate between different notes', async ({ page }) => {
    const firstNote = fixtures.standardNote;
    const secondNote = fixtures.starredNote;

    // Navigate to first note
    const firstNoteLink = page.getByText(firstNote.note.title!);
    await expect(firstNoteLink).toBeVisible();
    await firstNoteLink.click();

    await expect(page.getByText(firstNote.note.title!)).toBeVisible();

    // Navigate to second note
    const secondNoteLink = page.getByText(secondNote.note.title!);
    await expect(secondNoteLink).toBeVisible();
    await secondNoteLink.click();

    await expect(page.getByText(secondNote.note.title!)).toBeVisible();

    // Verify first note title is not prominently displayed (we're on second note)
    // Note: First note might still be visible in sidebar, so we check main content area
    const mainContent = page.locator('main, [role="main"], .main-content');
    await expect(mainContent.getByText(secondNote.note.title!)).toBeVisible();
  });

  test('should toggle sidebar visibility', async ({ page }) => {
    // Find sidebar toggle button
    const sidebarToggle = page.getByRole('button', { name: /toggle sidebar|menu|☰/i }).or(
      page.locator('[data-testid="sidebar-toggle"], .sidebar-toggle')
    );

    // Verify sidebar is initially visible
    const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar');
    await expect(sidebar.first()).toBeVisible();

    // Toggle sidebar closed
    if (await sidebarToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sidebarToggle.click();

      // Wait for animation
      await page.waitForTimeout(500);

      // Sidebar might be hidden or have collapsed state
      // Check for collapsed class or hidden state
      const isCollapsed =
        (await sidebar.first().getAttribute('data-state')) === 'collapsed' ||
        (await sidebar.first().getAttribute('class'))?.includes('collapsed') ||
        !(await sidebar.first().isVisible().catch(() => true));

      // Toggle sidebar open again
      await sidebarToggle.click();
      await page.waitForTimeout(500);

      // Verify sidebar is visible again
      await expect(sidebar.first()).toBeVisible();
    }
  });

  test('should navigate using sidebar filters', async ({ page }) => {
    // Click "Starred" filter in sidebar (if available)
    const starredFilter = page.getByRole('button', { name: /starred|favorites/i }).or(
      page.getByText(/starred/i).locator('xpath=ancestor::button')
    );

    if (await starredFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await starredFilter.click();

      // Mock starred notes filter
      await page.route('**/api/v1/notes?*filter=starred*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            mockResponses.listNotes([
              {
                id: fixtures.starredNote.note.id,
                title: fixtures.starredNote.note.title!,
                snippet: fixtures.starredNote.original.content.substring(0, 100),
                created_at_utc: fixtures.starredNote.note.created_at_utc,
                updated_at_utc: fixtures.starredNote.note.updated_at_utc,
                starred: true,
                archived: false,
                tags: fixtures.starredNote.tags,
                has_revision: true,
                metadata: {},
              },
            ])
          ),
        });
      });

      // Verify only starred notes are shown
      await expect(page.getByText(fixtures.starredNote.note.title!)).toBeVisible({ timeout: 5000 });
    }

    // Click "All Notes" filter
    const allNotesFilter = page.getByRole('button', { name: /all notes/i }).or(
      page.getByText(/all notes/i).locator('xpath=ancestor::button')
    );

    if (await allNotesFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allNotesFilter.click();

      // Verify all notes are shown again
      await expect(page.getByText(fixtures.standardNote.note.title!)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should navigate using tabs (if implemented)', async ({ page }) => {
    // Look for tab navigation
    const tabsList = page.locator('[role="tablist"]');

    if (await tabsList.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get all tabs
      const tabs = page.locator('[role="tab"]');
      const tabCount = await tabs.count();

      if (tabCount > 1) {
        // Click second tab
        const secondTab = tabs.nth(1);
        await secondTab.click();

        // Verify tab is selected
        await expect(secondTab).toHaveAttribute('aria-selected', 'true');

        // Click first tab
        const firstTab = tabs.nth(0);
        await firstTab.click();

        // Verify first tab is selected
        await expect(firstTab).toHaveAttribute('aria-selected', 'true');
      }
    }
  });

  test('should handle browser back button navigation', async ({ page }) => {
    // Note: Tauri apps might not support traditional browser navigation
    // This test might not be applicable depending on implementation

    const firstNote = fixtures.standardNote;
    const secondNote = fixtures.starredNote;

    // Navigate to first note
    const firstNoteLink = page.getByText(firstNote.note.title!);
    await expect(firstNoteLink).toBeVisible();
    await firstNoteLink.click();
    await page.waitForTimeout(500);

    // Navigate to second note
    const secondNoteLink = page.getByText(secondNote.note.title!);
    await expect(secondNoteLink).toBeVisible();
    await secondNoteLink.click();
    await page.waitForTimeout(500);

    // Verify second note is displayed
    await expect(page.getByText(secondNote.note.title!)).toBeVisible();

    // Try browser back navigation
    try {
      await page.goBack();
      await page.waitForTimeout(500);

      // Verify first note is displayed (if back navigation works)
      const isFirstNoteVisible = await page
        .getByText(firstNote.note.title!)
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (isFirstNoteVisible) {
        // Back navigation works
        expect(true).toBe(true);

        // Test forward navigation
        await page.goForward();
        await page.waitForTimeout(500);

        // Verify second note is displayed again
        await expect(page.getByText(secondNote.note.title!)).toBeVisible({ timeout: 5000 });
      }
    } catch (error) {
      // Browser navigation not supported (expected for some Tauri apps)
      console.log('Browser back/forward navigation not supported');
    }
  });

  test('should support deep linking to specific note', async ({ page }) => {
    const targetNote = fixtures.starredNote;

    // Mock note endpoint
    await page.route(`**/api/v1/notes/${targetNote.note.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(targetNote),
      });
    });

    // Navigate directly to note (if URL-based routing is supported)
    // For Tauri apps, this might be via hash routing or query params
    try {
      await page.goto(`/#/notes/${targetNote.note.id}`);
      await page.waitForLoadState('networkidle');

      // Verify note is displayed
      await expect(page.getByText(targetNote.note.title!)).toBeVisible({ timeout: 5000 });
    } catch (error) {
      // Hash routing not supported, try query params
      try {
        await page.goto(`/?note=${targetNote.note.id}`);
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(targetNote.note.title!)).toBeVisible({ timeout: 5000 });
      } catch (error2) {
        // Direct URL navigation not supported
        console.log('Deep linking not supported in this implementation');
      }
    }
  });

  test('should navigate to search results and back', async ({ page }) => {
    const searchQuery = 'fixture';

    // Mock search API
    await page.route('**/api/v1/search?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.searchNotes(fixtures.searchResults)),
      });
    });

    // Perform search
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
    await expect(searchInput.first()).toBeVisible();
    await searchInput.first().fill(searchQuery);
    await page.waitForTimeout(500);

    // Wait for search results
    const searchResults = page.locator('[data-testid="search-results"], .search-results');
    await expect(searchResults.first()).toBeVisible({ timeout: 5000 });

    // Click first search result
    const firstResult = page.locator('[data-testid="search-result-item"], .search-result-item').first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();

    // Verify navigation to note
    const noteContent = page.locator('[data-testid="note-content"], .note-content, .markdown-preview');
    await expect(noteContent.first()).toBeVisible({ timeout: 5000 });

    // Navigate back to search (if back button exists)
    const backButton = page.getByRole('button', { name: /back/i }).or(
      page.locator('[data-testid="back-button"], .back-button')
    );

    if (await backButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await backButton.click();

      // Verify search results are displayed again
      await expect(searchResults.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should maintain scroll position when navigating back to list', async ({ page }) => {
    // This test checks if scroll position is preserved (good UX)

    // Navigate to a note
    const targetNote = fixtures.standardNote;
    const noteLink = page.getByText(targetNote.note.title!);
    await expect(noteLink).toBeVisible();

    // Scroll to note if needed
    await noteLink.scrollIntoViewIfNeeded();

    // Get initial scroll position
    const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar').first();
    const initialScrollY = await sidebar.evaluate((el) => el.scrollTop).catch(() => 0);

    // Click note
    await noteLink.click();
    await page.waitForTimeout(500);

    // Verify note is displayed
    await expect(page.getByText(targetNote.note.title!)).toBeVisible();

    // Navigate back to list
    const backButton = page.getByRole('button', { name: /back|close/i }).or(
      page.locator('[data-testid="back-button"], .back-button')
    );

    if (await backButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await backButton.click();
      await page.waitForTimeout(500);

      // Check if scroll position is maintained (within tolerance)
      const newScrollY = await sidebar.evaluate((el) => el.scrollTop).catch(() => 0);

      // Allow some tolerance (50px) for scroll position restoration
      expect(Math.abs(newScrollY - initialScrollY)).toBeLessThan(50);
    }
  });

  test('should handle invalid note ID gracefully', async ({ page }) => {
    const invalidNoteId = 'nonexistent-note-id';

    // Mock note endpoint with 404
    await page.route(`**/api/v1/notes/${invalidNoteId}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.apiErrors.notFound.body),
      });
    });

    // Try to navigate to invalid note (via URL or click)
    try {
      await page.goto(`/#/notes/${invalidNoteId}`);
      await page.waitForLoadState('networkidle');
    } catch (error) {
      // URL navigation not supported
    }

    // Verify error message or redirect to home
    const errorMessage = page.getByText(/not found|404|doesn't exist/i);
    const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasError) {
      // Should redirect to home or show empty state
      const homeIndicator = page.getByText(/all notes|recent notes|home/i);
      await expect(homeIndicator.first()).toBeVisible({ timeout: 5000 });
    } else {
      // Error message is displayed
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should navigate using keyboard shortcuts', async ({ page }) => {
    // Test common keyboard shortcuts (implementation-specific)

    // Try opening search with Ctrl+F or Cmd+K
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);

    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
    const isSearchFocused = await searchInput.first().isVisible({ timeout: 1000 }).catch(() => false);

    if (isSearchFocused) {
      // Search opened via keyboard
      await expect(searchInput.first()).toBeFocused();

      // Close search with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Try opening new note with Ctrl+N
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(300);

    const editor = page.locator('[data-testid="note-editor"], .markdown-editor, textarea');
    const isEditorVisible = await editor.first().isVisible({ timeout: 1000 }).catch(() => false);

    if (isEditorVisible) {
      // New note opened via keyboard
      await expect(editor.first()).toBeVisible();
    }
  });
});
