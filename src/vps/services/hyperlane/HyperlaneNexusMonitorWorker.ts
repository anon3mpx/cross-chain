import { IntentStatus, Rail } from '../../types';
import { IntentService } from '../IntentService';

export interface HyperlaneMessageStatus {
  status: string;
  destinationTxHash?: string;
}

export interface HyperlaneNexusExplorerClient {
  getMessageStatus(trackingId: string): Promise<HyperlaneMessageStatus | null>;
}

export interface HyperlaneNexusMonitorWorkerOptions {
  pollIntervalMs?: number;
}

const DEFAULT_EXPLORER_URL = 'https://explorer.hyperlane.xyz';

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

class HttpHyperlaneNexusExplorerClient implements HyperlaneNexusExplorerClient {
  constructor(
    private readonly baseUrl = process.env.HYPERLANE_EXPLORER_URL?.trim() || DEFAULT_EXPLORER_URL,
    private readonly timeoutMs = readIntEnv('HYPERLANE_EXPLORER_TIMEOUT_MS', 8_000),
  ) {}

  async getMessageStatus(trackingId: string): Promise<HyperlaneMessageStatus | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const url = `${this.baseUrl.replace(/\/$/, '')}/api/messages?id=${encodeURIComponent(trackingId)}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const payload = await response.json() as {
        messages?: Array<{ status?: string; destination_tx_hash?: string }>;
      };
      const message = payload.messages?.[0];
      if (!message?.status) return null;
      return {
        status: message.status,
        destinationTxHash: message.destination_tx_hash,
      };
    } catch {
      return null;
    }
  }
}

export class HyperlaneNexusMonitorWorker {
  private readonly pollIntervalMs: number;
  private readonly client: HyperlaneNexusExplorerClient;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private running = false;

  constructor(
    private readonly intentService: IntentService,
    client: HyperlaneNexusExplorerClient = new HttpHyperlaneNexusExplorerClient(),
    options: HyperlaneNexusMonitorWorkerOptions = {},
  ) {
    this.client = client;
    this.pollIntervalMs = options.pollIntervalMs ?? readIntEnv('HYPERLANE_NEXUS_MONITOR_INTERVAL_MS', 30_000);
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
        [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
        300,
      );
      const hyperlaneIntents = active.filter((intent) =>
        intent.quote.rail === Rail.HYPERLANE_NEXUS && Boolean(intent.srcTxHash ?? intent.railTxId),
      );

      for (const intent of hyperlaneIntents) {
        if (!this.running) break;
        const trackingId = intent.srcTxHash ?? intent.railTxId;
        if (!trackingId) continue;

        let status: HyperlaneMessageStatus | null;
        try {
          status = await this.client.getMessageStatus(trackingId);
        } catch (err) {
          console.warn(`[Hyperlane Nexus Monitor] status fetch failed intent=${intent.intentId}`, err);
          continue;
        }
        if (!status) continue;

        await this.intentService.upsertProviderTransfer({
          intentId: intent.intentId,
          provider: 'hyperlane_explorer',
          providerQuoteId: trackingId,
          status: this._providerTransferStatus(status.status),
          sourceTxHash: trackingId,
          destinationTxHash: status.destinationTxHash,
          latestProviderStatus: status.status,
          metadata: {},
          lastPolledAt: Date.now(),
        });

        if (intent.status === IntentStatus.SUBMITTED && this._isInTransit(status.status)) {
          try {
            await this.intentService.markInTransit(intent.intentId, trackingId, {
              actor: 'system',
              eventSource: 'hyperlane-nexus-monitor',
              allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
            });
          } catch (err) {
            console.warn(`[Hyperlane Nexus Monitor] transit transition failed intent=${intent.intentId}`, err);
          }
        }

        if (this._isSettled(status.status)) {
          try {
            await this.intentService.markSettled(intent.intentId, status.destinationTxHash ?? trackingId, {
              actor: 'system',
              eventSource: 'hyperlane-nexus-monitor',
              allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
            });
          } catch (err) {
            console.warn(`[Hyperlane Nexus Monitor] settle transition failed intent=${intent.intentId}`, err);
          }
          continue;
        }

        if (this._isFailed(status.status)) {
          try {
            await this.intentService.markFailed(intent.intentId, `Hyperlane Nexus transfer ${status.status}`, {
              actor: 'system',
              eventSource: 'hyperlane-nexus-monitor',
            });
          } catch (err) {
            console.warn(`[Hyperlane Nexus Monitor] failed transition failed intent=${intent.intentId}`, err);
          }
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private _providerTransferStatus(status: string): 'SUBMITTED' | 'IN_TRANSIT' | 'SETTLED' | 'FAILED' {
    if (this._isSettled(status)) return 'SETTLED';
    if (this._isFailed(status)) return 'FAILED';
    if (this._isInTransit(status)) return 'IN_TRANSIT';
    return 'SUBMITTED';
  }

  private _isSettled(status: string): boolean {
    const normalized = status.trim().toLowerCase();
    return normalized === 'delivered' || normalized === 'success';
  }

  private _isFailed(status: string): boolean {
    const normalized = status.trim().toLowerCase();
    return normalized === 'failed' || normalized === 'invalid';
  }

  private _isInTransit(status: string): boolean {
    const normalized = status.trim().toLowerCase();
    return normalized === 'relayed' || normalized === 'processing' || normalized === 'in_transit';
  }
}
