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
    routerV1: '0x10c9db3761056d752bc41ac817f730f9e4348bb0',
    receiverV1: '0x3aef79e7455843a33e4c46d5cf283a809bf50970',
    pluginRegistry: '0x39c586ec7f4df4a3b5cb5603e6ac6a6f4b950a49',
    railPlugins: {
      [Rail.LAYERZERO]: '0x1FdD058dD7BFf3B8Ff805f930a25bb3e17DD12Ec',
      [Rail.CCTP]: '0xe1b589fcd71541099dd861a68a104f31e5ffebed',
      [Rail.CCTP_FAST]: '0xf788dc2af6a35339028df57d92a3d6221547d991',
    },
    receiverAdapters: {
      layerzero: '0x6f7cd979bcbd03c2fd593c5beec3b2628514392b',
    },
    swapPlugins: {
      empseal: '0x6bb306a5db3fdaa6a5d11349837b6349cdb52b7a',
    },
  },
  42161: {
    routerV1: '0x465fa155c8623dd3dce1e5e134d86f1d47b8fcf4',
    receiverV1: '0xa10914363664e46154328e6e787961641ea6e3de',
    pluginRegistry: '0x1725e2c27e428eb4a18ed121b459f4055ef2cc5b',
    railPlugins: {
      [Rail.LAYERZERO]: '0x4554C302D11020C82C4dEAaE45520C10b7BC28cb',
      [Rail.CCTP]: '0x396adf660cf97105308c3650575d73b5fe8f586e',
      [Rail.CCTP_FAST]: '0x970b735a5cdaaa97cd686a1da0b9f5d8332011c0',
    },
    receiverAdapters: {
      layerzero: '0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3',
    },
    swapPlugins: {
      empseal: '0x033ec98b64c0c0098faebb61996aa5761356dfb1',
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
  10: {
    routerV1: '0xe6ef55853f548b7edfa403056f91f85fd3b3f086',
    receiverV1: '0x65642ac8fd57eff8dd4651cb76be48814c8bf386',
    pluginRegistry: '0x367ec0c092d32f3883c4cacbfb6c9c3594062e90',
    railPlugins: {
      [Rail.LAYERZERO]: '0xDBCCeA86821f02031a9C371276a0EaD3656B128F',
      [Rail.CCTP]: '0x1b7eb489eb0ae102720442fe15b0e08653a13404',
      [Rail.CCTP_FAST]: '0x050c6c2555c2d54aba01420fbc02ff0f1d10e8df',
    },
    receiverAdapters: {
      layerzero: '0x845cd50644a9592de43bcac0212656480744aaca',
    },
    swapPlugins: {
      empseal: '0x965395a8fb2e52db7097fe7b4a9e0844dfd9ecc2',
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
