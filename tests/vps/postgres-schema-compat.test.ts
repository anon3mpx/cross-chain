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
    /missing provider-direct rail support/i,
  );
});

test('assertPostgresRailSchemaCompatibility accepts Gas.zip and Hyperlane-capable constraints', async () => {
  await assert.doesNotReject(() => assertPostgresRailSchemaCompatibility({
    query: async () => ({
      rows: [
        { conname: 'intents_rail_check', def: "CHECK ((rail = ANY (ARRAY['CCTP'::text, 'GASZIP'::text, 'HYPERLANE_NEXUS'::text, 'CHAINFLIP'::text, 'MAYA'::text, 'TELESWAP'::text])))" },
        { conname: 'intents_fallback_rail_check', def: "CHECK ((fallback_rail IS NULL OR fallback_rail = ANY (ARRAY['CCTP'::text, 'GASZIP'::text, 'HYPERLANE_NEXUS'::text, 'CHAINFLIP'::text, 'MAYA'::text, 'TELESWAP'::text])))" },
        { conname: 'intent_rail_attempts_rail_check', def: "CHECK ((rail = ANY (ARRAY['CCTP'::text, 'GASZIP'::text, 'HYPERLANE_NEXUS'::text, 'CHAINFLIP'::text, 'MAYA'::text, 'TELESWAP'::text])))" },
      ],
    }),
  } as any));
});

test('toFriendlyIntentPersistenceError rewrites stale provider-direct rail check violations', () => {
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

test('toFriendlyIntentPersistenceError also rewrites deferred Phase 3 rail constraint violations', () => {
  const rewritten = toFriendlyIntentPersistenceError(
    {
      code: '23514',
      constraint: 'intent_rail_attempts_rail_check',
      message: 'new row violates check constraint',
    },
    { rail: 'MAYA' },
  );

  assert.ok(rewritten instanceof Error);
  assert.match(rewritten!.message, /Chainflip, Maya, or TeleSwap/i);
});
