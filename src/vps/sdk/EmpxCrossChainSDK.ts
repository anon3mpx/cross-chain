// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain SDK — Client-facing integration layer
//
// Design goal: compete with intent-first integrations on DX simplicity.
// A partner should be able to go from zero to working cross-chain
// swap in under 10 minutes with a small amount of code.
//
// Usage:
//   const empx = new EmpxCrossChainSDK({ apiKey: 'rflo_...' });
//   const swap = await empx.swap({ from, to, wallet });
//   swap.on('status', updateUI);
//   const result = await swap.settle();
// ─────────────────────────────────────────────────────────

import EventEmitter from 'eventemitter3';
import { IntentStatus, Rail, SettlementToken, CHAIN_ID } from '../types';
import { buildIntentActionMessage } from '../utils/intentActionAuth';
import { RailVariantLabel } from '../rails/registry';
import type { RpcProviderOverrides } from '../core/ExecutionContext';

export const DEFAULT_PARTNER_API_BASE_URL = 'https://partners.empx.io';

export interface SwapFrom {
  chainId: number;
  token: string;
  amount: string;
  decimals?: number;
}

export interface SwapTo {
  chainId: number;
  token: string;
  decimals?: number;
  nativeAddress?: string;
}

export interface SwapOptions {
  from: SwapFrom;
  to: SwapTo;
  wallet: string;
  refundAddress?: string;
  slippagePct?: number;
  urgency?: 'fast' | 'normal' | 'patient';
  gasToken?: string;
}

export interface TxRequest {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

export interface RouterIntentIntegration {
  mode: 'router_intent';
  contractAddress: string;
  calldata: string;
  value: string;
  expiresAt?: number;
  // Router-backed intents can always be rendered as a wallet transaction immediately.
  tx: TxRequest;
}

export interface ProviderDirectApproval {
  token: string;
  spender: string;
  amount: string;
}

export interface ProviderDirectIntegration {
  mode: 'provider_direct';
  action: {
    kind: string;
    [key: string]: unknown;
  };
  // Provider-direct rails may need approvals or provider-specific submission metadata.
  approvals?: ProviderDirectApproval[];
  tx?: TxRequest;
}

export type SwapIntegration = RouterIntentIntegration | ProviderDirectIntegration;

export interface SwapQuote {
  intentId: string;
  estimatedOut: string;
  minOut: string;
  rawEstimatedOut: string;
  rawMinOut: string;
  feeUSD: number;
  rail: Rail;
  etaSeconds: number;
  expiresAt: number;
  // Preserve the selected integration so consumers can branch between router and provider-direct UX.
  integration: SwapIntegration;
  tx?: TxRequest;
}

export interface SwapResult {
  intentId: string;
  status: IntentStatus;
  srcTxHash: string;
  dstTxHash: string;
  amountOut: string;
  rail: Rail;
}

export interface IntentStatusView {
  intentId: string;
  status: IntentStatus;
  srcTxHash?: string;
  dstTxHash?: string;
  railTxId?: string;
  rail: Rail;
  railVariant?: RailVariantLabel;
  etaSeconds: number;
  createdAt?: number;
  updatedAt?: number;
  errorMessage?: string;
  canCancel?: boolean;
  canCancelInWallet?: boolean;
  canRequestRefund?: boolean;
  refund?: unknown;
}

export interface IntentActionRequest {
  userAddress: string;
}

export interface SubmitIntentRequest extends IntentActionRequest {
  sourceTxHash?: string;
  srcTxHash?: string;
}

export interface CancelIntentRequest extends IntentActionRequest {
  reason?: string;
  replacementTxHash?: string;
}

export interface RefundIntentRequest extends IntentActionRequest {
  reason: string;
}

export interface SingleChainSwapQuote {
  tradeInfo: unknown;
  calldata: {
    to: string;
    data: string;
    value: string;
    chainId?: number;
  };
  swapType?: string;
}

export type ExecuteResult =
  | { kind: 'cross-chain'; handle: SwapHandle; quote: SwapQuote }
  | ({ kind: 'single-chain' } & SingleChainSwapQuote);

type PartnerOfferSummary = {
  offerId: string;
  rail: Rail;
};

type PartnerOfferSetPayload = {
  offerSetId: string;
  bestOfferId?: string;
  offers: PartnerOfferSummary[];
};

type PartnerQuoteResponse = {
  offerSet?: PartnerOfferSetPayload;
};

type PartnerSelectionQuote = {
  intentId: string;
  estimatedOut: string;
  minAmountOut: string;
  feeAmountUSD: number;
  rail: Rail;
  etaSeconds: number;
  expiresAt: number;
};

type PartnerSelectionResponse = {
  intentId: string;
  quote: PartnerSelectionQuote;
  integration: unknown;
};

export class SwapHandle extends EventEmitter {
  readonly intentId: string;
  readonly quote: SwapQuote;
  private _ws: WebSocket | null = null;

