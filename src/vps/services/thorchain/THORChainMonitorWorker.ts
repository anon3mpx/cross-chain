import { IntentStatus, Rail } from '../../types';
import { IntentService } from '../IntentService';

export interface THORChainTxStatus {
  out_txs?: Array<{ txID?: string; txid?: string }>;
  outbound_txs?: Array<{ txID?: string; txid?: string }>;
  stages?: {
    outbound_signed?: { completed?: boolean };
    swap_status?: { completed?: boolean };
  };
  status?: string;
}

export interface THORChainMonitorClient {
  inboundAddresses(): Promise<unknown>;
  txStatus(txHash: string): Promise<THORChainTxStatus>;
}

export interface THORChainMonitorWorkerOptions {
  pollIntervalMs?: number;
}

export class THORChainMonitorWorker {
  private readonly pollIntervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private running = false;

  constructor(
    private readonly intentService: IntentService,
    private readonly client: THORChainMonitorClient,
    options: THORChainMonitorWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? this._readIntEnv('THORCHAIN_MONITOR_INTERVAL_MS', 30_000);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this._poll();
    this.timer = setInterval(() => {
      void this._poll();
    }, this.pollIntervalMs);
    this.timer.unref?.();
    console.log('[THORChain Monitor] started');
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
      await this.client.inboundAddresses();
    } catch (err) {
      console.warn('[THORChain Monitor] inbound addresses check failed', err);
      this.polling = false;
      return;
    }

    try {
      const stuck = await this.intentService.findStuckIntents(300);
      const thorStuck = stuck.filter((intent) => intent.quote.rail === Rail.THORCHAIN);

      for (const intent of thorStuck) {
        if (!this.running) break;
        if (intent.status !== IntentStatus.IN_TRANSIT) continue;
        if (!intent.railTxId) continue;

        let status: THORChainTxStatus;
        try {
          status = await this.client.txStatus(intent.railTxId);
        } catch (err) {
          console.warn(`[THORChain Monitor] tx status fetch failed intent=${intent.intentId}`, err);
          continue;
        }

        const outboundTxHash = this._extractOutboundTxHash(status);
        if (this._isComplete(status) && outboundTxHash) {
          try {
            await this.intentService.markSettled(intent.intentId, outboundTxHash, {
              actor: 'system',
              eventSource: 'thorchain-monitor',
            });
          } catch (err) {
            console.warn(`[THORChain Monitor] settle transition failed intent=${intent.intentId}`, err);
          }
          continue;
        }

        try {
          await this.intentService.markStuck(
            intent.intentId,
            `THORChain pending outbound settlement: ${this._statusLabel(status)}`,
            {
              actor: 'system',
              eventSource: 'thorchain-monitor',
            },
          );
        } catch (err) {
          console.warn(`[THORChain Monitor] stuck transition failed intent=${intent.intentId}`, err);
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private _isComplete(status: THORChainTxStatus): boolean {
    if (status.status?.toLowerCase() === 'done') return true;
    if (status.stages?.outbound_signed?.completed === true) return true;
    return status.stages?.swap_status?.completed === true;
  }

  private _extractOutboundTxHash(status: THORChainTxStatus): string | undefined {
    const tx = status.out_txs?.[0]?.txID
      ?? status.out_txs?.[0]?.txid
      ?? status.outbound_txs?.[0]?.txID
      ?? status.outbound_txs?.[0]?.txid;
    if (!tx) return undefined;
    const normalized = String(tx).trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private _statusLabel(status: THORChainTxStatus): string {
    if (status.status && status.status.trim().length > 0) return status.status;
    if (status.stages?.outbound_signed?.completed === true) return 'outbound_signed';
    if (status.stages?.swap_status?.completed === true) return 'swap_completed';
    return 'pending';
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }
}
