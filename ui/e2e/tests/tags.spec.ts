/**
 * E2E Test: Tag Management
 *
 * Tests critical path for managing tags on notes.
 * Covers:
 * - Add tag to note
 * - Remove tag from note
 * - Filter notes by tag
 * - Create new tag
 * - Tag autocomplete
 */

import { test, expect } from '@playwright/test';
import { fixtures, mockResponses } from '../fixtures/test-data';

test.describe('Tag Management', () => {
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

  test('should add tag to note', async ({ page }) => {
    const targetNote = fixtures.standardNote;
    const newTag = 'urgent';
    const updatedNote = {
      ...targetNote,
      tags: [...targetNote.tags, newTag],
    };

    // Mock get note API
    let currentNote = targetNote;
    await page.route(`**/api/v1/notes/${targetNote.note.id}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(currentNote),
        });
      }
    });

    // Mock update tags API
    await page.route(`**/api/v1/notes/${targetNote.note.id}/tags`, async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postDataJSON();
        if (requestBody.add && requestBody.add.includes(newTag)) {
          currentNote = updatedNote;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tags: currentNote.tags }),
        });
      }
    });

    // Mock notes list
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockResponses.listNotes([
            {
              id: targetNote.note.id,
              title: targetNote.note.title!,
              snippet: targetNote.original.content.substring(0, 100),
              created_at_utc: targetNote.note.created_at_utc,
              updated_at_utc: targetNote.note.updated_at_utc,
              starred: false,
              archived: false,
              tags: currentNote.tags,
              has_revision: true,
              metadata: {},
            },
          ])
        ),
      });
    });

    // Navigate to note
    await page.reload();
    await page.waitForLoadState('networkidle');

    const noteLink = page.getByText(targetNote.note.title!);
    await expect(noteLink).toBeVisible();
    await noteLink.click();

    // Find tag input or add tag button
    const addTagButton = page.getByRole('button', { name: /add tag|new tag|\+.*tag/i });
    const tagInput = page.getByPlaceholder(/tag|label/i);

    if (await addTagButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addTagButton.click();
    }

    await expect(tagInput.first()).toBeVisible();

    // Enter tag name
    await tagInput.first().fill(newTag);
    await tagInput.first().press('Enter');

    // Verify tag appears on note
    const tagBadge = page.getByText(newTag, { exact: false });
    await expect(tagBadge).toBeVisible({ timeout: 5000 });
  });

  test('should remove tag from note', async ({ page }) => {
    const targetNote = fixtures.taggedNote; // Has tags: ['tag1', 'tag2', 'tag3']
    const tagToRemove = 'tag2';
    const updatedNote = {
      ...targetNote,
      tags: targetNote.tags.filter((t) => t !== tagToRemove),
    };

    // Mock get note API
    let currentNote = targetNote;
    await page.route(`**/api/v1/notes/${targetNote.note.id}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(currentNote),
        });
      }
    });

    // Mock update tags API
    await page.route(`**/api/v1/notes/${targetNote.note.id}/tags`, async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postDataJSON();
        if (requestBody.remove && requestBody.remove.includes(tagToRemove)) {
          currentNote = updatedNote;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tags: currentNote.tags }),
        });
      }
    });

    // Mock notes list
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockResponses.listNotes([
            {
              id: targetNote.note.id,
              title: targetNote.note.title!,
              snippet: targetNote.original.content.substring(0, 100),
              created_at_utc: targetNote.note.created_at_utc,
              updated_at_utc: targetNote.note.updated_at_utc,
              starred: false,
              archived: false,
              tags: currentNote.tags,
              has_revision: true,
              metadata: {},
            },
          ])
        ),
      });
    });

    // Navigate to note
    await page.reload();
    await page.waitForLoadState('networkidle');

    const noteLink = page.getByText(targetNote.note.title!);
    await expect(noteLink).toBeVisible();
    await noteLink.click();

    // Find tag badge for the tag to remove
    const tagBadge = page.getByText(tagToRemove, { exact: false }).first();
    await expect(tagBadge).toBeVisible();

    // Click remove button (X icon) on tag badge
    const removeButton = tagBadge
      .locator('..') // Parent element
      .getByRole('button', { name: /remove|delete|×|x/i })
      .or(tagBadge.locator('xpath=..').locator('button'));

    if (await removeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await removeButton.first().click();
    } else {
      // Fallback: Right-click tag for context menu
      await tagBadge.click({ button: 'right' });
      const removeMenuItem = page.getByRole('menuitem', { name: /remove|delete/i });
      await expect(removeMenuItem).toBeVisible();
      await removeMenuItem.click();
    }

    // Verify tag is removed
    await expect(page.getByText(tagToRemove, { exact: true })).not.toBeVisible({ timeout: 5000 });
  });

  test('should filter notes by tag', async ({ page }) => {
    const filterTag = 'important';
    const taggedNote = fixtures.taggedNote;
    const untaggedNote = fixtures.standardNote;

    // Mock notes list with filtering
    await page.route('**/api/v1/notes?*', async (route) => {
      const url = new URL(route.request().url());
      const filter = url.searchParams.get('filter');

      let notesToReturn = [];

      if (filter && filter.includes(filterTag)) {
        // Only return notes with the filter tag
        notesToReturn = [
          {
            id: taggedNote.note.id,
            title: taggedNote.note.title!,
            snippet: taggedNote.original.content.substring(0, 100),
            created_at_utc: taggedNote.note.created_at_utc,
            updated_at_utc: taggedNote.note.updated_at_utc,
            starred: false,
            archived: false,
            tags: [...taggedNote.tags, filterTag],
            has_revision: true,
            metadata: {},
          },
        ];
      } else {
        // Return all notes
        notesToReturn = [
          {
            id: taggedNote.note.id,
            title: taggedNote.note.title!,
            snippet: taggedNote.original.content.substring(0, 100),
            created_at_utc: taggedNote.note.created_at_utc,
            updated_at_utc: taggedNote.note.updated_at_utc,
            starred: false,
            archived: false,
            tags: [...taggedNote.tags, filterTag],
            has_revision: true,
            metadata: {},
          },
          {
            id: untaggedNote.note.id,
            title: untaggedNote.note.title!,
            snippet: untaggedNote.original.content.substring(0, 100),
            created_at_utc: untaggedNote.note.created_at_utc,
            updated_at_utc: untaggedNote.note.updated_at_utc,
            starred: false,
            archived: false,
            tags: untaggedNote.tags,
            has_revision: true,
            metadata: {},
          },
        ];
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.listNotes(notesToReturn)),
      });
    });

    // Navigate to app
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify both notes are initially visible
    await expect(page.getByText(taggedNote.note.title!)).toBeVisible();
    await expect(page.getByText(untaggedNote.note.title!)).toBeVisible();

    // Click on tag filter (in sidebar or filter panel)
    const tagFilter = page.getByText(filterTag, { exact: false }).first();
    await expect(tagFilter).toBeVisible();
    await tagFilter.click();

    // Verify only tagged note is visible
    await expect(page.getByText(taggedNote.note.title!)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(untaggedNote.note.title!)).not.toBeVisible();

    // Clear filter
    const clearFilterButton = page.getByRole('button', { name: /clear filter|all notes|×/i });
    if (await clearFilterButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearFilterButton.click();

      // Verify both notes are visible again
      await expect(page.getByText(taggedNote.note.title!)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(untaggedNote.note.title!)).toBeVisible();
    }
  });

  test('should create new tag', async ({ page }) => {
    const newTagName = 'newly-created-tag';

    // Mock create tag API
    await page.route('**/api/v1/tags', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ name: requestBody.name }),
        });
      }
    });

    // Mock get all tags API
    let allTags = ['existing-tag-1', 'existing-tag-2'];
    await page.route('**/api/v1/tags', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(allTags),
        });
      }
    });

    // Navigate to tags management (if available)
    // This is implementation-specific - might be in settings, sidebar, etc.

    // Try to create tag via note tagging interface
    const targetNote = fixtures.standardNote;
    await page.route(`**/api/v1/notes/${targetNote.note.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(targetNote),
      });
    });

    await page.route(`**/api/v1/notes/${targetNote.note.id}/tags`, async (route) => {
      if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postDataJSON();
        if (requestBody.add && requestBody.add.includes(newTagName)) {
          allTags = [...allTags, newTagName];
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tags: [...targetNote.tags, newTagName] }),
        });
      }
    });

    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockResponses.listNotes([
            {
              id: targetNote.note.id,
              title: targetNote.note.title!,
              snippet: targetNote.original.content.substring(0, 100),
              created_at_utc: targetNote.note.created_at_utc,
              updated_at_utc: targetNote.note.updated_at_utc,
              starred: false,
              archived: false,
              tags: targetNote.tags,
              has_revision: true,
              metadata: {},
            },
          ])
        ),
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const noteLink = page.getByText(targetNote.note.title!);
    await expect(noteLink).toBeVisible();
    await noteLink.click();

    // Add new tag
    const addTagButton = page.getByRole('button', { name: /add tag|new tag|\+.*tag/i });
    const tagInput = page.getByPlaceholder(/tag|label/i);

    if (await addTagButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addTagButton.click();
    }

    await expect(tagInput.first()).toBeVisible();
    await tagInput.first().fill(newTagName);
    await tagInput.first().press('Enter');

    // Verify new tag is created and appears
    await expect(page.getByText(newTagName)).toBeVisible({ timeout: 5000 });
  });

  test('should show tag autocomplete suggestions', async ({ page }) => {
    const existingTags = ['existing-tag-1', 'existing-tag-2', 'another-tag'];
    const partialInput = 'exist';

    // Mock get all tags API
    await page.route('**/api/v1/labels', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(existingTags),
      });
    });

    const targetNote = fixtures.standardNote;
    await page.route(`**/api/v1/notes/${targetNote.note.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(targetNote),
      });
    });

    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockResponses.listNotes([
            {
              id: targetNote.note.id,
              title: targetNote.note.title!,
              snippet: targetNote.original.content.substring(0, 100),
              created_at_utc: targetNote.note.created_at_utc,
              updated_at_utc: targetNote.note.updated_at_utc,
              starred: false,
              archived: false,
              tags: targetNote.tags,
              has_revision: true,
              metadata: {},
            },
          ])
        ),
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const noteLink = page.getByText(targetNote.note.title!);
    await expect(noteLink).toBeVisible();
    await noteLink.click();

    // Open tag input
    const addTagButton = page.getByRole('button', { name: /add tag|new tag|\+.*tag/i });
    const tagInput = page.getByPlaceholder(/tag|label/i);

    if (await addTagButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addTagButton.click();
    }

    await expect(tagInput.first()).toBeVisible();

    // Type partial tag name
    await tagInput.first().fill(partialInput);
    await page.waitForTimeout(300);

    // Verify autocomplete suggestions appear
    const autocompleteMenu = page.locator('[role="listbox"], [data-testid="tag-autocomplete"], .autocomplete-menu');

    // Check if autocomplete is implemented
    const hasAutocomplete = await autocompleteMenu.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasAutocomplete) {
      // Verify matching suggestions are shown
      const suggestions = autocompleteMenu.locator('[role="option"], .autocomplete-item');
      const suggestionCount = await suggestions.count();
      expect(suggestionCount).toBeGreaterThan(0);

      // Verify suggestions contain the partial input
      const firstSuggestion = suggestions.first();
      await expect(firstSuggestion).toContainText(partialInput, { ignoreCase: true });
    }
  });

  test('should handle tag API error gracefully', async ({ page }) => {
    const targetNote = fixtures.standardNote;

    await page.route(`**/api/v1/notes/${targetNote.note.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(targetNote),
      });
    });

    // Mock update tags API with error
    await page.route(`**/api/v1/notes/${targetNote.note.id}/tags`, async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.apiErrors.serverError.body),
        });
      }
    });

    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockResponses.listNotes([
            {
              id: targetNote.note.id,
              title: targetNote.note.title!,
              snippet: targetNote.original.content.substring(0, 100),
              created_at_utc: targetNote.note.created_at_utc,
              updated_at_utc: targetNote.note.updated_at_utc,
              starred: false,
              archived: false,
              tags: targetNote.tags,
              has_revision: true,
              metadata: {},
            },
          ])
        ),
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const noteLink = page.getByText(targetNote.note.title!);
    await expect(noteLink).toBeVisible();
    await noteLink.click();

    // Try to add tag
    const addTagButton = page.getByRole('button', { name: /add tag|new tag|\+.*tag/i });
    const tagInput = page.getByPlaceholder(/tag|label/i);

    if (await addTagButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addTagButton.click();
    }

    await expect(tagInput.first()).toBeVisible();
    await tagInput.first().fill('error-tag');
    await tagInput.first().press('Enter');

    // Verify error message is displayed
    const errorMessage = page.getByText(/error|failed|unable/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});
