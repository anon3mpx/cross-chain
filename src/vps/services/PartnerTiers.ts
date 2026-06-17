export enum PartnerTier {
  FREE = 'FREE',
  GROWTH = 'GROWTH',
  PARTNER = 'PARTNER',
  ENTERPRISE = 'ENTERPRISE',
}

export interface PartnerTierDefinition {
  feeShareBps: number;
  quotesPerMin: number;
  maxTxPerDay: number;
  sla: string;
  approval: 'self_serve' | 'approval_required' | 'contract_required';
}

export const PARTNER_TIER_DEFINITIONS: Record<PartnerTier, PartnerTierDefinition> = {
  [PartnerTier.FREE]: {
    feeShareBps: 0,
    quotesPerMin: 60,
    maxTxPerDay: 500,
    sla: 'none',
    approval: 'self_serve',
  },
  [PartnerTier.GROWTH]: {
    feeShareBps: 1500,
    quotesPerMin: 300,
    maxTxPerDay: 5_000,
    sla: 'none',
    approval: 'approval_required',
  },
  [PartnerTier.PARTNER]: {
    feeShareBps: 2000,
    quotesPerMin: 600,
    maxTxPerDay: 10_000,
    sla: '99.5%',
    approval: 'contract_required',
  },
  [PartnerTier.ENTERPRISE]: {
    feeShareBps: 3000,
    quotesPerMin: 6_000,
    maxTxPerDay: 500_000,
    sla: '99.9%',
    approval: 'contract_required',
  },
};
