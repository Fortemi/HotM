import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for HotM
 *
 * This configuration runs tests against the Vite dev server.
 * Tests cover critical user journeys with API mocking.
 */
export default defineConfig({
  testDir: './tests',

  // Run tests in parallel (max 5 workers for stability)
  fullyParallel: true,
  workers: process.env.CI ? 1 : 5,

  // Fail the build on CI if tests were accidentally left as .only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html'], ['github']]
    : [['html'], ['list']],

  // Shared test settings
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:1420',

    // Collect trace when retrying failed tests
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on first retry
    video: 'retain-on-failure',

    // Default timeout for actions (click, fill, etc.)
    actionTimeout: 10000,
  },

  // Test timeout (30 seconds per test)
  timeout: 30000,

  // Global timeout (10 minutes for entire suite)
  globalTimeout: 600000,

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Firefox and WebKit disabled for faster CI
    // Uncomment for comprehensive cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Start dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
