import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';

import { registerDexQuoteAdapters } from '../../src/vps/bootstrap/dexAdapters';

test('registerDexQuoteAdapters uses pooled provider facades when available', async () => {
  let registeredChainId = 0;
  let registeredQuoteFn: ((tokenIn: string, tokenOut: string, amountIn: bigint) => Promise<bigint>) | undefined;
  let getProviderCalls = 0;

  const quoteEngine = {
    registerDexQuoteFn(chainId: number, fn: (tokenIn: string, tokenOut: string, amountIn: bigint) => Promise<bigint>) {
      registeredChainId = chainId;
      registeredQuoteFn = fn;
    },
  } as any;

  const resultInterface = new ethers.Interface([
    'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
  ]);

  registerDexQuoteAdapters(
    quoteEngine,
    {
      CHAIN_1_DEX_QUOTES_ENABLED: '1',
      CHAIN_1_UNIV2_ROUTER: '0x1111111111111111111111111111111111111111',
    },
    {
      getProvider() {
        getProviderCalls += 1;
        return {
          asEthersProvider() {
            return {
              async call(_tx: unknown) {
                return resultInterface.encodeFunctionResult('getAmountsOut', [[5n, 9n]]);
              },
            } as any;
          },
        };
      },
    } as any,
  );

  assert.equal(registeredChainId, 1);
  assert.ok(registeredQuoteFn);
  const amountOut = await registeredQuoteFn!(
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    5n,
  );
  assert.equal(amountOut, 9n);
  assert.equal(getProviderCalls, 1);
});
