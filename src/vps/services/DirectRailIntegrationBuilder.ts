import { RailOffer, QuoteResult } from '../types';
import { buildRouterIntegration, type RouterIntegration } from './IntentCalldataBuilder';
import { Interface, ZeroAddress, getAddress, isAddress, zeroPadValue } from 'ethers';
import type { LayerZeroValueTransferApiUserStep } from './layerzero/LayerZeroValueTransferApiClient';

const THOR_ROUTER_IFACE = new Interface([
  'function depositWithExpiry(address payable vault,address asset,uint256 amount,string memo,uint256 expiration)',
]);
const ERC20_IFACE = new Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
]);
const HYPERLANE_WARP_ROUTE_IFACE = new Interface([
  'function transferRemote(uint32 destinationDomain, bytes32 recipient, uint256 amount) payable returns (bytes32)',
]);

export type SelectedOfferIntegration =
  | { mode: 'router_intent'; integration: RouterIntegration }
  | {
    mode: 'provider_direct';
    action: {
      kind: 'thorchain_swap';
      depositAddress: string;
      memo: string;
      expiresAt: number;
      expectedAmountOut: string;
    };
    tx?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
    };
  }
  | {
    mode: 'provider_direct';
    action: {
      kind: 'layerzero_value_transfer_api';
      quoteId: string;
      userSteps: LayerZeroValueTransferApiUserStep[];
      requiresFreshUserSteps: boolean;
      submitSignatureRequired: boolean;
    };
  }
  | {
    mode: 'provider_direct';
    action: {
      kind: 'gaszip_transfer';
      recipient: string;
      expectedAmountOut: string;
      expiresAt: number;
    };
    tx?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
    };
  }
  | {
    mode: 'provider_direct';
    action: {
      kind: 'hyperlane_transfer_remote';
      warpRouteAddress: string;
      destinationDomain: number;
      interchainGasFee: string;
    };
    approvals?: Array<{
      token: string;
      spender: string;
      amount: string;
    }>;
    tx?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
    };
  }
  | {
    mode: 'provider_direct';
    action: {
      kind: 'chainflip_deposit';
      depositAddress: string;
      channelId: string;
      expectedAmountOut: string;
    };
    tx?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
    };
  }
  | {
    mode: 'provider_direct';
    action: {
      kind: 'maya_swap';
      depositAddress: string;
      memo: string;
      expiresAt: number;
      expectedAmountOut: string;
    };
    tx?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
    };
  }
  | {
    mode: 'provider_direct';
    action: {
      kind: 'teleswap_deposit';
      depositAddress: string;
      swapId?: string;
      expectedAmountOut: string;
    };
    tx?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
    };
  };

function materializeSelectedOfferQuote(offer: RailOffer): QuoteResult {
  const executionQuote = offer.execution?.quote;
  if (!executionQuote || typeof executionQuote !== 'object') {
    throw new Error(`Selected offer ${offer.offerId} is missing execution quote payload`);
  }

  return executionQuote as QuoteResult;
}

function isThorchainProviderDirectOffer(offer: RailOffer): boolean {
  const provider = typeof offer.execution?.provider === 'string'
    ? offer.execution.provider.toLowerCase()
    : '';
  if (provider === 'thorchain' || provider === 'thorchain_api') return true;
  if (offer.rail === 'THORCHAIN') return true;
  return offer.offerType === 'thor_api_direct';
}

function isLayerZeroValueTransferApiProviderDirectOffer(offer: RailOffer): boolean {
  const provider = typeof offer.execution?.provider === 'string'
    ? offer.execution.provider.toLowerCase()
    : '';
  if (provider === 'layerzero_value_transfer_api') return true;
  return offer.rail === 'LAYERZERO' && offer.offerType === 'lz_api_direct';
}

function isGasZipProviderDirectOffer(offer: RailOffer): boolean {
  const provider = typeof offer.execution?.provider === 'string'
    ? offer.execution.provider.toLowerCase()
    : '';
  if (provider === 'gaszip') return true;
  return offer.rail === 'GASZIP' || offer.offerType === 'gaszip_api_direct';
}

function isHyperlaneNexusProviderDirectOffer(offer: RailOffer): boolean {
  const provider = typeof offer.execution?.provider === 'string'
    ? offer.execution.provider.toLowerCase()
    : '';
  if (provider === 'hyperlane_explorer') return true;
  return offer.rail === 'HYPERLANE_NEXUS' || offer.offerType === 'hyperlane_nexus_direct';
}

