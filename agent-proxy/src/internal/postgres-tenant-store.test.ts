import { describe, expect, it, vi } from 'vitest';
import authFixture from '../auth/fixtures/fortemi-auth-v1.json';
import { createFortemiAuthVerifier, FortemiAuthError } from '../auth/index.js';
import tenantFixture from './fixtures/tenant-registry-v1.json';
import {
  PostgresTenantStore,
  composePostgresTenantStore,
  type TenantQueryExecutor,
} from './postgres-tenant-store.js';

type FixtureRow = { tenantId: string; status: string };

class FakeExecutor implements TenantQueryExecutor {
  readonly calls: Array<{ text: string; values: unknown[] }> = [];

  constructor(
    private readonly rows: FixtureRow[] = [],
    private readonly failure?: Error,
    private readonly rowCount = rows.length,
  ) {}

  async query<Row extends Record<string, unknown>>(text: string, values: unknown[]) {
    this.calls.push({ text, values });
    if (this.failure) throw this.failure;
    return { rowCount: this.rowCount, rows: this.rows as unknown as Row[] };
  }
}

class FakePool extends FakeExecutor {
  readonly end = vi.fn(async () => {});
  errorListener?: (error: Error) => void;

  on(_event: 'error', listener: (error: Error) => void): this {
    this.errorListener = listener;
    return this;
  }
}

function validToken(): string {
  return authFixture.cases.find((entry) => entry.id === 'valid')!.token;
}

function verifierFor(rows: FixtureRow[]) {
  return createFortemiAuthVerifier({
    issuer: authFixture.config.issuer,
    audience: authFixture.config.audience,
    tenantClaimName: authFixture.config.tenant_claim_name,
    clockSkewSeconds: authFixture.config.clock_skew_seconds,
    jwks: authFixture.jwks,
    tenantStore: new PostgresTenantStore(new FakeExecutor(rows)),
  });
}

describe('PostgresTenantStore', () => {
  it('uses Fortemi tenant_registry with a parameterized tenant UUID', async () => {
    const fixture = tenantFixture.cases.find((entry) => entry.id === 'active')!;
    const executor = new FakeExecutor([fixture.row as FixtureRow]);

    await expect(new PostgresTenantStore(executor).lookup(fixture.tenant_id)).resolves.toEqual({
      tenantId: fixture.tenant_id,
      status: 'active',
    });
    expect(executor.calls).toHaveLength(1);
    expect(executor.calls[0].text).toContain('FROM public.tenant_registry');
    expect(executor.calls[0].text).toContain('WHERE id = $1::uuid');
    expect(executor.calls[0].text).not.toContain(fixture.tenant_id);
    expect(executor.calls[0].values).toEqual([fixture.tenant_id]);
  });

  it('admits the authority JWT only for the active fixture tenant', async () => {
    const fixture = tenantFixture.cases.find((entry) => entry.id === 'active')!;
    const context = await verifierFor([fixture.row as FixtureRow])(validToken(), 'read:note');
    expect(context.tenantId).toBe(fixture.tenant_id);
    expect(context.credential).toMatchObject({ algorithm: 'RS256', keyId: 'fixture-key-1' });
  });

  it.each(tenantFixture.cases.filter((entry) => 'error' in entry.expected))(
    'does not enumerate the $id tenant state',
    async (fixture) => {
      const rows = fixture.row ? [fixture.row as FixtureRow] : [];
      await expect(verifierFor(rows)(validToken(), 'read:note')).rejects.toMatchObject({
        code: fixture.expected.error,
        httpStatus: fixture.expected.http_status,
      });
    },
  );

  it.each([
    ['query failure', new FakeExecutor([], new Error('postgres://user:secret@db/internal'))],
    ['unknown status', new FakeExecutor([{
      tenantId: tenantFixture.cases[0].tenant_id,
      status: 'pending',
    }])],
    ['tenant mismatch', new FakeExecutor([{
      tenantId: '00000000-0000-4000-8000-000000000002',
      status: 'active',
    }])],
    ['duplicate rows', new FakeExecutor([
      tenantFixture.cases[0].row as FixtureRow,
      tenantFixture.cases[0].row as FixtureRow,
    ])],
    ['row-count mismatch', new FakeExecutor([], undefined, 1)],
  ])('reduces %s to tenant_store_unavailable', async (_label, executor) => {
    await expect(
      new PostgresTenantStore(executor).lookup(tenantFixture.cases[0].tenant_id),
    ).rejects.toEqual(new FortemiAuthError('tenant_store_unavailable'));
  });
});

describe('composePostgresTenantStore', () => {
  it('preserves local mode without constructing a database pool', async () => {
    const createPool = vi.fn();
    const composition = composePostgresTenantStore({ environment: {}, createPool });
    expect(composition.tenantStore).toBeUndefined();
    expect(createPool).not.toHaveBeenCalled();
    await composition.close();
  });

  it('constructs one bounded pool and closes it once', async () => {
    const pool = new FakePool();
    const createPool = vi.fn(() => pool);
    const reportUnavailable = vi.fn();
    const composition = composePostgresTenantStore({
      environment: {
        FORTEMI_TENANT_DATABASE_URL: 'postgresql://tenant-reader:fixture@db/fortemi',
      },
      createPool,
      reportUnavailable,
    });

    expect(composition.tenantStore).toBeInstanceOf(PostgresTenantStore);
    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({
      application_name: 'hotm-agent-proxy-tenant-store',
      max: 4,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      query_timeout: 5_000,
      statement_timeout: 5_000,
      allowExitOnIdle: true,
    }));
    pool.errorListener?.(new Error('private database detail'));
    expect(reportUnavailable).toHaveBeenCalledTimes(1);
    await composition.close();
    await composition.close();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it.each([
    { FORTEMI_TENANT_DATABASE_URL: 'https://db.invalid/fortemi' },
    {
      FORTEMI_TENANT_DATABASE_URL: 'postgresql://db/fortemi',
      FORTEMI_TENANT_DB_POOL_MAX: '0',
    },
    {
      FORTEMI_TENANT_DATABASE_URL: 'postgresql://db/fortemi',
      FORTEMI_TENANT_DB_QUERY_TIMEOUT_MS: 'not-a-number',
    },
  ])('fails closed for invalid pool configuration', (environment) => {
    expect(() => composePostgresTenantStore({ environment })).toThrowError(
      new FortemiAuthError('config_error'),
    );
  });
});