  constructor(quote: SwapQuote, private baseUrl: string, private apiKey: string) {
    super();
    this.intentId = quote.intentId;
    this.quote = quote;
  }

  connect(): this {
    const url = `${this.baseUrl.replace(/^http/, 'ws')}/ws/intent/${this.intentId}`;
    // WebSocket remains the lowest-latency path for status fanout when the host supports it.
    this._ws = new WebSocket(url, ['rflo-auth', this.apiKey]);

    this._ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as { status: IntentStatus; dstTxHash?: string; amountOut?: string; errorMessage?: string };
      this.emit('status', msg.status);

      if (msg.status === IntentStatus.SETTLED) {
        this.emit('settled', msg);
        this._ws?.close();
      }
      if (msg.status === IntentStatus.FAILED) {
        this.emit('failed', msg);
        this._ws?.close();
      }
      if (msg.status === IntentStatus.CANCELLED) {
        this.emit('cancelled', msg);
        this._ws?.close();
      }
    };

    this._ws.onerror = (err) => this.emit('error', err);
    return this;
  }

  settle(timeoutMs = 300_000): Promise<SwapResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Swap timed out')), timeoutMs);

      this.on('settled', (msg) => {
        clearTimeout(timer);
        resolve({
          intentId: this.intentId,
          status: IntentStatus.SETTLED,
          srcTxHash: '',
          dstTxHash: msg.dstTxHash ?? '',
          amountOut: msg.amountOut ?? '',
          rail: this.quote.rail,
        });
      });

      this.on('failed', (msg) => {
        clearTimeout(timer);
        reject(new Error(`Swap failed: ${msg.errorMessage ?? 'unknown'}`));
      });

      this.on('cancelled', (msg) => {
        clearTimeout(timer);
        reject(new Error(`Swap cancelled: ${msg.errorMessage ?? 'cancelled by user'}`));
      });
    });
  }

  async pollUntilSettled(intervalMs = 3000, timeoutMs = 300_000): Promise<SwapResult> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this._pollStatus();
      this.emit('status', status.status);
      if (status.status === IntentStatus.SETTLED) {
        return {
          intentId: status.intentId,
          status: status.status,
          srcTxHash: status.srcTxHash ?? '',
          dstTxHash: status.dstTxHash ?? '',
          amountOut: '',
          rail: status.rail,
        };
      }
      if (status.status === IntentStatus.FAILED) throw new Error(`Swap failed: ${status.errorMessage}`);
      if (status.status === IntentStatus.CANCELLED) throw new Error(`Swap cancelled: ${status.errorMessage ?? 'cancelled by user'}`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error('Swap timed out');
  }

  async markSubmitted(input: SubmitIntentRequest): Promise<IntentStatusView> {
    return this._postIntentAction('submitted', input);
  }

  async cancel(input: CancelIntentRequest): Promise<IntentStatusView> {
    return this._postIntentAction('cancel', input);
  }

  async requestRefund(input: RefundIntentRequest): Promise<{ ok: true; refund: unknown; ts: number }> {
    return this._postIntentAction('refund', input);
  }

  private async _pollStatus(): Promise<IntentStatusView> {
    const res = await fetch(`${this.baseUrl}/partner/intent/${this.intentId}`, {
      headers: { 'x-api-key': this.apiKey },
    });
    return await res.json() as IntentStatusView;
  }

  private async _postIntentAction(
    action: 'submitted' | 'cancel' | 'refund',
    input: SubmitIntentRequest | CancelIntentRequest | RefundIntentRequest,
  ): Promise<any> {
    // PartnerAPI only exposes the lightweight provider-direct submitted callback.
    if (action === 'cancel') {
      throw new Error('Partner API does not expose cancel actions for SDK-managed intents.');
    }
    if (action === 'refund') {
      throw new Error('Partner API does not expose refund actions for SDK-managed intents.');
    }

    const sourceTxHash = 'sourceTxHash' in input && input.sourceTxHash
      ? input.sourceTxHash
      : 'srcTxHash' in input
        ? input.srcTxHash
        : undefined;
    if (!sourceTxHash) {
      throw new Error('sourceTxHash is required for submitted intents.');
    }

    const res = await fetch(`${this.baseUrl}/partner/intent/${this.intentId}/submitted`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userAddress: input.userAddress,
        sourceTxHash,
      }),
    });

    if (!res.ok) {
      throw new Error(`submitted failed: ${await res.text()}`);
    }
    return await res.json();
  }
}

