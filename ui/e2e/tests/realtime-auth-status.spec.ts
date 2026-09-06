import { expect, test, type Page, type Route } from '@playwright/test';

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
      body: JSON.stringify({ ...compatibilityBase, auth }),
    });
  });
  await page.route(
    (url) => url.origin === 'http://localhost:3000' && (url.pathname === '/health' || url.pathname.startsWith('/health/')),
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
  if (await sidebarHeading.isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).first().click();
  await expect(sidebarHeading).toBeVisible();
}

test.describe('Realtime auth and reachability status', () => {
  test('shows auth-required when Fortemi is reachable but notes and SSE return 401', async ({ page }) => {
    await installHealthyRoutes(page, {
      required: true,
      mode: 'hosted',
      oauth_issuer_configured: true,
      tenant_context_available: false,
    });
    await page.route('**/api/v1/notes?*', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
    });
    await page.route('**/api/v1/events**', async (route) => {
      await route.fulfill({ status: 401, contentType: 'text/plain', body: 'Unauthorized' });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openSidebar(page);

    await expect(page.getByText('Auth Required')).toBeVisible();
    await expect(page.getByText('Offline Mode')).not.toBeVisible();
    await expect(page.getByText(/Fortemi is reachable, but this session is not authorized for notes or realtime events/i)).toBeVisible();
  });

  test('shows incompatible for legacy WebSocket 410 without calling it offline', async ({ page }) => {
    await page.addInitScript(() => {
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
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED;
            const close = new CloseEvent('close', { code: 410, reason: 'Gone' });
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
    await expect(page.getByRole('button', { name: /open realtime activity/i }).getByText('incompatible')).toBeVisible();
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
      (url) => url.origin === 'http://localhost:3000' && (url.pathname === '/health' || url.pathname.startsWith('/health/')),
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
