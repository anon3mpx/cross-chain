import { Rail, RailOfferType } from '../types';

export type RailSettlementAssetAllowlist = Partial<Record<Rail, string[]>>;

export interface DestinationGasConfig {
  default: number;
  byOfferType?: Partial<Record<RailOfferType, number>>;
}

/**
 * Curated settlement / route assets that each rail is allowed to transport.
 *
 * This is intentionally NOT the same thing as the global set of user-facing
 * tokens Ruflo can support through source/destination swaps.
 */
export const RAIL_SETTLEMENT_ASSET_ALLOWLISTS: RailSettlementAssetAllowlist = {
  [Rail.CCTP]: ['USDC'],
  [Rail.LAYERZERO]: ['USDC'],
  // [Rail.AXELAR]: ['USDC', 'USDT', 'WETH'],
  // [Rail.VIA_LABS]: ['USDC', 'USDT', 'WETH'],
  [Rail.THORCHAIN]: ['USDC', 'USDT', 'WETH'],
};

// Backward-compatible alias while the rest of the codebase finishes migrating.
export const ROUTE_ASSET_ALLOWLISTS = RAIL_SETTLEMENT_ASSET_ALLOWLISTS;

export const DESTINATION_GAS_LIMITS: Partial<Record<Rail, DestinationGasConfig>> = {
  [Rail.CCTP]: {
    default: 200_000,
    byOfferType: {
      cctp_standard: 200_000,
      cctp_fast: 200_000,
    },
  },
  // [Rail.AXELAR]: {
  //   default: 250_000,
  //   byOfferType: {
  //     axelar_direct: 220_000,
  //     axelar_dst_swap: 260_000,
  //   },
  // },
  [Rail.LAYERZERO]: {
    default: 220_000,
    byOfferType: {
      lz_oft: 220_000,
      lz_oft_adapter: 230_000,
      lz_stargate_pool: 240_000,
      lz_stargate_oft: 240_000,
    },
  },
  [Rail.THORCHAIN]: {
    default: 0,
    byOfferType: {
      thor_api_direct: 0,
    },
  },
};
