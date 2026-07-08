import { expect, test } from '@playwright/test';
import { mockResponses } from '../fixtures/test-data';

const compatibilityFixture = {
  schema_version: 1,
  contract_revision: '2026-07-06',
  api: {
    name: 'fortemi',
    version: '2026.5.25',
    minimum_hotm_enterprise_client: '0.0.0-checkpoint',
    git_sha_present: true,
    build_date_present: true,
  },
  deployment: {
    mode: 'local_sidecar',
    edition: 'community',
    hosted_multi_tenant_ready: false,
  },
  auth: {
    required: false,
    mode: 'anonymous_local',
    oauth_issuer_configured: false,
    tenant_context_available: false,
  },
  capabilities: {
    core_notes: { state: 'available' },
    search: { state: 'available' },
    jobs: { state: 'available' },
    realtime_activity: { state: 'available' },
    hosted_auth: { state: 'available' },
    premium_components: { state: 'available' },
    backoffice_api: { state: 'preview', reason_code: 'backoffice_contract_pending' },
    audit_posture: { state: 'preview', reason_code: 'hosted_audit_gate_open' },
    quota_status: { state: 'unavailable', reason_code: 'quota_policy_not_implemented' },
    kms_status: { state: 'unknown', reason_code: 'key_provider_not_implemented' },
    mcp_scope_gate: { state: 'available' },
    support_diagnostics: { state: 'preview', reason_code: 'support_export_disabled' },
  },
  links: {
    openapi: '/openapi.yaml',
    asyncapi: '/asyncapi.yaml',
    health: '/health',
    streaming_health: '/api/v1/health/streaming',
  },
};

async function mockHotmShell(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'healthy',
        version: '2026.5.25',
        database: 'connected',
        ollama: 'unavailable',
        capabilities: {
          chat: { available: false, configured: true },
          webhooks: true,
        },
        sse: { active_connections: 1, events_delivered: 12 },
      }),
    });
  });

  await page.route('**/api/v1/system/compatibility', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(compatibilityFixture),
    });
  });

  await page.route('**/api/v1/health/knowledge', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_notes: 3,
        orphan_notes: 0,
        stale_notes: 0,
        unlinked_notes: 1,
        avg_links_per_note: 2.1,
        tag_coverage: 0.7,
        last_activity: '2026-07-06T12:00:00Z',
      }),
    });
  });

  await page.route('**/api/v1/notes?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponses.listNotes([])),
    });
  });
}

async function openEnterprisePreview(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const sidebarToggle = page.getByRole('button', { name: /toggle sidebar/i });
  const adminButton = page.getByText('Admin').locator('xpath=ancestor::button');
  if (!(await adminButton.isVisible({ timeout: 1500 }).catch(() => false))) {
    await sidebarToggle.click();
  }

  const navigateButton = page.getByRole('button', { name: /navigate/i });
  if (await navigateButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await navigateButton.click({ force: true });
  }

  await adminButton.click({ force: true });

  if (await page.getByRole('dialog', { name: /sidebar/i }).isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
  }

  await page.getByRole('tab', { name: /api surface/i }).click({ force: true });
  await expect(page.getByText('Enterprise Preview')).toBeVisible();
}

test.describe('Enterprise Preview', () => {
  test.beforeEach(async ({ page }) => {
    await mockHotmShell(page);
  });

  test('HUX-REQ-012 renders compatibility-gated premium and backoffice preview on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEnterprisePreview(page);

    await expect(page.getByText('Hosted Auth Preview')).toBeVisible();
    await expect(page.getByText('tenant_context_absent')).toBeVisible();
    await expect(page.getByText('Premium Components Catalog')).toBeVisible();
    await expect(page.getByText('Licensed Server Components')).toBeVisible();
    await expect(page.getByText('license required')).toBeVisible();
    await expect(page.getByText('Backoffice Console Preview')).toBeVisible();
    await expect(page.getByText('Tenant Health', { exact: true })).toBeVisible();
    await expect(page.getByText('Support Diagnostics', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('hosted_production_blocked_rls_gate').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Export disabled/i })).toBeDisabled();
    await expect(page.getByText('Premium Components').first()).toBeVisible();
    await expect(page.getByText('Backoffice Console', { exact: true })).toBeVisible();
    await expect(page.getByText('KMS Status').first()).toBeVisible();
    await expect(page.getByText('backoffice_contract_pending').first()).toBeVisible();
    await expect(page.getByText('production disabled').first()).toBeVisible();

    await page.screenshot({
      path: '../.aiwg/evidence/hotm-enterprise-preview-desktop.png',
      fullPage: true,
    });
  });

  test('HUX-REQ-012 keeps enterprise preview usable on mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openEnterprisePreview(page);

    await expect(page.getByText('Enterprise Preview')).toBeVisible();
    await expect(page.getByText('Hosted Auth Preview')).toBeVisible();
    await expect(page.getByText('Premium Components Catalog')).toBeVisible();
    await expect(page.getByText('Backoffice Console Preview')).toBeVisible();
    await expect(page.getByText('Premium Components').first()).toBeVisible();
    await expect(page.getByText('Backoffice Console', { exact: true })).toBeVisible();
    await expect(page.getByText('production disabled').first()).toBeVisible();

    await page.screenshot({
      path: '../.aiwg/evidence/hotm-enterprise-preview-mobile.png',
      fullPage: true,
    });
  });
});
