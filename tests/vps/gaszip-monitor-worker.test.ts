import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { GasZipMonitorWorker } from '../../src/vps/services/gaszip/GasZipMonitorWorker';
import { IntentStatus, Rail, SettlementToken, type QuoteResult } from '../../src/vps/types';

function makeGasZipQuote(intentId: string): QuoteResult {
  return {
    intentId,
    srcChainId: 8453,
    dstChainId: 42161,
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    amountIn: 805000000000000n,
    estimatedOut: 800000000000000n,
    minAmountOut: 800000000000000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0,
    feeAmountToken: 0n,
    rail: Rail.GASZIP,
    railType: 'messaging',
    settlementToken: SettlementToken.ETH,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 800000000000000n,
    dstGasLimit: 0,
    etaSeconds: 1,
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    railPluginId: '0x' + '00'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
    nativeDstAddress: '0x3333333333333333333333333333333333333333',
    selectedByUser: true,
  };
}

test('GasZipMonitorWorker moves submitted intents into transit when the source tx is mined', async () => {
  const intentService = new IntentService(new IntentEngine());
  const intentId = '0x' + '12'.repeat(32);
  await intentService.createQuotedIntent(makeGasZipQuote(intentId), '0x3333333333333333333333333333333333333333');
  await intentService.markSubmitted(intentId, '0x' + 'ab'.repeat(32));

  const worker = new GasZipMonitorWorker(
    intentService,
    {
      listChains: async () => ({ chains: [] }),
      getQuoteReverse: async () => {
        throw new Error('not used');
      },
      getCalldataQuote: async () => {
        throw new Error('not used');
      },
      searchTransaction: async () => null,
    },
    async (chainId) => ({
      getTransactionReceipt: async (txHash) => {
        assert.equal(chainId, 8453);
        assert.equal(txHash, '0x' + 'ab'.repeat(32));
        return { status: 1 };
      },
    }),
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.ok(intent);
  assert.equal(intent.status, IntentStatus.IN_TRANSIT);
});

test('GasZipMonitorWorker marks destination received when Gas.zip exposes a pending outbound tx', async () => {
  const intentService = new IntentService(new IntentEngine());
  const intentId = '0x' + '34'.repeat(32);
  await intentService.createQuotedIntent(makeGasZipQuote(intentId), '0x3333333333333333333333333333333333333333');
  await intentService.markSubmitted(intentId, '0x' + 'cd'.repeat(32));

  const worker = new GasZipMonitorWorker(
    intentService,
    {
      listChains: async () => ({ chains: [] }),
      getQuoteReverse: async () => {
        throw new Error('not used');
      },
      getCalldataQuote: async () => {
        throw new Error('not used');
      },
      searchTransaction: async (hash) => {
        assert.equal(hash, '0x' + 'cd'.repeat(32));
        return {
          deposit: {
            block: 1,
            chain: 8453,
            hash,
            log: 0,
            sender: '0xsender',
            shorts: [42161],
            status: 'CONFIRMED',
            time: Date.now(),
            to: '0xreceiver',
            usd: 2,
            value: '805000000000000',
          },
          txs: [
            {
              chain: 42161,
              hash: '0x' + 'ef'.repeat(32),
              nonce: 1,
              refund: false,
              cancelled: false,
              signer: '0xsigner',
              status: 'PENDING',
              time: Date.now(),
              to: '0xreceiver',
              usd: 2,
              value: 800000000000000,
            },
          ],
        };
      },
    },
    async () => null,
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.ok(intent);
  assert.equal(intent.status, IntentStatus.DESTINATION_RECEIVED);
  assert.equal(intent.dstTxHash, '0x' + 'ef'.repeat(32));
});

test('GasZipMonitorWorker settles from Gas.zip confirmed outbound status', async () => {
  const intentService = new IntentService(new IntentEngine());
  const intentId = '0x' + '56'.repeat(32);
  await intentService.createQuotedIntent(makeGasZipQuote(intentId), '0x3333333333333333333333333333333333333333');
  await intentService.markSubmitted(intentId, '0x' + 'aa'.repeat(32));
  await intentService.markInTransit(intentId, '0x' + 'aa'.repeat(32));

  const worker = new GasZipMonitorWorker(
    intentService,
    {
      listChains: async () => ({ chains: [] }),
      getQuoteReverse: async () => {
        throw new Error('not used');
      },
      getCalldataQuote: async () => {
        throw new Error('not used');
      },
      searchTransaction: async () => ({
        deposit: {
          block: 1,
          chain: 8453,
          hash: '0x' + 'aa'.repeat(32),
          log: 0,
          sender: '0xsender',
          shorts: [42161],
          status: 'CONFIRMED',
          time: Date.now(),
          to: '0xreceiver',
          usd: 2,
          value: '805000000000000',
        },
        txs: [
          {
            chain: 42161,
            hash: '0x' + 'bb'.repeat(32),
            nonce: 1,
            refund: false,
            cancelled: false,
            signer: '0xsigner',
            status: 'CONFIRMED',
            time: Date.now(),
            to: '0xreceiver',
            usd: 2,
            value: 800000000000000,
          },
        ],
      }),
    },
    async () => null,
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.ok(intent);
  assert.equal(intent.status, IntentStatus.SETTLED);
  assert.equal(intent.dstTxHash, '0x' + 'bb'.repeat(32));
});
