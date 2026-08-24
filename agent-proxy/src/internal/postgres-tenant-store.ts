import { Pool, type PoolConfig, type QueryResult } from 'pg';
import {
  FortemiAuthError,
  type TenantRecord,
  type TenantStatus,
  type TenantStore,
} from '../auth/index.js';

const TENANT_LOOKUP_SQL = `
  SELECT id::text AS "tenantId", status
    FROM public.tenant_registry
   WHERE id = $1::uuid
`;

const TENANT_STATUSES = new Set<TenantStatus>(['active', 'suspended', 'soft_deleted']);

type TenantRow = Record<string, unknown> & {
  tenantId: unknown;
  status: unknown;
};

export interface TenantQueryExecutor {
  query<Row extends Record<string, unknown>>(
    text: string,
    values: unknown[],
  ): Promise<Pick<QueryResult<Row>, 'rowCount' | 'rows'>>;
}

interface TenantPool extends TenantQueryExecutor {
  end(): Promise<void>;
  on(event: 'error', listener: (error: Error) => void): this;
}

export interface TenantStoreComposition {
  readonly tenantStore?: TenantStore;
  close(): Promise<void>;
}

export interface TenantStoreCompositionOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly createPool?: (config: PoolConfig) => TenantPool;
  readonly reportUnavailable?: () => void;
}

function configError(): never {
  throw new FortemiAuthError('config_error');
}

function boundedInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(environment[name] ?? String(defaultValue));
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) configError();
  return value;
}

function databaseUrl(environment: NodeJS.ProcessEnv): string | null {
  const value = environment.FORTEMI_TENANT_DATABASE_URL?.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) configError();
  } catch (error) {
    if (error instanceof FortemiAuthError) throw error;
    configError();
  }
  return value;
}

function tenantStoreUnavailable(): FortemiAuthError {
  return new FortemiAuthError('tenant_store_unavailable');
}

/** Internal adapter for Fortemi's system-scoped tenant_registry authority. */
export class PostgresTenantStore implements TenantStore {
  constructor(private readonly executor: TenantQueryExecutor) {}

  async lookup(tenantId: string): Promise<TenantRecord | null> {
    let result: Pick<QueryResult<TenantRow>, 'rowCount' | 'rows'>;
    try {
      result = await this.executor.query<TenantRow>(TENANT_LOOKUP_SQL, [tenantId]);
    } catch {
      throw tenantStoreUnavailable();
    }

    if (result.rowCount !== result.rows.length || result.rows.length > 1) {
      throw tenantStoreUnavailable();
    }
    const row = result.rows[0];
    if (!row) return null;
    if (
      typeof row.tenantId !== 'string'
      || row.tenantId !== tenantId
      || typeof row.status !== 'string'
      || !TENANT_STATUSES.has(row.status as TenantStatus)
    ) {
      throw tenantStoreUnavailable();
    }
    return { tenantId: row.tenantId, status: row.status as TenantStatus };
  }
}

/** Compose the hosted adapter only when its dedicated least-privilege DB URL exists. */
export function composePostgresTenantStore(
  options: TenantStoreCompositionOptions = {},
): TenantStoreComposition {
  const environment = options.environment ?? process.env;
  const connectionString = databaseUrl(environment);
  if (!connectionString) {
    return Object.freeze({ tenantStore: undefined, close: async () => {} });
  }

  const poolConfig: PoolConfig = {
    connectionString,
    application_name: 'hotm-agent-proxy-tenant-store',
    max: boundedInteger(environment, 'FORTEMI_TENANT_DB_POOL_MAX', 4, 1, 32),
    connectionTimeoutMillis: boundedInteger(
      environment,
      'FORTEMI_TENANT_DB_CONNECT_TIMEOUT_MS',
      5_000,
      100,
      30_000,
    ),
    idleTimeoutMillis: boundedInteger(
      environment,
      'FORTEMI_TENANT_DB_IDLE_TIMEOUT_MS',
      30_000,
      1_000,
      300_000,
    ),
    query_timeout: boundedInteger(
      environment,
      'FORTEMI_TENANT_DB_QUERY_TIMEOUT_MS',
      5_000,
      100,
      30_000,
    ),
    statement_timeout: boundedInteger(
      environment,
      'FORTEMI_TENANT_DB_QUERY_TIMEOUT_MS',
      5_000,
      100,
      30_000,
    ),
    allowExitOnIdle: true,
  };
  const pool = (options.createPool ?? ((config) => new Pool(config)))(poolConfig);
  const reportUnavailable = options.reportUnavailable
    ?? (() => console.error('[agent-proxy] Tenant store connection unavailable'));
  pool.on('error', reportUnavailable);
  const tenantStore = Object.freeze(new PostgresTenantStore(pool));
  let closed = false;

  return Object.freeze({
    tenantStore,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await pool.end();
    },
  });
}
