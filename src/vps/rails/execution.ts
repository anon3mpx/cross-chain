import { IntentService } from '../services/IntentService';
import { CctpAttestationWorker } from '../services/CctpAttestationWorker';
import { THORChainClient } from '../services/thorchain/THORChainClient';
import { THORChainMonitorWorker } from '../services/thorchain/THORChainMonitorWorker';
import { Rail } from '../types';
import { getRailVariantLabel, RailVariantLabel } from './registry';

export type RailExecutionMode = 'worker' | 'passive' | 'disabled';

export interface RailExecutionContext {
  intentService: IntentService;
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

    const worker = new CctpAttestationWorker(context.intentService);
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

const DEFAULT_ADAPTERS: RailExecutionAdapter[] = [
  new CctpRailExecutionAdapter(),
  new THORChainRailExecutionAdapter(),
  new PassiveRailExecutionAdapter(Rail.AXELAR, 'event-monitor'),
  new PassiveRailExecutionAdapter(Rail.LAYERZERO, 'event-monitor'),
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
