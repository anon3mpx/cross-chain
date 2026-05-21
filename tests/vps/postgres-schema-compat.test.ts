import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPostgresRailSchemaCompatibility,
  toFriendlyIntentPersistenceError,
} from '../../src/vps/db/schemaCompatibility';

test('assertPostgresRailSchemaCompatibility throws when intents rail constraints do not include GASZIP', async () => {
  await assert.rejects(
    () => assertPostgresRailSchemaCompatibility({
      query: async () => ({
        rows: [
          { conname: 'intents_rail_check', def: "CHECK ((rail = ANY (ARRAY['CCTP'::text, 'AXELAR'::text])))" },
          { conname: 'intents_fallback_rail_check', def: "CHECK ((fallback_rail IS NULL OR fallback_rail = ANY (ARRAY['CCTP'::text, 'AXELAR'::text])))" },
          { conname: 'intent_rail_attempts_rail_check', def: "CHECK ((rail = ANY (ARRAY['CCTP'::text, 'AXELAR'::text])))" },
        ],
      }),
    } as any),
    /missing GASZIP rail support/i,
  );
});

test('assertPostgresRailSchemaCompatibility accepts GASZIP-capable constraints', async () => {
  await assert.doesNotReject(() => assertPostgresRailSchemaCompatibility({
    query: async () => ({
      rows: [
        { conname: 'intents_rail_check', def: "CHECK ((rail = ANY (ARRAY['CCTP'::text, 'GASZIP'::text])))" },
        { conname: 'intents_fallback_rail_check', def: "CHECK ((fallback_rail IS NULL OR fallback_rail = ANY (ARRAY['CCTP'::text, 'GASZIP'::text])))" },
        { conname: 'intent_rail_attempts_rail_check', def: "CHECK ((rail = ANY (ARRAY['CCTP'::text, 'GASZIP'::text])))" },
      ],
    }),
  } as any));
});

test('toFriendlyIntentPersistenceError rewrites stale GASZIP rail check violations', () => {
  const rewritten = toFriendlyIntentPersistenceError(
    {
      code: '23514',
      constraint: 'intents_rail_check',
      message: 'new row for relation "intents" violates check constraint "intents_rail_check"',
    },
    { rail: 'GASZIP' },
  );

  assert.ok(rewritten instanceof Error);
  assert.match(rewritten!.message, /run `npm run db:migrate`/i);
});

