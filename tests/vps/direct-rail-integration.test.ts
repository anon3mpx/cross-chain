import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, ZeroAddress } from 'ethers';
import { buildSelectedOfferIntegration } from '../../src/vps/services/DirectRailIntegrationBuilder';

const THOR_ROUTER_IFACE = new Interface([
  'function depositWithExpiry(address payable vault,address asset,uint256 amount,string memo,uint256 expiration)',
]);
const HYPERLANE_WARP_ROUTE_IFACE = new Interface([
  'function transferRemote(uint32 destinationDomain, bytes32 recipient, uint256 amount) payable returns (bytes32)',
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

test('provider_direct Hyperlane offers return transferRemote tx helpers and approvals', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '99'.repeat(32), {
    rail: 'HYPERLANE_NEXUS',
    offerType: 'hyperlane_nexus_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'hyperlane_explorer',
      warpRouteAddress: '0x' + 'a'.repeat(40),
      destinationDomain: 8453,
      interchainGasFee: '50000000000000',
      quote: {
        srcChainId: 1,
        tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: 1_000_000n,
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'hyperlane_transfer_remote');
  assert.equal(integration.action.warpRouteAddress, '0x' + 'a'.repeat(40));
  assert.equal(integration.action.destinationDomain, 8453);
  assert.equal(integration.action.interchainGasFee, '50000000000000');
  assert.equal(integration.approvals?.[0]?.spender, '0x' + 'a'.repeat(40));

  assert.ok(integration.tx);
  assert.equal(integration.tx!.to, '0x' + 'a'.repeat(40));
  assert.equal(integration.tx!.value, '50000000000000');
  assert.equal(integration.tx!.chainId, 1);

  const decoded = HYPERLANE_WARP_ROUTE_IFACE.decodeFunctionData('transferRemote', integration.tx!.data);
  assert.equal(decoded.destinationDomain, 8453n);
  assert.equal(decoded.amount.toString(), '1000000');
});

test('provider_direct Chainflip offers return deposit helpers and ERC-20 transfer txs', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + 'aa'.repeat(32), {
    rail: 'CHAINFLIP',
    offerType: 'chainflip_broker_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'chainflip_broker',
      depositAddress: '0x4444444444444444444444444444444444444444',
      channelId: 'cf-channel-1',
      expectedAmountOut: '990000',
      quote: {
        srcChainId: 1,
        tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: 1_000_000n,
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'chainflip_deposit');
  assert.equal(integration.action.depositAddress, '0x4444444444444444444444444444444444444444');
  assert.equal(integration.action.channelId, 'cf-channel-1');
  assert.equal(integration.action.expectedAmountOut, '990000');
  assert.equal(integration.tx?.to, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  assert.equal(integration.tx?.chainId, 1);
  assert.equal(integration.tx?.value, '0');
});

test('provider_direct Maya offers return vault deposit instructions and router tx helpers', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + 'bb'.repeat(32), {
    rail: 'MAYA',
    offerType: 'maya_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'maya_midgard',
      vaultAddress: '0x5555555555555555555555555555555555555555',
      memo: '=:ARB.USDC:0xabc',
      expectedAmountOut: '985000',
      expiresAt: 1_900_000_123,
      quote: {
        srcChainId: 1,
        tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: 1_000_000n,
      },
      routerAddress: '0x6666666666666666666666666666666666666666',
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'maya_swap');
  assert.equal(integration.action.depositAddress, '0x5555555555555555555555555555555555555555');
  assert.equal(integration.action.memo, '=:ARB.USDC:0xabc');
  assert.equal(integration.action.expectedAmountOut, '985000');
  assert.ok(integration.tx);
  assert.equal(integration.tx!.to, '0x6666666666666666666666666666666666666666');
  assert.equal(integration.tx!.value, '0');

  const decoded = THOR_ROUTER_IFACE.decodeFunctionData('depositWithExpiry', integration.tx!.data);
  assert.equal(decoded.vault.toLowerCase(), '0x5555555555555555555555555555555555555555');
  assert.equal(decoded.asset.toLowerCase(), '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
  assert.equal(decoded.amount.toString(), '1000000');
  assert.equal(decoded.memo, '=:ARB.USDC:0xabc');
  assert.equal(decoded.expiration.toString(), '1900000123');
});

test('provider_direct TeleSwap offers return deposit helpers for direct source deposits', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + 'cc'.repeat(32), {
    rail: 'TELESWAP',
    offerType: 'teleswap_direct',
    executionMode: 'provider_direct',
    execution: {
      provider: 'teleswap_api',
      depositAddress: '0x7777777777777777777777777777777777777777',
      swapId: 'ts-swap-1',
      expectedAmountOut: '970000',
      quote: {
        srcChainId: 137,
        tokenIn: '0x1111111111111111111111111111111111111111',
        amountIn: 1_000_000n,
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'teleswap_deposit');
  assert.equal(integration.action.depositAddress, '0x7777777777777777777777777777777777777777');
  assert.equal(integration.action.swapId, 'ts-swap-1');
  assert.equal(integration.action.expectedAmountOut, '970000');
  assert.equal(integration.tx?.to, '0x1111111111111111111111111111111111111111');
  assert.equal(integration.tx?.value, '0');
  assert.equal(integration.tx?.chainId, 137);
});
