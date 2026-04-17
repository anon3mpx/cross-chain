import { Pool, PoolConfig } from 'pg';

export interface PostgresEnv {
  DATABASE_URL?: string;
  PGHOST?: string;
  PGPORT?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
  PGDATABASE?: string;
  PGSSL?: string;
  PGPOOL_MAX?: string;
  PG_IDLE_TIMEOUT_MS?: string;
  PG_CONNECTION_TIMEOUT_MS?: string;
}

function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createPostgresPoolFromEnv(env: PostgresEnv = process.env): Pool {
  const hasUrl = !!env.DATABASE_URL;
  const sslEnabled = (env.PGSSL ?? '').toLowerCase() === 'true';

  const config: PoolConfig = hasUrl
    ? {
        connectionString: env.DATABASE_URL,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: env.PGHOST,
        port: readInt(env.PGPORT, 5432),
        user: env.PGUSER,
        password: env.PGPASSWORD,
        database: env.PGDATABASE,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      };

  config.max = readInt(env.PGPOOL_MAX, 20);
  config.idleTimeoutMillis = readInt(env.PG_IDLE_TIMEOUT_MS, 30_000);
  config.connectionTimeoutMillis = readInt(env.PG_CONNECTION_TIMEOUT_MS, 10_000);

  return new Pool(config);
}
