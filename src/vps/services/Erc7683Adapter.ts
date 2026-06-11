import { AbiCoder, keccak256, toUtf8Bytes, zeroPadValue } from 'ethers';
import {
  EMPX_ORDER_DATA_TYPE,
  EmpxSwapOrderV1,
  FillInstruction,
  GaslessCrossChainOrder,
  OnchainCrossChainOrder,
  OrderOutput,
  ResolvedCrossChainOrder,
} from '../core/erc7683';
import type { QuoteEngine } from './QuoteEngine';
import type { IntentService } from './IntentService';
import type { SwapAdapter } from '../sdk/swapAdapter';
import { isSwapSdkChain } from '../sdk/swapAdapter';
import { buildSelectedOfferIntegration } from './DirectRailIntegrationBuilder';
import type { ExecutionContext } from '../core/ExecutionContext';

const abiCoder = AbiCoder.defaultAbiCoder();

export interface Erc7683AdapterDeps {
  quoteEngine: QuoteEngine;
  intentService: IntentService;
  swapAdapter: SwapAdapter;
}

export interface Erc7683Order {
  onchain?: OnchainCrossChainOrder;
  gasless?: GaslessCrossChainOrder;
  orderDataJson?: EmpxSwapOrderV1;
  signature?: string;
}

export interface Erc7683ResolveResult {
  resolved: ResolvedCrossChainOrder;
  empx: {
    estimatedOut: string;
    minAmountOut: string;
    etaSeconds: number;
    feeUsd: number;
    executionMode: 'router_intent' | 'provider_direct' | 'single-chain';
    revenueTier: 'agg-wired' | 'api-direct' | 'unknown';
  };
}

export interface Erc7683OpenResult extends Erc7683ResolveResult {
  intentId?: string;
  integration?: unknown;
  singleChainTx?: { to: string; data: string; value: string; chainId: number };
}

export class Erc7683Adapter {
  constructor(private readonly deps: Erc7683AdapterDeps) {}

  async resolve(order: Erc7683Order, ctx: ExecutionContext): Promise<Erc7683ResolveResult | { error: string }> {
    const decoded = decodeOrder(order);
    if ('error' in decoded) return decoded;

    // Same-chain orders are valid here; we normalize them through the swap SDK
    // instead of forcing every 7683 order onto a cross-chain rail.
    if (decoded.srcChainId === decoded.dstChainId && isSwapSdkChain(decoded.srcChainId)) {
      try {
        const trade = await this.deps.swapAdapter.quote({
          chainId: decoded.srcChainId,
          tokenIn: decoded.tokenIn,
          tokenOut: decoded.tokenOut,
          amountIn: decoded.amountIn,
          recipient: decoded.recipient,
          slippageBps: decoded.slippageBps ?? 50,
        }, ctx);
        const amountOut = String((trade as any).amountOut ?? 0);
        return {
          resolved: toResolvedShape(decoded, amountOut, amountOut),
          empx: {
            estimatedOut: amountOut,
            minAmountOut: amountOut,
            etaSeconds: 30,
            feeUsd: 0,
            executionMode: 'single-chain',
            revenueTier: 'agg-wired',
          },
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'single-chain resolve failed' };
      }
    }

    const offerSet = await this.deps.quoteEngine.getOffers({
      srcChainId: decoded.srcChainId,
      dstChainId: decoded.dstChainId,
      tokenIn: decoded.tokenIn,
      tokenOut: decoded.tokenOut,
      amountIn: BigInt(decoded.amountIn),
      userAddress: decoded.recipient,
      nativeDstAddress: decoded.nativeDstAddress,
      urgency: 'normal',
    });
    const offer = offerSet?.offers?.[0];
    if (!offer) return { error: 'no route for this order' };

    return {
      resolved: toResolvedShape(decoded, offer.estimatedOut.toString(), offer.minAmountOut.toString()),
      empx: {
        estimatedOut: offer.estimatedOut.toString(),
        minAmountOut: offer.minAmountOut.toString(),
        etaSeconds: offer.economics.settlementTimeSeconds,
        feeUsd: (offer.economics.providerFeeUSD ?? 0) + (offer.economics.protocolFeeUSD ?? 0),
        executionMode: offer.executionMode === 'provider_direct' ? 'provider_direct' : 'router_intent',
        revenueTier: offer.executionMode === 'provider_direct' ? 'api-direct' : 'agg-wired',
      },
    };
  }

