// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — API Key Manager
// ALL callers must pre-register. No anonymous access.
// Tracks per-partner rebate accrual with pull-based withdrawal.
// ─────────────────────────────────────────────────────────
import crypto from 'crypto';
import { InMemoryPartnerRepository } from '../db/InMemoryPartnerRepository';
import type { PartnerRepository, StoredPartner } from '../db/PartnerRepository';
import { PARTNER_TIER_DEFINITIONS, PartnerTier } from './PartnerTiers';

export { PARTNER_TIER_DEFINITIONS, PartnerTier };

export interface PartnerConfig {
  apiKey: string;
  webhookSecret: string;
  tier: PartnerTier;
  name: string;
  contactEmail: string;
  feeShareBps: number;
  quotesPerMin: number;
  maxTxPerDay: number;
  webhookUrl?: string;
  allowedOrigins?: string[];
  payoutAddress?: string;
  active: boolean;
  registeredAt: number;
}

export interface RateLimitState {
  windowStart: number;
  quoteCount: number;
  txCount: number;
  txCountDate: string;
  quotesTotal: number;
  execsTotal: number;
}

export type RateLimitResult =
  | { allowed: true; partner: PartnerConfig }
  | { allowed: false; reason: 'UNREGISTERED' | 'INVALID_KEY' | 'RATE_LIMIT' | 'DAILY_LIMIT' | 'INACTIVE' | 'ABUSE_DETECTED' };

export interface RebateSummary {
  apiKey: string;
  tier: PartnerTier;
  feeShareBps: number;
  payoutAddress?: string;
  chains: Record<number, string>;
  totalUSDC: string;
}

export interface ApiKeyManagerOptions {
  repository?: PartnerRepository;
}

type RebateStore = Map<string, Map<number, bigint>>;

const ABUSE_RATIO = 80;
const ABUSE_MIN_QUOTES = 1000;
const API_KEY_PREFIX_LENGTH = 12;

export class ApiKeyManager {
  private readonly repository: PartnerRepository;
  private readonly rateLimits = new Map<string, RateLimitState>();
  private readonly rebates: RebateStore = new Map();
  private readonly webhookSecretsByHash = new Map<string, string>();

  constructor(options: ApiKeyManagerOptions = {}) {
    this.repository = options.repository ?? new InMemoryPartnerRepository();
  }

  // ── Registration (mandatory — no anonymous callers) ────────────────────────

  async registerPartner(config: Omit<PartnerConfig, 'apiKey' | 'webhookSecret' | 'registeredAt'>): Promise<PartnerConfig> {
    const apiKey = this.generateKey();
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const tierDefaults = PARTNER_TIER_DEFINITIONS[config.tier];
    const registeredAt = Date.now();
    const full: PartnerConfig = {
      ...config,
      feeShareBps: config.feeShareBps ?? tierDefaults.feeShareBps,
      quotesPerMin: config.quotesPerMin ?? tierDefaults.quotesPerMin,
      maxTxPerDay: config.maxTxPerDay ?? tierDefaults.maxTxPerDay,
      apiKey,
      webhookSecret,
      registeredAt,
    };
    const apiKeyHash = this.hashSecret(apiKey);
    const stored = await this.repository.createPartner({
      ...full,
      id: this.partnerIdFromApiKey(apiKey),
      apiKeyHash,
      apiKeyPrefix: this.apiKeyPrefix(apiKey),
      webhookSecretHash: this.hashSecret(webhookSecret),
    });
    this.webhookSecretsByHash.set(apiKeyHash, webhookSecret);
    this.rateLimits.set(apiKeyHash, this.freshState());
    this.rebates.set(apiKeyHash, new Map());
    return this.toPartnerConfig(stored, apiKey, webhookSecret);
  }

  async updateTier(apiKey: string, tier: PartnerTier): Promise<void> {
    const apiKeyHash = this.hashSecret(apiKey);
    await this.repository.updateTier(apiKeyHash, tier);
  }

  async deactivate(apiKey: string): Promise<void> {
    await this.repository.setActive(this.hashSecret(apiKey), false);
  }

  async reactivate(apiKey: string): Promise<void> {
    await this.repository.setActive(this.hashSecret(apiKey), true);
  }

  // ── Rate-limit checks ──────────────────────────────────────────────────────

  async checkQuote(apiKey: string | undefined): Promise<RateLimitResult> {
    const check = await this.validateKey(apiKey);
    if (!check.allowed) return check;

    const state = this.getState(this.hashSecret(apiKey!));
    if (Date.now() - state.windowStart > 60_000) {
      state.windowStart = Date.now();
      state.quoteCount = 0;
    }
    if (state.quoteCount >= check.partner.quotesPerMin) return { allowed: false, reason: 'RATE_LIMIT' };

    if (state.quotesTotal > ABUSE_MIN_QUOTES && state.execsTotal > 0) {
      if ((state.quotesTotal / state.execsTotal) > ABUSE_RATIO) {
        return { allowed: false, reason: 'ABUSE_DETECTED' };
      }
    }

    state.quoteCount += 1;
    state.quotesTotal += 1;
    return check;
  }

