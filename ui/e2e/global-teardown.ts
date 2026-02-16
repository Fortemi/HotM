/**
 * Global Teardown for UAT Suite
 *
 * Runs after the UAT test suite to clean up any orphaned `_hotm_uat`-tagged
 * notes from crashed or interrupted test runs.
 *
 * Configured in playwright.config.ts as `globalTeardown` for the UAT project.
 */

import { globalCleanup } from './fixtures/live-api-helpers';

async function teardown(): Promise<void> {
  await globalCleanup();
}

export default teardown;
