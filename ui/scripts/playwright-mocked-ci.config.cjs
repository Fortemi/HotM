const { defineConfig, devices } = require('@playwright/test');

const baseURL = 'http://localhost:1420';

module.exports = defineConfig({
  testDir: '../e2e',
  // Playwright cleans outputDir before a run; keep the pre-run receipt beside it.
  outputDir: '../test-results/mocked-ci/artifacts',
  fullyParallel: true,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 30000,
  globalTimeout: 600000,
  reporter: [
    ['html', { outputFolder: '../playwright-report/mocked-ci', open: 'never' }],
    ['github'],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'mocked-desktop-1280',
      testMatch: 'tests/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'mocked-mobile-390',
      testMatch: 'tests/**/*.spec.ts',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'VITE_API_BASE_URL="${HOTM_API_URL:-${VITE_API_BASE_URL:-http://localhost:3000/api/v1}}" npm run dev',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
