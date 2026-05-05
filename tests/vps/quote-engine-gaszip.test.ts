import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';

const USER = '0x3333333333333333333333333333333333333333';
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

test('QuoteEngine includes Gas.zip provider-direct offers for destination gas direct deposits', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    layerZeroValueTransferApiQuoteWorker: undefined,
    gasZipQuoteWorker: {
      quoteDirectDeposit: async () => ({
        srcChainId: 8453,
        dstChainId: 42161,
        recipient: USER,
        requestedAmountWei: '800000000000000',
        expectedAmountWei: '800000000000000',
        sourceValueWei: '805000000000000',
        expiresAt: Math.floor(Date.now() / 1000) + 90,
        directDepositAddress: '0x391E7C679d29bD940d63be94AD22A25d25b5A604',
        calldata: '0x010039',
        sourceSymbol: 'ETH',
        destinationSymbol: 'ETH',
        providerFeeUsd: 0,
        settlementTimeSeconds: 7,
      }),
    } as any,
  } as any);

  const offerSet = await engine.getOffers({
    tokenIn: NATIVE,
    tokenOut: NATIVE,
    amountIn: 1n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: USER,
    destinationGas: [{ chainId: 42161, amountWei: '800000000000000' }],
  } as any);

  assert.ok(offerSet);
  const offer = offerSet!.offers.find((candidate) =>
    candidate.offerType === 'gaszip_api_direct'
      && candidate.executionMode === 'provider_direct',
  );
  assert.ok(offer);
  assert.equal(offer!.amountIn, 805000000000000n);
  assert.equal(offer!.estimatedOut, 800000000000000n);
  assert.equal(offer!.execution.provider, 'gaszip');
  assert.equal(offer!.execution.directDepositAddress, '0x391E7C679d29bD940d63be94AD22A25d25b5A604');
});
