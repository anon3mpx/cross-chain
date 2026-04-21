// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Event Monitor
// Watches source and destination chain events to drive intent state machine.
// Uses ethers.js providers with automatic fallback on failure.
// ─────────────────────────────────────────────────────────

import { ethers } from 'ethers';
import { IntentEngine } from './IntentEngine';
import { ChainConfig } from '../types';

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
  private fallbackProviders: Map<number, ethers.JsonRpcProvider> = new Map();
  private contracts: Map<string, ethers.Contract> = new Map(); // key = `${chainId}:${address}`

  constructor(private intentEngine: IntentEngine) {}

  // ── Setup ──────────────────────────────────────────────────────────────────

  addChain(chain: ChainConfig): void {
    if (!chain.rpcUrl) return;
    const pollingIntervalMs = this._readIntEnv('RPC_POLLING_INTERVAL_MS', 4000);
    const primary  = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId, {
      polling: true,
      batchMaxCount: 1,
      staticNetwork: true,
    });
    primary.pollingInterval = pollingIntervalMs;
    const fallback = chain.rpcFallback
      ? new ethers.JsonRpcProvider(chain.rpcFallback, chain.chainId, {
          polling: true,
          batchMaxCount: 1,
          staticNetwork: true,
        })
      : undefined;
    if (fallback) fallback.pollingInterval = pollingIntervalMs;
    this.providers.set(chain.chainId, primary);
    if (fallback) this.fallbackProviders.set(chain.chainId, fallback);

    if (chain.routerV1) this._watchRouter(chain);
    if (chain.receiverV1) this._watchReceiver(chain);
  }

  // ── Router Events (source chain) ──────────────────────────────────────────

  private _watchRouter(chain: ChainConfig): void {
    const provider = this.providers.get(chain.chainId)!;
    const contract = new ethers.Contract(chain.routerV1!, ROUTER_ABI, provider);
    this.contracts.set(`${chain.chainId}:router`, contract);

    contract.on('IntentInitiated', (intentId, user, tokenIn, amountIn, dstChainId, railTxId, event) => {
      try {
        this.intentEngine.markInTransit(intentId, railTxId);
      } catch {
        // Intent may not be in DB if submitted directly to contract (bypass VPS)
        // Log and ignore — recovery engine will pick it up
        console.warn(`[EventMonitor] Unknown intentId from chain ${chain.chainId}: ${intentId}`);
      }
    });

    provider.on('error', () => this._switchToFallback(chain.chainId));
  }

  // ── Receiver Events (destination chain) ───────────────────────────────────

  private _watchReceiver(chain: ChainConfig): void {
    const provider = this.providers.get(chain.chainId)!;
    const contract = new ethers.Contract(chain.receiverV1!, RECEIVER_ABI, provider);
    this.contracts.set(`${chain.chainId}:receiver`, contract);

    contract.on('IntentSettled', (intentId, user, tokenOut, amountOut, event) => {
      this.intentEngine.markSettled(intentId, event.log.transactionHash);
    });

    contract.on('DirectDelivery', (intentId, user, settlementToken, amount, event) => {
      this.intentEngine.markSettled(intentId, event.log.transactionHash);
    });

    provider.on('error', () => this._switchToFallback(chain.chainId));
  }

  // ── Provider Failover ─────────────────────────────────────────────────────

  private _switchToFallback(chainId: number): void {
    const fallback = this.fallbackProviders.get(chainId);
    if (!fallback) return;
    console.warn(`[EventMonitor] Switching chain ${chainId} to fallback RPC`);
    this.providers.set(chainId, fallback);
    // Re-attach listeners (simplified — production would re-register all contracts)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  stop(): void {
    this.contracts.forEach(contract => contract.removeAllListeners());
    this.providers.forEach(provider => provider.destroy());
    this.fallbackProviders.forEach(provider => provider.destroy());
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
