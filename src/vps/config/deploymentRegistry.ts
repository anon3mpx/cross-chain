import { Rail } from '../types';

type SwapPluginKind = 'empseal' | 'univ2' | 'univ3';
type ReceiverAdapterKind = 'axelar' | 'layerzero';

export interface ChainDeploymentEntry {
  routerV1?: string;
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
    routerV1: '0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255',
    receiverV1: '0xbffcf8b777f360c0e01af37051fdd503e58cf2a2',
    pluginRegistry: '0x8b946b19af78d52865fae2418b93cbc1a0321caa',
    railPlugins: {
      [Rail.AXELAR]: '0x605df42c4cfc3799569d3bcc0ad820feea3227d0',
      [Rail.LAYERZERO]: '0x5389cefc0a8fd0148f1e512715843012f42ab6ea',
      [Rail.CCTP]: '0x4af4869ecaf9e9b204349756971e876f4bd29204',
      [Rail.CCTP_FAST]: '0x50d2cedeeeb310c13aa513a54a3e097e4c9d6f8d',
    },
    receiverAdapters: {
      axelar: '0x055f3838c4d58b2b10ec4d64f39c7286777fb0ad',
      layerzero: '0x1e35837f3fbafeebf5e1ccc28b40e4099cf5db39',
    },
  },
  421614: {},
  11155420: {
    routerV1: '0x6d68f2a7632ea73b8d565ad55faa775b2fdac56b',
    receiverV1: '0x1c2bda495534a45469d08f35d68d95d5132ec5ac',
    pluginRegistry: '0xb6bc61c1cfd486949fc47f13d517d80355ed58bf',
    railPlugins: {
      [Rail.AXELAR]: '0x21e1a9261a7e1050d34db82bb67dea80c5d4c0bc',
      [Rail.LAYERZERO]: '0x7f76c13d61ab4f9f7902c255a52a1dae6c434afb',
      [Rail.CCTP]: '0xbbb3f1c913343ca3d1ab0fc346fbf09dd1e2f681',
      [Rail.CCTP_FAST]: '0xd4f0a5a29cce8a1cdbadbf8d6c328640ab984f1d',
    },
    receiverAdapters: {
      axelar: '0xc827913f0556a74bf9589d7ba7434cfe1be2a62b',
      layerzero: '0x7f5713bcf5198a1d1045ddd79d2952317fe3846e',
    },
  },
};

export function getDeploymentEntry(chainId: number): ChainDeploymentEntry | undefined {
  return DEPLOYMENT_REGISTRY_BY_CHAIN[chainId];
}

export function getRouterAddressFromDeploymentRegistry(chainId: number): string | undefined {
  return getDeploymentEntry(chainId)?.routerV1;
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
