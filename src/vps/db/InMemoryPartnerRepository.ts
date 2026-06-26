import { PARTNER_TIER_DEFINITIONS } from '../services/PartnerTiers';
import type { PartnerTier } from '../services/PartnerTiers';
import type { CreatePartnerInput, PartnerRepository, StoredPartner } from './PartnerRepository';

export class InMemoryPartnerRepository implements PartnerRepository {
  private readonly byHash = new Map<string, StoredPartner>();

  async createPartner(input: CreatePartnerInput): Promise<StoredPartner> {
    const { apiKey: _apiKey, webhookSecret: _webhookSecret, ...stored } = input;
    const partner = stored as StoredPartner;
    this.byHash.set(input.apiKeyHash, partner);
    return partner;
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<StoredPartner | undefined> {
    return this.byHash.get(apiKeyHash);
  }

  async findByApiKeyPrefix(apiKeyPrefix: string): Promise<StoredPartner | undefined> {
    return [...this.byHash.values()].find((partner) => partner.apiKeyPrefix === apiKeyPrefix);
  }

  async updateTier(apiKeyHash: string, tier: PartnerTier): Promise<StoredPartner> {
    const partner = this.mustGet(apiKeyHash);
    const defaults = PARTNER_TIER_DEFINITIONS[tier];
    Object.assign(partner, {
      tier,
      feeShareBps: defaults.feeShareBps,
      quotesPerMin: defaults.quotesPerMin,
      maxTxPerDay: defaults.maxTxPerDay,
    });
    return partner;
  }

  async setActive(apiKeyHash: string, active: boolean): Promise<StoredPartner> {
    const partner = this.mustGet(apiKeyHash);
    partner.active = active;
    return partner;
  }

  async updateAllowedOrigins(apiKeyHash: string, allowedOrigins: string[]): Promise<StoredPartner> {
    const partner = this.mustGet(apiKeyHash);
    partner.allowedOrigins = allowedOrigins;
    return partner;
  }

  private mustGet(apiKeyHash: string): StoredPartner {
    const partner = this.byHash.get(apiKeyHash);
    if (!partner) throw new Error('partner not found');
    return partner;
  }
}
