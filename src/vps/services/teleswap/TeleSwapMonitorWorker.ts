import { IntentStatus, Rail } from '../../types';
import { IntentService } from '../IntentService';

export interface TeleSwapStatusResponse {
  state: string;
  destinationTxHash?: string;
}

export interface TeleSwapStatusClient {
  getSwapStatus(swapId: string): Promise<TeleSwapStatusResponse | null>;
}

export interface TeleSwapMonitorWorkerOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
}

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

class HttpTeleSwapStatusClient implements TeleSwapStatusClient {
  private readonly apiBaseUrl: string | undefined;
  private readonly timeoutMs: number;

  constructor(timeoutMs = readIntEnv('TELESWAP_TIMEOUT_MS', 8_000)) {
    this.apiBaseUrl = readEnv('TELESWAP_API_URL');
    this.timeoutMs = timeoutMs;
  }

  async getSwapStatus(swapId: string): Promise<TeleSwapStatusResponse | null> {
    if (!this.apiBaseUrl) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(
        `${this.apiBaseUrl.replace(/\/$/, '')}/swap/${encodeURIComponent(swapId)}`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);
      if (!response.ok) return null;
      const json = await response.json() as { state?: string; destination_tx_hash?: string };
      if (!json?.state) return null;
      return {
        state: json.state,
        destinationTxHash: json.destination_tx_hash,
      };
    } catch {
      return null;
    }
  }
}

export class TeleSwapMonitorWorker {
  private readonly pollIntervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private running = false;

  constructor(
    private readonly intentService: IntentService,
    private readonly client: TeleSwapStatusClient = new HttpTeleSwapStatusClient(),
    options: TeleSwapMonitorWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? readIntEnv('TELESWAP_MONITOR_INTERVAL_MS', 30_000);
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

  async getStatusOnce(swapId: string): Promise<{
    status: IntentStatus;
    destinationTxHash?: string;
  } | null> {
    const raw = await this.client.getSwapStatus(swapId);
    if (!raw) return null;
    return {
      status: this._mapState(raw.state),
      destinationTxHash: raw.destinationTxHash,
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
      const intents = active.filter((intent) =>
        intent.quote.rail === Rail.TELESWAP
          && Boolean(intent.quote.teleSwapSwapId ?? intent.railTxId),
      );

      for (const intent of intents) {
        if (!this.running) break;
        const swapId = intent.quote.teleSwapSwapId ?? intent.railTxId;
        if (!swapId) continue;

        let status: TeleSwapStatusResponse | null;
        try {
          status = await this.client.getSwapStatus(swapId);
        } catch (err) {
          console.warn(`[TeleSwap Monitor] status fetch failed intent=${intent.intentId}`, err);
          continue;
        }
        if (!status) continue;

        const mapped = this._mapState(status.state);
        await this.intentService.upsertProviderTransfer({
          intentId: intent.intentId,
          provider: 'teleswap_api',
          providerQuoteId: swapId,
          status: this._providerTransferStatus(mapped),
          sourceTxHash: intent.srcTxHash,
          destinationTxHash: status.destinationTxHash,
          latestProviderStatus: status.state,
          metadata: {},
          lastPolledAt: Date.now(),
        });

        if (mapped === IntentStatus.IN_TRANSIT && intent.status === IntentStatus.SUBMITTED) {
          await this.intentService.markInTransit(intent.intentId, swapId, {
            actor: 'system',
            eventSource: 'teleswap-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
          }).catch((err) => console.warn(`[TeleSwap Monitor] transit transition failed intent=${intent.intentId}`, err));
        }

        if (mapped === IntentStatus.SETTLED) {
          await this.intentService.markSettled(intent.intentId, status.destinationTxHash ?? swapId, {
            actor: 'system',
            eventSource: 'teleswap-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
          }).catch((err) => console.warn(`[TeleSwap Monitor] settle transition failed intent=${intent.intentId}`, err));
          continue;
        }

        if (mapped === IntentStatus.STUCK) {
          await this.intentService.markFailed(intent.intentId, `TeleSwap transfer ${status.state}`, {
            actor: 'system',
            eventSource: 'teleswap-monitor',
          }).catch((err) => console.warn(`[TeleSwap Monitor] failed transition failed intent=${intent.intentId}`, err));
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private _mapState(state: string): IntentStatus {
    switch (state.trim().toUpperCase()) {
      case 'PENDING_DEPOSIT':
        return IntentStatus.SUBMITTED;
      case 'DEPOSIT_CONFIRMED':
      case 'MINT_COMPLETE':
        return IntentStatus.IN_TRANSIT;
      case 'SWAP_COMPLETE':
      case 'COMPLETE':
        return IntentStatus.SETTLED;
      case 'FAILED':
      case 'REFUNDED':
        return IntentStatus.STUCK;
      default:
        return IntentStatus.IN_TRANSIT;
    }
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
