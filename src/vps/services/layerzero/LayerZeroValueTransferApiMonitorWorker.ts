import { IntentStatus, Rail } from '../../types';
import { IntentService } from '../IntentService';
import {
  LayerZeroValueTransferApiClient,
  LayerZeroValueTransferApiStatusResponse,
} from './LayerZeroValueTransferApiClient';

export interface LayerZeroValueTransferApiStatusClient {
  getLayerZeroValueTransferApiStatus(
    quoteId: string,
    txHash?: string,
  ): Promise<LayerZeroValueTransferApiStatusResponse>;
}

export interface LayerZeroValueTransferApiMonitorWorkerOptions {
  pollIntervalMs?: number;
}

export class LayerZeroValueTransferApiMonitorWorker {
  private readonly pollIntervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private running = false;

  constructor(
    private readonly intentService: IntentService,
    private readonly client: LayerZeroValueTransferApiStatusClient = new LayerZeroValueTransferApiClient(),
    options: LayerZeroValueTransferApiMonitorWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? this._readIntEnv('LAYERZERO_TRANSFER_MONITOR_INTERVAL_MS', 30_000);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this._poll();
    this.timer = setInterval(() => {
      void this._poll();
    }, this.pollIntervalMs);
    this.timer.unref?.();
    console.log('[LayerZero Value Transfer API Monitor] started');
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
        [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
        300,
      );
      const lzActive = active.filter((intent) =>
        intent.quote.rail === Rail.LAYERZERO
          && Boolean(intent.quote.layerZeroValueTransferApiQuoteId)
      );

      for (const intent of lzActive) {
        if (!this.running) break;
        const quoteId = intent.quote.layerZeroValueTransferApiQuoteId;
        if (!quoteId) continue;
        const txHash = intent.srcTxHash ?? intent.railTxId;

        let status: LayerZeroValueTransferApiStatusResponse;
        try {
          status = await this.client.getLayerZeroValueTransferApiStatus(quoteId, txHash);
        } catch (err) {
          console.warn(`[LayerZero Value Transfer API Monitor] status fetch failed intent=${intent.intentId}`, err);
          continue;
        }

        if (intent.status === IntentStatus.SUBMITTED && this._hasSent(status)) {
          try {
            await this.intentService.markInTransit(intent.intentId, txHash ?? quoteId, {
              actor: 'system',
              eventSource: 'layerzero-value-transfer-api-monitor',
              allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
            });
          } catch (err) {
            console.warn(`[LayerZero Value Transfer API Monitor] transit transition failed intent=${intent.intentId}`, err);
          }
        }

        if (this._isSucceeded(status)) {
          const deliveredTxHash = this._extractDeliveredTxHash(status) ?? txHash ?? quoteId;
          try {
            await this.intentService.markSettled(intent.intentId, deliveredTxHash, {
              actor: 'system',
              eventSource: 'layerzero-value-transfer-api-monitor',
              allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
            });
          } catch (err) {
            console.warn(`[LayerZero Value Transfer API Monitor] settle transition failed intent=${intent.intentId}`, err);
          }
          continue;
        }

        if (this._isFailed(status)) {
          try {
            await this.intentService.markFailed(intent.intentId, `LayerZero Value Transfer API transfer ${status.status}`, {
              actor: 'system',
              eventSource: 'layerzero-value-transfer-api-monitor',
            });
          } catch (err) {
            console.warn(`[LayerZero Value Transfer API Monitor] failed transition failed intent=${intent.intentId}`, err);
          }
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private _isSucceeded(status: LayerZeroValueTransferApiStatusResponse): boolean {
    const normalized = status.status.trim().toUpperCase();
    return normalized === 'SUCCEEDED' || normalized === 'DELIVERED' || normalized === 'SUCCESS';
  }

  private _isFailed(status: LayerZeroValueTransferApiStatusResponse): boolean {
    const normalized = status.status.trim().toUpperCase();
    return normalized === 'FAILED' || normalized === 'REVERTED' || normalized === 'EXPIRED';
  }

  private _hasSent(status: LayerZeroValueTransferApiStatusResponse): boolean {
    return status.executionHistory?.some((entry) => entry.event.trim().toUpperCase() === 'SENT') ?? false;
  }

  private _extractDeliveredTxHash(status: LayerZeroValueTransferApiStatusResponse): string | undefined {
    const delivered = [...(status.executionHistory ?? [])]
      .reverse()
      .find((entry) => entry.event.trim().toUpperCase() === 'DELIVERED');
    const hash = delivered?.transaction?.hash;
    if (!hash) return undefined;
    const normalized = hash.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }
}
