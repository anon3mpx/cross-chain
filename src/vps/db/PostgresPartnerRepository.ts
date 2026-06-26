import type { Pool } from 'pg';
import { PARTNER_TIER_DEFINITIONS } from '../services/PartnerTiers';
import type { PartnerTier } from '../services/PartnerTiers';
import type { CreatePartnerInput, PartnerRepository, StoredPartner } from './PartnerRepository';

export class PostgresPartnerRepository implements PartnerRepository {
  constructor(private readonly pool: Pool) {}

  async createPartner(input: CreatePartnerInput): Promise<StoredPartner> {
    const now = Date.now();
    const result = await this.pool.query(`
      insert into partners (
        id, api_key_hash, api_key_prefix, webhook_secret_hash, tier, name, contact_email,
        fee_share_bps, quotes_per_min, max_tx_per_day, webhook_url, allowed_origins,
        payout_address, active, registered_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      returning *
    `, [
      input.id,
      input.apiKeyHash,
      input.apiKeyPrefix,
      input.webhookSecretHash,
      input.tier,
      input.name,
      input.contactEmail,
      input.feeShareBps,
      input.quotesPerMin,
      input.maxTxPerDay,
      input.webhookUrl ?? null,
      input.allowedOrigins ?? [],
      input.payoutAddress ?? null,
      input.active,
      input.registeredAt,
      now,
    ]);
    return rowToPartner(result.rows[0]);
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<StoredPartner | undefined> {
    const result = await this.pool.query('select * from partners where api_key_hash = $1', [apiKeyHash]);
    return result.rows[0] ? rowToPartner(result.rows[0]) : undefined;
  }

  async findByApiKeyPrefix(apiKeyPrefix: string): Promise<StoredPartner | undefined> {
    const result = await this.pool.query('select * from partners where api_key_prefix = $1', [apiKeyPrefix]);
    return result.rows[0] ? rowToPartner(result.rows[0]) : undefined;
  }

  async updateTier(apiKeyHash: string, tier: PartnerTier): Promise<StoredPartner> {
    const defaults = PARTNER_TIER_DEFINITIONS[tier];
    const result = await this.pool.query(`
      update partners
      set tier = $2, fee_share_bps = $3, quotes_per_min = $4, max_tx_per_day = $5, updated_at = $6
      where api_key_hash = $1
      returning *
    `, [apiKeyHash, tier, defaults.feeShareBps, defaults.quotesPerMin, defaults.maxTxPerDay, Date.now()]);
    if (!result.rows[0]) throw new Error('partner not found');
    return rowToPartner(result.rows[0]);
  }

  async setActive(apiKeyHash: string, active: boolean): Promise<StoredPartner> {
    const result = await this.pool.query(
      'update partners set active = $2, updated_at = $3 where api_key_hash = $1 returning *',
      [apiKeyHash, active, Date.now()],
    );
    if (!result.rows[0]) throw new Error('partner not found');
    return rowToPartner(result.rows[0]);
  }

  async updateAllowedOrigins(apiKeyHash: string, allowedOrigins: string[]): Promise<StoredPartner> {
    const result = await this.pool.query(
      'update partners set allowed_origins = $2, updated_at = $3 where api_key_hash = $1 returning *',
      [apiKeyHash, allowedOrigins, Date.now()],
    );
    if (!result.rows[0]) throw new Error('partner not found');
    return rowToPartner(result.rows[0]);
  }
}

function rowToPartner(row: any): StoredPartner {
  return {
    id: row.id,
    apiKeyHash: row.api_key_hash,
    apiKeyPrefix: row.api_key_prefix,
    webhookSecretHash: row.webhook_secret_hash,
    tier: row.tier,
    name: row.name,
    contactEmail: row.contact_email,
    feeShareBps: row.fee_share_bps,
    quotesPerMin: row.quotes_per_min,
    maxTxPerDay: row.max_tx_per_day,
    webhookUrl: row.webhook_url ?? undefined,
    allowedOrigins: row.allowed_origins ?? [],
    payoutAddress: row.payout_address ?? undefined,
    active: row.active,
    registeredAt: Number(row.registered_at),
  };
}
