#!/usr/bin/env node
/** Real hosted acceptance; no response mocks, traces, videos, or screenshots. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, chmod, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const exec = promisify(execFile);
const help = `Usage: node ui/scripts/qualify-hosted-realtime.mjs --base-url http://127.0.0.1:PORT --receipt FILE
  [--ui-image IMMUTABLE_REFERENCE] [--ui-revision SHA]
  [--core-image IMMUTABLE_REFERENCE] [--core-revision SHA]

Requires a same-origin proxy to the isolated hosted API and the installed
fortemi-qualification-token helper. Identity arguments are operator assertions,
not image inspection. No personal-service default. Full runs take several minutes.
Exit 0 = all live checks and cleanup passed; otherwise nonzero.
`;
const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { process.stdout.write(help); process.exit(0); }
const options = {};
const allowed = new Set(['base-url', 'receipt', 'ui-image', 'ui-revision', 'core-image', 'core-revision']);
for (let i = 0; i < argv.length; i += 2) {
  const key = argv[i]?.replace(/^--/, '');
  if (!argv[i]?.startsWith('--') || !allowed.has(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
    process.stderr.write('Invalid arguments; use --help.\n'); process.exit(2);
  }
  options[key] = argv[i + 1];
}
let origin;
try {
  const url = new URL(options['base-url']);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || !url.port || url.username || url.password || !['', '/'].includes(url.pathname)
    || url.search || url.hash || !options.receipt) throw new Error();
  origin = url.origin;
} catch { process.stderr.write('Explicit loopback UI origin and --receipt are required.\n'); process.exit(2); }
process.umask(0o077);
const expectedAuth = {
  required: true, mode: 'hosted_oauth', oauth_issuer_configured: true, tenant_context_available: true,
  claim_contract_version: '1.1.0', claim_contract_profile: 'rust-node-jwt-v1',
  authority_release: 'v2026.9.0', authority_commit: 'cff36d293d73080c186e2f35115dd92a594982d2',
  manifest_sha256: '2df0a35edad67cc3e8869286183a4d098b1eb8fc2161432ed0b54ba69b17e242',
  release_policy_sha256: 'bd77fbeba24991f969d07e5f45c5259504e52bb5ab9d7c4137abb22270c4abe8',
};
const receipt = {
  started_at: new Date().toISOString(), full_acceptance: false,
  scope: 'Real helper-issued service-account bearer injection; not interactive OIDC sign-in',
  operator_asserted_identity: Object.fromEntries(['ui-image', 'ui-revision', 'core-image', 'core-revision']
    .map((key) => [key, options[key] ?? null])),
  identity_verified_by_harness: false,
  observed: {}, checks: {}, fixtures: [], cleanup: {},
  excluded: ['interactive OIDC sign-in', 'live HTTP410 injection', 'physical database erasure'],
};
let browser, tmp, serial = 0;
let interrupted = false;
let cleaningUp = false;
const activeRequests = new Set();
function requireUninterrupted() {
  if (interrupted && !cleaningUp) throw new Error('qualification_interrupted');
}
function interrupt() {
  interrupted = true;
  receipt.interrupted = true;
  // Cleanup uses fresh credentials and bounded requests of its own; a second
  // signal must not abort the exact-fixture cleanup that is already running.
  if (!cleaningUp) for (const controller of activeRequests) controller.abort();
}
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
const sessions = [];
const fixtures = [];
const save = () => writeFile(options.receipt, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
async function check(name, actual, expected) {
  requireUninterrupted();
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  receipt.checks[name] = { actual, expected, pass };
  await save();
  if (!pass) throw new Error('check_failed');
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function poll(predicate, milliseconds = 15000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    requireUninterrupted();
    if (await predicate()) return true;
    await sleep(150);
  }
  requireUninterrupted();
  return Boolean(await predicate());
}
async function api(path, token, method = 'GET', body) {
  requireUninterrupted();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  // Let an in-flight mutation return its fixture ID before interruption is
  // raised, so a committed creation remains available to exact cleanup.
  if (!cleaningUp && method === 'GET') activeRequests.add(controller);
  try {
    const response = await fetch(origin + path, {
      method, redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let data;
    try { data = await response.json(); } catch { data = null; }
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
    activeRequests.delete(controller);
  }
}
async function issue(identity = 'tenant-a', kind = 'valid') {
  requireUninterrupted();
  const file = join(tmp, `${++serial}.jwt`);
  const { stdout } = await exec('/usr/local/bin/fortemi-qualification-token',
    ['--identity', identity, '--case', kind, '--output', file], { timeout: 25000, maxBuffer: 16384 });
  const metadata = JSON.parse(stdout);
  return { value: (await readFile(file, 'utf8')).trim(), expires: metadata.expires_at_epoch };
}
async function newSession() {
  requireUninterrupted();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const state = { context, page: await context.newPage(), noteStatuses: [], sseStatuses: [], sseRequests: 0, wsAttempts: 0, boundaryBlocks: 0 };
  sessions.push(state);
  // The released transport uses fetch. Refuse redirects before application
  // code runs, without changing any response body or status.
  await context.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => nativeFetch(input, { ...init, redirect: 'error' });
  });
  // Protect the installed personal service if a UI has stale runtime config.
  // Aborting unexpected origins is a boundary guard, never a successful mock response.
  await context.route('**/*', async (route) => {
    const target = new URL(route.request().url());
    if (['data:', 'blob:'].includes(target.protocol)) return route.continue();
    if (target.origin !== origin) {
      state.boundaryBlocks++;
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await context.routeWebSocket('**/*', (socket) => { state.wsAttempts++; socket.close(); });
  state.page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/events') state.sseRequests++;
  });
  state.page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path === '/api/v1/notes') state.noteStatuses.push(response.status());
    if (path === '/api/v1/events') state.sseStatuses.push(response.status());
  });
  await state.page.goto(origin, { waitUntil: 'domcontentloaded' });
  return state;
}
async function replaceSession(state, token) {
  await state.page.evaluate((value) => {
    localStorage.removeItem('hotm_api_bearer_token');
    localStorage.removeItem('hotm_active_memory');
    if (value) localStorage.setItem('hotm_api_bearer_token', value);
  }, token?.value ?? null);
  state.noteStatuses = []; state.sseStatuses = []; state.sseRequests = 0;
  await state.page.reload({ waitUntil: 'domcontentloaded' });
}
async function sidebar(page) {
  const heading = page.getByText('Hall of the Mind', { exact: true });
  const toggle = page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).first();
  if (!await poll(async () => await heading.isVisible() || await toggle.isVisible())) {
    throw new Error('sidebar_not_rendered');
  }
  if (!await heading.isVisible()) await toggle.click();
  if (!await poll(() => heading.isVisible())) throw new Error('sidebar_not_visible');
}
async function authRequired(state, prefix, expectedStatus, timeout = 20000) {
  await check(prefix + '_notes_status', await poll(() => state.noteStatuses.includes(expectedStatus), timeout), true);
  await check(prefix + '_sse_status', await poll(() => state.sseStatuses.includes(expectedStatus), timeout), true);
  await sidebar(state.page);
  await check(prefix + '_auth_required', await poll(() => state.page.getByText('Auth Required', { exact: true }).isVisible(), timeout), true);
  await check(prefix + '_not_offline', await state.page.getByText('Offline Mode', { exact: true }).isVisible(), false);
  const quick = state.page.getByPlaceholder('Quick note... (Ctrl+Enter to save)');
  if (!await quick.isVisible()) await state.page.getByRole('button', { name: 'Quick Note', exact: true }).click();
  await quick.fill('Authorization gate verification; never submit');
  await check(prefix + '_mutation_disabled', await state.page.getByRole('button', { name: 'Create Note', exact: true }).isDisabled(), true);
  const requests = state.sseRequests;
  await state.page.getByRole('button', { name: /open realtime activity/i }).click();
  await check(prefix + '_drawer_retains_terminal', await poll(() => state.page.getByText('state: auth-required', { exact: true }).isVisible()), true);
  await sleep(3500);
  await check(prefix + '_terminal_no_reconnect_churn', state.sseRequests, requests);
  await state.page.keyboard.press('Escape');
  await quick.fill('');
}
async function connected(state, prefix) {
  await check(prefix + '_notes_200', await poll(() => state.noteStatuses.includes(200)), true);
  await check(prefix + '_sse_200', await poll(() => state.sseStatuses.includes(200)), true);
  await state.page.getByRole('button', { name: /open realtime activity/i }).click();
  await check(prefix + '_state_connected', await poll(() => state.page.getByText('state: connected', { exact: true }).isVisible()), true);
  await check(prefix + '_transport_sse', await state.page.getByText('transport: sse', { exact: true }).isVisible(), true);
  await state.page.keyboard.press('Escape');
  await check(prefix + '_auth_cleared', await state.page.getByText('Auth Required', { exact: true }).isVisible(), false);
}
async function createFixture(identity, token, title) {
  const result = await api('/api/v1/notes', token.value, 'POST', {
    content: `# ${title}\n\nIsolated HotM304 acceptance.`, title, source: 'hotm304-qualification',
    format: 'markdown', revision_mode: 'none', pipeline: [],
  });
  if (result.status === 201 && /^[0-9a-f-]{36}$/i.test(result.data?.id ?? '')) {
    const fixture = { identity, id: result.data.id, title };
    fixtures.push(fixture); receipt.fixtures.push(fixture); await save();
  }
  await check('create_' + title, result.status, 201);
  if (!fixtures.some((fixture) => fixture.id === result.data?.id)) throw new Error('invalid_fixture_receipt');
  return fixtures.at(-1);
}
async function converges(state, fixture, prefix) {
  await check(prefix + '_real_ui_convergence', await poll(() => state.page.getByText(fixture.title, { exact: true }).first().isVisible()), true);
}