function isChainflipProviderDirectOffer(offer: RailOffer): boolean {
  const provider = typeof offer.execution?.provider === 'string'
    ? offer.execution.provider.toLowerCase()
    : '';
  if (provider === 'chainflip_broker') return true;
  return offer.rail === 'CHAINFLIP' || offer.offerType === 'chainflip_broker_direct';
}

function isMayaProviderDirectOffer(offer: RailOffer): boolean {
  const provider = typeof offer.execution?.provider === 'string'
    ? offer.execution.provider.toLowerCase()
    : '';
  if (provider === 'maya_midgard' || provider === 'maya_api') return true;
  return offer.rail === 'MAYA' || offer.offerType === 'maya_direct';
}

function isTeleSwapProviderDirectOffer(offer: RailOffer): boolean {
  const provider = typeof offer.execution?.provider === 'string'
    ? offer.execution.provider.toLowerCase()
    : '';
  if (provider === 'teleswap_api') return true;
  return offer.rail === 'TELESWAP' || offer.offerType === 'teleswap_direct';
}

function readLayerZeroValueTransferApiUserSteps(offer: RailOffer): LayerZeroValueTransferApiUserStep[] {
  const execution = offer.execution as Record<string, unknown>;
  const raw = execution.layerZeroValueTransferApiUserSteps ?? execution.userSteps;
  return Array.isArray(raw) ? raw as LayerZeroValueTransferApiUserStep[] : [];
}

function readLayerZeroValueTransferApiQuoteId(offer: RailOffer): string {
  const execution = offer.execution as Record<string, unknown>;
  const quote = execution.quote as Record<string, unknown> | undefined;
  const raw = execution.layerZeroValueTransferApiQuoteId ?? quote?.layerZeroValueTransferApiQuoteId;
  const quoteId = String(raw ?? '').trim();
  if (!quoteId) {
    throw new Error(`Selected LayerZero Value Transfer API offer ${offer.offerId} is missing quote id`);
  }
  return quoteId;
}

function hasLayerZeroValueTransferApiStepType(
  userSteps: LayerZeroValueTransferApiUserStep[],
  type: string,
): boolean {
  return userSteps.some((step) => step.type.trim().toUpperCase() === type);
}

function requiresFreshLayerZeroValueTransferApiUserSteps(userSteps: LayerZeroValueTransferApiUserStep[]): boolean {
  return userSteps.some((step) => step.chainType.trim().toUpperCase() === 'SOLANA');
}

