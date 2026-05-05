import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

const BASE_USDC = '0x0000000000000000000000000000000000001001';
const BASE_AXLUSDC = '0x0000000000000000000000000000000000001002';
const BASE_ETH = '0x0000000000000000000000000000000000001003';
const ARB_USDC = '0x0000000000000000000000000000000000002001';
const ARB_AXLUSDC = '0x0000000000000000000000000000000000002002';
const ARB_ETH = '0x0000000000000000000000000000000000002003';

const TEST_ENV: Record<string, string> = {
  CHAIN_8453_TOKEN_CCTP_USDC: BASE_USDC,
  CHAIN_8453_TOKEN_AXELAR_USDC: BASE_AXLUSDC,
  CHAIN_8453_TOKEN_LAYERZERO_USDC: BASE_USDC,
  CHAIN_8453_TOKEN_VIA_LABS_USDC: BASE_USDC,
  CHAIN_8453_TOKEN_THORCHAIN_USDC: BASE_USDC,
  CHAIN_8453_TOKEN_AXELAR_ETH: BASE_ETH,
  CHAIN_8453_TOKEN_LAYERZERO_ETH: BASE_ETH,
  CHAIN_8453_TOKEN_VIA_LABS_ETH: BASE_ETH,
  CHAIN_8453_TOKEN_THORCHAIN_ETH: BASE_ETH,
  CHAIN_42161_TOKEN_CCTP_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_AXELAR_USDC: ARB_AXLUSDC,
  CHAIN_42161_TOKEN_LAYERZERO_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_VIA_LABS_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_THORCHAIN_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_AXELAR_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_LAYERZERO_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_VIA_LABS_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_THORCHAIN_ETH: ARB_ETH,
  CHAIN_8453_ROUTER_V1: '0x1111111111111111111111111111111111111111',
  CHAIN_42161_RECEIVER_V1: '0x2222222222222222222222222222222222222222',
  VPS_INTENT_SIGNER_PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945382db45d7d771f4f5c4b7b0d5c3d53d4f52',
};

const QUOTE_REQUEST = {
  tokenIn: BASE_USDC,
  tokenOut: ARB_USDC,
  amountIn: '100000000',
  srcChainId: 8453,
  dstChainId: 42161,
  userAddress: '0x3333333333333333333333333333333333333333',
  destinationGas: [{ provider: 'gaszip', chainId: 42161, amountWei: '800000000000000' }],
};

function withPatchedEnv(extraEnv: Record<string, string>, fn: () => Promise<void>) {
  const nextEnv = { ...TEST_ENV, ...extraEnv };
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(nextEnv)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return fn().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function listen(app: express.Express) {
  const server = await new Promise<ReturnType<express.Express['listen']>>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    },
  };
}

test('status API can select a composed primary-transfer plus Gas.zip destination gas flow and aggregate status', async () => {
  await withPatchedEnv({}, async () => {
    const [
      { QuoteEngine },
      { IntentEngine },
      { IntentService },
      { buildStatusAPI },
    ] = await Promise.all([
      import('../../src/vps/services/QuoteEngine'),
      import('../../src/vps/services/IntentEngine'),
      import('../../src/vps/services/IntentService'),
      import('../../src/vps/api/StatusAPI'),
    ]);

    const quoteEngine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: undefined,
      layerZeroValueTransferApiQuoteWorker: undefined,
      gasZipQuoteWorker: {
        quoteDirectDeposit: async () => ({
          srcChainId: 8453,
          dstChainId: 42161,
          recipient: QUOTE_REQUEST.userAddress,
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
    quoteEngine.registerDexQuoteFn(8453, async (_tokenIn, _tokenOut, amountIn) => amountIn);
    quoteEngine.registerDexQuoteFn(42161, async (_tokenIn, _tokenOut, amountIn) => amountIn);

    const intentService = new IntentService(new IntentEngine());
    const server = await listen(buildStatusAPI(intentService, quoteEngine));

    try {
      const quoteRes = await fetch(`${server.baseUrl}/quote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(QUOTE_REQUEST),
      });
      assert.equal(quoteRes.status, 200);
      const quoteBody = await quoteRes.json() as any;

      const selectRes = await fetch(`${server.baseUrl}/quote/select-composed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userAddress: QUOTE_REQUEST.userAddress,
          offerSetId: quoteBody.offerSet.offerSetId,
          primaryTransferOfferId: quoteBody.gasZipComposition.primaryTransferOfferId,
          gasZipDestinationGasOfferId: quoteBody.gasZipComposition.gasZipDestinationGasOfferId,
        }),
      });

      assert.equal(selectRes.status, 200);
      const selectionBody = await selectRes.json() as any;
      assert.equal(selectionBody.status, 'QUOTED');
      assert.equal(selectionBody.primaryTransfer.quote.rail, 'CCTP');
      assert.equal(selectionBody.gasZipDestinationGas.quote.rail, 'GASZIP');
      assert.equal(selectionBody.gasZipDestinationGas.integration.action.kind, 'gaszip_transfer');
      assert.match(selectionBody.tracking.statusPath, /\/intent\/composed\//);

      await intentService.markSubmitted(selectionBody.primaryTransfer.intentId, '0xprimary');
      await intentService.markSubmitted(selectionBody.gasZipDestinationGas.intentId, '0xgaszip');

      const composedStatusRes = await fetch(`${server.baseUrl}${selectionBody.tracking.statusPath}`);
      assert.equal(composedStatusRes.status, 200);
      const composedStatus = await composedStatusRes.json() as any;
      assert.equal(composedStatus.status, 'SUBMITTED');
      assert.equal(composedStatus.primaryTransfer.intentId, selectionBody.primaryTransfer.intentId);
      assert.equal(composedStatus.gasZipDestinationGas.intentId, selectionBody.gasZipDestinationGas.intentId);

      await intentService.markSettled(selectionBody.primaryTransfer.intentId, '0xdstprimary');

      const partialRes = await fetch(`${server.baseUrl}${selectionBody.tracking.statusPath}`);
      assert.equal(partialRes.status, 200);
      const partial = await partialRes.json() as any;
      assert.equal(partial.status, 'PARTIALLY_SETTLED');
    } finally {
      quoteEngine.resetDexQuoteFns();
      await server.close();
    }
  });
});

