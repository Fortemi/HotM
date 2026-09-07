import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';

const releasePolicy = JSON.parse(readFileSync(
  new URL('../../../agent-proxy/src/auth/fixtures/fortemi-auth-release-policy-v1.json', import.meta.url),
  'utf8',
));

// Keep unrelated API calls isolated when these checks target a published UI.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }));
});

const compatibilityBase = {
  schema_version: 1,
  contract_revision: '2026-07-06',
  api: {
    name: 'fortemi',
    version: '2026.7.1',
    minimum_hotm_enterprise_client: '2026.7.1',
    git_sha_present: true,
    build_date_present: true,
  },
  deployment: {
    mode: 'local',
    edition: 'community',
    hosted_multi_tenant_ready: false,
  },
  capabilities: {},
  links: {
    openapi: '/api/v1/operator/openapi.yaml',
    asyncapi: '/api/v1/operator/asyncapi.yaml',
    health: '/health',
    streaming_health: '/api/v1/health/stream',
  },
};

async function installHealthyRoutes(page: Page, auth: Record<string, unknown>) {
  const healthy = async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'healthy', db: true, ollama: true, vector: true }),
    });
  };

  await page.route('**/api/v1/system/compatibility', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...compatibilityBase,
        auth: {
          ...auth,
          ...(auth.required ? {
            claim_contract_version: '1.1.0',
            claim_contract_profile: 'rust-node-jwt-v1',
            authority_release: releasePolicy.current_release.tag,
          } : {}),
        },
      }),
    });
  });
  await page.route(
    (url) => (url.pathname === '/healthz' || url.pathname === '/health' || url.pathname.startsWith('/health/')),
    healthy,
  );
  await page.route('**/api/v1/health', healthy);
  await page.route('**/api/v1/archives**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/tags**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tags: [] }) });
  });
}

async function openSidebar(page: Page) {
  const sidebarHeading = page.getByText('Hall of the Mind', { exact: true });
  const sidebarToggle = page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).first();
  // DOMContentLoaded may precede React rendering. Wait for the desktop heading
  // or mobile control before deciding whether the sidebar needs opening.
  await expect.poll(async () =>
    await sidebarHeading.isVisible() || await sidebarToggle.isVisible(),
  ).toBe(true);
  if (await sidebarHeading.isVisible()) return;
  await sidebarToggle.click();
  await expect(sidebarHeading).toBeVisible();
}