export async function buildSelectedOfferIntegration(
  intentId: string,
  offer: RailOffer,
  userAddress: string,
): Promise<SelectedOfferIntegration> {
  if (offer.executionMode !== 'provider_direct') {
    const quote = materializeSelectedOfferQuote(offer);
    return {
      mode: 'router_intent',
      integration: await buildRouterIntegration(intentId, quote, userAddress),
    };
  }

  if (isThorchainProviderDirectOffer(offer)) {
    const executionQuote = offer.execution.quote as Record<string, unknown>;
    const thorQuote = (offer.execution as Record<string, unknown>).thorQuote as Record<string, unknown> | undefined;
    const source = thorQuote && typeof thorQuote === 'object' ? thorQuote : executionQuote;
    const depositAddress = String(source.inbound_address ?? '');
    const memo = String(source.memo ?? '');
    const expiresAt = Number(source.expiry ?? 0);
    const expectedAmountOut = String(source.expected_amount_out ?? '');

    const router = String(source.router ?? (offer.execution as Record<string, unknown>).router ?? '');
    const amountInRaw = executionQuote.amountIn;
    const amountIn = typeof amountInRaw === 'bigint'
      ? amountInRaw
      : (() => {
        const raw = String(amountInRaw ?? '').trim();
        return /^\d+$/.test(raw) ? BigInt(raw) : null;
      })();
    const tokenInRaw = String(executionQuote.tokenIn ?? '').trim();
    const tokenInIsAddress = isAddress(tokenInRaw);
    const asset = tokenInIsAddress ? tokenInRaw : ZeroAddress;
    const canBuildTx = isAddress(router) && isAddress(depositAddress) && amountIn !== null && expiresAt > 0 && memo.length > 0;

    return {
      mode: 'provider_direct',
      action: {
        kind: 'thorchain_swap',
        depositAddress,
        memo,
        expiresAt,
        expectedAmountOut,
      },
      ...(canBuildTx
        ? {
          tx: {
            to: router,
            data: THOR_ROUTER_IFACE.encodeFunctionData('depositWithExpiry', [
              depositAddress,
              asset,
              amountIn,
              memo,
              expiresAt,
            ]),
            value: asset === ZeroAddress ? amountIn.toString() : '0',
            chainId: Number(executionQuote.srcChainId ?? 0),
          },
        }
        : {}),
    };
  }

  if (isLayerZeroValueTransferApiProviderDirectOffer(offer)) {
    const userSteps = readLayerZeroValueTransferApiUserSteps(offer);
    return {
      mode: 'provider_direct',
      action: {
        kind: 'layerzero_value_transfer_api',
        quoteId: readLayerZeroValueTransferApiQuoteId(offer),
        userSteps,
        requiresFreshUserSteps: requiresFreshLayerZeroValueTransferApiUserSteps(userSteps),
        submitSignatureRequired: hasLayerZeroValueTransferApiStepType(userSteps, 'SIGNATURE'),
      },
    };
  }

  if (isGasZipProviderDirectOffer(offer)) {
    const execution = offer.execution as Record<string, unknown>;
    const quote = execution.quote as Record<string, unknown> | undefined;
    const rawTx = execution.tx as Record<string, unknown> | undefined;
    const recipient = String(execution.recipient ?? quote?.nativeDstAddress ?? '');
    const expectedAmountOut = String(execution.expectedAmountWei ?? quote?.estimatedOut ?? '');
    const expiresAt = Number(execution.expiresAt ?? quote?.expiresAt ?? 0);
    const tx = rawTx && typeof rawTx === 'object'
      ? {
        to: String(rawTx.to ?? execution.directDepositAddress ?? ''),
        data: String(rawTx.data ?? execution.calldata ?? '0x'),
        value: String(rawTx.value ?? execution.sourceValueWei ?? ''),
        chainId: Number(rawTx.chainId ?? quote?.srcChainId ?? 0),
      }
      : undefined;

    return {
      mode: 'provider_direct',
      action: {
        kind: 'gaszip_transfer',
        recipient,
        expectedAmountOut,
        expiresAt,
      },
      ...(tx && tx.to ? { tx } : {}),
    };
  }

  if (isHyperlaneNexusProviderDirectOffer(offer)) {
    const execution = offer.execution as Record<string, unknown>;
    const quote = execution.quote as Record<string, unknown> | undefined;
    const warpRouteAddress = String(execution.warpRouteAddress ?? '').trim();
    const destinationDomain = Number(execution.destinationDomain ?? 0);
    const interchainGasFee = String(execution.interchainGasFee ?? '0');
    const tokenIn = String(quote?.tokenIn ?? '').trim();
    const amountInRaw = quote?.amountIn;
    const amountIn = typeof amountInRaw === 'bigint'
      ? amountInRaw
      : (() => {
        const raw = String(amountInRaw ?? '').trim();
        return /^\d+$/.test(raw) ? BigInt(raw) : null;
      })();
    const recipient = getAddress(userAddress);
    const canBuildTx = isAddress(warpRouteAddress) && destinationDomain > 0 && amountIn !== null;

    return {
      mode: 'provider_direct',
      action: {
        kind: 'hyperlane_transfer_remote',
        warpRouteAddress,
        destinationDomain,
        interchainGasFee,
      },
      ...(canBuildTx
        ? {
          approvals: isAddress(tokenIn)
            ? [{
              token: tokenIn,
              spender: warpRouteAddress,
              amount: amountIn.toString(),
            }]
            : undefined,
          tx: {
            to: warpRouteAddress,
            data: HYPERLANE_WARP_ROUTE_IFACE.encodeFunctionData('transferRemote', [
              destinationDomain,
              zeroPadValue(recipient, 32),
              amountIn,
            ]),
            value: interchainGasFee,
            chainId: Number(quote?.srcChainId ?? 0),
          },
        }
        : {}),
    };
  }

  if (isChainflipProviderDirectOffer(offer)) {
    const execution = offer.execution as Record<string, unknown>;
    const quote = execution.quote as Record<string, unknown> | undefined;
    const depositAddress = String(execution.depositAddress ?? '').trim();
    const channelId = String(execution.channelId ?? quote?.chainflipChannelId ?? '').trim();
    const expectedAmountOut = String(execution.expectedAmountOut ?? quote?.estimatedOut ?? '');
    const tokenIn = String(quote?.tokenIn ?? '').trim();
    const amountInRaw = quote?.amountIn;
    const amountIn = typeof amountInRaw === 'bigint'
      ? amountInRaw
      : (() => {
        const raw = String(amountInRaw ?? '').trim();
        return /^\d+$/.test(raw) ? BigInt(raw) : null;
      })();
    const canBuildTx = depositAddress.length > 0 && amountIn !== null;
    const tx = canBuildTx
      ? thisOrBuildPassthroughTx(tokenIn, depositAddress, amountIn, Number(quote?.srcChainId ?? 0))
      : undefined;

    return {
      mode: 'provider_direct',
      action: {
        kind: 'chainflip_deposit',
        depositAddress,
        channelId,
        expectedAmountOut,
      },
      ...(tx ? { tx } : {}),
    };
  }

  if (isMayaProviderDirectOffer(offer)) {
    const execution = offer.execution as Record<string, unknown>;
    const quote = execution.quote as Record<string, unknown> | undefined;
    const depositAddress = String(execution.vaultAddress ?? execution.depositAddress ?? '').trim();
    const memo = String(execution.memo ?? '').trim();
    const expiresAt = Number(execution.expiresAt ?? quote?.expiresAt ?? 0);
    const expectedAmountOut = String(execution.expectedAmountOut ?? quote?.estimatedOut ?? '');
    const routerAddress = String(execution.routerAddress ?? '').trim();
    const tokenIn = String(quote?.tokenIn ?? '').trim();
    const amountInRaw = quote?.amountIn;
    const amountIn = typeof amountInRaw === 'bigint'
      ? amountInRaw
      : (() => {
        const raw = String(amountInRaw ?? '').trim();
        return /^\d+$/.test(raw) ? BigInt(raw) : null;
      })();

    let tx: { to: string; data: string; value: string; chainId: number } | undefined;
    if (isAddress(routerAddress) && isAddress(depositAddress) && amountIn !== null && expiresAt > 0 && memo.length > 0) {
      const asset = isAddress(tokenIn) ? tokenIn : ZeroAddress;
      tx = {
        to: routerAddress,
        data: THOR_ROUTER_IFACE.encodeFunctionData('depositWithExpiry', [
          depositAddress,
          asset,
          amountIn,
          memo,
          expiresAt,
        ]),
        value: asset === ZeroAddress ? amountIn.toString() : '0',
        chainId: Number(quote?.srcChainId ?? 0),
      };
    } else if (depositAddress.length > 0 && amountIn !== null) {
      tx = thisOrBuildPassthroughTx(tokenIn, depositAddress, amountIn, Number(quote?.srcChainId ?? 0));
    }

    return {
      mode: 'provider_direct',
      action: {
        kind: 'maya_swap',
        depositAddress,
        memo,
        expiresAt,
        expectedAmountOut,
      },
      ...(tx ? { tx } : {}),
    };
  }

  if (isTeleSwapProviderDirectOffer(offer)) {
    const execution = offer.execution as Record<string, unknown>;
    const quote = execution.quote as Record<string, unknown> | undefined;
    const depositAddress = String(execution.depositAddress ?? '').trim();
    const swapId = String(execution.swapId ?? quote?.teleSwapSwapId ?? '').trim();
    const expectedAmountOut = String(execution.expectedAmountOut ?? quote?.estimatedOut ?? '');
    const tokenIn = String(quote?.tokenIn ?? '').trim();
    const amountInRaw = quote?.amountIn;
    const amountIn = typeof amountInRaw === 'bigint'
      ? amountInRaw
      : (() => {
        const raw = String(amountInRaw ?? '').trim();
        return /^\d+$/.test(raw) ? BigInt(raw) : null;
      })();
    const tx = depositAddress.length > 0 && amountIn !== null
      ? thisOrBuildPassthroughTx(tokenIn, depositAddress, amountIn, Number(quote?.srcChainId ?? 0))
      : undefined;

    return {
      mode: 'provider_direct',
      action: {
        kind: 'teleswap_deposit',
        depositAddress,
        ...(swapId ? { swapId } : {}),
        expectedAmountOut,
      },
      ...(tx ? { tx } : {}),
    };
  }

  throw new Error(`Unsupported provider direct integration for offer ${offer.offerId}`);
}

function thisOrBuildPassthroughTx(
  tokenIn: string,
  depositAddress: string,
  amountIn: bigint,
  chainId: number,
): { to: string; data: string; value: string; chainId: number } {
  if (isAddress(tokenIn)) {
    return {
      to: tokenIn,
      data: ERC20_IFACE.encodeFunctionData('transfer', [depositAddress, amountIn]),
      value: '0',
      chainId,
    };
  }
  return {
    to: depositAddress,
    data: '0x',
    value: amountIn.toString(),
    chainId,
  };
}
