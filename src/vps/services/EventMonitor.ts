// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Event Monitor
// Watches source and destination chain events to drive intent state machine.
// Uses ethers.js providers with automatic fallback on failure.
// ─────────────────────────────────────────────────────────

import { ethers } from 'ethers';
import { ChainConfig } from '../types';
import { isRetryableInfraError } from '../app/infraErrors';
import { IntentService } from './IntentService';
import { RpcProviderRegistry } from './RpcProviderRegistry';

// ABI fragments — only the events we care about
const ROUTER_ABI = [
  'event IntentInitiated(bytes32 indexed intentId, address indexed user, address tokenIn, uint256 amountIn, uint32 dstChainId, bytes32 railTxId)',
];
const RECEIVER_ABI = [
  'event IntentSettled(bytes32 indexed intentId, address indexed user, address tokenOut, uint256 amountOut)',
  'event DirectDelivery(bytes32 indexed intentId, address indexed user, address settlementToken, uint256 amount)',
];

export class EventMonitor {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private chains: Map<number, ChainConfig> = new Map();
  private contracts: Map<string, ethers.Contract> = new Map(); // key = `${chainId}:${address}`

  constructor(
    private intentService: IntentService,
    private rpcProviderRegistry: Pick<RpcProviderRegistry, 'getPollingRpcUrl' | 'reportFailure'> = new RpcProviderRegistry(),
  ) {}

  // ── Setup ──────────────────────────────────────────────────────────────────

  addChain(chain: ChainConfig): void {
    if (!chain.isEVM) return;
    this.chains.set(chain.chainId, chain);
    const provider = this._buildProvider(chain);
    if (!provider) return;
    this.providers.set(chain.chainId, provider);
    if (chain.routerV1) this._watchRouter(chain);
    if (chain.receiverV1) this._watchReceiver(chain);
  }

  // ── Router Events (source chain) ──────────────────────────────────────────

  private _watchRouter(chain: ChainConfig): void {
    const provider = this.providers.get(chain.chainId)!;
    const contract = new ethers.Contract(chain.routerV1!, ROUTER_ABI, provider);
    this.contracts.set(`${chain.chainId}:router`, contract);

    contract.on('IntentInitiated', (intentId, user, tokenIn, amountIn, dstChainId, railTxId, event) => {
      void this.intentService.markInTransit(intentId, railTxId, {
        actor: 'system',
        eventSource: 'event-monitor',
        chainId: chain.chainId,
        txHash: event.log.transactionHash,
        logIndex: event.log.index,
        idempotencyKey: `${chain.chainId}:${event.log.transactionHash}:${event.log.index}:IntentInitiated`,
      }).catch(() => {
        console.warn(`[EventMonitor] Unknown intentId from chain ${chain.chainId}: ${intentId}`);
      });
    });

  }

  // ── Receiver Events (destination chain) ───────────────────────────────────

  private _watchReceiver(chain: ChainConfig): void {
    const provider = this.providers.get(chain.chainId)!;
    const contract = new ethers.Contract(chain.receiverV1!, RECEIVER_ABI, provider);
    this.contracts.set(`${chain.chainId}:receiver`, contract);

    contract.on('IntentSettled', (intentId, user, tokenOut, amountOut, event) => {
      void this.intentService.markSettled(intentId, event.log.transactionHash, {
        actor: 'system',
        eventSource: 'event-monitor',
        chainId: chain.chainId,
        txHash: event.log.transactionHash,
        logIndex: event.log.index,
        idempotencyKey: `${chain.chainId}:${event.log.transactionHash}:${event.log.index}:IntentSettled`,
      }).catch((err) => {
        console.warn('[EventMonitor] failed to mark intent settled', err);
      });
    });

    contract.on('DirectDelivery', (intentId, user, settlementToken, amount, event) => {
      void this.intentService.markSettled(intentId, event.log.transactionHash, {
        actor: 'system',
        eventSource: 'event-monitor',
        chainId: chain.chainId,
        txHash: event.log.transactionHash,
        logIndex: event.log.index,
        idempotencyKey: `${chain.chainId}:${event.log.transactionHash}:${event.log.index}:DirectDelivery`,
      }).catch((err) => {
        console.warn('[EventMonitor] failed to mark direct delivery settled', err);
      });
    });

  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  stop(): void {
    this.contracts.forEach(contract => contract.removeAllListeners());
    this.providers.forEach(provider => provider.destroy());
  }

  private _buildProvider(chain: ChainConfig): ethers.JsonRpcProvider | null {
    let rpcUrl: string;
    try {
      rpcUrl = this.rpcProviderRegistry.getPollingRpcUrl(chain.chainId);
    } catch {
      return null;
    }

    const pollingIntervalMs = this._readIntEnv('RPC_POLLING_INTERVAL_MS', 4000);
    const provider = new ethers.JsonRpcProvider(rpcUrl, chain.chainId, {
      polling: true,
      batchMaxCount: 1,
      staticNetwork: true,
    });
    provider.pollingInterval = pollingIntervalMs;
    provider.on('error', (err) => {
      if (!isRetryableInfraError(err)) return;
      this.rpcProviderRegistry.reportFailure(chain.chainId, 'poll', rpcUrl, err);
      this._rebuildChain(chain.chainId);
    });
    return provider;
  }

  private _rebuildChain(chainId: number): void {
    const chain = this.chains.get(chainId);
    if (!chain) return;

    this.contracts.get(`${chainId}:router`)?.removeAllListeners();
    this.contracts.get(`${chainId}:receiver`)?.removeAllListeners();
    this.contracts.delete(`${chainId}:router`);
    this.contracts.delete(`${chainId}:receiver`);

    this.providers.get(chainId)?.destroy();
    const provider = this._buildProvider(chain);
    if (!provider) return;
    this.providers.set(chainId, provider);

    if (chain.routerV1) this._watchRouter(chain);
    if (chain.receiverV1) this._watchReceiver(chain);
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
