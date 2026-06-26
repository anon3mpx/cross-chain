import { IntentStatus, Rail } from '../../types';
import { IntentService } from '../IntentService';
import { ChainflipBrokerClient, type ChainflipSwapStatus } from './ChainflipBrokerClient';

export interface ChainflipStatusClient {
  getSwapStatus(channelId: string): Promise<ChainflipSwapStatus | null>;
}

export interface ChainflipMonitorWorkerOptions {
  pollIntervalMs?: number;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export class ChainflipMonitorWorker {
  private readonly pollIntervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private running = false;

  constructor(
    private readonly intentService: IntentService,
    private readonly client: ChainflipStatusClient = new ChainflipBrokerClient(),
    options: ChainflipMonitorWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? readIntEnv('CHAINFLIP_MONITOR_INTERVAL_MS', 30_000);
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

  async getStatusOnce(channelId: string): Promise<{
    status: IntentStatus;
    depositTxHash?: string;
    destinationTxHash?: string;
    failureReason?: string;
  } | null> {
    const raw = await this.client.getSwapStatus(channelId);
    if (!raw) return null;
    return {
      status: this._mapState(raw.state),
      depositTxHash: raw.depositTxHash,
      destinationTxHash: raw.destinationTxHash,
      failureReason: raw.failureReason,
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
        intent.quote.rail === Rail.CHAINFLIP
          && Boolean(intent.quote.chainflipChannelId ?? intent.railTxId),
      );

      for (const intent of intents) {
        if (!this.running) break;
        const channelId = intent.quote.chainflipChannelId ?? intent.railTxId;
        if (!channelId) continue;

        let status: ChainflipSwapStatus | null;
        try {
          status = await this.client.getSwapStatus(channelId);
        } catch (err) {
          console.warn(`[Chainflip Monitor] status fetch failed intent=${intent.intentId}`, err);
          continue;
        }
        if (!status) continue;

        const mapped = this._mapState(status.state);
        await this.intentService.upsertProviderTransfer({
          intentId: intent.intentId,
          provider: 'chainflip_broker',
          providerQuoteId: channelId,
          status: this._providerTransferStatus(mapped),
          sourceTxHash: intent.srcTxHash,
          destinationTxHash: status.destinationTxHash,
          latestProviderStatus: status.state,
          metadata: {},
          lastPolledAt: Date.now(),
        });

        if (mapped === IntentStatus.IN_TRANSIT && intent.status === IntentStatus.SUBMITTED) {
          await this.intentService.markInTransit(intent.intentId, channelId, {
            actor: 'system',
            eventSource: 'chainflip-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
          }).catch((err) => console.warn(`[Chainflip Monitor] transit transition failed intent=${intent.intentId}`, err));
        }

        if (mapped === IntentStatus.DESTINATION_RECEIVED) {
          await this.intentService.markDestinationReceived(intent.intentId, status.destinationTxHash ?? channelId, {
            actor: 'system',
            eventSource: 'chainflip-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
          }).catch((err) => console.warn(`[Chainflip Monitor] destination transition failed intent=${intent.intentId}`, err));
          continue;
        }

        if (mapped === IntentStatus.SETTLED) {
          await this.intentService.markSettled(intent.intentId, status.destinationTxHash ?? channelId, {
            actor: 'system',
            eventSource: 'chainflip-monitor',
            allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
          }).catch((err) => console.warn(`[Chainflip Monitor] settle transition failed intent=${intent.intentId}`, err));
          continue;
        }

        if (mapped === IntentStatus.STUCK) {
          await this.intentService.markFailed(intent.intentId, `Chainflip transfer ${status.state}${status.failureReason ? `: ${status.failureReason}` : ''}`, {
            actor: 'system',
            eventSource: 'chainflip-monitor',
          }).catch((err) => console.warn(`[Chainflip Monitor] failed transition failed intent=${intent.intentId}`, err));
        }
      }
    } finally {
      this.polling = false;
    }
  }

  private _mapState(state: string): IntentStatus {
    switch (state.trim().toUpperCase()) {
      case 'AWAITING_DEPOSIT':
        return IntentStatus.SUBMITTED;
      case 'DEPOSIT_RECEIVED':
      case 'SWAP_EXECUTED':
        return IntentStatus.IN_TRANSIT;
      case 'SETTLEMENT_BROADCAST':
        return IntentStatus.DESTINATION_RECEIVED;
      case 'COMPLETE':
        return IntentStatus.SETTLED;
      case 'FAILED':
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
