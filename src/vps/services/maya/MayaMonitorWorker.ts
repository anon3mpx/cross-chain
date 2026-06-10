import { IntentStatus, Rail } from '../../types';
import { IntentService } from '../IntentService';
import { MayaClient, type MayaActionStatus } from './MayaClient';

export interface MayaStatusClient {
  getActionStatus(sourceTxHash: string): Promise<MayaActionStatus | null>;
}

export interface MayaMonitorWorkerOptions {
  pollIntervalMs?: number;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export class MayaMonitorWorker {
  private readonly pollIntervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private running = false;

  constructor(
    private readonly intentService: IntentService,
    private readonly client: MayaStatusClient = new MayaClient(),
    options: MayaMonitorWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? readIntEnv('MAYA_MONITOR_INTERVAL_MS', 30_000);
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

  async getStatusOnce(sourceTxHash: string): Promise<{
    status: IntentStatus;
    outboundTxHash?: string;
  } | null> {
    const raw = await this.client.getActionStatus(sourceTxHash);
    if (!raw) return null;
    return {
      status: this._mapStatus(raw),
      outboundTxHash: raw.outboundTxHash,
    };
  }

  private async _poll(): Promise<void> {
    if (!this.running || this.polling) return;
    this.polling = true;

    try {
      const active = await this.intentService.listIntentsByStatuses(
        [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
        300,
      );
      const intents = active.filter((intent) => intent.quote.rail === Rail.MAYA && Boolean(intent.srcTxHash));

      for (const intent of intents) {
        if (!this.running) break;
        const sourceTxHash = intent.srcTxHash;
        if (!sourceTxHash) continue;

        let status: MayaActionStatus | null;
        try {
          status = await this.client.getActionStatus(sourceTxHash);
        } catch (err) {
          console.warn(`[Maya Monitor] status fetch failed intent=${intent.intentId}`, err);
          continue;
        }
        if (!status) continue;

        const mapped = this._mapStatus(status);
        await this.intentService.upsertProviderTransfer({
          intentId: intent.intentId,
          provider: 'maya_midgard',
          providerQuoteId: sourceTxHash,
          status: this._providerTransferStatus(mapped),
          sourceTxHash,
          destinationTxHash: status.outboundTxHash,
          latestProviderStatus: status.status,
          metadata: {},
          lastPolledAt: Date.now(),
        });

        if (mapped === IntentStatus.IN_TRANSIT && intent.status === IntentStatus.SUBMITTED) {
          await this.intentService.markInTransit(intent.intentId, sourceTxHash, {
            actor: 'system',
            eventSource: 'maya-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
          }).catch((err) => console.warn(`[Maya Monitor] transit transition failed intent=${intent.intentId}`, err));
        }

        if (mapped === IntentStatus.DESTINATION_RECEIVED) {
          await this.intentService.markDestinationReceived(intent.intentId, status.outboundTxHash ?? sourceTxHash, {
            actor: 'system',
            eventSource: 'maya-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
          }).catch((err) => console.warn(`[Maya Monitor] destination transition failed intent=${intent.intentId}`, err));
          continue;
        }

        if (mapped === IntentStatus.SETTLED) {
          await this.intentService.markSettled(intent.intentId, status.outboundTxHash ?? sourceTxHash, {
            actor: 'system',
            eventSource: 'maya-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
          }).catch((err) => console.warn(`[Maya Monitor] settle transition failed intent=${intent.intentId}`, err));
          continue;
        }

        if (mapped === IntentStatus.STUCK) {
          await this.intentService.markFailed(intent.intentId, `Maya transfer ${status.status}`, {
            actor: 'system',
            eventSource: 'maya-monitor',
          }).catch((err) => console.warn(`[Maya Monitor] failed transition failed intent=${intent.intentId}`, err));
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private _mapStatus(status: MayaActionStatus): IntentStatus {
    if (status.status === 'success' && status.outboundCompleted) return IntentStatus.SETTLED;
    if (status.status === 'success') return IntentStatus.DESTINATION_RECEIVED;
    if (status.status === 'refund' || status.status === 'failed') return IntentStatus.STUCK;
    if (status.inboundObserved) return IntentStatus.IN_TRANSIT;
    return IntentStatus.SUBMITTED;
  }

  private _providerTransferStatus(status: IntentStatus): 'SUBMITTED' | 'IN_TRANSIT' | 'SETTLED' | 'FAILED' {
    switch (status) {
      case IntentStatus.SETTLED:
        return 'SETTLED';
      case IntentStatus.STUCK:
        return 'FAILED';
      case IntentStatus.SUBMITTED:
        return 'SUBMITTED';
      default:
        return 'IN_TRANSIT';
    }
  }
}
