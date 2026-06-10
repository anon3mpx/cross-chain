import { IntentService } from '../services/IntentService';
import { CctpAttestationWorker } from '../services/CctpAttestationWorker';
import { THORChainClient } from '../services/thorchain/THORChainClient';
import { THORChainMonitorWorker } from '../services/thorchain/THORChainMonitorWorker';
import { LayerZeroValueTransferApiClient } from '../services/layerzero/LayerZeroValueTransferApiClient';
import { LayerZeroValueTransferApiMonitorWorker } from '../services/layerzero/LayerZeroValueTransferApiMonitorWorker';
import { HyperlaneNexusMonitorWorker } from '../services/hyperlane/HyperlaneNexusMonitorWorker';
import { GasZipMonitorWorker } from '../services/gaszip/GasZipMonitorWorker';
import { ChainflipMonitorWorker } from '../services/chainflip/ChainflipMonitorWorker';
import { MayaMonitorWorker } from '../services/maya/MayaMonitorWorker';
import { TeleSwapMonitorWorker } from '../services/teleswap/TeleSwapMonitorWorker';
import { RpcProviderRegistry } from '../services/RpcProviderRegistry';
import { Rail } from '../types';
import { getRailVariantLabel, RailVariantLabel } from './registry';

export type RailExecutionMode = 'worker' | 'passive' | 'disabled';

export interface RailExecutionContext {
  intentService: IntentService;
  rpcProviderRegistry?: Pick<RpcProviderRegistry, 'getPollingRpcUrl' | 'reportFailure' | 'getProvider' | 'getReadProvider'>;
  /**
   * Sprint 2 — multi-instance idempotency lock store.
   * When provided, rail workers acquire DB-backed lease locks before
   * performing side effects (V1: CCTP destination relay).
   */
  idempotency?: import('../db/IdempotencyStore').IdempotencyStore;
  /** Sprint 2.7 — cross-process nonce reservation for relayer EOAs. */
  nonceStore?: import('../db/RelayerNonceStore').RelayerNonceStore;
}

export interface RailExecutionOptions {
  enabled?: Partial<Record<Rail, boolean>>;
}

export interface RailExecutionHandle<T = unknown> {
  rail: Rail;
  mode: RailExecutionMode;
  label: string;
  visualLabels?: RailVariantLabel[];
  instance?: T;
  stop(): Promise<void>;
}

interface RailExecutionAdapter<T = unknown> {
  rail: Rail;
  start(context: RailExecutionContext, options: RailExecutionOptions): Promise<RailExecutionHandle<T>>;
}

class PassiveRailExecutionAdapter implements RailExecutionAdapter {
  constructor(
    readonly rail: Rail,
    private readonly label: string,
  ) {}

  async start(): Promise<RailExecutionHandle> {
      return {
        rail: this.rail,
        mode: 'passive',
        label: this.label,
        visualLabels: [getRailVariantLabel(this.rail)],
        async stop() {
          return;
        },
    };
  }
}

class CctpRailExecutionAdapter implements RailExecutionAdapter<CctpAttestationWorker> {
  readonly rail = Rail.CCTP;

  async start(
    context: RailExecutionContext,
    options: RailExecutionOptions,
  ): Promise<RailExecutionHandle<CctpAttestationWorker>> {
    const enabled = options.enabled?.[Rail.CCTP] ?? readBool('ENABLE_CCTP_RELAY', false);
    if (!enabled) {
      return {
        rail: this.rail,
        mode: 'disabled',
        label: 'cctp-relay',
        visualLabels: ['CCTP_STANDARD', 'CCTP_FAST'],
        async stop() {
          return;
        },
      };
    }

    const worker = new CctpAttestationWorker(
      context.intentService,
      context.rpcProviderRegistry,
      undefined,
      context.idempotency,
      context.nonceStore,
    );
    await worker.start();

    return {
      rail: this.rail,
      mode: 'worker',
      label: 'cctp-relay',
      visualLabels: ['CCTP_STANDARD', 'CCTP_FAST'],
      instance: worker,
      async stop() {
        worker.stop();
      },
    };
  }
}

class THORChainRailExecutionAdapter implements RailExecutionAdapter<THORChainMonitorWorker> {
  readonly rail = Rail.THORCHAIN;

  async start(
    context: RailExecutionContext,
    options: RailExecutionOptions,
  ): Promise<RailExecutionHandle<THORChainMonitorWorker>> {
    const enabled = options.enabled?.[Rail.THORCHAIN] ?? readBool('ENABLE_THORCHAIN_WORKER', true);
    if (!enabled) {
      return {
        rail: this.rail,
        mode: 'disabled',
        label: 'thorchain-api-direct-monitor',
        visualLabels: ['THORCHAIN'],
        async stop() {
          return;
        },
      };
    }

    const client = new THORChainClient();
    const worker = new THORChainMonitorWorker(context.intentService, client);
    await worker.start();

    return {
      rail: this.rail,
      mode: 'worker',
      label: 'thorchain-api-direct-monitor',
      visualLabels: ['THORCHAIN'],
      instance: worker,
      async stop() {
        worker.stop();
      },
    };
  }
}

