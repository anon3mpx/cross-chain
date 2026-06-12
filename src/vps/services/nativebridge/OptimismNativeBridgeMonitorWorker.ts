import { Intent, IntentStatus, Rail } from '../../types';
import { IntentService } from '../IntentService';

export interface OptimismNativeBridgeStatus {
  status: IntentStatus;
  sourceTxHash?: string;
  destinationTxHash?: string;
}

export interface OptimismNativeBridgeStatusClient {
  getStatus(intent: Intent): Promise<OptimismNativeBridgeStatus | null>;
}

export interface OptimismNativeBridgeMonitorWorkerOptions {
  pollIntervalMs?: number;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export class RpcOptimismNativeBridgeStatusClient implements OptimismNativeBridgeStatusClient {
  constructor(
    private readonly getProvider: (chainId: number) => Promise<{
      getTransactionReceipt(hash: string): Promise<{ status?: number; blockNumber: number } | null>;
      getBlock(blockNumber: number): Promise<{ timestamp: number } | null>;
    } | null>,
  ) {}

  async getStatus(intent: Intent): Promise<OptimismNativeBridgeStatus | null> {
    if (!intent.srcTxHash) return null;

    const provider = await this.getProvider(intent.quote.srcChainId);
    if (!provider) return null;

    const receipt = await provider.getTransactionReceipt(intent.srcTxHash);
    if (!receipt || receipt.status === 0) {
      return { status: IntentStatus.SUBMITTED, sourceTxHash: intent.srcTxHash };
    }

    const block = await provider.getBlock(receipt.blockNumber);
    const confirmedAtMs = block?.timestamp ? block.timestamp * 1000 : Date.now();
    const elapsedMs = Math.max(0, Date.now() - confirmedAtMs);
    const etaMs = Math.max(1, intent.quote.etaSeconds) * 1000;

    return {
      status: elapsedMs >= etaMs ? IntentStatus.SETTLED : IntentStatus.IN_TRANSIT,
      sourceTxHash: intent.srcTxHash,
      destinationTxHash: intent.srcTxHash,
    };
  }
}

export class OptimismNativeBridgeMonitorWorker {
  private readonly pollIntervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private running = false;

  constructor(
    private readonly intentService: IntentService,
    private readonly client: OptimismNativeBridgeStatusClient,
    options: OptimismNativeBridgeMonitorWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? readIntEnv('OPTIMISM_NATIVE_BRIDGE_MONITOR_INTERVAL_MS', 30_000);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this._poll();
    this.timer = setInterval(() => {
      void this._poll();
    }, this.pollIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async _poll(): Promise<void> {
    if (!this.running || this.polling) return;
    this.polling = true;

    try {
      const active = await this.intentService.listIntentsByStatuses(
        [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
        300,
      );
      const intents = active.filter((intent) => intent.quote.rail === Rail.OPTIMISM_NATIVE_BRIDGE);

      for (const intent of intents) {
        if (!this.running) break;
        const status = await this.client.getStatus(intent).catch(() => null);
        if (!status) continue;

        if (status.status === IntentStatus.IN_TRANSIT && intent.status === IntentStatus.SUBMITTED) {
          await this.intentService.markInTransit(intent.intentId, status.sourceTxHash ?? intent.srcTxHash ?? intent.intentId, {
            actor: 'system',
            eventSource: 'optimism-native-bridge-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
          }).catch(() => undefined);
          continue;
        }

        if (status.status === IntentStatus.SETTLED) {
          await this.intentService.markSettled(intent.intentId, status.destinationTxHash ?? status.sourceTxHash ?? intent.intentId, {
            actor: 'system',
            eventSource: 'optimism-native-bridge-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
          }).catch(() => undefined);
        }
      }
    } finally {
      this.polling = false;
    }
  }
}
