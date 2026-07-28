import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 1 : 5,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['github']] : [['html'], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
  },
  timeout: 30000,
  globalTimeout: 600000,
  outputDir: 'test-results',
  globalTeardown: './e2e/global-teardown.ts',
  projects: [
    {
      name: 'e2e-mocked',
      testMatch: 'tests/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:1420',
      },
    },
    {
      name: 'smoke',
      testMatch: 'smoke/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'uat',
      testMatch: 'uat/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'live-assets',
      testMatch: 'live/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:1420',
      },
    },
  ],
  webServer: {
    command: 'VITE_API_BASE_URL="${HOTM_API_URL:-${VITE_API_BASE_URL:-http://localhost:3000/api/v1}}" npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
