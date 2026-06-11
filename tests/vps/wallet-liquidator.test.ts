import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletLiquidator } from '../../src/vps/services/WalletLiquidator';

test('WalletLiquidator builds a wallet-liquidator basket from scan results', async () => {
  const liquidator = new WalletLiquidator(
    {
      scan: async () => ({
        wallet: '0x3333333333333333333333333333333333333333',
        scannedAt: Date.now(),
        balances: [{
          chainId: 8453,
          token: '0x1111111111111111111111111111111111111111',
          decimals: 6,
          balance: '1000',
        }],
        skipped: [],
      }),
    } as any,
    {
      quote: async (basket: any) => ({
        basketId: 'bkt_1',
        mode: basket.mode,
        legs: [],
        totals: { inputsUsd: 0, outputsUsd: 0, feeUsd: 0, worstEtaSeconds: 0, parallelEtaSeconds: 0 },
        aggregateTier: 'unknown',
        skipped: [],
        effectiveConstraints: basket.constraints,
        expiresAt: Date.now() + 60_000,
      }),
    } as any,
  );

  const result = await liquidator.quote({
    wallet: '0x3333333333333333333333333333333333333333',
    chainIds: [8453],
    target: {
      chainId: 8453,
      token: '0x2222222222222222222222222222222222222222',
    },
  }, { routeSource: 'agent-sdk' });

  assert.ok(!('error' in result));
  assert.equal(result.basket.mode, 'wallet-liquidator');
  assert.equal(result.basket.inputs.length, 1);
});
