import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  DEFAULT_PARTNER_API_BASE_URL,
  EmpxCrossChainSDK,
  IntentStatus,
  SwapHandle,
  type SwapQuote,
} from '../../src/vps/sdk/EmpxCrossChainSDK';

async function listen(app: express.Express): Promise<{ baseUrl: string; close(): Promise<void> }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}

function makeQuote(intentId: string): SwapQuote {
  return {
    intentId,
    estimatedOut: '1.000000',
    minOut: '0.990000',
    rawEstimatedOut: '1000000',
    rawMinOut: '990000',
    feeUSD: 0,
    rail: 'CCTP',
    etaSeconds: 60,
    expiresAt: 1_717_171_717,
    integration: {
      mode: 'router_intent',
      contractAddress: '0x1111111111111111111111111111111111111111',
      calldata: '0xabcdef',
      value: '123',
      tx: {
        to: '0x1111111111111111111111111111111111111111',
        data: '0xabcdef',
        value: '123',
        chainId: 1,
      },
    },
    tx: {
      to: '0x1111111111111111111111111111111111111111',
      data: '0xabcdef',
      value: '123',
      chainId: 1,
    },
  };
}

test('EmpxCrossChainSDK defaults to the dedicated partner API domain', () => {
  const sdk = new EmpxCrossChainSDK({ apiKey: 'partner-key' });
  assert.equal(DEFAULT_PARTNER_API_BASE_URL, 'https://partners.empx.io');
  assert.equal((sdk as any).baseUrl, DEFAULT_PARTNER_API_BASE_URL);
});

test('EmpxCrossChainSDK.quote follows partner quote/select and normalizes router intent integration', async () => {
  let quoteBody: any;
  let selectBody: any;

  const app = express();
  app.use(express.json());
  app.post('/partner/quote', (req, res) => {
    assert.equal(req.get('x-api-key'), 'partner-key');
    quoteBody = req.body;
    res.json({
      offerSet: {
        offerSetId: 'ofs_1',
        bestOfferId: 'offer_best',
        offers: [
          { offerId: 'offer_alt', rail: 'AXELAR' },
          { offerId: 'offer_best', rail: 'CCTP' },
        ],
      },
    });
  });
  app.post('/partner/quote/select', (req, res) => {
    assert.equal(req.get('x-api-key'), 'partner-key');
    selectBody = req.body;
    res.json({
      intentId: 'intent_sdk_1',
      quote: {
        intentId: 'intent_sdk_1',
        estimatedOut: '1000000',
        minAmountOut: '990000',
        feeAmountUSD: 0,
        rail: 'CCTP',
        etaSeconds: 45,
        expiresAt: 1_717_171_717,
      },
      integration: {
        contractAddress: '0x1111111111111111111111111111111111111111',
        calldata: '0xabcdef',
        value: '123',
        expiresAt: 1_717_171_717,
      },
    });
  });

  const server = await listen(app);
  try {
    const sdk = new EmpxCrossChainSDK({
      apiKey: 'partner-key',
      baseUrl: server.baseUrl,
      integratorId: 'int_1',
      agentId: 'agent_1',
    });

    const quote = await sdk.quote({
      from: {
        chainId: 1,
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '1',
        decimals: 6,
      },
      to: {
        chainId: 8453,
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
      },
      wallet: '0x3333333333333333333333333333333333333333',
    });

    assert.deepEqual(quoteBody, {
      tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amountIn: '1000000',
      srcChainId: 1,
      dstChainId: 8453,
      userAddress: '0x3333333333333333333333333333333333333333',
      urgency: 'normal',
      integratorId: 'int_1',
      agentId: 'agent_1',
    });
    assert.deepEqual(selectBody, {
      userAddress: '0x3333333333333333333333333333333333333333',
      offerSetId: 'ofs_1',
      offerId: 'offer_best',
      integratorId: 'int_1',
      agentId: 'agent_1',
    });

    assert.equal(quote.intentId, 'intent_sdk_1');
    assert.equal(quote.rail, 'CCTP');
    assert.equal(quote.rawEstimatedOut, '1000000');
    assert.equal(quote.tx?.to, '0x1111111111111111111111111111111111111111');
    assert.equal(quote.integration.mode, 'router_intent');
    assert.equal(quote.integration.tx.chainId, 1);
  } finally {
    await server.close();
  }
});

