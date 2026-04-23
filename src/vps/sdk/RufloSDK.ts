// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain SDK — Client-facing integration layer
//
// Design goal: compete with NEAR Intents on DX simplicity.
// A partner should be able to go from zero to working cross-chain
// swap in under 10 minutes with 3-5 lines of code.
//
// Usage:
//   const ruflo = new RufloSDK({ apiKey: 'rflo_...' });
//   const swap  = await ruflo.swap({ from, to, wallet });
//   swap.on('status', updateUI);
//   const result = await swap.settle();
// ─────────────────────────────────────────────────────────

import EventEmitter from 'eventemitter3';
import { IntentStatus, Rail, SettlementToken, CHAIN_ID } from '../types';
import { buildIntentActionMessage, IntentAction } from '../utils/intentActionAuth';

// ── Public-facing types (simplified — hides internal complexity) ───────────────

export interface SwapFrom {
  chainId:  number;
  token:    string;   // ERC-20 address or 'NATIVE' for ETH/AVAX/etc.
  amount:   string;   // Human-readable (e.g. "100.5"), SDK converts to wei
  decimals?: number;  // Default 18. USDC = 6.
}

export interface SwapTo {
  chainId:       number;
  token:         string;   // ERC-20 address, 'NATIVE', 'BTC', 'SOL', 'DOGE'
  nativeAddress?: string;  // Required for BTC/SOL/DOGE destinations
}

export interface SwapOptions {
  from:         SwapFrom;
  to:           SwapTo;
  wallet:       string;    // User's EVM wallet address
  slippagePct?: number;    // Default 0.5%
  urgency?:     'fast' | 'normal';
  gasToken?:    string;    // Paymaster: pay gas in this token (default: native)
}

export interface SwapQuote {
  intentId:      string;
  estimatedOut:  string;   // Human-readable output amount
  minOut:        string;   // After slippage
  feeUSD:        number;
  rail:          Rail;
  etaSeconds:    number;
  expiresAt:     number;
  // Pre-built transaction ready to sign — pass directly to wallet
  tx: {
    to:       string;
    data:     string;
    value:    string;
    chainId:  number;
  };
}

export interface SwapResult {
  intentId:  string;
  status:    IntentStatus;
  srcTxHash: string;
  dstTxHash: string;
  amountOut: string;
  rail:      Rail;
}

export interface IntentStatusView {
  intentId: string;
  status: IntentStatus;
  srcTxHash?: string;
  dstTxHash?: string;
  railTxId?: string;
  rail: Rail;
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
  signature: string;
  timestamp?: number;
}

export interface SubmitIntentRequest extends IntentActionRequest {
  srcTxHash: string;
}

export interface CancelIntentRequest extends IntentActionRequest {
  reason?: string;
  replacementTxHash?: string;
}

export interface RefundIntentRequest extends IntentActionRequest {
  reason: string;
}

// ── SwapHandle — returned from ruflo.swap(), emits real-time events ────────────

export class SwapHandle extends EventEmitter {
  readonly intentId: string;
  readonly quote: SwapQuote;
  private _ws: WebSocket | null = null;
  private _settled = false;

  constructor(quote: SwapQuote, private baseUrl: string, private apiKey: string) {
    super();
    this.intentId = quote.intentId;
    this.quote    = quote;
  }

  // ── Connect WebSocket for real-time status (preferred over polling) ────────

