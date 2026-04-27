import { Rail } from '../types';

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
