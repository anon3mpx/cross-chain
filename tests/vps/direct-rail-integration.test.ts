import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSelectedOfferIntegration } from '../../src/vps/services/DirectRailIntegrationBuilder';

test('provider_direct THOR offers return deposit instructions instead of RouterV1 calldata', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '11'.repeat(32), {
    executionMode: 'provider_direct',
    execution: {
      provider: 'thorchain',
      quote: {
        inbound_address: '0xthorvault',
        memo: '=:BTC.BTC:bc1qexample:0',
        expiry: 1_800_000_000,
        expected_amount_out: '100000000',
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'thorchain_swap');
  assert.equal(integration.action.depositAddress, '0xthorvault');
});

test('provider_direct THOR offers infer provider from rail metadata when execution.provider is absent', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '22'.repeat(32), {
    rail: 'THORCHAIN',
    offerType: 'thor_api_direct',
    executionMode: 'provider_direct',
    execution: {
      quote: {
        inbound_address: '0xthorvault2',
        memo: '=:ETH.ETH:0xabc:0',
        expiry: 1_900_000_000,
        expected_amount_out: '90000000',
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'thorchain_swap');
  assert.equal(integration.action.depositAddress, '0xthorvault2');
});
