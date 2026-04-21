import { Pool } from 'pg';
import { IntentEngine } from '../services/IntentEngine';
import { createPostgresPoolFromEnv } from './postgres';
import { IntentPersistence, IntentPersistenceOptions } from './IntentPersistence';
import { IntentRepository } from './IntentRepository';

export interface PostgresIntentStore {
  pool: Pool;
  repo: IntentRepository;
}

export interface PostgresIntentPersistence {
  pool: Pool;
  repo: IntentRepository;
  persistence: IntentPersistence;
}

export function createPostgresIntentStore(): PostgresIntentStore {
  const pool = createPostgresPoolFromEnv();
  const repo = new IntentRepository(pool);
  return { pool, repo };
}

/**
 * Hooks Postgres persistence into the existing in-memory IntentEngine.
 * This gives durable intent snapshots/events without forcing a full service refactor.
 */
export function attachPostgresIntentPersistence(
  intentEngine: IntentEngine,
  options: IntentPersistenceOptions = {},
): PostgresIntentPersistence {
  const pool = createPostgresPoolFromEnv();
  const repo = new IntentRepository(pool);
  const persistence = new IntentPersistence(intentEngine, repo, options);
  persistence.start();

  return { pool, repo, persistence };
}
