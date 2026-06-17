import type { PartnerConfig } from '../services/ApiKeyManager';
import type { PartnerTier } from '../services/PartnerTiers';

export interface StoredPartner extends Omit<PartnerConfig, 'apiKey' | 'webhookSecret'> {
  id: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  webhookSecretHash: string;
}

export interface CreatePartnerInput extends Omit<PartnerConfig, 'registeredAt'> {
  id: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  webhookSecretHash: string;
  registeredAt: number;
}

export interface PartnerRepository {
  createPartner(input: CreatePartnerInput): Promise<StoredPartner>;
  findByApiKeyHash(apiKeyHash: string): Promise<StoredPartner | undefined>;
  findByApiKeyPrefix(apiKeyPrefix: string): Promise<StoredPartner | undefined>;
  updateTier(apiKeyHash: string, tier: PartnerTier): Promise<StoredPartner>;
  setActive(apiKeyHash: string, active: boolean): Promise<StoredPartner>;
  updateAllowedOrigins?(apiKeyHash: string, allowedOrigins: string[]): Promise<StoredPartner>;
}
