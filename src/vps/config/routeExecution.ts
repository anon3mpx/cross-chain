import { Rail, RailOfferType } from '../types';

export type RailRouteAssetAllowlist = Partial<Record<Rail, string[]>>;

export interface DestinationGasConfig {
  default: number;
  byOfferType?: Partial<Record<RailOfferType, number>>;
}

export const ROUTE_ASSET_ALLOWLISTS: RailRouteAssetAllowlist = {
  [Rail.CCTP]: ['USDC'],
  [Rail.AXELAR]: ['USDC', 'USDT', 'WETH'],
  [Rail.LAYERZERO]: ['USDC', 'USDT', 'WETH'],
  [Rail.VIA_LABS]: ['USDC', 'USDT', 'WETH'],
  [Rail.THORCHAIN]: ['USDC', 'USDT', 'WETH'],
};

export const DESTINATION_GAS_LIMITS: Partial<Record<Rail, DestinationGasConfig>> = {
  [Rail.CCTP]: {
    default: 200_000,
    byOfferType: {
      cctp_standard: 200_000,
      cctp_fast: 200_000,
    },
  },
  [Rail.AXELAR]: {
    default: 250_000,
    byOfferType: {
      axelar_direct: 220_000,
      axelar_dst_swap: 260_000,
    },
  },
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
