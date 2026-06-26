import { randomBytes } from 'node:crypto';
import { Interface } from 'ethers';
import {
  BASKET_LIMITS,
  BasketInput,
  BasketOutput,
  BasketQuote,
  BasketLegQuote,
  IntentBasket,
  validateBasket,
} from '../core/IntentBasket';
import type { ExecutionContext } from '../core/ExecutionContext';
import type { SwapAdapter } from '../sdk/swapAdapter';
import { isSwapSdkChain } from '../sdk/swapAdapter';
import type { QuoteEngine } from './QuoteEngine';
import type { IntentService } from './IntentService';
import { buildSelectedOfferIntegration } from './DirectRailIntegrationBuilder';
import type { RailOffer } from '../types';
import { getEmpsealMulticallRouterAddressForChain } from '../config/contracts';
import type { BasketRepository } from '../db/BasketRepository';

export interface BasketQuoteEngineDeps {
  swapAdapter: SwapAdapter;
  quoteEngine: QuoteEngine;
  intentService?: IntentService;
  basketRepository?: BasketRepository;
}

export interface BasketLegExecution {
  legIndex: number;
  legKind: 'single-chain' | 'cross-chain';
  tx?: { to: string; data: string; value: string; chainId: number };
  intentId?: string;
  integration?: unknown;
  error?: string;
}

export interface BasketExecutionPlan {
  basketId: string;
  mode: 'sequential' | 'multicall';
  orderedLegIndexes: number[];
  legs: BasketLegExecution[];
  batchedTx?: { to: string; data: string; value: string; chainId: number };
  walletSendCalls?: {
    version: '1.0';
    chainId: string;
    from: string;
    calls: Array<{ to: string; data: string; value: string }>;
  };
  multicallIneligibleReason?: string;
}

interface PairingEntry {
  input: BasketInput;
  output: BasketOutput;
  amountWei: string;
}

interface PreparedSameChainLeg {
  chainId: number;
  recipient: string;
  swapType: string;
  tradeInfo: {
    amountIn: string;
    amountOut: string;
    fee?: string;
    path: string[];
    adapters: string[];
  };
}

const MULTICALL_IFACE = new Interface([
  'function multiSwap((uint8,(uint256 amountIn,uint256 amountOut,address[] path,address[] adapters),address recipient,uint256 fee,uint256 nativeValue)[] legs)',
]);

export class BasketQuoteEngine {
  constructor(private readonly deps: BasketQuoteEngineDeps) {}