export class EmpxCrossChainSDK {
  private apiKey: string;
  private baseUrl: string;
  private rpcProviders?: RpcProviderOverrides;
  private integratorId?: string;
  private agentId?: string;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    rpcProviders?: RpcProviderOverrides;
    integratorId?: string;
    agentId?: string;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_PARTNER_API_BASE_URL;
    this.rpcProviders = config.rpcProviders;
    this.integratorId = config.integratorId;
    this.agentId = config.agentId;
  }

  async execute(opts: SwapOptions): Promise<ExecuteResult> {
    if (opts.from.chainId === opts.to.chainId) {
      return this.swapSingleChain({
        chainId: opts.from.chainId,
        tokenIn: opts.from.token,
        tokenOut: opts.to.token,
        amountIn: this._toWei(opts.from.amount, opts.from.decimals ?? 18),
        recipient: opts.wallet,
        slippageBps: Math.round((opts.slippagePct ?? 0.5) * 100),
      });
    }

    const handle = await this.swap(opts);
    return { kind: 'cross-chain', handle, quote: handle.quote };
  }

  async quote(opts: SwapOptions): Promise<SwapQuote> {
    const quoteResponse = await this._requestOfferSet(opts);
    const offerSet = quoteResponse.offerSet;
    if (!offerSet || offerSet.offers.length === 0) {
      throw new Error('Quote failed: offerSet missing from /partner/quote response.');
    }

    // The live Partner API returns an offer set first; the SDK follows through and selects the best offer.
    const selection = await this._selectOffer(offerSet, opts.wallet);
    const integration = this._normalizeIntegration(selection.integration, opts.from.chainId);
    const outputDecimals = opts.to.decimals ?? opts.from.decimals ?? 18;

    return {
      intentId: selection.intentId,
      estimatedOut: this._fromWei(selection.quote.estimatedOut, outputDecimals),
      minOut: this._fromWei(selection.quote.minAmountOut, outputDecimals),
      rawEstimatedOut: selection.quote.estimatedOut,
      rawMinOut: selection.quote.minAmountOut,
      feeUSD: selection.quote.feeAmountUSD,
      rail: selection.quote.rail,
      etaSeconds: selection.quote.etaSeconds,
      expiresAt: selection.quote.expiresAt,
      integration,
      tx: integration.tx,
    };
  }

  async swap(opts: SwapOptions): Promise<SwapHandle> {
    const quote = await this.quote(opts);
    return new SwapHandle(quote, this.baseUrl, this.apiKey).connect();
  }

  async swapSingleChain(input: {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    recipient: string;
    slippageBps?: number;
  }): Promise<ExecuteResult> {
    const res = await fetch(`${this.baseUrl}/partner/swap-single-chain`, {
      method: 'POST',
      headers: this._authHeaders(),
      body: JSON.stringify({
        ...input,
        rpcProviders: this._wireRpcOverrides(),
        integratorId: this.integratorId,
        agentId: this.agentId,
      }),
    });
    if (!res.ok) {
      throw new Error(`Single-chain swap failed: ${await res.text()}`);
    }
    const body = await res.json() as SingleChainSwapQuote;
    return { kind: 'single-chain', ...body };
  }

  async getSupportedRoutes(): Promise<{ srcChainId: number; dstChainIds: number[]; rails: Rail[] }[]> {
    throw new Error('Partner API does not expose a supported-routes discovery endpoint.');
  }

  private _authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'content-type': 'application/json',
    };
    if (this.integratorId) headers['x-ruflo-integrator-id'] = this.integratorId;
    if (this.agentId) headers['x-ruflo-agent-id'] = this.agentId;
    return headers;
  }

  private _wireRpcOverrides(): Record<number, string> | undefined {
    if (!this.rpcProviders) return undefined;
    const out: Record<number, string> = {};
    for (const [chainId, value] of Object.entries(this.rpcProviders)) {
      if (typeof value === 'string') out[Number(chainId)] = value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  private async _requestOfferSet(opts: SwapOptions): Promise<PartnerQuoteResponse> {
    const res = await fetch(`${this.baseUrl}/partner/quote`, {
      method: 'POST',
      headers: this._authHeaders(),
      body: JSON.stringify({
        tokenIn: opts.from.token,
        tokenOut: opts.to.token,
        amountIn: this._toWei(opts.from.amount, opts.from.decimals ?? 18),
        srcChainId: opts.from.chainId,
        dstChainId: opts.to.chainId,
        userAddress: opts.wallet,
        nativeDstAddress: opts.to.nativeAddress,
        refundAddress: opts.refundAddress,
        urgency: opts.urgency ?? 'normal',
        rpcProviders: this._wireRpcOverrides(),
        integratorId: this.integratorId,
        agentId: this.agentId,
      }),
    });

    if (!res.ok) {
      throw new Error(`Quote failed: ${await res.text()}`);
    }
    return await res.json() as PartnerQuoteResponse;
  }

  private async _selectOffer(offerSet: PartnerOfferSetPayload, userAddress: string): Promise<PartnerSelectionResponse> {
    let current = offerSet;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const offerId = current.bestOfferId ?? current.offers[0]?.offerId;
      if (!offerId) {
        throw new Error('Quote failed: offerSet did not contain any selectable offers.');
      }

      const res = await fetch(`${this.baseUrl}/partner/quote/select`, {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify({
          userAddress,
          offerSetId: current.offerSetId,
          offerId,
          integratorId: this.integratorId,
          agentId: this.agentId,
        }),
      });

      if (res.status === 409) {
        // Offer volatility is expected; prefer the server-provided fallback set over an immediate requote.
        const payload = await res.json() as { fallbackOfferSet?: PartnerOfferSetPayload };
        if (payload.fallbackOfferSet?.offers?.length) {
          current = payload.fallbackOfferSet;
          continue;
        }
      }

      if (!res.ok) {
        throw new Error(`Quote selection failed: ${await res.text()}`);
      }
      return await res.json() as PartnerSelectionResponse;
    }

    throw new Error('Quote selection failed: no selectable offers remained after fallback handling.');
  }

  private _normalizeIntegration(integration: unknown, chainId: number): SwapIntegration {
    if (!integration || typeof integration !== 'object') {
      throw new Error('Quote selection failed: integration payload missing.');
    }

    const raw = integration as Record<string, unknown>;
    // Router-intent and provider-direct payloads come back in different shapes; normalize them once here.
    if (
      typeof raw.contractAddress === 'string'
      && typeof raw.calldata === 'string'
      && typeof raw.value === 'string'
    ) {
      return {
        mode: 'router_intent',
        contractAddress: raw.contractAddress,
        calldata: raw.calldata,
        value: raw.value,
        expiresAt: typeof raw.expiresAt === 'number' ? raw.expiresAt : undefined,
        tx: {
          to: raw.contractAddress,
          data: raw.calldata,
          value: raw.value,
          chainId,
        },
      };
    }

    const tx = this._normalizeTx(raw.tx, chainId);
    const approvals = Array.isArray(raw.approvals)
      ? raw.approvals.flatMap((approval) => {
        if (!approval || typeof approval !== 'object') return [];
        const item = approval as Record<string, unknown>;
        if (
          typeof item.token !== 'string'
          || typeof item.spender !== 'string'
          || typeof item.amount !== 'string'
        ) {
          return [];
        }
        return [{
          token: item.token,
          spender: item.spender,
          amount: item.amount,
        }];
      })
      : undefined;

    if (!raw.action || typeof raw.action !== 'object') {
      throw new Error('Quote selection failed: unknown integration payload shape.');
    }

    return {
      mode: 'provider_direct',
      action: raw.action as ProviderDirectIntegration['action'],
      ...(approvals && approvals.length > 0 ? { approvals } : {}),
      ...(tx ? { tx } : {}),
    };
  }

  private _normalizeTx(value: unknown, fallbackChainId: number): TxRequest | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const raw = value as Record<string, unknown>;
    if (
      typeof raw.to !== 'string'
      || typeof raw.data !== 'string'
      || typeof raw.value !== 'string'
    ) {
      return undefined;
    }
    const chainId = Number(raw.chainId ?? fallbackChainId);
    return {
      to: raw.to,
      data: raw.data,
      value: raw.value,
      chainId: Number.isFinite(chainId) ? chainId : fallbackChainId,
    };
  }

  private _toWei(amount: string, decimals: number): string {
    const trimmed = amount.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    const [wholeRaw, fractionRaw = ''] = trimmed.split('.');
    // Reject silent precision loss instead of truncating user-entered decimals beyond token precision.
    if (fractionRaw.length > decimals && /[1-9]/.test(fractionRaw.slice(decimals))) {
      throw new Error(`Amount ${amount} exceeds supported precision for ${decimals} decimals.`);
    }

    const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';
    const fraction = (fractionRaw + '0'.repeat(decimals)).slice(0, decimals) || '0';
    return (BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction)).toString();
  }

  private _fromWei(raw: string, decimals: number): string {
    const value = BigInt(raw);
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const fraction = value % base;
    if (fraction === 0n) return `${whole}.000000`;
    const fractionText = fraction.toString().padStart(decimals, '0').slice(0, 6).padEnd(6, '0');
    return `${whole}.${fractionText}`;
  }
}

export { CHAIN_ID, Rail, IntentStatus, SettlementToken };
export { buildIntentActionMessage };
export { EmpxCrossChainSDK as RufloSDK };