  async open(
    order: Erc7683Order,
    attribution: { partnerId?: string; integratorId?: string; agentId?: string; solverId?: string },
    ctx: ExecutionContext,
  ): Promise<Erc7683OpenResult | { error: string }> {
    const resolved = await this.resolve(order, ctx);
    if ('error' in resolved) return resolved;

    const decoded = decodeOrder(order);
    if ('error' in decoded) return decoded;

    if (decoded.srcChainId === decoded.dstChainId && isSwapSdkChain(decoded.srcChainId)) {
      const swap = await this.deps.swapAdapter.swap({
        chainId: decoded.srcChainId,
        tokenIn: decoded.tokenIn,
        tokenOut: decoded.tokenOut,
        amountIn: decoded.amountIn,
        recipient: decoded.recipient,
        slippageBps: decoded.slippageBps ?? 50,
      }, ctx);
      const calldata = (swap as any).calldata;
      return {
        ...resolved,
        singleChainTx: calldata
          ? {
              to: String(calldata.to),
              data: String(calldata.data),
              value: String(calldata.value ?? '0'),
              chainId: Number(calldata.chainId ?? decoded.srcChainId),
            }
          : undefined,
      };
    }

    // Cross-chain open creates a normal EMPX intent before returning calldata.
    // That keeps external-solver-originated volume on the standard status path.
    const offerSet = await this.deps.quoteEngine.getOffers({
      srcChainId: decoded.srcChainId,
      dstChainId: decoded.dstChainId,
      tokenIn: decoded.tokenIn,
      tokenOut: decoded.tokenOut,
      amountIn: BigInt(decoded.amountIn),
      userAddress: decoded.recipient,
      nativeDstAddress: decoded.nativeDstAddress,
      urgency: 'normal',
    });
    const offer = offerSet?.offers?.[0];
    if (!offer) return { error: 'no route' };

    const intent = await this.deps.intentService.createQuotedIntentFromOffer(
      offer,
      decoded.recipient,
      {
        partnerId: attribution.partnerId ?? decoded.partnerId,
        integratorId: attribution.integratorId ?? decoded.integratorId,
        agentId: attribution.agentId ?? decoded.agentId,
        routeSource: 'external-solver',
        solverId: attribution.solverId,
      },
    );
    const built = await buildSelectedOfferIntegration(intent.intentId, offer, decoded.recipient);
    return {
      ...resolved,
      intentId: intent.intentId,
      integration: built.mode === 'router_intent' ? built.integration : built,
    };
  }
}

function decodeOrder(order: Erc7683Order): EmpxSwapOrderV1 | { error: string } {
  if (order.orderDataJson) return order.orderDataJson;

  const payload = order.onchain ?? order.gasless;
  if (!payload) return { error: 'missing ERC-7683 order payload' };
  if (payload.orderDataType !== EMPX_ORDER_DATA_TYPE) {
    return { error: 'unsupported orderDataType' };
  }

  try {
    // The HTTP surface accepts raw ERC-7683 payloads, so we decode the EMPX
    // orderData format here and then hand the result to the normal quote path.
    const [
      srcChainId,
      dstChainId,
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      recipient,
      nativeDstAddress,
      slippageBps,
      partnerId,
      integratorId,
      agentId,
    ] = abiCoder.decode(
      ['uint32', 'uint32', 'address', 'bytes32', 'uint256', 'uint256', 'bytes32', 'bytes32', 'uint16', 'bytes32', 'bytes32', 'bytes32'],
      payload.orderData,
    );

    return {
      srcChainId: Number(srcChainId),
      dstChainId: Number(dstChainId),
      tokenIn: String(tokenIn),
      tokenOut: decodeBytes32Token(tokenOut),
      amountIn: String(amountIn),
      minAmountOut: String(minAmountOut),
      recipient: decodeBytes32Token(recipient),
      nativeDstAddress: decodeOptionalBytes32(nativeDstAddress),
      slippageBps: Number(slippageBps),
      partnerId: decodeOptionalBytes32(partnerId),
      integratorId: decodeOptionalBytes32(integratorId),
      agentId: decodeOptionalBytes32(agentId),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'failed to decode orderData' };
  }
}

function toResolvedShape(decoded: EmpxSwapOrderV1, estimatedOut: string, minAmountOut: string): ResolvedCrossChainOrder {
  const maxSpent: OrderOutput[] = [{
    token: normalizeBytes32(decoded.tokenIn),
    amount: decoded.amountIn,
    recipient: normalizeBytes32(decoded.recipient),
    chainId: decoded.srcChainId,
  }];
  const minReceived: OrderOutput[] = [{
    token: normalizeBytes32(decoded.tokenOut),
    amount: minAmountOut,
    recipient: normalizeBytes32(decoded.recipient),
    chainId: decoded.dstChainId,
  }];
  const fillInstructions: FillInstruction[] = [{
    destinationChainId: decoded.dstChainId,
    destinationSettler: normalizeBytes32('EMPX'),
    originData: '0x',
  }];

  return {
    user: decoded.recipient,
    originChainId: decoded.srcChainId,
    openDeadline: Math.floor(Date.now() / 1000) + 300,
    fillDeadline: Math.floor(Date.now() / 1000) + 1_800,
    orderId: keccak256(toUtf8Bytes(JSON.stringify({
      srcChainId: decoded.srcChainId,
      dstChainId: decoded.dstChainId,
      tokenIn: decoded.tokenIn,
      tokenOut: decoded.tokenOut,
      amountIn: decoded.amountIn,
      minAmountOut,
      estimatedOut,
      recipient: decoded.recipient,
    }))),
    maxSpent,
    minReceived,
    fillInstructions,
  };
}

function normalizeBytes32(value: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return zeroPadValue(value as `0x${string}`, 32);
  const hex = Buffer.from(value, 'utf8').toString('hex').slice(0, 64);
  return `0x${hex.padEnd(64, '0')}`;
}

function decodeBytes32Token(value: string): string {
  const trimmed = decodeOptionalBytes32(value);
  return trimmed ?? value;
}

function decodeOptionalBytes32(value: string): string | undefined {
  if (!value || /^0x0{64}$/i.test(value)) return undefined;
  if (/^0x0{24}[0-9a-fA-F]{40}$/i.test(value)) return `0x${value.slice(-40)}`;
  const bytes = Buffer.from(value.slice(2), 'hex');
  const utf8 = bytes.toString('utf8').replace(/\0+$/g, '').trim();
  return utf8 || undefined;
}
