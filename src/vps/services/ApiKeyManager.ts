// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — API Key Manager
// ALL callers must pre-register. No anonymous access.
// Tracks per-partner rebate accrual with pull-based withdrawal.
// ─────────────────────────────────────────────────────────
import crypto from 'crypto';

export enum PartnerTier {
  FREE       = 'FREE',       // Registered, no fee share, capped volume
  GROWTH     = 'GROWTH',     // Approved, 15% fee share, higher limits
  PARTNER    = 'PARTNER',    // Revenue share agreement, 20% fee share
  ENTERPRISE = 'ENTERPRISE', // Custom contract, 30% fee share
}

export interface PartnerConfig {
  apiKey:          string;
  webhookSecret:   string;    // HMAC secret for signing webhook payloads
  tier:            PartnerTier;
  name:            string;
  contactEmail:    string;
  feeShareBps:     number;
  quotesPerMin:    number;
  maxTxPerDay:     number;
  webhookUrl?:     string;
  allowedOrigins?: string[];
  payoutAddress?:  string;    // EVM address to receive rebate payouts (USDC)
  active:          boolean;
  registeredAt:    number;
}

export interface RateLimitState {
  windowStart:  number;
  quoteCount:   number;
  txCount:      number;
  txCountDate:  string;
  quotesTotal:  number;
  execsTotal:   number;
}

// Per-chain accrued rebates: apiKey → chainId → amount (in USDC 6-dec units)
type RebateStore = Map<string, Map<number, bigint>>;

const TIER_DEFAULTS: Record<PartnerTier, Pick<PartnerConfig, 'feeShareBps' | 'quotesPerMin' | 'maxTxPerDay'>> = {
  [PartnerTier.FREE]:       { feeShareBps: 0,    quotesPerMin: 60,    maxTxPerDay: 500     },
  [PartnerTier.GROWTH]:     { feeShareBps: 1500, quotesPerMin: 300,   maxTxPerDay: 5_000   },
  [PartnerTier.PARTNER]:    { feeShareBps: 2000, quotesPerMin: 600,   maxTxPerDay: 10_000  },
  [PartnerTier.ENTERPRISE]: { feeShareBps: 3000, quotesPerMin: 6_000, maxTxPerDay: 500_000 },
};

// Abuse: if quote:execute > 80:1 after 1000 quotes, throttle
const ABUSE_RATIO    = 80;
const ABUSE_MIN_QUOTES = 1000;

export type RateLimitResult =
  | { allowed: true;  partner: PartnerConfig }
  | { allowed: false; reason: 'UNREGISTERED' | 'INVALID_KEY' | 'RATE_LIMIT' | 'DAILY_LIMIT' | 'INACTIVE' | 'ABUSE_DETECTED' };

export interface RebateSummary {
  apiKey:       string;
  tier:         PartnerTier;
  feeShareBps:  number;
  payoutAddress?: string;
  chains:       Record<number, string>;   // chainId → accrued USDC amount string
  totalUSDC:    string;                   // sum across all chains
}

export class ApiKeyManager {
  private partners    = new Map<string, PartnerConfig>();
  private rateLimits  = new Map<string, RateLimitState>();
  private rebates:      RebateStore = new Map();

  // ── Registration (mandatory — no anonymous callers) ────────────────────────

  registerPartner(config: Omit<PartnerConfig, 'apiKey' | 'webhookSecret' | 'registeredAt'>): PartnerConfig {
    const apiKey       = this._generateKey();
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const full: PartnerConfig = {
      ...config,
      ...TIER_DEFAULTS[config.tier],
      // Allow overrides from config
      feeShareBps:  config.feeShareBps  ?? TIER_DEFAULTS[config.tier].feeShareBps,
      quotesPerMin: config.quotesPerMin ?? TIER_DEFAULTS[config.tier].quotesPerMin,
      maxTxPerDay:  config.maxTxPerDay  ?? TIER_DEFAULTS[config.tier].maxTxPerDay,
      apiKey,
      webhookSecret,
      registeredAt: Date.now(),
    };
    this.partners.set(apiKey, full);
    this.rateLimits.set(apiKey, this._freshState());
    this.rebates.set(apiKey, new Map());
    return full;
  }

  updateTier(apiKey: string, tier: PartnerTier): void {
    const p = this._mustGet(apiKey);
    Object.assign(p, TIER_DEFAULTS[tier], { tier });
  }

  deactivate(apiKey: string): void { this._mustGet(apiKey).active = false; }
  reactivate(apiKey: string): void { this._mustGet(apiKey).active = true; }

  // ── Rate-limit checks ──────────────────────────────────────────────────────