class LayerZeroValueTransferApiRailExecutionAdapter implements RailExecutionAdapter<LayerZeroValueTransferApiMonitorWorker> {
  readonly rail = Rail.LAYERZERO;

  async start(
    context: RailExecutionContext,
    options: RailExecutionOptions,
  ): Promise<RailExecutionHandle<LayerZeroValueTransferApiMonitorWorker>> {
    const enabled = options.enabled?.[Rail.LAYERZERO] ?? readBool('ENABLE_LAYERZERO_TRANSFER_API', false);
    if (!enabled) {
      return {
        rail: this.rail,
        mode: 'passive',
        label: 'layerzero-value-transfer-api-disabled',
        visualLabels: ['LAYERZERO'],
        async stop() {
          return;
        },
      };
    }

    const worker = new LayerZeroValueTransferApiMonitorWorker(
      context.intentService,
      new LayerZeroValueTransferApiClient(),
    );
    await worker.start();

    return {
      rail: this.rail,
      mode: 'worker',
      label: 'layerzero-value-transfer-api-monitor',
      visualLabels: ['LAYERZERO'],
      instance: worker,
      async stop() {
        worker.stop();
      },
    };
  }
}

class GasZipRailExecutionAdapter implements RailExecutionAdapter<GasZipMonitorWorker> {
  readonly rail = Rail.GASZIP;

  async start(
    context: RailExecutionContext,
    options: RailExecutionOptions,
  ): Promise<RailExecutionHandle<GasZipMonitorWorker>> {
    const enabled = options.enabled?.[Rail.GASZIP] ?? readBool('ENABLE_GASZIP_DIRECT_DEPOSIT', false);
    if (!enabled) {
      return {
        rail: this.rail,
        mode: 'disabled',
        label: 'gaszip-direct-monitor',
        visualLabels: ['GASZIP'],
        async stop() {
          return;
        },
      };
    }

    const worker = new GasZipMonitorWorker(
      context.intentService,
      undefined,
      async (chainId) => {
        try {
          const registry = context.rpcProviderRegistry ?? new RpcProviderRegistry();
          return 'getProvider' in registry
            ? registry.getProvider(chainId).asEthersProvider()
            : registry.getReadProvider(chainId);
        } catch {
          return null;
        }
      },
    );
    await worker.start();

    return {
      rail: this.rail,
      mode: 'worker',
      label: 'gaszip-direct-monitor',
      visualLabels: ['GASZIP'],
      instance: worker,
      async stop() {
        worker.stop();
      },
    };
  }
}

class HyperlaneNexusRailExecutionAdapter implements RailExecutionAdapter<HyperlaneNexusMonitorWorker> {
  readonly rail = Rail.HYPERLANE_NEXUS;

  async start(
    context: RailExecutionContext,
    options: RailExecutionOptions,
  ): Promise<RailExecutionHandle<HyperlaneNexusMonitorWorker>> {
    const enabled = options.enabled?.[Rail.HYPERLANE_NEXUS] ?? readBool('ENABLE_HYPERLANE_NEXUS', false);
    if (!enabled) {
      return {
        rail: this.rail,
        mode: 'disabled',
        label: 'hyperlane-nexus-monitor',
        visualLabels: ['HYPERLANE_NEXUS'],
        async stop() {
          return;
        },
      };
    }

    const worker = new HyperlaneNexusMonitorWorker(context.intentService);
    await worker.start();

    return {
      rail: this.rail,
      mode: 'worker',
      label: 'hyperlane-nexus-monitor',
      visualLabels: ['HYPERLANE_NEXUS'],
      instance: worker,
      async stop() {
        worker.stop();
      },
    };
  }
}

class ChainflipRailExecutionAdapter implements RailExecutionAdapter<ChainflipMonitorWorker> {
  readonly rail = Rail.CHAINFLIP;

  async start(
    context: RailExecutionContext,
    options: RailExecutionOptions,
  ): Promise<RailExecutionHandle<ChainflipMonitorWorker>> {
    const enabled = options.enabled?.[Rail.CHAINFLIP] ?? readBool('ENABLE_CHAINFLIP', Boolean(process.env.CHAINFLIP_BROKER_URL));
    if (!enabled) {
      return {
        rail: this.rail,
        mode: 'disabled',
        label: 'chainflip-monitor',
        visualLabels: ['CHAINFLIP'],
        async stop() {
          return;
        },
      };
    }

    const worker = new ChainflipMonitorWorker(context.intentService);
    await worker.start();

    return {
      rail: this.rail,
      mode: 'worker',
      label: 'chainflip-monitor',
      visualLabels: ['CHAINFLIP'],
      instance: worker,
      async stop() {
        worker.stop();
      },
    };
  }
}

