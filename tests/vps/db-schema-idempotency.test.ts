import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('schema.sql drops updated_at triggers before recreating them', () => {
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'src/vps/db/schema.sql'), 'utf8');

  for (const triggerName of [
    'trg_intents_updated_at',
    'trg_intent_refund_cases_updated_at',
    'trg_chain_event_offsets_updated_at',
    'trg_task_outbox_updated_at',
  ]) {
    assert.match(
      schema,
      new RegExp(`DROP TRIGGER IF EXISTS ${triggerName} ON [^;]+;[\\s\\S]*CREATE TRIGGER ${triggerName}`),
    );
  }
});

