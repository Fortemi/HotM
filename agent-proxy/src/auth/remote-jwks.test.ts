import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JSONWebKeySet,
} from 'jose';
import { describe, expect, it } from 'vitest';

import {
  createFortemiAuthVerifier,
  FortemiAuthError,
  type FortemiAuthConfig,
} from './verify.js';

const ISSUER = 'https://issuer.example.test';
const AUDIENCE = 'fortemi-agent-proxy';
const TENANT_CLAIM = 'fortemi:tenant_id';
const TENANT_ID = '00000000-0000-4000-8000-000000000001';

async function signingKey(kid: string) {
  const pair = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = {
    ...await exportJWK(pair.publicKey),
    kid,
    alg: 'RS256',
    use: 'sig',
  };
  return { ...pair, publicJwk };
}

async function tokenFor(
  privateKey: CryptoKey,
  kid: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    scope: 'agent:chat',
    [TENANT_CLAIM]: TENANT_ID,
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('principal-1')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

interface JwksServer {
  readonly url: URL;
  readonly requestCount: () => number;
  close(): Promise<void>;
}

async function jwksServer(
  response: () => { status?: number; body: unknown },
  delayMs = 0,
): Promise<JwksServer> {
  let requests = 0;
  const server: Server = createServer(async (_request, result) => {
    requests += 1;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const current = response();
    result.statusCode = current.status ?? 200;
    result.setHeader('Content-Type', 'application/json');
    result.end(JSON.stringify(current.body));
  });
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: new URL(`http://127.0.0.1:${port}/jwks.json`),
    requestCount: () => requests,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

function remoteConfig(url: URL, overrides: Partial<FortemiAuthConfig['remoteJwks']> = {}): FortemiAuthConfig {
  return {
    issuer: ISSUER,
    audience: AUDIENCE,
    tenantClaimName: TENANT_CLAIM,
    clockSkewSeconds: 0,
    jwksUrl: url,
    remoteJwks: {
      timeoutDuration: overrides.timeoutDuration ?? 1_000,
      cooldownDuration: overrides.cooldownDuration ?? 30_000,
      cacheMaxAge: overrides.cacheMaxAge ?? 60_000,
    },
    tenantStore: {
      async lookup(tenantId) {
        return { tenantId, status: 'active' };
      },
    },
  };
}

describe('reusable remote JWKS resolver', () => {
  it('coalesces concurrent fetches and reuses the cached key set', async () => {
    const key = await signingKey('key-1');
    const token = await tokenFor(key.privateKey, 'key-1');
    const server = await jwksServer(
      () => ({ body: { keys: [key.publicJwk] } satisfies JSONWebKeySet }),
      25,
    );
    try {
      const config = remoteConfig(server.url);
      const verify = createFortemiAuthVerifier(config);
      await Promise.all(Array.from({ length: 12 }, () => verify(token)));
      expect(server.requestCount()).toBe(1);

      // The verifier owns an immutable URL snapshot and one resolver instance.
      (config as { jwksUrl: URL }).jwksUrl = new URL('http://127.0.0.1:1/unreachable');
      await verify(token);
      expect(server.requestCount()).toBe(1);
    } finally {
      await server.close();
    }
  });

  it('reloads once on a new kid and admits a rotated signing key', async () => {
    const first = await signingKey('key-1');
    const second = await signingKey('key-2');
    let keys: JSONWebKeySet = { keys: [first.publicJwk] };
    const server = await jwksServer(() => ({ body: keys }));
    try {
      const verify = createFortemiAuthVerifier(remoteConfig(server.url, {
        cooldownDuration: 0,
      }));
      await verify(await tokenFor(first.privateKey, 'key-1'));
      keys = { keys: [second.publicJwk] };
      const rotated = await verify(await tokenFor(second.privateKey, 'key-2'));
      expect(rotated.credential.keyId).toBe('key-2');
      expect(server.requestCount()).toBe(2);
    } finally {
      await server.close();
    }
  });

  it('maps a JWKS endpoint outage to the shared redacted 503 error', async () => {
    const key = await signingKey('key-1');
    const server = await jwksServer(() => ({ status: 503, body: { diagnostic: 'private' } }));
    try {
      const failure = await createFortemiAuthVerifier(remoteConfig(server.url))(
        await tokenFor(key.privateKey, 'key-1'),
      ).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(FortemiAuthError);
      expect(failure).toMatchObject({ code: 'jwks_unreachable', httpStatus: 503 });
      expect(JSON.stringify(failure)).not.toContain('private');
    } finally {
      await server.close();
    }
  });

  it('maps malformed JWKS cache material to the shared redacted 503 error', async () => {
    const key = await signingKey('key-1');
    const server = await jwksServer(() => ({ body: { not_keys: [] } }));
    try {
      const failure = await createFortemiAuthVerifier(remoteConfig(server.url))(
        await tokenFor(key.privateKey, 'key-1'),
      ).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(FortemiAuthError);
      expect(failure).toMatchObject({ code: 'jwks_cache_failure', httpStatus: 503 });
    } finally {
      await server.close();
    }
  });
});
