import { test, expect } from '@playwright/test'

// Assumes: server running at 127.0.0.1:53211 and UI dev server at 5173

test('loads and can create a note via API then search', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=Quick Capture')).toBeVisible()

  // Call API to create a note, then search for it in UI
  const res = await fetch('http://127.0.0.1:53211/api/v1/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'Playwright smoke', format: 'markdown', source: 'test' }) })
  const data = await res.json() as { noteId: string }
  expect(data.noteId).toBeTruthy()

  await page.getByPlaceholder('Search (tag:, collection:)').fill('Playwright')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.locator('text=Score:')).toBeVisible()
})
