import { Rail } from '../types';

/**
 * Policy for which assets a rail may use as settlement / route assets.
 * This does not describe the global set of user-facing tokenIn/tokenOut assets.
 */
export interface RouteAssetPolicy {
  isAllowed(rail: Rail, assetAlias: string): boolean;
  allowedAssets(rail: Rail): string[];
}

export class StaticRouteAssetPolicy implements RouteAssetPolicy {
  constructor(private readonly byRail: Partial<Record<Rail, string[]>>) {}

  isAllowed(rail: Rail, assetAlias: string): boolean {
    return this.allowedAssets(rail).includes(assetAlias.toUpperCase());
  }

  allowedAssets(rail: Rail): string[] {
    return (this.byRail[rail] ?? []).map((value) => value.toUpperCase());
  }
}
