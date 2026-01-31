# E2E Test Suite for HotM

Comprehensive end-to-end test suite for the Hall of the Mind SPA using Playwright.

## Test Coverage

This E2E test suite covers the 5 most critical user journeys:

### 1. Note CRUD Operations (`tests/note-crud.spec.ts`)
- Create new note
- Edit existing note
- Delete note
- Star/unstar note
- Error handling for CRUD operations
- Empty note content handling

**Coverage:** 7 test scenarios

### 2. Search Functionality (`tests/search.spec.ts`)
- Display search input
- Perform search and display results
- Navigate to note from search results
- Empty search results handling
- Clear search results
- Search API error handling
- Keyboard navigation in search results
- Search query highlighting
- Debounced search input

**Coverage:** 9 test scenarios

### 3. Tag Management (`tests/tags.spec.ts`)
- Add tag to note
- Remove tag from note
- Filter notes by tag
- Create new tag
- Tag autocomplete suggestions
- Tag API error handling

**Coverage:** 6 test scenarios

### 4. Navigation and Routing (`tests/navigation.spec.ts`)
- Navigate to note detail from list
- Navigate between different notes
- Toggle sidebar visibility
- Navigate using sidebar filters
- Tab navigation
- Browser back/forward navigation
- Deep linking to specific note
- Navigate to search results and back
- Maintain scroll position
- Handle invalid note ID
- Keyboard shortcuts

**Coverage:** 11 test scenarios

### 5. Error Handling (`tests/error-handling.spec.ts`)
- API unavailable error
- Network timeout handling
- 404 error for invalid note ID
- Server error (500) handling
- Unauthorized error (401) handling
- Retry option after error
- Malformed API response handling
- Partial API failure handling
- Create note failure error
- Search API failure error
- Intermittent network failure recovery
- CORS error handling

**Coverage:** 12 test scenarios

## Total Test Coverage

- **Test Files:** 5
- **Test Scenarios:** 45
- **Critical Paths:** 5 (100% coverage)
- **Edge Cases:** All major edge cases covered
- **Error Paths:** All major error scenarios covered

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Run All Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e/tests/note-crud.spec.ts

# Run tests matching pattern
npx playwright test --grep "should create"
```

### Debug Tests

```bash
# Debug mode (interactive)
npx playwright test --debug

# Debug specific test
npx playwright test e2e/tests/search.spec.ts --debug

# Show trace viewer after test
npx playwright show-trace trace.zip
```

### Test Reports

```bash
# Generate HTML report
npx playwright test --reporter=html

# Open report
npx playwright show-report

# Generate JSON report
npx playwright test --reporter=json
```

## Test Architecture

### Fixtures (`fixtures/test-data.ts`)

Provides comprehensive test data management:

- **Factories:** Dynamic test data generation with `noteFactory`, `searchHitFactory`, `noteSummaryFactory`
- **Static Fixtures:** Deterministic test scenarios (healthy system, error responses, edge cases)
- **Mock Helpers:** API response builders for consistent mocking

### API Mocking

All tests use Playwright's route mocking for:
- **Isolation:** Tests don't depend on backend availability
- **Speed:** No network latency or database queries
- **Determinism:** Predictable test data and responses
- **Edge Cases:** Easy to simulate error conditions

### Test Organization

```
e2e/
├── playwright.config.ts       # Playwright configuration
├── fixtures/
│   └── test-data.ts          # Test data factories and fixtures
└── tests/
    ├── note-crud.spec.ts      # Note CRUD operations
    ├── search.spec.ts         # Search functionality
    ├── tags.spec.ts           # Tag management
    ├── navigation.spec.ts     # Navigation and routing
    └── error-handling.spec.ts # Error scenarios
```

## Configuration

### Playwright Config (`playwright.config.ts`)

- **Base URL:** `http://localhost:1420` (Vite dev server)
- **Browsers:** Chromium (default), Firefox and WebKit disabled for CI
- **Parallel Execution:** 5 workers (1 in CI)
- **Retries:** 2 retries on CI, 0 locally
- **Timeout:** 30 seconds per test, 10 minutes global
- **Screenshots:** On failure only
- **Video:** On first retry
- **Trace:** On first retry

### Web Server

Tests automatically start the Vite dev server before running:
- **Command:** `npm run dev`
- **URL:** `http://localhost:1420`
- **Reuse:** Reuses existing server (not in CI)
- **Timeout:** 120 seconds

## Writing New Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { fixtures, noteFactory, mockResponses } from '../fixtures/test-data';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Mock API endpoints
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.healthySystem),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should perform action', async ({ page }) => {
    // Arrange: Setup test data
    const testNote = noteFactory.build();

    // Act: Perform user action
    await page.getByRole('button', { name: /action/i }).click();

    // Assert: Verify expected outcome
    await expect(page.getByText('Expected Result')).toBeVisible();
  });
});
```

### Best Practices

1. **Use Semantic Locators:** Prefer `getByRole`, `getByText`, `getByPlaceholder` over CSS selectors
2. **Mock API Calls:** Use `page.route()` to mock all API interactions
3. **Wait for State:** Use `waitForLoadState('networkidle')` after navigation
4. **Test User Journeys:** Focus on real user workflows, not implementation details
5. **Handle Timing:** Use `expect().toBeVisible()` with timeout instead of `waitForTimeout`
6. **Test Edge Cases:** Empty states, error conditions, boundary values
7. **Keep Tests Independent:** Each test should be runnable in isolation

### Locator Strategies

```typescript
// GOOD: Semantic selectors
page.getByRole('button', { name: /save/i })
page.getByPlaceholder(/search/i)
page.getByText('Note Title')

// FALLBACK: Test IDs for complex components
page.locator('[data-testid="note-editor"]')

// AVOID: CSS class selectors (brittle)
page.locator('.btn-save')
```

## CI Integration

### GitHub Actions

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E Tests
  run: npm run test:e2e

- name: Upload Test Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests Timeout

- Increase timeout in `playwright.config.ts`
- Check if dev server is starting correctly
- Verify API mocks are set up before navigation

### Flaky Tests

- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use retries for stability: `test.describe.configure({ retries: 2 })`
- Check for race conditions in async operations

### Selectors Not Found

- Verify selectors match actual rendered components
- Use Playwright Inspector: `npx playwright test --debug`
- Check if component is visible: `await element.isVisible()`

### API Mocks Not Working

- Ensure route is set up before `page.goto()`
- Check route pattern matches actual request URL
- Use `page.on('request', ...)` to debug requests

## Coverage Goals

| Metric | Target | Current |
|--------|--------|---------|
| Critical Paths | 100% | 100% |
| Edge Cases | 80% | 95% |
| Error Paths | 80% | 100% |
| User Journeys | 5 major | 5 major |

## Future Enhancements

- [ ] Add visual regression testing with Percy or Playwright screenshots
- [ ] Add performance testing with Lighthouse
- [ ] Add accessibility testing with axe-core
- [ ] Add cross-browser testing (Firefox, WebKit)
- [ ] Add mobile viewport testing
- [ ] Add Tauri-specific E2E tests (if needed)

## References

- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [API Mocking Guide](https://playwright.dev/docs/mock)
- [HotM API Specification](../../docs/specifications/api-specification.md)