  checkQuote(apiKey: string | undefined): RateLimitResult {
    if (!apiKey) return { allowed: false, reason: 'UNREGISTERED' };
    const partner = this.partners.get(apiKey);
    if (!partner)        return { allowed: false, reason: 'INVALID_KEY' };
    if (!partner.active) return { allowed: false, reason: 'INACTIVE' };

    const state = this._getState(apiKey);
    if (Date.now() - state.windowStart > 60_000) {
      state.windowStart = Date.now();
      state.quoteCount  = 0;
    }
    if (state.quoteCount >= partner.quotesPerMin) return { allowed: false, reason: 'RATE_LIMIT' };

    if (state.quotesTotal > ABUSE_MIN_QUOTES && state.execsTotal > 0) {
      if ((state.quotesTotal / state.execsTotal) > ABUSE_RATIO) {
        return { allowed: false, reason: 'ABUSE_DETECTED' };
      }
    }

    state.quoteCount++;
    state.quotesTotal++;
    return { allowed: true, partner };
  }

  checkSubmit(apiKey: string | undefined): RateLimitResult {
    if (!apiKey) return { allowed: false, reason: 'UNREGISTERED' };
    const partner = this.partners.get(apiKey);
    if (!partner)        return { allowed: false, reason: 'INVALID_KEY' };
    if (!partner.active) return { allowed: false, reason: 'INACTIVE' };

    const state = this._getState(apiKey);
    const today = new Date().toISOString().slice(0, 10);
    if (state.txCountDate !== today) { state.txCountDate = today; state.txCount = 0; }
    if (state.txCount >= partner.maxTxPerDay) return { allowed: false, reason: 'DAILY_LIMIT' };

    state.txCount++;
    state.execsTotal++;
    return { allowed: true, partner };
  }

  /**
   * Validates API key presence/existence/activity without mutating counters.
   * Use for read-only endpoints and webhook delivery paths.
   */
  validateKey(apiKey: string | undefined): RateLimitResult {
    if (!apiKey) return { allowed: false, reason: 'UNREGISTERED' };
    const partner = this.partners.get(apiKey);
    if (!partner) return { allowed: false, reason: 'INVALID_KEY' };
    if (!partner.active) return { allowed: false, reason: 'INACTIVE' };
    return { allowed: true, partner };
  }

  // ── Fee split + rebate accrual ─────────────────────────────────────────────

  splitFee(grossFee: bigint, partner: PartnerConfig): { platformFee: bigint; partnerRebate: bigint } {
    const partnerRebate = (grossFee * BigInt(partner.feeShareBps)) / 10_000n;
    return { platformFee: grossFee - partnerRebate, partnerRebate };
  }

  // Called by IntentEngine after each settled intent
  accrueRebate(apiKey: string, chainId: number, amountUSDC: bigint): void {
    if (!this.rebates.has(apiKey)) this.rebates.set(apiKey, new Map());
    const chain = this.rebates.get(apiKey)!;
    chain.set(chainId, (chain.get(chainId) ?? 0n) + amountUSDC);
  }

  // Pull-based: partner calls /partner/withdraw to claim. Returns amount and resets.
  claimRebate(apiKey: string, chainId: number): bigint {
    const chain = this.rebates.get(apiKey);
    if (!chain) return 0n;
    const amount = chain.get(chainId) ?? 0n;
    chain.set(chainId, 0n);
    return amount;
  }

  getRebateSummary(apiKey: string): RebateSummary {
    const partner = this._mustGet(apiKey);
    const chain   = this.rebates.get(apiKey) ?? new Map<number, bigint>();
    const chains: Record<number, string> = {};
    let total = 0n;
    chain.forEach((amt, cid) => { chains[cid] = amt.toString(); total += amt; });
    return {
      apiKey,
      tier:         partner.tier,
      feeShareBps:  partner.feeShareBps,
      payoutAddress: partner.payoutAddress,
      chains,
      totalUSDC:    total.toString(),
    };
  }

  // ── Webhook signing ────────────────────────────────────────────────────────

  signWebhookPayload(apiKey: string, body: string): string {
    const secret = this.partners.get(apiKey)?.webhookSecret ?? '';
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _generateKey(): string {
    return 'rflo_' + crypto.randomBytes(24).toString('hex');
  }
  private _mustGet(apiKey: string): PartnerConfig {
    const p = this.partners.get(apiKey);
    if (!p) throw new Error(`Partner not found: ${apiKey}`);
    return p;
  }
  private _getState(key: string): RateLimitState {
    if (!this.rateLimits.has(key)) this.rateLimits.set(key, this._freshState());
    return this.rateLimits.get(key)!;
  }
  private _freshState(): RateLimitState {
    return { windowStart: Date.now(), quoteCount: 0, txCount: 0, txCountDate: '', quotesTotal: 0, execsTotal: 0 };
  }
}