  connect(): this {
    const url = `${this.baseUrl.replace('https', 'wss')}/ws/intent/${this.intentId}?key=${this.apiKey}`;
    this._ws = new WebSocket(url);

    this._ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as { status: IntentStatus; dstTxHash?: string; amountOut?: string };
      this.emit('status', msg.status);

      if (msg.status === IntentStatus.SETTLED) {
        this._settled = true;
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

  // ── Async settle — await until terminal result ────────────────────────────

  settle(timeoutMs = 300_000): Promise<SwapResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Swap timed out')), timeoutMs);

      this.on('settled', (msg) => {
        clearTimeout(timer);
        resolve({
          intentId:  this.intentId,
          status:    IntentStatus.SETTLED,
          srcTxHash: '', // populated from status update
          dstTxHash: msg.dstTxHash ?? '',
          amountOut: msg.amountOut ?? '',
          rail:      this.quote.rail,
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

  // ── Polling fallback (for environments without WebSocket) ─────────────────

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
      if (status.status === IntentStatus.FAILED)  throw new Error(`Swap failed: ${status.errorMessage}`);
      if (status.status === IntentStatus.CANCELLED) throw new Error(`Swap cancelled: ${status.errorMessage ?? 'cancelled by user'}`);
      await new Promise(r => setTimeout(r, intervalMs));
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
    action: IntentAction,
    input: SubmitIntentRequest | CancelIntentRequest | RefundIntentRequest,
  ): Promise<any> {
    const timestamp = input.timestamp ?? Date.now();
    const body: Record<string, unknown> = {
      userAddress: input.userAddress,
      signature: input.signature,
      timestamp,
    };

    if ('srcTxHash' in input) {
      body.srcTxHash = input.srcTxHash;
    }
    if ('reason' in input) {
      body.reason = input.reason;
    }
    if ('replacementTxHash' in input && input.replacementTxHash) {
      body.replacementTxHash = input.replacementTxHash;
    }

    const res = await fetch(`${this.baseUrl}/intent/${this.intentId}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`${action} failed: ${await res.text()}`);
    }
    return await res.json();
  }
}

// ── RufloSDK — main entry point ────────────────────────────────────────────────

export class RufloSDK {
  private apiKey:  string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey  = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.ruflo.io';
  }

  // ── Get a quote (does NOT submit tx) ──────────────────────────────────────

  async quote(opts: SwapOptions): Promise<SwapQuote> {
    const res = await fetch(`${this.baseUrl}/partner/quote`, {
      method:  'POST',
      headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        tokenIn:         opts.from.token,
        tokenOut:        opts.to.token,
        amountIn:        this._toWei(opts.from.amount, opts.from.decimals ?? 18),
        srcChainId:      opts.from.chainId,
        dstChainId:      opts.to.chainId,
        userAddress:     opts.wallet,
        nativeDstAddress: opts.to.nativeAddress,
        urgency:         opts.urgency ?? 'normal',
      }),
    });

    if (!res.ok) throw new Error(`Quote failed: ${await res.text()}`);
    const { quote, integration } = await res.json() as {
      quote: {
        intentId: string;
        estimatedOut: string;
        minAmountOut: string;
        feeAmountUSD: number;
        rail: Rail;
        etaSeconds: number;
        expiresAt: number;
      };
      integration: {
        contractAddress: string;
        calldata: string;
        value: string;
      };
    };

    return {
      intentId:     quote.intentId,
      estimatedOut: this._fromWei(quote.estimatedOut, opts.from.decimals ?? 18),
      minOut:       this._fromWei(quote.minAmountOut, opts.from.decimals ?? 18),
      feeUSD:       quote.feeAmountUSD,
      rail:         quote.rail,
      etaSeconds:   quote.etaSeconds,
      expiresAt:    quote.expiresAt,
      tx: {
        to:      integration.contractAddress,
        data:    integration.calldata,
        value:   integration.value,
        chainId: opts.from.chainId,
      },
    };
  }

  // ── Quote + connect WebSocket in one call (most common pattern) ───────────

  async swap(opts: SwapOptions): Promise<SwapHandle> {
    const q = await this.quote(opts);
    return new SwapHandle(q, this.baseUrl, this.apiKey).connect();
  }

  // ── Supported chains and tokens ────────────────────────────────────────────

  async getSupportedRoutes(): Promise<{ srcChainId: number; dstChainIds: number[]; rails: Rail[] }[]> {
    const res = await fetch(`${this.baseUrl}/routes`, { headers: { 'x-api-key': this.apiKey } });
    return await res.json() as { srcChainId: number; dstChainIds: number[]; rails: Rail[] }[];
  }

  // ── Utils ──────────────────────────────────────────────────────────────────

  private _toWei(amount: string, decimals: number): string {
    return (BigInt(Math.round(parseFloat(amount) * 10 ** decimals))).toString();
  }
  private _fromWei(raw: string, decimals: number): string {
    return (Number(raw) / 10 ** decimals).toFixed(6);
  }
}

// ── Chain + token helpers (convenience re-exports for partner DX) ──────────────
export { CHAIN_ID, Rail, IntentStatus, SettlementToken };
export { buildIntentActionMessage };
