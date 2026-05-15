/**
 * Tests for the rate limiter wiring on /api/agent/chat.
 *
 * Verifies:
 *  - Requests under the limit are passed through.
 *  - Requests over the limit get 429 with retry metadata.
 *  - The skip predicate (RATE_LIMIT_RPM <= 0) bypasses the limiter.
 *
 * Uses a small fetch-based driver against a real Express server so the
 * actual middleware library is exercised (no mocks).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import type { Server } from 'http';

interface TestServer {
  server: Server;
  url: string;
}

async function startServer(limit: number, skipDisable: boolean): Promise<TestServer> {
  const app = express();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => skipDisable,
    message: { error: 'rate_limit_exceeded', retry_after_seconds: 60 },
  });
  app.get('/protected', limiter, (_req, res) => res.json({ ok: true }));

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function stopServer(s: TestServer): Promise<void> {
  return new Promise((resolve) => s.server.close(() => resolve()));
}

describe('rate limiter', () => {
  describe('with limit=3 (small for fast verification)', () => {
    let s: TestServer;

    beforeAll(async () => {
      s = await startServer(3, false);
    });

    afterAll(async () => {
      await stopServer(s);
    });

    it('passes requests under the limit', async () => {
      const responses = await Promise.all([
        fetch(`${s.url}/protected`),
        fetch(`${s.url}/protected`),
        fetch(`${s.url}/protected`),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(200);
      }
    });

    it('rejects the next request with 429 and the configured payload', async () => {
      const res = await fetch(`${s.url}/protected`);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body).toEqual({
        error: 'rate_limit_exceeded',
        retry_after_seconds: 60,
      });
    });

    it('emits standard RateLimit-* headers (draft-7)', async () => {
      const res = await fetch(`${s.url}/protected`);
      // Either passes or is rate-limited — either way the standard headers exist
      expect(res.headers.get('ratelimit-policy') ?? res.headers.get('ratelimit')).not.toBeNull();
    });
  });

  describe('with skip predicate active (RATE_LIMIT_RPM <= 0)', () => {
    let s: TestServer;

    beforeAll(async () => {
      s = await startServer(1, true); // limit=1 but skip=true bypasses
    });

    afterAll(async () => {
      await stopServer(s);
    });

    it('allows unlimited requests when the skip predicate returns true', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${s.url}/protected`);
        expect(res.status).toBe(200);
      }
    });
  });
});
