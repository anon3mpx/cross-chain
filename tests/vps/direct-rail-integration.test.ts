import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, ZeroAddress } from 'ethers';
import { buildSelectedOfferIntegration } from '../../src/vps/services/DirectRailIntegrationBuilder';

const THOR_ROUTER_IFACE = new Interface([
  'function depositWithExpiry(address payable vault,address asset,uint256 amount,string memo,uint256 expiration)',
]);

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

test('provider_direct THOR offers use execution.thorQuote payload when quote is normalized', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '33'.repeat(32), {
    rail: 'THORCHAIN',
    offerType: 'thor_api_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'thorchain_api',
      quote: {
        tokenIn: 'BASE.ETH',
        tokenOut: 'BASE.USDC',
        amountIn: '500000000000000',
      },
      thorQuote: {
        inbound_address: '0xthorvault3',
        memo: '=:BASE.USDC:0xabc',
        expiry: 1_900_000_123,
        expected_amount_out: '12345678',
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'thorchain_swap');
  assert.equal(integration.action.depositAddress, '0xthorvault3');
  assert.equal(integration.action.memo, '=:BASE.USDC:0xabc');
  assert.equal(integration.action.expiresAt, 1_900_000_123);
  assert.equal(integration.action.expectedAmountOut, '12345678');
});

test('provider_direct THOR offers include tx helper for ERC-20 deposits', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '44'.repeat(32), {
    rail: 'THORCHAIN',
    offerType: 'thor_api_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'thorchain_api',
      quote: {
        srcChainId: 8453,
        tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amountIn: '10000000',
      },
      thorQuote: {
        router: '0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4',
        inbound_address: '0x4feea1caeea66b3351ddba68bd80c37c9ed6c3c8',
        memo: '=:BASE.USDC:0x05F8cC8753D90d67DBB8c02118440b8283F941c9',
        expiry: 1_900_000_123,
        expected_amount_out: '12345678',
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.ok(integration.tx);
  assert.equal(integration.tx!.to, '0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4');
  assert.equal(integration.tx!.value, '0');
  assert.equal(integration.tx!.chainId, 8453);

  const decoded = THOR_ROUTER_IFACE.decodeFunctionData('depositWithExpiry', integration.tx!.data);
  assert.equal(decoded.vault.toLowerCase(), '0x4feea1caeea66b3351ddba68bd80c37c9ed6c3c8');
  assert.equal(decoded.asset.toLowerCase(), '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
  assert.equal(decoded.amount.toString(), '10000000');
  assert.equal(decoded.memo, '=:BASE.USDC:0x05F8cC8753D90d67DBB8c02118440b8283F941c9');
  assert.equal(decoded.expiration.toString(), '1900000123');
});

test('provider_direct THOR offers set tx value for native deposits', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '55'.repeat(32), {
    rail: 'THORCHAIN',
    offerType: 'thor_api_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'thorchain_api',
      quote: {
        srcChainId: 8453,
        tokenIn: 'BASE.ETH',
        amountIn: '500000000000000',
      },
      thorQuote: {
        router: '0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4',
        inbound_address: '0x4feea1caeea66b3351ddba68bd80c37c9ed6c3c8',
        memo: '=:BASE.USDC:0x05F8cC8753D90d67DBB8c02118440b8283F941c9',
        expiry: 1_900_000_123,
        expected_amount_out: '12345678',
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.ok(integration.tx);
  assert.equal(integration.tx!.value, '500000000000000');
  const decoded = THOR_ROUTER_IFACE.decodeFunctionData('depositWithExpiry', integration.tx!.data);
  assert.equal(decoded.asset.toLowerCase(), ZeroAddress.toLowerCase());
});

test('provider_direct LayerZero Value Transfer API offers return user steps for EVM execution', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '66'.repeat(32), {
    rail: 'LAYERZERO',
    offerType: 'lz_api_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'layerzero_value_transfer_api',
      quote: {
        layerZeroValueTransferApiQuoteId: 'quote_lz_direct',
      },
      layerZeroValueTransferApiQuoteId: 'quote_lz_direct',
      layerZeroValueTransferApiUserSteps: [{
        type: 'TRANSACTION',
        description: 'bridge',
        chainKey: 'base',
        chainType: 'EVM',
        signerAddress: '0x3333333333333333333333333333333333333333',
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
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'layerzero_value_transfer_api');
  assert.equal(integration.action.quoteId, 'quote_lz_direct');
  assert.equal(integration.action.requiresFreshUserSteps, false);
  assert.equal(integration.action.userSteps[0]?.chainType, 'EVM');
});

test('provider_direct LayerZero Value Transfer API offers mark Solana execution as needing fresh user steps', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '77'.repeat(32), {
    rail: 'LAYERZERO',
    offerType: 'lz_api_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'layerzero_value_transfer_api',
      layerZeroValueTransferApiQuoteId: 'quote_lz_solana',
      layerZeroValueTransferApiUserSteps: [{
        type: 'TRANSACTION',
        description: 'bridge',
        chainKey: 'solana',
        chainType: 'SOLANA',
        signerAddress: 'Dz93pUVjXuaMnSsPSn7V99V4cUzhKoQdx9ECwZJZiafG',
        transaction: {
          encoded: {
            encoding: 'base64',
            data: 'AQAB',
          },
        },
      }],
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'layerzero_value_transfer_api');
  assert.equal(integration.action.quoteId, 'quote_lz_solana');
  assert.equal(integration.action.requiresFreshUserSteps, true);
  assert.equal(integration.action.userSteps[0]?.chainType, 'SOLANA');
});

test('provider_direct Gas.zip offers return normalized direct-deposit transaction helpers', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '88'.repeat(32), {
    rail: 'GASZIP',
    offerType: 'gaszip_api_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'gaszip',
      expectedAmountWei: '800000000000000',
      recipient: '0x3333333333333333333333333333333333333333',
      expiresAt: 1_900_000_123,
      directDepositAddress: '0x391E7C679d29bD940d63be94AD22A25d25b5A604',
      quote: {
        srcChainId: 8453,
      },
      tx: {
        to: '0x391E7C679d29bD940d63be94AD22A25d25b5A604',
        data: '0x010039',
        value: '805000000000000',
        chainId: 8453,
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'gaszip_transfer');
  assert.equal(integration.action.expectedAmountOut, '800000000000000');
  assert.equal(integration.tx?.to, '0x391E7C679d29bD940d63be94AD22A25d25b5A604');
  assert.equal(integration.tx?.data, '0x010039');
  assert.equal(integration.tx?.value, '805000000000000');
  assert.equal(integration.tx?.chainId, 8453);
});
