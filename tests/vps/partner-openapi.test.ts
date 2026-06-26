import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('partner.openapi.json documents only the partner domain and partner routes', () => {
  const spec = JSON.parse(readFileSync('partner.openapi.json', 'utf8'));
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.servers[0].url, 'https://partners.empx.io');
  assert.ok(spec.paths['/partner/register']);
  assert.ok(spec.paths['/partner/tiers']);
  assert.ok(spec.paths['/partner/quote']);
  assert.ok(spec.paths['/partner/quote/select']);
  assert.ok(spec.paths['/partner/intent/{intentId}']);
  assert.ok(spec.paths['/partner/intent/{intentId}/submitted']);
  assert.equal(spec.paths['/api/v1/health'], undefined);
  assert.equal(spec.components.securitySchemes.PartnerApiKey.name, 'x-api-key');
});
