import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPoolFromEnv, type PostgresEnv } from './postgres';

export function loadEnvFile(filePath: string, env: PostgresEnv = process.env): void {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!key || env[key as keyof PostgresEnv] !== undefined) continue;

    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key as keyof PostgresEnv] = value;
  }
}

export function collectMigrationFiles(dbDir: string): string[] {
  const schemaFile = path.join(dbDir, 'schema.sql');
  const migrationsDir = path.join(dbDir, 'migrations');
  const files = [schemaFile];

  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((entry) => entry.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right))
      .map((entry) => path.join(migrationsDir, entry));
    files.push(...migrationFiles);
  }

  return files;
}

export async function runMigrations(env: PostgresEnv = process.env): Promise<void> {
  const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
  const files = collectMigrationFiles(dbDir);
  const pool = createPostgresPoolFromEnv(env);

  try {
    for (const file of files) {
      const sql = fs.readFileSync(file, 'utf8');
      if (!sql.trim()) continue;
      await pool.query(sql);
      process.stdout.write(`[db:migrate] applied ${path.relative(process.cwd(), file)}\n`);
    }
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  if (!process.env.DATABASE_URL && !(process.env.PGHOST && process.env.PGDATABASE)) {
    throw new Error('DATABASE_URL or PGHOST/PGDATABASE credentials are required');
  }
  await runMigrations(process.env);
}

const isEntrypoint = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isEntrypoint) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[db:migrate] ${message}\n`);
    process.exitCode = 1;
  });
}
