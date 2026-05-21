import test from 'node:test';
import assert from 'node:assert/strict';
import { GasZipQuoteWorker } from '../../src/vps/services/gaszip/GasZipQuoteWorker';

const USER = '0x3333333333333333333333333333333333333333';
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

test('GasZipQuoteWorker maps direct-deposit quotes into provider-direct execution payloads', async () => {
  const worker = new GasZipQuoteWorker(
    {
      listChains: async () => ({
        chains: [
          { name: 'Base', chain: 8453, short: 1, gas: '21000', gwei: '1', bal: '1', rpcs: [], symbol: 'ETH', price: 2500 },
          { name: 'Arbitrum', chain: 42161, short: 2, gas: '21000', gwei: '0.1', bal: '1', rpcs: [], symbol: 'ETH', price: 2500 },
        ],
      }),
      getQuoteReverse: async (depositChain, outboundWei, outboundChain) => {
        assert.equal(depositChain, 8453);
        assert.equal(outboundWei, '800000000000000');
        assert.equal(outboundChain, 42161);
        return {
          chain: 8453,
          required: 805000000000000,
          gas: 5000000000000,
          speed: 7,
          usd: 2.01,
        };
      },
      getCalldataQuote: async (depositChain, depositWei, outboundChains, params) => {
        assert.equal(depositChain, 8453);
        assert.equal(depositWei, '805000000000000');
        assert.deepEqual(outboundChains, [42161]);
        assert.equal(params.to, USER);
        assert.equal(params.from, USER);
        return {
          calldata: '0x010039',
          quotes: [
            {
              chain: 42161,
              expected: '800000000000000',
              gas: '5000000000000',
              speed: 7,
              usd: 2.01,
            },
          ],
        };
      },
    },
    {
      enabled: true,
      directDepositAddress: '0x391E7C679d29bD940d63be94AD22A25d25b5A604',
    },
  );

  const result = await worker.quoteDirectDeposit({
    tokenIn: NATIVE,
    tokenOut: NATIVE,
    amountIn: 1n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: USER,
    destinationGas: [{ chainId: 42161, amountWei: '800000000000000' }],
  });

  assert.ok(result);
  assert.equal(result!.srcChainId, 8453);
  assert.equal(result!.dstChainId, 42161);
  assert.equal(result!.requestedAmountWei, '800000000000000');
  assert.equal(result!.expectedAmountWei, '800000000000000');
  assert.equal(result!.sourceValueWei, '805000000000000');
  assert.equal(result!.directDepositAddress, '0x391E7C679d29bD940d63be94AD22A25d25b5A604');
  assert.equal(result!.calldata, '0x010039');
  assert.equal(result!.recipient, USER);
});

test('GasZipQuoteWorker returns null when destination gas is absent', async () => {
  const worker = new GasZipQuoteWorker(
    {
      listChains: async () => ({ chains: [] }),
      getQuoteReverse: async () => {
        throw new Error('should not be called');
      },
      getCalldataQuote: async () => {
        throw new Error('should not be called');
      },
    },
    { enabled: true },
  );

  const noGasRequest = await worker.quoteDirectDeposit({
    tokenIn: NATIVE,
    tokenOut: NATIVE,
    amountIn: 1n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: USER,
  });

  assert.equal(noGasRequest, null);
});

test('GasZipQuoteWorker can quote destination gas for non-native primary transfer requests', async () => {
  const worker = new GasZipQuoteWorker(
    {
      listChains: async () => ({
        chains: [
          { name: 'Base', chain: 8453, short: 1, gas: '21000', gwei: '1', bal: '1', rpcs: [], symbol: 'ETH', price: 2500 },
          { name: 'Arbitrum', chain: 42161, short: 2, gas: '21000', gwei: '0.1', bal: '1', rpcs: [], symbol: 'ETH', price: 2500 },
        ],
      }),
      getQuoteReverse: async () => ({
        chain: 8453,
        required: 805000000000000,
        gas: 5000000000000,
        speed: 7,
        usd: 2.01,
      }),
      getCalldataQuote: async () => ({
        calldata: '0x010039',
        quotes: [
          {
            chain: 42161,
            expected: '800000000000000',
            gas: '5000000000000',
            speed: 7,
            usd: 2.01,
          },
        ],
      }),
    },
    { enabled: true },
  );

  const result = await worker.quoteDirectDeposit({
    tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    tokenOut: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: USER,
    destinationGas: [{ chainId: 42161, amountWei: '800000000000000' }],
  });

  assert.ok(result);
  assert.equal(result!.expectedAmountWei, '800000000000000');
});