class MayaRailExecutionAdapter implements RailExecutionAdapter<MayaMonitorWorker> {
  readonly rail = Rail.MAYA;

  async start(
    context: RailExecutionContext,
    options: RailExecutionOptions,
  ): Promise<RailExecutionHandle<MayaMonitorWorker>> {
    const enabled = options.enabled?.[Rail.MAYA] ?? readBool('ENABLE_MAYA', false);
    if (!enabled) {
      return {
        rail: this.rail,
        mode: 'disabled',
        label: 'maya-monitor',
        visualLabels: ['MAYA'],
        async stop() {
          return;
        },
      };
    }

    const worker = new MayaMonitorWorker(context.intentService);
    await worker.start();

    return {
      rail: this.rail,
      mode: 'worker',
      label: 'maya-monitor',
      visualLabels: ['MAYA'],
      instance: worker,
      async stop() {
        worker.stop();
      },
    };
  }
}

class TeleSwapRailExecutionAdapter implements RailExecutionAdapter<TeleSwapMonitorWorker> {
  readonly rail = Rail.TELESWAP;

  async start(
    context: RailExecutionContext,
    options: RailExecutionOptions,
  ): Promise<RailExecutionHandle<TeleSwapMonitorWorker>> {
    const enabled = options.enabled?.[Rail.TELESWAP] ?? readBool('ENABLE_TELESWAP', Boolean(process.env.TELESWAP_API_URL));
    if (!enabled) {
      return {
        rail: this.rail,
        mode: 'disabled',
        label: 'teleswap-monitor',
        visualLabels: ['TELESWAP'],
        async stop() {
          return;
        },
      };
    }

    const worker = new TeleSwapMonitorWorker(context.intentService);
    await worker.start();

    return {
      rail: this.rail,
      mode: 'worker',
      label: 'teleswap-monitor',
      visualLabels: ['TELESWAP'],
      instance: worker,
      async stop() {
        worker.stop();
      },
    };
  }
}

const DEFAULT_ADAPTERS: RailExecutionAdapter[] = [
  new CctpRailExecutionAdapter(),
  new THORChainRailExecutionAdapter(),
  new LayerZeroValueTransferApiRailExecutionAdapter(),
  new HyperlaneNexusRailExecutionAdapter(),
  new GasZipRailExecutionAdapter(),
  new ChainflipRailExecutionAdapter(),
  new MayaRailExecutionAdapter(),
  new TeleSwapRailExecutionAdapter(),
  new PassiveRailExecutionAdapter(Rail.AXELAR, 'event-monitor'),
  new PassiveRailExecutionAdapter(Rail.VIA_LABS, 'event-monitor'),
  new PassiveRailExecutionAdapter(Rail.WORMHOLE, 'event-monitor'),
];

export class RailExecutionManager {
  private readonly adapters = new Map<Rail, RailExecutionAdapter>(
    DEFAULT_ADAPTERS.map((adapter) => [adapter.rail, adapter]),
  );
  private handles = new Map<Rail, RailExecutionHandle>();

  constructor(private readonly context: RailExecutionContext) {}

  async startAll(options: RailExecutionOptions = {}): Promise<ReadonlyMap<Rail, RailExecutionHandle>> {
    if (this.handles.size > 0) return this.handles;

    for (const rail of Object.values(Rail)) {
      const adapter = this.adapters.get(rail);
      if (!adapter) {
        this.handles.set(rail, {
          rail,
          mode: 'disabled',
          label: 'unconfigured',
          visualLabels: [getRailVariantLabel(rail)],
          async stop() {
            return;
          },
        });
        continue;
      }

      const handle = await adapter.start(this.context, options);
      this.handles.set(rail, handle);
    }

    return this.handles;
  }

  getHandles(): ReadonlyMap<Rail, RailExecutionHandle> {
    return this.handles;
  }

  getHandle<T = unknown>(rail: Rail): RailExecutionHandle<T> | undefined {
    return this.handles.get(rail) as RailExecutionHandle<T> | undefined;
  }

  getInstance<T = unknown>(rail: Rail): T | undefined {
    return this.getHandle<T>(rail)?.instance;
  }

  describe(): string {
    return [...this.handles.values()]
      .flatMap((handle) => {
        const labels = handle.visualLabels && handle.visualLabels.length > 0
          ? handle.visualLabels
          : [getRailVariantLabel(handle.rail)];
        return labels.map((label) => `${label}=${handle.mode}`);
      })
      .join(' ');
  }

  async stopAll(): Promise<void> {
    const handles = [...this.handles.values()];
    this.handles.clear();

    for (const handle of handles.reverse()) {
      try {
        await handle.stop();
      } catch (err) {
        console.warn(`[RailExecutionManager] stop failed rail=${handle.rail}`, err);
      }
    }
  }
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}
