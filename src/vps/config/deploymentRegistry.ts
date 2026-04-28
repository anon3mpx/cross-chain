import { Rail } from '../types';

type SwapPluginKind = 'empseal' | 'univ2' | 'univ3';
type ReceiverAdapterKind = 'axelar' | 'layerzero';

export interface ChainDeploymentEntry {
  routerV1?: string;
  routerV1Abi?: 'legacy' | 'current';
  receiverV1?: string;
  pluginRegistry?: string;
  paymaster?: string;
  railPlugins?: Partial<Record<Rail, string>>;
  receiverAdapters?: Partial<Record<ReceiverAdapterKind, string>>;
  swapPlugins?: Partial<Record<SwapPluginKind, string>>;
}

export const DEPLOYMENT_REGISTRY_BY_CHAIN: Record<number, ChainDeploymentEntry> = {
  8453: {
    routerV1: '0x1111111111111111111111111111111111111111',
    routerV1Abi: 'current',
    receiverV1: '0x1111111111111111111111111111111111111112',
    pluginRegistry: '0x1111111111111111111111111111111111111113',
    railPlugins: {
      [Rail.AXELAR]: '0x1111111111111111111111111111111111111114',
      [Rail.LAYERZERO]: '0x1111111111111111111111111111111111111115',
      [Rail.CCTP]: '0x1111111111111111111111111111111111111118',
    },
    receiverAdapters: {
      axelar: '0x1111111111111111111111111111111111111116',
      layerzero: '0x1111111111111111111111111111111111111117',
    },
  },
  42161: {
    routerV1: '0x2222222222222222222222222222222222222221',
    routerV1Abi: 'current',
    receiverV1: '0x2222222222222222222222222222222222222222',
    pluginRegistry: '0x2222222222222222222222222222222222222223',
    railPlugins: {
      [Rail.AXELAR]: '0x2222222222222222222222222222222222222224',
      [Rail.LAYERZERO]: '0x2222222222222222222222222222222222222225',
      [Rail.CCTP]: '0x2222222222222222222222222222222222222228',
    },
    receiverAdapters: {
      axelar: '0x2222222222222222222222222222222222222226',
      layerzero: '0x2222222222222222222222222222222222222227',
    },
  },
  84532: {
    routerV1Abi: 'current',
  },
  421614: {
    routerV1Abi: 'current',
  },
  11155420: {
    routerV1Abi: 'current',
  },
};

export function getDeploymentEntry(chainId: number): ChainDeploymentEntry | undefined {
  return DEPLOYMENT_REGISTRY_BY_CHAIN[chainId];
}

export function getRouterAddressFromDeploymentRegistry(chainId: number): string | undefined {
  return getDeploymentEntry(chainId)?.routerV1;
}

export function getRouterAbiFromDeploymentRegistry(chainId: number): 'legacy' | 'current' | undefined {
  return getDeploymentEntry(chainId)?.routerV1Abi;
}

export function getReceiverAddressFromDeploymentRegistry(chainId: number): string | undefined {
  return getDeploymentEntry(chainId)?.receiverV1;
}

export function getRailPluginAddressFromDeploymentRegistry(
  chainId: number,
  rail: Rail,
): string | undefined {
  return getDeploymentEntry(chainId)?.railPlugins?.[rail];
}

export function getReceiverAdapterAddressFromDeploymentRegistry(
  chainId: number,
  adapter: ReceiverAdapterKind,
): string | undefined {
  return getDeploymentEntry(chainId)?.receiverAdapters?.[adapter];
}
