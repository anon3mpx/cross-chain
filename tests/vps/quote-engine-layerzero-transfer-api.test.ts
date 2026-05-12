import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { Rail } from '../../src/vps/types';

const USER = '0x3333333333333333333333333333333333333333';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SCROLL_USDC = '0x0000000000000000000000000000000000005343';

test('QuoteEngine includes LayerZero Value Transfer API provider-direct offers', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    layerZeroValueTransferApiQuoteWorker: {
      quoteLayerZeroValueTransferApi: async () => ({
        quote: {
          id: 'quote_lz_direct',
          feeUsd: '0.50',
          srcAmount: '1000000',
          dstAmount: '997000',
          dstAmountMin: '990000',
          routeSteps: [{ type: 'STARGATE_V2_TAXI', srcChainKey: 'base' }],
          userSteps: [{
            type: 'TRANSACTION',
            description: 'bridge',
            chainKey: 'base',
            chainType: 'EVM',
            signerAddress: USER,
            transaction: {
              encoded: {
                chainId: 8453,
                to: '0x27a16dc786820B16E5c9028b75B99F6f604b5d26',
                data: '0x1234',
                value: '456',
              },
            },
          }],
        },
        sourceToken: {
          chainKey: 'base',
          address: BASE_USDC,
          decimals: 6,
          symbol: 'USDC',
          name: 'USD Coin',
        },
        destinationToken: {
          chainKey: 'scroll',
          address: SCROLL_USDC,
          decimals: 6,
          symbol: 'USDC',
          name: 'USD Coin',
        },
        expectedAmountOut: '997000',
        minAmountOut: '990000',
        feeUsd: 0.5,
        settlementTimeSeconds: 45,
        userSteps: [],
      }),
    },
  });

  const offerSet = await engine.getOffers({
    tokenIn: BASE_USDC,
    tokenOut: SCROLL_USDC,
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 534352,
    userAddress: USER,
  });

  assert.ok(offerSet);
  const offer = offerSet.offers.find((candidate) =>
    candidate.rail === Rail.LAYERZERO
      && candidate.executionMode === 'provider_direct'
      && candidate.offerType === 'lz_api_direct',
  );
  assert.ok(offer);
  assert.equal(offer.estimatedOut, 997_000n);
  assert.equal(offer.minAmountOut, 990_000n);
  assert.equal(offer.economics.providerFeeUSD, 0.5);
  assert.equal(offer.economics.protocolFeeUSD, 0);
  assert.equal(offer.execution.provider, 'layerzero_value_transfer_api');
  assert.equal(offer.execution.layerZeroValueTransferApiQuoteId, 'quote_lz_direct');
});