test.describe('Realtime auth and reachability status', () => {
  test('shows auth-required when Fortemi is reachable but notes and SSE return 401', async ({ page }) => {
    await installHealthyRoutes(page, {
      required: true,
      mode: 'hosted',
      oauth_issuer_configured: true,
      tenant_context_available: true,
    });
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
    });
    let sseResponses = 0;
    await page.route('**/api/v1/events**', async (route) => {
      sseResponses++;
      await route.fulfill({ status: 401, contentType: 'text/plain', body: 'Unauthorized' });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openSidebar(page);

    await expect(page.getByText('Auth Required')).toBeVisible();
    await expect.poll(() => sseResponses).toBeGreaterThan(0);
    await expect(page.getByText('Offline Mode')).not.toBeVisible();
    await expect(page.getByText(/Fortemi is reachable, but this session is not authorized for notes or realtime events/i)).toBeVisible();
  });

  test('shows auth-required when Fortemi is reachable but notes and SSE return 403', async ({ page }) => {
    await installHealthyRoutes(page, {
      required: true,
      mode: 'hosted',
      oauth_issuer_configured: true,
      tenant_context_available: true,
    });
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Forbidden' }) });
    });
    let sseResponses = 0;
    await page.route('**/api/v1/events**', async (route) => {
      sseResponses++;
      await route.fulfill({ status: 403, contentType: 'text/plain', body: 'Forbidden' });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openSidebar(page);

    await expect(page.getByText('Auth Required')).toBeVisible();
    await expect.poll(() => sseResponses).toBeGreaterThan(0);
    await expect(page.getByText('Offline Mode')).not.toBeVisible();
    await expect(page.getByText(/Fortemi is reachable, but this session is not authorized for notes or realtime events/i)).toBeVisible();
  });

  test('treats opaque legacy WebSocket HTTP 410 handshake failure as transport failure', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __HOTM_WS_ATTEMPTS__?: number }).__HOTM_WS_ATTEMPTS__ = 0;
      class MockWebSocket extends EventTarget {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        readyState = MockWebSocket.CONNECTING;
        onopen: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;

        constructor(public readonly url: string) {
          super();
          (window as unknown as { __HOTM_WS_ATTEMPTS__: number }).__HOTM_WS_ATTEMPTS__ += 1;
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED;
            const close = new CloseEvent('close', { code: 1006, reason: '' });
            this.onclose?.(close);
            this.dispatchEvent(close);
          }, 0);
        }

        send() {}
        close() {
          this.readyState = MockWebSocket.CLOSED;
        }
      }
      window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    });
    await installHealthyRoutes(page, {
      required: false,
      mode: 'anonymous_local',
      oauth_issuer_configured: false,
      tenant_context_available: false,
    });
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notes: [], total: 0 }) });
    });
    await page.route('**/api/v1/events**', () => new Promise(() => {}));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openSidebar(page);

    await expect(page.getByText('Offline Mode')).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __HOTM_WS_ATTEMPTS__?: number }).__HOTM_WS_ATTEMPTS__ ?? 0)).toBeGreaterThan(0);
    await page.waitForTimeout(3200);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __HOTM_WS_ATTEMPTS__?: number }).__HOTM_WS_ATTEMPTS__ ?? 0)).toBeGreaterThan(1);
    await expect(page.getByRole('button', { name: /open realtime activity/i }).getByText('incompatible')).not.toBeVisible();
  });

  test('keeps Offline Mode reserved for health-check unreachability', async ({ page }) => {
    await page.route('**/api/v1/system/compatibility', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...compatibilityBase,
          auth: {
            required: false,
            mode: 'anonymous_local',
            oauth_issuer_configured: false,
            tenant_context_available: false,
          },
        }),
      });
    });
    await page.route(
      (url) => (url.pathname === '/healthz' || url.pathname === '/health' || url.pathname.startsWith('/health/')),
      async (route) => route.abort('failed'),
    );
    await page.route('**/api/v1/health', async (route) => route.abort('failed'));
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notes: [], total: 0 }) });
    });
    await page.route('**/api/v1/events**', () => new Promise(() => {}));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openSidebar(page);

    await expect(page.getByText('Offline Mode')).toBeVisible();
    await expect(page.getByText('Auth Required')).not.toBeVisible();
  });
});

test('reports observable SSE 410 as incompatible while health remains reachable', async ({ page }) => {
  let eventResponses = 0;
  page.on('response', (response) => {
    if (response.url().includes('/events') && response.status() === 410) eventResponses++;
  });
  await installHealthyRoutes(page, {
    required: true, mode: 'hosted', oauth_issuer_configured: true, tenant_context_available: true,
  });
  await page.route('**/api/v1/notes?*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ notes: [], total: 0 }),
  }));
  await page.route('**/api/v1/events**', (route) => route.fulfill({
    status: 410, contentType: 'text/plain', body: 'Gone',
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => eventResponses).toBeGreaterThan(0);
  // The compact header badge is intentionally hidden on mobile; the activity
  // drawer exposes the connection state at every supported viewport.
  await page.getByRole('button', { name: /open realtime activity/i }).click();
  await expect(page.getByText('state: incompatible', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await openSidebar(page);
  await expect(page.getByText('Offline Mode')).not.toBeVisible();
  await expect(page.getByText('Auth Required')).not.toBeVisible();
});