  async checkSubmit(apiKey: string | undefined): Promise<RateLimitResult> {
    const check = await this.validateKey(apiKey);
    if (!check.allowed) return check;

    const state = this.getState(this.hashSecret(apiKey!));
    const today = new Date().toISOString().slice(0, 10);
    if (state.txCountDate !== today) {
      state.txCountDate = today;
      state.txCount = 0;
    }
    if (state.txCount >= check.partner.maxTxPerDay) return { allowed: false, reason: 'DAILY_LIMIT' };

    state.txCount += 1;
    state.execsTotal += 1;
    return check;
  }

  /**
   * Validates API key presence/existence/activity without mutating counters.
   * Use for read-only endpoints and webhook delivery paths.
   */
  async validateKey(apiKey: string | undefined): Promise<RateLimitResult> {
    if (!apiKey) return { allowed: false, reason: 'UNREGISTERED' };
    const partner = await this.repository.findByApiKeyHash(this.hashSecret(apiKey));
    if (!partner) return { allowed: false, reason: 'INVALID_KEY' };
    if (!partner.active) return { allowed: false, reason: 'INACTIVE' };
    return { allowed: true, partner: this.toPartnerConfig(partner, apiKey) };
  }

  // ── Fee split + rebate accrual ─────────────────────────────────────────────

  splitFee(grossFee: bigint, partner: PartnerConfig): { platformFee: bigint; partnerRebate: bigint } {
    const partnerRebate = (grossFee * BigInt(partner.feeShareBps)) / 10_000n;
    return { platformFee: grossFee - partnerRebate, partnerRebate };
  }

  accrueRebate(apiKey: string, chainId: number, amountUSDC: bigint): void {
    const apiKeyHash = this.hashSecret(apiKey);
    if (!this.rebates.has(apiKeyHash)) this.rebates.set(apiKeyHash, new Map());
    const chain = this.rebates.get(apiKeyHash)!;
    chain.set(chainId, (chain.get(chainId) ?? 0n) + amountUSDC);
  }

  claimRebate(apiKey: string, chainId: number): bigint {
    const chain = this.rebates.get(this.hashSecret(apiKey));
    if (!chain) return 0n;
    const amount = chain.get(chainId) ?? 0n;
    chain.set(chainId, 0n);
    return amount;
  }

  async getRebateSummary(apiKey: string): Promise<RebateSummary> {
    const check = await this.validateKey(apiKey);
    if (!check.allowed) throw new Error(`Partner not found: ${apiKey}`);
    const chain = this.rebates.get(this.hashSecret(apiKey)) ?? new Map<number, bigint>();
    const chains: Record<number, string> = {};
    let total = 0n;
    chain.forEach((amt, cid) => {
      chains[cid] = amt.toString();
      total += amt;
    });
    return {
      apiKey,
      tier: check.partner.tier,
      feeShareBps: check.partner.feeShareBps,
      payoutAddress: check.partner.payoutAddress,
      chains,
      totalUSDC: total.toString(),
    };
  }

  // ── Webhook signing ────────────────────────────────────────────────────────

  async signWebhookPayload(apiKey: string, body: string): Promise<string> {
    const apiKeyHash = this.hashSecret(apiKey);
    const partner = await this.repository.findByApiKeyHash(apiKeyHash);
    const cachedSecret = this.webhookSecretsByHash.get(apiKeyHash);
    // Durable storage keeps the webhook secret hash. Runtime-created partners use
    // the original secret for HMAC compatibility; restarted processes fall back
    // to the hash until encrypted webhook-secret storage is added.
    const secret = cachedSecret ?? partner?.webhookSecretHash ?? '';
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private generateKey(): string {
    return 'rflo_' + crypto.randomBytes(24).toString('hex');
  }

  private hashSecret(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private apiKeyPrefix(apiKey: string): string {
    return apiKey.slice(0, API_KEY_PREFIX_LENGTH);
  }

  private partnerIdFromApiKey(apiKey: string): string {
    return `ptn_${this.hashSecret(apiKey).slice(0, 24)}`;
  }

  private getState(apiKeyHash: string): RateLimitState {
    if (!this.rateLimits.has(apiKeyHash)) this.rateLimits.set(apiKeyHash, this.freshState());
    return this.rateLimits.get(apiKeyHash)!;
  }

  private freshState(): RateLimitState {
    return { windowStart: Date.now(), quoteCount: 0, txCount: 0, txCountDate: '', quotesTotal: 0, execsTotal: 0 };
  }

  private toPartnerConfig(partner: StoredPartner, apiKey: string, webhookSecret = ''): PartnerConfig {
    return {
      apiKey,
      webhookSecret,
      tier: partner.tier,
      name: partner.name,
      contactEmail: partner.contactEmail,
      feeShareBps: partner.feeShareBps,
      quotesPerMin: partner.quotesPerMin,
      maxTxPerDay: partner.maxTxPerDay,
      webhookUrl: partner.webhookUrl,
      allowedOrigins: partner.allowedOrigins,
      payoutAddress: partner.payoutAddress,
      active: partner.active,
      registeredAt: partner.registeredAt,
    };
  }
}
