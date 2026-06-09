import { Rail, SettlementToken } from '../../types';

export interface HyperlaneNexusQuoteRequest {
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  assetSymbol: 'USDC' | 'USDT';
  amountIn: bigint;
  destinationAddress: string;
}

export interface HyperlaneNexusQuoteResult {
  warpRouteAddress: string;
  destinationDomain: number;
  expectedAmountOut: bigint;
  interchainGasFee: bigint;
  etaSeconds: number;
}

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBigIntSafe(value: string | undefined, fallback: bigint): bigint {
  if (!value) return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

export const HYPERLANE_DOMAIN_BY_CHAIN_ID: Record<number, number> = {
  1: 1,
  10: 10,
  56: 56,
  137: 137,
  8453: 8453,
  42161: 42161,
  43114: 43114,
};

export const HYPERLANE_NEXUS_ACCESSIBLE_CHAIN_IDS = new Set<number>(
  Object.keys(HYPERLANE_DOMAIN_BY_CHAIN_ID).map(Number),
);

export const HYPERLANE_NEXUS_RAIL = Rail.HYPERLANE_NEXUS;

export class HyperlaneNexusQuoteWorker {
  private readonly defaultIgpFee: bigint;
  private readonly defaultEtaSeconds: number;

  constructor() {
    this.defaultIgpFee = parseBigIntSafe(readEnv('HYPERLANE_IGP_FEE_DEFAULT'), 0n);
    const eta = Number.parseInt(readEnv('HYPERLANE_ETA_DEFAULT') ?? '', 10);
    this.defaultEtaSeconds = Number.isFinite(eta) && eta > 0 ? eta : 60;
  }

  async quote(req: HyperlaneNexusQuoteRequest): Promise<HyperlaneNexusQuoteResult | null> {
    if (req.amountIn <= 0n) return null;
    if (req.srcChainId === req.dstChainId) return null;
    if (!HYPERLANE_NEXUS_ACCESSIBLE_CHAIN_IDS.has(req.srcChainId)) return null;
    const destinationDomain = HYPERLANE_DOMAIN_BY_CHAIN_ID[req.dstChainId];
    if (destinationDomain === undefined) return null;

    const warpRouteAddress = this.warpRouteAddressFor(req.srcChainId, req.assetSymbol);
    if (!warpRouteAddress) return null;

    return {
      warpRouteAddress,
      destinationDomain,
      expectedAmountOut: req.amountIn,
      interchainGasFee: this.igpFeeFor(req.srcChainId),
      etaSeconds: this.etaFor(req.srcChainId),
    };
  }

  private warpRouteAddressFor(chainId: number, assetSymbol: 'USDC' | 'USDT'): string | null {
    const value = readEnv(`HYPERLANE_WARP_ROUTE_${assetSymbol}_${chainId}`);
    if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
    return value;
  }

  private igpFeeFor(chainId: number): bigint {
    return parseBigIntSafe(readEnv(`HYPERLANE_IGP_FEE_${chainId}`), this.defaultIgpFee);
  }

  private etaFor(chainId: number): number {
    const raw = Number.parseInt(readEnv(`HYPERLANE_ETA_${chainId}`) ?? '', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : this.defaultEtaSeconds;
  }
}

export function inferHyperlaneAssetSymbol(token: SettlementToken): 'USDC' | 'USDT' | null {
  if (token === SettlementToken.USDC) return 'USDC';
  if (token === SettlementToken.USDT) return 'USDT';
  return null;
}
