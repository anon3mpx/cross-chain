import { ethers } from 'ethers';
import { IntentStatus, Rail } from '../../types';
import { IntentService } from '../IntentService';
import { RpcProviderRegistry } from '../RpcProviderRegistry';
import {
  GasZipClient,
  type GasZipClientLike,
  type GasZipSearchResponse,
  type GasZipSearchTransaction,
} from './GasZipClient';

export interface GasZipTransactionReceipt {
  status?: number | null;
}

export interface GasZipReceiptProvider {
  getTransactionReceipt(txHash: string): Promise<GasZipTransactionReceipt | null>;
}

export type GasZipReceiptProviderFactory = (chainId: number) => GasZipReceiptProvider | Promise<GasZipReceiptProvider | null> | null;

export interface GasZipMonitorWorkerOptions {
  pollIntervalMs?: number;
}

export class GasZipMonitorWorker {
  private readonly pollIntervalMs: number;
  private readonly providerCache = new Map<number, GasZipReceiptProvider | null>();
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private running = false;

  constructor(
    private readonly intentService: IntentService,
    private readonly client: GasZipClientLike = new GasZipClient(),
    private readonly providerFactory: GasZipReceiptProviderFactory = defaultGasZipReceiptProviderFactory,
    options: GasZipMonitorWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? this._readIntEnv('GASZIP_MONITOR_INTERVAL_MS', 30_000);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this._poll();
    this.timer = setInterval(() => {
      void this._poll();
    }, this.pollIntervalMs);
    this.timer.unref?.();
    console.log('[GasZip Monitor] started');
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
      const gasZipActive = active.filter((intent) => intent.quote.rail === Rail.GASZIP);

      for (const intent of gasZipActive) {
        if (!this.running) break;
        const trackingTxHash = intent.srcTxHash ?? intent.railTxId;
        if (!trackingTxHash) continue;

        try {
          const search = await this.client.searchTransaction(trackingTxHash);
          if (search) {
            await this._applySearchStatus(intent.intentId, search, trackingTxHash);
            continue;
          }
        } catch (err) {
          console.warn(`[GasZip Monitor] search failed intent=${intent.intentId}`, err);
        }

        await this._applyReceiptFallback(intent.intentId, intent.quote.srcChainId, trackingTxHash);
      }
    } finally {
      this.polling = false;
    }
  }

  private async _applySearchStatus(
    intentId: string,
    search: GasZipSearchResponse,
    trackingTxHash: string,
  ): Promise<void> {
    const confirmedTx = this._selectOutboundTx(search.txs, ['CONFIRMED', 'PRIORITY']);
    if (confirmedTx) {
      await this._markSettled(intentId, confirmedTx.hash);
      return;
    }

    const pendingTx = this._selectOutboundTx(search.txs, ['SEEN', 'PENDING']);
    if (pendingTx) {
      await this._markDestinationReceived(intentId, pendingTx.hash);
      return;
    }

    if (search.deposit.status === 'CANCELLED') {
      await this._markFailed(intentId, 'Gas.zip deposit cancelled');
      return;
    }

    await this._markInTransit(intentId, search.deposit.hash || trackingTxHash);
  }

  private async _applyReceiptFallback(
    intentId: string,
    chainId: number,
    trackingTxHash: string,
  ): Promise<void> {
    const provider = await this._getProvider(chainId);
    if (!provider) return;

    let receipt: GasZipTransactionReceipt | null;
    try {
      receipt = await provider.getTransactionReceipt(trackingTxHash);
    } catch (err) {
      console.warn(`[GasZip Monitor] receipt fetch failed intent=${intentId}`, err);
      return;
    }
    if (!receipt) return;

    const minedSuccessfully = Number(receipt.status ?? 0) === 1;
    if (!minedSuccessfully) {
      await this._markFailed(intentId, 'Gas.zip source transaction reverted');
      return;
    }

    await this._markInTransit(intentId, trackingTxHash);
  }

  private async _getProvider(chainId: number): Promise<GasZipReceiptProvider | null> {
    if (this.providerCache.has(chainId)) {
      return this.providerCache.get(chainId) ?? null;
    }

    const provider = await this.providerFactory(chainId);
    this.providerCache.set(chainId, provider ?? null);
    return provider ?? null;
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }

  private _selectOutboundTx(
    txs: GasZipSearchTransaction[],
    statuses: GasZipSearchTransaction['status'][],
  ): GasZipSearchTransaction | undefined {
    return txs
      .filter((tx) => !tx.cancelled && !tx.refund && statuses.includes(tx.status))
      .sort((a, b) => b.time - a.time)[0];
  }

  private async _markInTransit(intentId: string, railTxId: string): Promise<void> {
    try {
      await this.intentService.markInTransit(intentId, railTxId, {
        actor: 'system',
        eventSource: 'gaszip-monitor',
        allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT],
      });
    } catch (err) {
      console.warn(`[GasZip Monitor] transit transition failed intent=${intentId}`, err);
    }
  }

  private async _markDestinationReceived(intentId: string, dstTxHash: string): Promise<void> {
    try {
      await this.intentService.markDestinationReceived(intentId, dstTxHash, {
        actor: 'system',
        eventSource: 'gaszip-monitor',
        allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
      });
    } catch (err) {
      console.warn(`[GasZip Monitor] destination transition failed intent=${intentId}`, err);
    }
  }

  private async _markSettled(intentId: string, dstTxHash: string): Promise<void> {
    try {
      await this.intentService.markSettled(intentId, dstTxHash, {
        actor: 'system',
        eventSource: 'gaszip-monitor',
        allowedFrom: [IntentStatus.SUBMITTED, IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED],
      });
    } catch (err) {
      console.warn(`[GasZip Monitor] settle transition failed intent=${intentId}`, err);
    }
  }

  private async _markFailed(intentId: string, reason: string): Promise<void> {
    try {
      await this.intentService.markFailed(intentId, reason, {
        actor: 'system',
        eventSource: 'gaszip-monitor',
      });
    } catch (err) {
      console.warn(`[GasZip Monitor] failed transition failed intent=${intentId}`, err);
    }
  }
}

const defaultRpcProviderRegistry = new RpcProviderRegistry();

const defaultGasZipReceiptProviderFactory: GasZipReceiptProviderFactory = (chainId) => {
  try {
    return defaultRpcProviderRegistry.getReadProvider(chainId);
  } catch {
    return null;
  }
};
