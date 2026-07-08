#!/usr/bin/env node
import { createHash } from 'node:crypto';
import http from 'node:http';
import assert from 'node:assert/strict';

const LIMIT = 3;
const RETRY_AFTER_SECONDS = 30;
const FORBIDDEN_TELEMETRY_KEYS = [
  'token',
  'tenant_id',
  'user_email',
  'auth_code',
  'api_key',
  'client_secret',
];

const manifest = {
  manifest_version: 1,
  schema_revision: '2026-05-17',
  service: {
    status: 'operational',
    message: null,
    cache_ttl_seconds: 300,
  },
};

const body = JSON.stringify(manifest);
const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
const buckets = new Map();
const observations = [];

function writeJson(res, status, payload, extraHeaders = {}) {
  const json = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    ...extraHeaders,
  });
  res.end(json);
}

function identityKey(req) {
  return req.socket.remoteAddress || 'unknown';
}

function checkLimit(req) {
  const key = identityKey(req);
  const current = buckets.get(key) || { count: 0 };
  current.count += 1;
  buckets.set(key, current);

  if (current.count > LIMIT) {
    observations.push({
      event: 'throttled',
      identity_key_kind: 'client_ip',
      cache_header_present: Boolean(req.headers['if-none-match'] || req.headers['cache-control']),
    });
    return false;
  }

  observations.push({ event: 'allowed', identity_key_kind: 'client_ip' });
  return true;
}

const server = http.createServer((req, res) => {
  if (req.url !== '/v1/manifest') {
    writeJson(res, 404, { error: 'not_found' });
    return;
  }

  if (req.method !== 'GET') {
    writeJson(
      res,
      405,
      { error: 'method_not_allowed', allowed: ['GET'] },
      { Allow: 'GET' },
    );
    return;
  }

  if (!checkLimit(req)) {
    writeJson(
      res,
      429,
      { error: 'rate_limited', retry_after_seconds: RETRY_AFTER_SECONDS },
      { 'Retry-After': String(RETRY_AFTER_SECONDS) },
    );
    return;
  }

  const commonHeaders = {
    ETag: etag,
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    Vary: 'Accept-Encoding',
    'X-Manifest-Revision': manifest.schema_revision,
  };

  if (req.headers['if-none-match'] === etag) {
    observations.push({ event: 'cache_revalidated', identity_key_kind: 'client_ip' });
    res.writeHead(304, commonHeaders);
    res.end();
    return;
  }

  observations.push({ event: 'origin_hit', identity_key_kind: 'client_ip' });
  writeJson(res, 200, manifest, commonHeaders);
});

function listen() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.equal(typeof address, 'object');
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

function assertNoForbiddenTelemetry() {
  for (const observation of observations) {
    for (const key of Object.keys(observation)) {
      assert.equal(
        FORBIDDEN_TELEMETRY_KEYS.includes(key),
        false,
        `telemetry contains forbidden key ${key}`,
      );
    }
  }
}

async function main() {
  const baseUrl = await listen();

  try {
    const methodResponse = await fetch(`${baseUrl}/v1/manifest`, { method: 'POST' });
    assert.equal(methodResponse.status, 405);
    assert.equal(methodResponse.headers.get('allow'), 'GET');
    assert.deepEqual(await readJson(methodResponse), {
      error: 'method_not_allowed',
      allowed: ['GET'],
    });

    const first = await fetch(`${baseUrl}/v1/manifest`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('etag'), etag);
    assert.equal(first.headers.get('cache-control'), 'public, max-age=300, stale-while-revalidate=600');
    assert.equal(first.headers.get('vary'), 'Accept-Encoding');
    assert.equal(first.headers.get('x-manifest-revision'), manifest.schema_revision);
    assert.deepEqual(await readJson(first), manifest);

    const conditional = await fetch(`${baseUrl}/v1/manifest`, {
      headers: { 'If-None-Match': etag },
    });
    assert.equal(conditional.status, 304);
    assert.equal(await conditional.text(), '');

    const noCache = await fetch(`${baseUrl}/v1/manifest`, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Accept-Encoding': 'br',
        'X-Forwarded-For': '203.0.113.10',
      },
    });
    assert.equal(noCache.status, 200);

    const overLimit = await fetch(`${baseUrl}/v1/manifest`, {
      headers: {
        'If-None-Match': etag,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Accept-Encoding': 'gzip',
        'X-Forwarded-For': '198.51.100.77',
      },
    });
    assert.equal(overLimit.status, 429);
    assert.equal(overLimit.headers.get('retry-after'), String(RETRY_AFTER_SECONDS));
    assert.deepEqual(await readJson(overLimit), {
      error: 'rate_limited',
      retry_after_seconds: RETRY_AFTER_SECONDS,
    });

    const events = observations.map((observation) => observation.event);
    assert.equal(events.includes('allowed'), true);
    assert.equal(events.includes('origin_hit'), true);
    assert.equal(events.includes('cache_revalidated'), true);
    assert.equal(events.includes('throttled'), true);
    assertNoForbiddenTelemetry();

    console.log(
      JSON.stringify(
        {
          ok: true,
          route: '/v1/manifest',
          fixture_limit: `${LIMIT} requests/window`,
          retry_after_seconds: RETRY_AFTER_SECONDS,
          evidence: {
            statuses: [200, 304, 405, 429],
            cache_header_non_bypass: true,
            retry_after_header: true,
            telemetry_redacted: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