try {
  await save();
  const compatibility = await api('/api/v1/system/compatibility');
  await check('compatibility_http', compatibility.status, 200);
  const contract = compatibility.data ?? {};
  const observedAuth = Object.fromEntries(Object.keys(expectedAuth).map((key) => [key, contract.auth?.[key] ?? null]));
  receipt.observed = { api: contract.api, deployment: contract.deployment, auth: observedAuth };
  await check('exact_auth_contract', observedAuth, expectedAuth);
  await check('schema_version', contract.schema_version, 1);
  await check('api_name', contract.api?.name, 'fortemi');
  await check('deployment_profile', contract.deployment?.mode, 'hosted_multi_tenant');
  await check('internal_qualification', contract.deployment?.edition, 'internal');
  await check('honest_incomplete_hosted_readiness', contract.deployment?.hosted_multi_tenant_ready, false);
  // Deliberately load Playwright only after preflight, before issuing credentials.
  // Debug call logging can include evaluate arguments; never inherit it here.
  delete process.env.DEBUG;
  delete process.env.PWDEBUG;
  const { chromium } = await import('@playwright/test');
  browser = await chromium.launch({ headless: true });
  tmp = await mkdtemp('/dev/shm/fortemi-hotm-304-'); await chmod(tmp, 0o700);
  const anonymous = await newSession();
  await authRequired(anonymous, 'missing', 401);
  const forbidden = await issue('forbidden');
  await replaceSession(anonymous, forbidden);
  await authRequired(anonymous, 'forbidden', 403);
  const a = await issue('tenant-a');
  const b = await issue('tenant-b');
  const pageA = anonymous;
  await replaceSession(pageA, a);
  await connected(pageA, 'tenant_a');
  const pageB = await newSession();
  await replaceSession(pageB, b);
  await connected(pageB, 'tenant_b');
  const run = randomUUID();
  const noteA = await createFixture('tenant-a', a, `hotm304-${run}-a`);
  const noteB = await createFixture('tenant-b', b, `hotm304-${run}-b`);
  await converges(pageA, noteA, 'tenant_a');
  await converges(pageB, noteB, 'tenant_b');
  await sleep(1500);
  await check('a_excludes_b_ui', await pageA.page.getByText(noteB.title, { exact: true }).count(), 0);
  await check('b_excludes_a_ui', await pageB.page.getByText(noteA.title, { exact: true }).count(), 0);
  for (const [name, token, own, foreign] of [['a', a, noteA, noteB], ['b', b, noteB, noteA]]) {
    const list = await api('/api/v1/notes?limit=100', token.value);
    await check(name + '_real_list_isolation', list.status === 200
      && list.data?.notes?.some((note) => note.id === own.id)
      && !list.data?.notes?.some((note) => note.id === foreign.id), true);
  }
  // Token claims are never rewritten. Wait past the real expiry and configured
  // maximum60second skew; server stream close must eventually produce real401.
  const expiryDeadline = (a.expires + 75) * 1000;
  await check('expired_stream_reauth', await poll(() => pageA.sseStatuses.includes(401), Math.max(1000, expiryDeadline - Date.now())), true);
  await check('naturally_expired_api', (await api('/api/v1/notes', a.value)).status, 401);
  // Force an actual notes request too, without browser response interception.
  await pageA.page.reload({ waitUntil: 'domcontentloaded' });
  await authRequired(pageA, 'expired', 401);
  const replacement = await issue('tenant-a', 'replacement');
  await replaceSession(pageA, replacement);
  await connected(pageA, 'replacement');
  const newNote = await createFixture('tenant-a', replacement, `hotm304-${run}-replacement`);
  await converges(pageA, newNote, 'replacement');
  for (const [index, state] of sessions.entries()) {
    await check(`browser_${index}_no_legacy_websocket`, state.wsAttempts, 0);
    await check(`browser_${index}_same_origin_only`, state.boundaryBlocks, 0);
  }
} catch (error) {
  // Exception text/stack may capture Playwright evaluate arguments or headers.
  receipt.error_class = error?.constructor?.name ?? 'Error';
} finally {
  cleaningUp = true;
  for (const fixture of fixtures) {
    try {
      const token = await issue(fixture.identity, 'replacement');
      const deleted = await api('/api/v1/notes/' + fixture.id, token.value, 'DELETE');
      const readback = await api('/api/v1/notes/' + fixture.id, token.value);
      receipt.cleanup[fixture.id] = { delete_status: deleted.status, readback_status: readback.status,
        pass: deleted.status === 204 && [403, 404].includes(readback.status), kind: 'soft_delete' };
    } catch (error) { receipt.cleanup[fixture.id] = { pass: false, error_class: error?.constructor?.name ?? 'Error' }; }
    await save();
  }
  for (const state of sessions) {
    try {
      await state.page.evaluate(() => { localStorage.removeItem('hotm_api_bearer_token'); localStorage.removeItem('hotm_active_memory'); sessionStorage.clear(); });
      await state.context.clearCookies();
      await state.context.close();
    } catch { receipt.browser_cleanup_error = true; }
  }
  if (browser) await browser.close().catch(() => { receipt.browser_cleanup_error = true; });
  if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => { receipt.tmpfs_cleanup_error = true; });
  receipt.finished_at = new Date().toISOString();
  receipt.full_acceptance = !interrupted && !receipt.error_class && !receipt.browser_cleanup_error && !receipt.tmpfs_cleanup_error
    && Object.values(receipt.checks).every((check) => check.pass)
    && Object.values(receipt.cleanup).every((check) => check.pass);
  await save();
}
process.stdout.write(JSON.stringify({ receipt: options.receipt, full_acceptance: receipt.full_acceptance,
  failed_checks: Object.entries(receipt.checks).filter(([, value]) => !value.pass).map(([name]) => name) }) + '\n');
process.exitCode = receipt.full_acceptance ? 0 : 1;
