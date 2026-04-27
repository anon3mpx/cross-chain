import { Rail, RailOfferType } from '../types';
import { DESTINATION_GAS_LIMITS, type DestinationGasConfig } from '../config/routeExecution';

export interface DestinationGasPolicy {
  gasLimit(rail: Rail, offerType?: RailOfferType): number;
}

export class StaticDestinationGasPolicy implements DestinationGasPolicy {
  constructor(private readonly byRail: Partial<Record<Rail, DestinationGasConfig>> = DESTINATION_GAS_LIMITS) {}

  gasLimit(rail: Rail, offerType?: RailOfferType): number {
    const config = this.byRail[rail];
    if (!config) return 0;
    if (offerType && config.byOfferType?.[offerType] !== undefined) {
      return config.byOfferType[offerType] ?? config.default;
    }
    return config.default;
  }
}
