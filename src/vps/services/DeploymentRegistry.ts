import { Rail } from '../types';

export interface DeploymentRegistry {
  isExecutable(rail: Rail, srcChainId: number, dstChainId: number): boolean;
  requiresDestinationContracts(rail: Rail, srcChainId: number, dstChainId: number): boolean;
}

export interface DeploymentRoute {
  rail: Rail;
  srcChainId: number;
  dstChainId: number;
  enabled: boolean;
  requiresDestinationContracts: boolean;
  sourceReady: boolean;
  destinationReady: boolean;
}

export class StaticDeploymentRegistry implements DeploymentRegistry {
  constructor(private readonly routes: DeploymentRoute[]) {}

  isExecutable(rail: Rail, srcChainId: number, dstChainId: number): boolean {
    const hit = this.routes.find((route) =>
      route.rail === rail && route.srcChainId === srcChainId && route.dstChainId === dstChainId,
    );
    if (!hit) return false;
    if (!hit.enabled || !hit.sourceReady) return false;
    return hit.requiresDestinationContracts ? hit.destinationReady : true;
  }

  requiresDestinationContracts(rail: Rail, srcChainId: number, dstChainId: number): boolean {
    return this.routes.find((route) =>
      route.rail === rail && route.srcChainId === srcChainId && route.dstChainId === dstChainId,
    )?.requiresDestinationContracts ?? true;
  }
}