  async quote(basket: IntentBasket, ctx: ExecutionContext): Promise<BasketQuote | { error: string }> {
    const validation = validateBasket(basket);
    if (!validation.ok) return { error: validation.reason! };

    const basketId = basket.basketId ?? `bkt_${randomBytes(12).toString('hex')}`;
    const pairings = this.pairLegs(basket);
    if (pairings.length > BASKET_LIMITS.maxLegs) {
      return { error: `basket would expand to ${pairings.length} legs (max ${BASKET_LIMITS.maxLegs})` };
    }

    const results = await Promise.allSettled(
      pairings.map((pair, index) => this.quoteOneLeg(index, pair, basket, ctx)),
    );

    const legs: BasketLegQuote[] = [];
    const skipped: BasketQuote['skipped'] = [];
    let feeUsd = 0;
    let inputsUsd = 0;
    let outputsUsd = 0;
    let parallelEta = 0;
    let aggregate: BasketQuote['aggregateTier'] | null = null;

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const pair = pairings[i]!;
      if (result.status === 'rejected') {
        skipped.push({
          legIndex: i,
          input: pair.input,
          output: pair.output,
          reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
        continue;
      }
      if (!result.value) {
        skipped.push({ legIndex: i, input: pair.input, output: pair.output, reason: 'no route' });
        continue;
      }
      legs.push(result.value);
      feeUsd += result.value.feeUsd;
      inputsUsd += result.value.estimatedInUsd ?? 0;
      outputsUsd += result.value.estimatedOutUsd ?? 0;
      parallelEta = Math.max(parallelEta, result.value.etaSeconds);
      aggregate = mergeTier(aggregate, result.value.revenueTier);
    }

    const result = {
      basketId,
      mode: basket.mode,
      legs,
      totals: {
        inputsUsd,
        outputsUsd,
        feeUsd,
        worstEtaSeconds: legs.reduce((sum, leg) => sum + leg.etaSeconds, 0),
        parallelEtaSeconds: parallelEta,
      },
      aggregateTier: aggregate ?? 'unknown',
      skipped,
      effectiveConstraints: {
        slippageBps: basket.constraints.slippageBps ?? 50,
        deadlineSeconds: basket.constraints.deadlineSeconds ?? 30 * 60,
        maxLegs: BASKET_LIMITS.maxLegs,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    };
    await this.deps.basketRepository?.upsertQuote({
      basketId,
      basket,
      quote: result,
    });
    return result;
  }

  async executeBasket(
    basket: IntentBasket,
    userAddress: string,
    attribution: {
      partnerApiKey?: string;
      partnerId?: string;
      integratorId?: string;
      agentId?: string;
      solverId?: string;
      routeSource?: 'partner-api' | 'agent-sdk' | 'external-solver' | 'ui' | 'internal';
      parentBasketId?: string;
    },
    ctx: ExecutionContext,
    options: {
      basketId?: string;
      legIndexes?: number[];
      mode?: 'sequential' | 'multicall';
    } = {},
  ): Promise<BasketExecutionPlan | { error: string }> {
    const validation = validateBasket(basket);
    if (!validation.ok) return { error: validation.reason! };
    if (!this.deps.intentService) {
      return { error: 'IntentService unavailable — execute requires it for cross-chain legs.' };
    }

    const basketId = options.basketId ?? basket.basketId ?? `bkt_${randomBytes(12).toString('hex')}`;
    const pairings = this.pairLegs(basket);
    const allowed = options.legIndexes?.length
      ? new Set(options.legIndexes)
      : new Set(pairings.map((_pair, index) => index));
    const legs: BasketLegExecution[] = [];
    const sameChainLegs: PreparedSameChainLeg[] = [];

    for (let i = 0; i < pairings.length; i += 1) {
      if (!allowed.has(i)) continue;
      try {
        const leg = await this.executeOneLeg(i, pairings[i]!, basketId, userAddress, attribution, ctx);
        legs.push(leg);
        if ('preparedSameChainLeg' in leg && leg.preparedSameChainLeg) {
          sameChainLegs.push(leg.preparedSameChainLeg);
        }
      } catch (error) {
        legs.push({
          legIndex: i,
          legKind: this.isSingleChain(pairings[i]!.input, pairings[i]!.output) ? 'single-chain' : 'cross-chain',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const plan: BasketExecutionPlan = {
      basketId,
      mode: options.mode === 'multicall' ? 'multicall' : 'sequential',
      orderedLegIndexes: legs.map((leg) => leg.legIndex),
      legs,
    };

    if (plan.mode === 'multicall') {
      const txLegs = legs.filter((leg) => leg.tx && !leg.error);
      const sameChainId = txLegs[0]?.tx?.chainId;
      // We only emit wallet_sendCalls when every selected leg is a same-chain
      // wallet-signed tx on one chain. Cross-chain child intents stay explicit.
      if (txLegs.length < 2) {
        plan.multicallIneligibleReason = 'multicall requires at least two same-chain legs';
      } else if (legs.some((leg) => leg.intentId)) {
        plan.multicallIneligibleReason = 'multicall is only available for same-chain wallet-signed legs';
      } else if (txLegs.some((leg) => leg.tx?.chainId !== sameChainId)) {
        plan.multicallIneligibleReason = 'multicall requires all legs on the same chain';
      } else if (!sameChainId) {
        plan.multicallIneligibleReason = 'multicall requires signable tx payloads';
      } else {
        const contractBatch = this.buildContractBackedMulticallTx(sameChainId, sameChainLegs);
        if (contractBatch) {
          plan.batchedTx = contractBatch;
        } else {
          plan.walletSendCalls = {
            version: '1.0',
            chainId: `0x${sameChainId.toString(16)}`,
            from: userAddress,
            calls: txLegs.map((leg) => ({
              to: leg.tx!.to,
              data: leg.tx!.data,
              value: leg.tx!.value,
            })),
          };
          plan.multicallIneligibleReason = 'empseal multicall router not configured or one or more legs are not router-compatible';
        }
      }
    }

    await this.deps.basketRepository?.attachExecutionPlan(basketId, plan);
    return plan;
  }

  private async quoteOneLeg(
    legIndex: number,
    pair: PairingEntry,
    basket: IntentBasket,
    ctx: ExecutionContext,
  ): Promise<BasketLegQuote | null> {
    if (this.isSingleChain(pair.input, pair.output)) {
      const trade = await this.deps.swapAdapter.quote({
        chainId: pair.input.chainId,
        tokenIn: pair.input.token,
        tokenOut: pair.output.token,
        amountIn: pair.amountWei,
        recipient: pair.output.recipient ?? pair.input.wallet,
        slippageBps: pair.input.slippageBps ?? basket.constraints.slippageBps ?? 50,
      }, ctx);

      const amountOut = toBigInt((trade as any).amountOut ?? (trade as any).tradeInfo?.amountOut ?? 0);
      return {
        legIndex,
        input: pair.input,
        output: pair.output,
        legKind: 'single-chain',
        estimatedOut: amountOut.toString(),
        minAmountOut: amountOut.toString(),
        etaSeconds: 30,
        feeUsd: 0,
        revenueTier: 'agg-wired',
        opaqueLegRef: `${legIndex}:${randomBytes(8).toString('hex')}`,
      };
    }

    const offer = await this.selectBestOffer(pair, ctx);
    if (!offer) return null;

    return {
      legIndex,
      input: pair.input,
      output: pair.output,
      legKind: 'cross-chain',
      estimatedOut: offer.estimatedOut.toString(),
      minAmountOut: offer.minAmountOut.toString(),
      etaSeconds: offer.economics.settlementTimeSeconds,
      feeUsd: (offer.economics.providerFeeUSD ?? 0) + (offer.economics.protocolFeeUSD ?? 0),
      revenueTier: offer.executionMode === 'provider_direct'
        ? 'api-direct'
        : offer.executionMode === 'router_intent'
          ? 'agg-wired'
          : 'unknown',
      opaqueLegRef: `${legIndex}:${offer.offerId}`,
    };
  }

  private async executeOneLeg(
    legIndex: number,
    pair: PairingEntry,
    basketId: string,
    userAddress: string,
    attribution: {
      partnerApiKey?: string;
      partnerId?: string;
      integratorId?: string;
      agentId?: string;
      solverId?: string;
      routeSource?: 'partner-api' | 'agent-sdk' | 'external-solver' | 'ui' | 'internal';
      parentBasketId?: string;
    },
    ctx: ExecutionContext,
  ): Promise<BasketLegExecution & { preparedSameChainLeg?: PreparedSameChainLeg }> {
    if (this.isSingleChain(pair.input, pair.output)) {
      const swap = await this.deps.swapAdapter.swap({
        chainId: pair.input.chainId,
        tokenIn: pair.input.token,
        tokenOut: pair.output.token,
        amountIn: pair.amountWei,
        recipient: pair.output.recipient ?? userAddress,
      }, ctx);
      const calldata = (swap as any).calldata;
      if (!calldata) {
        throw new Error('same-chain leg did not return calldata');
      }
      return {
        legIndex,
        legKind: 'single-chain',
        tx: {
          to: String(calldata.to),
          data: String(calldata.data),
          value: String(calldata.value ?? '0'),
          chainId: Number(calldata.chainId ?? pair.input.chainId),
        },
        preparedSameChainLeg: {
          chainId: Number(calldata.chainId ?? pair.input.chainId),
          recipient: pair.output.recipient ?? userAddress,
          swapType: String((swap as any).swapType ?? ''),
          tradeInfo: {
            amountIn: String((swap as any).tradeInfo?.amountIn ?? pair.amountWei),
            amountOut: String((swap as any).tradeInfo?.amountOut ?? '0'),
            fee: String((swap as any).tradeInfo?.fee ?? '0'),
            path: Array.isArray((swap as any).tradeInfo?.path) ? (swap as any).tradeInfo.path : [],
            adapters: Array.isArray((swap as any).tradeInfo?.adapters) ? (swap as any).tradeInfo.adapters : [],
          },
        },
      };
    }

    const offer = await this.selectBestOffer(pair, ctx);
    if (!offer) throw new Error('no cross-chain route');

    // Cross-chain basket legs become ordinary tracked intents so monitoring,
    // refund handling, attribution, and reliability stay on the existing path.
    const intent = await this.deps.intentService!.createQuotedIntentFromOffer(
      offer,
      userAddress,
      {
        partnerApiKey: attribution.partnerApiKey,
        partnerId: attribution.partnerId,
        integratorId: attribution.integratorId,
        agentId: attribution.agentId,
        solverId: attribution.solverId,
        routeSource: attribution.routeSource,
        parentBasketId: attribution.parentBasketId ?? basketId,
      },
    );
    const built = await buildSelectedOfferIntegration(intent.intentId, offer, userAddress);
    const integration = built.mode === 'router_intent' ? built.integration : built;

    return {
      legIndex,
      legKind: 'cross-chain',
      intentId: intent.intentId,
      integration,
    };
  }

  private async selectBestOffer(pair: PairingEntry, ctx: ExecutionContext): Promise<RailOffer | null> {
    const offerSet = await this.deps.quoteEngine.getOffers({
      srcChainId: pair.input.chainId,
      dstChainId: pair.output.chainId,
      tokenIn: pair.input.token,
      tokenOut: pair.output.token,
      amountIn: BigInt(pair.amountWei),
      userAddress: pair.output.recipient ?? pair.input.wallet,
      nativeDstAddress: pair.output.nativeAddress,
      urgency: 'normal',
    });
    return offerSet?.offers?.[0] ?? null;
  }

  private pairLegs(basket: IntentBasket): PairingEntry[] {
    const outputAllocs = basket.outputs.map((output) => output.allocationBps ?? 0);
    const totalAlloc = outputAllocs.reduce((sum, value) => sum + value, 0);
    const defaultAlloc = basket.outputs.length > 0 ? Math.floor(10_000 / basket.outputs.length) : 10_000;

    // Pairing expands the high-level basket shape into concrete child legs.
    // Each resulting leg is still quoted/executed as a regular single-hop route.
    const splitInput = (amount: bigint, output: BasketOutput, outputIndex: number): string => {
      if (output.fixedAmount && /^\d+$/.test(output.fixedAmount)) return output.fixedAmount;
      const allocation = totalAlloc > 0 ? (output.allocationBps ?? 0) : defaultAlloc;
      if (outputIndex === basket.outputs.length - 1) {
        const prior = basket.outputs
          .slice(0, outputIndex)
          .reduce((sum, candidate) => {
            const bps = totalAlloc > 0 ? (candidate.allocationBps ?? 0) : defaultAlloc;
            return sum + (amount * BigInt(bps)) / 10_000n;
          }, 0n);
        return (amount - prior).toString();
      }
      return ((amount * BigInt(allocation)) / 10_000n).toString();
    };

    if (basket.mode === 'multi-to-one' || basket.mode === 'wallet-liquidator') {
      return basket.inputs.map((input) => ({
        input,
        output: basket.outputs[0]!,
        amountWei: input.amount,
      }));
    }

    if (basket.mode === 'one-to-many') {
      const input = basket.inputs[0]!;
      const total = BigInt(input.amount);
      return basket.outputs.map((output, index) => ({
        input,
        output,
        amountWei: splitInput(total, output, index),
      }));
    }

    const out: PairingEntry[] = [];
    for (const input of basket.inputs) {
      const total = BigInt(input.amount);
      basket.outputs.forEach((output, index) => {
        out.push({
          input,
          output,
          amountWei: splitInput(total, output, index),
        });
      });
    }
    return out;
  }

  private isSingleChain(input: BasketInput, output: BasketOutput): boolean {
    return input.chainId === output.chainId && isSwapSdkChain(input.chainId);
  }

  private buildContractBackedMulticallTx(
    chainId: number,
    legs: PreparedSameChainLeg[],
  ): { to: string; data: string; value: string; chainId: number } | null {
    const multicallRouter = getEmpsealMulticallRouterAddressForChain(chainId);
    if (!multicallRouter || legs.length < 2) return null;

    const encodedLegs = [];
    let totalValue = 0n;
    for (const leg of legs) {
      if (leg.chainId !== chainId) return null;
      const kind = toMulticallKind(leg.swapType);
      if (kind === null) return null;
      totalValue += kind === 1 ? BigInt(leg.tradeInfo.amountIn) : 0n;
      encodedLegs.push([
        kind,
        [
          BigInt(leg.tradeInfo.amountIn),
          BigInt(leg.tradeInfo.amountOut || '0'),
          leg.tradeInfo.path,
          leg.tradeInfo.adapters,
        ],
        leg.recipient,
        BigInt(leg.tradeInfo.fee || '0'),
        kind === 1 ? BigInt(leg.tradeInfo.amountIn) : 0n,
      ]);
    }

    return {
      to: multicallRouter,
      data: MULTICALL_IFACE.encodeFunctionData('multiSwap', [encodedLegs]),
      value: totalValue.toString(),
      chainId,
    };
  }
}

function mergeTier(
  current: BasketQuote['aggregateTier'] | null,
  next: BasketLegQuote['revenueTier'],
): BasketQuote['aggregateTier'] {
  if (!current) return next;
  if (current === next) return current;
  return 'mixed';
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.trim()) return BigInt(value.trim());
  return 0n;
}

function toMulticallKind(swapType: string): number | null {
  if (swapType === 'ERC20ToERC20') return 0;
  if (swapType === 'NativeToERC20') return 1;
  if (swapType === 'ERC20ToNative') return 2;
  return null;
}
