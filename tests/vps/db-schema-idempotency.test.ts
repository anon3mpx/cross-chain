import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('schema.sql drops updated_at triggers before recreating them', () => {
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'src/vps/db/schema.sql'), 'utf8');

  for (const triggerName of [
    'trg_intents_updated_at',
    'trg_intent_refund_cases_updated_at',
    'trg_intent_provider_transfers_updated_at',
    'trg_chain_event_offsets_updated_at',
    'trg_task_outbox_updated_at',
  ]) {
    assert.match(
      schema,
      new RegExp(`DROP TRIGGER IF EXISTS ${triggerName} ON [^;]+;[\\s\\S]*CREATE TRIGGER ${triggerName}`),
    );
  }
});

test('schema.sql defines provider-direct transfer tracking table', () => {
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'src/vps/db/schema.sql'), 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS intent_provider_transfers/);
  assert.match(schema, /provider\s+TEXT NOT NULL/);
  assert.match(schema, /provider_quote_id\s+TEXT NOT NULL/);
  assert.match(schema, /source_tx_hash\s+TEXT/);
  assert.match(schema, /source_signature\s+TEXT/);
  assert.match(schema, /destination_tx_hash\s+TEXT/);
  assert.match(schema, /latest_provider_status\s+TEXT/);
  assert.match(schema, /raw_error_payload\s+JSONB/);
  assert.match(schema, /CONSTRAINT uq_intent_provider_transfer UNIQUE \(intent_id, provider, provider_quote_id\)/);
  assert.match(schema, /idx_intents_lz_value_transfer_quote_id/);
});

test('schema.sql defines reliability and relayer nonce persistence tables', () => {
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'src/vps/db/schema.sql'), 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS route_outcomes/);
  assert.match(schema, /execution_mode\s+TEXT/);
  assert.match(schema, /offer_type\s+TEXT/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS relayer_nonces/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS relayer_nonce_cursor/);
});
