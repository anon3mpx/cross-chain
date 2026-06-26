import { Rail, SettlementToken } from '../../types';
import {
  HYPERLANE_DOMAIN_BY_CHAIN_ID,
  HYPERLANE_NEXUS_ACCESSIBLE_CHAIN_IDS,
  HyperlaneNexusRouteCatalog,
  type HyperlaneNexusRouteCatalogOptions,
} from './HyperlaneNexusRouteCatalog';

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

export interface HyperlaneNexusQuoteWorkerOptions extends HyperlaneNexusRouteCatalogOptions {
  catalog?: Pick<HyperlaneNexusRouteCatalog, 'findRoute'>;
}

export const HYPERLANE_NEXUS_RAIL = Rail.HYPERLANE_NEXUS;
export { HYPERLANE_DOMAIN_BY_CHAIN_ID, HYPERLANE_NEXUS_ACCESSIBLE_CHAIN_IDS };

export class HyperlaneNexusQuoteWorker {
  private readonly catalog: Pick<HyperlaneNexusRouteCatalog, 'findRoute'>;

  constructor(options: HyperlaneNexusQuoteWorkerOptions | Record<string, string | undefined> = {}) {
    if ('catalog' in options) {
      const typed = options as HyperlaneNexusQuoteWorkerOptions;
      this.catalog = typed.catalog ?? new HyperlaneNexusRouteCatalog(typed);
      return;
    }

    this.catalog = new HyperlaneNexusRouteCatalog(options);
  }

  async quote(req: HyperlaneNexusQuoteRequest): Promise<HyperlaneNexusQuoteResult | null> {
    if (req.amountIn <= 0n) return null;
    const route = this.catalog.findRoute({
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      assetSymbol: req.assetSymbol,
    });
    if (!route) return null;

    return {
      warpRouteAddress: route.warpRouteAddress,
      destinationDomain: route.destinationDomain,
      expectedAmountOut: req.amountIn,
      interchainGasFee: route.interchainGasFee,
      etaSeconds: route.etaSeconds,
    };
  }
}

export function inferHyperlaneAssetSymbol(token: SettlementToken): 'USDC' | 'USDT' | null {
  if (token === SettlementToken.USDC) return 'USDC';
  if (token === SettlementToken.USDT) return 'USDT';
  return null;
}