test('EmpxCrossChainSDK.quote preserves provider-direct integration payloads', async () => {
  const app = express();
  app.use(express.json());
  app.post('/partner/quote', (_req, res) => {
    res.json({
      offerSet: {
        offerSetId: 'ofs_direct',
        bestOfferId: 'offer_hyperlane',
        offers: [{ offerId: 'offer_hyperlane', rail: 'HYPERLANE_NEXUS' }],
      },
    });
  });
  app.post('/partner/quote/select', (_req, res) => {
    res.json({
      intentId: 'intent_direct_1',
      quote: {
        intentId: 'intent_direct_1',
        estimatedOut: '1000000',
        minAmountOut: '1000000',
        feeAmountUSD: 0,
        rail: 'HYPERLANE_NEXUS',
        etaSeconds: 60,
        expiresAt: 1_717_171_717,
      },
      integration: {
        mode: 'provider_direct',
        action: {
          kind: 'hyperlane_transfer_remote',
          warpRouteAddress: '0x4444444444444444444444444444444444444444',
          destinationDomain: 8453,
          interchainGasFee: '50000',
        },
        approvals: [{
          token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          spender: '0x4444444444444444444444444444444444444444',
          amount: '1000000',
        }],
        tx: {
          to: '0x4444444444444444444444444444444444444444',
          data: '0x1234',
          value: '50000',
          chainId: 1,
        },
      },
    });
  });

  const server = await listen(app);
  try {
    const sdk = new EmpxCrossChainSDK({ apiKey: 'partner-key', baseUrl: server.baseUrl });
    const quote = await sdk.quote({
      from: {
        chainId: 1,
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '1',
        decimals: 6,
      },
      to: {
        chainId: 8453,
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
      },
      wallet: '0x3333333333333333333333333333333333333333',
    });

    assert.equal(quote.integration.mode, 'provider_direct');
    assert.equal(quote.integration.action.kind, 'hyperlane_transfer_remote');
    assert.equal(quote.tx?.to, '0x4444444444444444444444444444444444444444');
    assert.equal(quote.tx?.chainId, 1);
  } finally {
    await server.close();
  }
});

test('SwapHandle.markSubmitted uses the partner submitted endpoint with provider-direct payload shape', async () => {
  let submittedBody: any;

  const app = express();
  app.use(express.json());
  app.post('/partner/intent/:id/submitted', (req, res) => {
    assert.equal(req.params.id, 'intent_submit_1');
    assert.equal(req.get('x-api-key'), 'partner-key');
    submittedBody = req.body;
    res.status(202).json({
      intentId: 'intent_submit_1',
      status: IntentStatus.SUBMITTED,
      srcTxHash: '0xsource',
      rail: 'CCTP',
      etaSeconds: 45,
    });
  });

  const server = await listen(app);
  try {
    const handle = new SwapHandle(makeQuote('intent_submit_1'), server.baseUrl, 'partner-key');
    const status = await handle.markSubmitted({
      userAddress: '0x3333333333333333333333333333333333333333',
      sourceTxHash: '0xsource',
    });

    assert.deepEqual(submittedBody, {
      userAddress: '0x3333333333333333333333333333333333333333',
      sourceTxHash: '0xsource',
    });
    assert.equal(status.status, IntentStatus.SUBMITTED);
    assert.equal(status.srcTxHash, '0xsource');
  } finally {
    await server.close();
  }
});

test('SwapHandle cancel and refund fail explicitly because PartnerAPI does not expose those routes', async () => {
  const handle = new SwapHandle(makeQuote('intent_unsupported_1'), 'http://127.0.0.1:1', 'partner-key');

  await assert.rejects(
    handle.cancel({ userAddress: '0x3333333333333333333333333333333333333333' }),
    /Partner API does not expose cancel/i,
  );
  await assert.rejects(
    handle.requestRefund({
      userAddress: '0x3333333333333333333333333333333333333333',
      reason: 'stuck',
    }),
    /Partner API does not expose refund/i,
  );
});
