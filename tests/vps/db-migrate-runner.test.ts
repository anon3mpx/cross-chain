import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectMigrationFiles, loadEnvFile } from '../../src/vps/db/migrate';

test('collectMigrationFiles returns schema first and SQL migrations in lexical order', () => {
  const rootDir = path.resolve(process.cwd(), 'src/vps/db');
  const files = collectMigrationFiles(rootDir);

  assert.ok(files.length >= 2);
  assert.equal(path.basename(files[0]!), 'schema.sql');
  assert.deepEqual(
    files.map((file) => path.relative(rootDir, file)),
    [
      'schema.sql',
      'migrations/20260505_add_gaszip_rail_constraints.sql',
      'migrations/20260605_add_relayer_nonces.sql',
      'migrations/20260605_add_reliability_and_attribution.sql',
    ],
  );
});

test('loadEnvFile reads DATABASE_URL from .env-style files without overwriting existing env', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-db-migrate-'));
  const envFile = path.join(tempDir, '.env');
  fs.writeFileSync(
    envFile,
    [
      '# comment',
      'DATABASE_URL=postgres://local:test@localhost:5432/ruflo',
      'PGSSL=true',
      'EXISTING=from-file',
      '',
    ].join('\n'),
    'utf8',
  );

  const env: Record<string, string | undefined> = {
    EXISTING: 'already-set',
  };

  loadEnvFile(envFile, env);

  assert.equal(env.DATABASE_URL, 'postgres://local:test@localhost:5432/ruflo');
  assert.equal(env.PGSSL, 'true');
  assert.equal(env.EXISTING, 'already-set');
});
