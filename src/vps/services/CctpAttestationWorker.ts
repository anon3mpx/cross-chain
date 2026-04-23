import {
  AbiCoder,
  Contract,
  EventLog,
  Interface,
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  ethers,
} from 'ethers';
import { CHAIN_CONFIGS } from '../config/chains';
import { getSettlementTokenAddress } from '../config/contracts';
import { Rail, SettlementToken } from '../types';
import { IntentService } from './IntentService';
import { getCctpDomain, getRailEnumValue } from '../rails/registry';

const ROUTER_ABI = [
  'event IntentInitiated(bytes32 indexed intentId, address indexed user, address tokenIn, uint256 amountIn, uint32 dstChainId, bytes32 railTxId)',
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,uint8 settlementToken,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent)',
];
const ROUTER_LEGACY_ABI = [
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,uint8 settlementToken,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 dstSwapPluginId,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes32 swapPluginId,bytes32 railPluginId)',
];

const MESSAGE_TRANSMITTER_ABI = [
  'event MessageSent(bytes message)',
  'function receiveMessage(bytes message, bytes attestation) external returns (bool)',
];

const TOKEN_MESSENGER_ABI = [
  'event DepositForBurn(address indexed burnToken,uint256 amount,address indexed depositor,bytes32 mintRecipient,uint32 destinationDomain,bytes32 destinationTokenMessenger,bytes32 destinationCaller,uint256 maxFee,uint32 indexed minFinalityThreshold,bytes hookData)',
  'function localMessageTransmitter() external view returns (address)',
];

const RECEIVER_ABI = [
  'function execute(address settlementToken, uint256 amount, bytes payload) external',
  'function approvedCallers(address caller) external view returns (bool)',
  'function settledIntents(bytes32 intentId) external view returns (bool)',
];

const ERC20_TRANSFER_IFACE = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

const ROUTER_IFACE = new Interface(ROUTER_ABI);
const ROUTER_LEGACY_IFACE = new Interface(ROUTER_LEGACY_ABI);
const MESSAGE_TRANSMITTER_IFACE = new Interface(MESSAGE_TRANSMITTER_ABI);
const TOKEN_MESSENGER_IFACE = new Interface(TOKEN_MESSENGER_ABI);

interface RelayJob {
  intentId: string;
  srcChainId: number;
  sourceDomainId: number;
  dstChainId: number;
  srcTxHash: string;
  message: string;
  messageHash: string;
  amount: bigint;
  receiver: string;
  settlementToken: string;
  payload: string;
  isFastTransfer: boolean;
}

interface IrisMessage {
  message?: string;
  status?: string;
  attestation?: string;
}

interface AttestationResult {
  message: string;
  attestation: string;
}

interface RetryEntry {
  srcChainId: number;
  intentId: string;
  srcTxHash: string;
  attempts: number;
  nextAttemptAt: number;
  lastError: string;
}

export class CctpAttestationWorker {
  private providers = new Map<number, JsonRpcProvider>();
  private routerContracts = new Map<number, Contract>();
  private messageTransmitterByChain = new Map<number, string>();
  private seenIntentIds = new Set<string>();
  private inFlightIntentIds = new Set<string>();
  private retryQueue = new Map<string, RetryEntry>();
  private destinationQueues = new Map<number, Promise<void>>();
  private retryTimer?: ReturnType<typeof setInterval>;
  private reconcileTimer?: ReturnType<typeof setInterval>;
  private reconciling = false;
  private running = false;

  constructor(private intentService: IntentService) {}

  async start(): Promise<void> {
    if (this.running) return;

    const relayerPk = this._readEnv('CCTP_RELAYER_PRIVATE_KEY') || this._readEnv('DEPLOYER_PRIVATE_KEY');
    if (!relayerPk) {
      console.warn('[CCTP Relay] disabled: missing CCTP_RELAYER_PRIVATE_KEY/DEPLOYER_PRIVATE_KEY');
      return;
    }

    this.running = true;

    const pollingIntervalMs = this._readIntEnv('RPC_POLLING_INTERVAL_MS', 4000);

    for (const chain of Object.values(CHAIN_CONFIGS)) {
      if (!chain.isEVM || !chain.rpcUrl) continue;
      const provider = new JsonRpcProvider(chain.rpcUrl, chain.chainId, {
        polling: true,
        // Some public/testnet RPCs return malformed batched responses.
        batchMaxCount: 1,
        staticNetwork: true,
      });
      provider.pollingInterval = pollingIntervalMs;
      provider.on('error', (err) => {
        console.warn(`[CCTP Relay] provider error chain=${chain.chainId}`, err);
      });
      this.providers.set(chain.chainId, provider);
    }

    for (const chain of Object.values(CHAIN_CONFIGS)) {
      if (!chain.isEVM || !chain.routerV1) continue;
      const provider = this.providers.get(chain.chainId);
      if (!provider) continue;
      const router = new Contract(chain.routerV1, ROUTER_ABI, provider);
      this.routerContracts.set(chain.chainId, router);

      router.on(
        'IntentInitiated',
        (intentId, _user, _tokenIn, _amountIn, _dstChainId, _railTxId, event) => {
          const txHash = String((event as any)?.log?.transactionHash ?? (event as any)?.transactionHash ?? '');
          if (!txHash) return;
          void this._enqueueIntent(chain.chainId, String(intentId), txHash);
        },
      );

      await this._backfillRecentIntentEvents(chain.chainId, router);
    }

    this._startRetryLoop();
    this._startReconcileLoop();
    console.log('[CCTP Relay] started');
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.retryTimer) clearInterval(this.retryTimer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.routerContracts.forEach((router) => router.removeAllListeners());
    this.providers.forEach((provider) => provider.destroy());
    this.retryTimer = undefined;
    this.reconcileTimer = undefined;
    this.routerContracts.clear();
    this.providers.clear();
    this.messageTransmitterByChain.clear();
    this.seenIntentIds.clear();
    this.inFlightIntentIds.clear();
    this.retryQueue.clear();
    this.destinationQueues.clear();
  }

  private async _backfillRecentIntentEvents(chainId: number, router: Contract): Promise<void> {
    const provider = this.providers.get(chainId);
    if (!provider) return;
    try {
      const lookbackBlocks = this._readNonNegativeIntEnv('CCTP_RELAY_LOOKBACK_BLOCKS', 4000);
      if (lookbackBlocks === 0) return;
      const latest = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - lookbackBlocks);

      const logs = await router.queryFilter(router.filters.IntentInitiated(), fromBlock, latest);
      for (const log of logs) {
        const event = log as EventLog;
        const intentId = String(event.args?.intentId ?? '');
        if (!intentId) continue;
        void this._enqueueIntent(chainId, intentId, event.transactionHash);
      }
    } catch (err) {
      console.warn(`[CCTP Relay] backfill failed chain=${chainId}`, err);
    }
  }

  private async _enqueueIntent(srcChainId: number, intentIdRaw: string, srcTxHash: string): Promise<void> {
    if (!this.running) return;
    const intentId = intentIdRaw.toLowerCase();
    if (this.seenIntentIds.has(intentId) || this.inFlightIntentIds.has(intentId)) return;
    const pendingRetry = this.retryQueue.get(intentId);
    if (pendingRetry && pendingRetry.nextAttemptAt > Date.now()) return;
    this.inFlightIntentIds.add(intentId);

    try {
      const job = await this._buildRelayJob(srcChainId, intentId, srcTxHash);
      if (!job) {
        this.retryQueue.delete(intentId);
        return; // non-CCTP or malformed tx
      }
      await this._relayJob(job);
      this.seenIntentIds.add(intentId);
      this.retryQueue.delete(intentId);
    } catch (err) {
      console.error(`[CCTP Relay] intent ${intentId} failed`, err);
      if (this._isRetryableRelayError(err)) {
        this._scheduleRetry(srcChainId, intentId, srcTxHash, err);
      } else {
        this.retryQueue.delete(intentId);
      }
    } finally {
      this.inFlightIntentIds.delete(intentId);
    }
  }

  private _scheduleRetry(
    srcChainId: number,
    intentId: string,
    srcTxHash: string,
    err: unknown,
  ): void {
    if (!this.running) return;

    const maxAttempts = this._readNonNegativeIntEnv('CCTP_RELAY_MAX_RETRY_ATTEMPTS', 0);
    const existing = this.retryQueue.get(intentId);
    const attempts = (existing?.attempts ?? 0) + 1;

    if (maxAttempts > 0 && attempts > maxAttempts) {
      this.retryQueue.delete(intentId);
      console.error(`[CCTP Relay] intent ${intentId} exhausted retries after ${attempts - 1} attempts`);
      return;
    }

    const baseMs = this._readIntEnv('CCTP_RELAY_RETRY_BASE_MS', 15_000);
    const maxMs = this._readIntEnv('CCTP_RELAY_RETRY_MAX_MS', 5 * 60_000);
    const backoffMs = Math.min(maxMs, baseMs * (2 ** Math.min(attempts - 1, 8)));
    const jitterMs = Math.floor(Math.random() * Math.min(baseMs, 10_000));

    this.retryQueue.set(intentId, {
      srcChainId,
      intentId,
      srcTxHash,
      attempts,
      nextAttemptAt: Date.now() + backoffMs + jitterMs,
      lastError: this._errorSummary(err),
    });
  }

  private _startRetryLoop(): void {
    if (this.retryTimer) return;
    const intervalMs = this._readIntEnv('CCTP_RELAY_RETRY_INTERVAL_MS', 15_000);
    this.retryTimer = setInterval(() => {
      void this._drainRetryQueue();
    }, intervalMs);
    this.retryTimer.unref?.();
  }

  private async _drainRetryQueue(): Promise<void> {
    if (!this.running || this.retryQueue.size === 0) return;

    const now = Date.now();
    for (const entry of this.retryQueue.values()) {
      if (entry.nextAttemptAt > now) continue;
      if (this.inFlightIntentIds.has(entry.intentId)) continue;
      console.log(
        `[CCTP Relay] retrying intent=${entry.intentId} attempt=${entry.attempts} lastError=${entry.lastError}`,
      );
      void this._enqueueIntent(entry.srcChainId, entry.intentId, entry.srcTxHash);
    }
  }

  private _startReconcileLoop(): void {
    if (this.reconcileTimer) return;
    const intervalMs = this._readIntEnv('CCTP_RELAY_RECONCILE_INTERVAL_MS', 60_000);
    this.reconcileTimer = setInterval(() => {
      void this._reconcileRecentIntentEvents();
    }, intervalMs);
    this.reconcileTimer.unref?.();
  }

  private async _reconcileRecentIntentEvents(): Promise<void> {
    if (!this.running || this.reconciling) return;
    this.reconciling = true;

    try {
      for (const [chainId, router] of this.routerContracts.entries()) {
        await this._backfillRecentIntentEvents(chainId, router);
      }
    } finally {
      this.reconciling = false;
    }
  }

  private async _buildRelayJob(
    srcChainId: number,
    intentId: string,
    srcTxHash: string,
  ): Promise<RelayJob | null> {
    const srcProvider = this.providers.get(srcChainId);
    if (!srcProvider) return null;

    const [tx, receipt] = await Promise.all([
      srcProvider.getTransaction(srcTxHash),
      srcProvider.getTransactionReceipt(srcTxHash),
    ]);
    if (!tx || !receipt) return null;

    let decoded;
    try {
      decoded = ROUTER_IFACE.decodeFunctionData('initiateSwap', tx.data);
    } catch {
      try {
        decoded = ROUTER_LEGACY_IFACE.decodeFunctionData('initiateSwap', tx.data);
      } catch {
        return null;
      }
    }

    const intent = decoded[0];
    const railValue = Number(intent.rail);
    if (railValue !== getRailEnumValue(Rail.CCTP)) return null;

    const decodedIntentId = String(intent.intentId).toLowerCase();
    if (decodedIntentId !== intentId) {
      console.warn(
        `[CCTP Relay] intent mismatch: event=${intentId} calldata=${decodedIntentId} tx=${srcTxHash}`,
      );
      return null;
    }

    const message = this._extractMessageBytesFromReceipt(receipt);
    const deposit = this._extractDepositFromReceipt(receipt);
    if (!deposit) throw new Error(`DepositForBurn event not found in tx ${receipt.hash}`);
    const dstChainId = Number(intent.dstChainId);
    const receiver = ethers.getAddress(String(intent.dstReceiver));
    const settlementToken = getSettlementTokenAddress(dstChainId, SettlementToken.USDC, Rail.CCTP);
    if (!settlementToken) {
      throw new Error(`missing CHAIN_${dstChainId}_TOKEN_CCTP_USDC (or fallback token)`);
    }
    if (receiver === ZeroAddress) {
      throw new Error(`intent.dstReceiver is zero for ${intentId}`);
    }

    const payload = AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'address', 'uint256', 'bytes', 'bytes32'],
      [
        intent.intentId,
        intent.user,
        intent.tokenOut,
        intent.minAmountOut,
        intent.swapDataDst,
        intent.dstSwapPluginId,
      ],
    );

    return {
      intentId,
      srcChainId,
      sourceDomainId: this._resolveSourceDomainId(srcChainId),
      dstChainId,
      srcTxHash,
      message,
      messageHash: ethers.keccak256(message),
      amount: deposit.amount,
      receiver,
      settlementToken: settlementToken.toLowerCase(),
      payload,
      isFastTransfer: deposit.minFinalityThreshold < 2000 || deposit.maxFee > 0n,
    };
  }

  private _extractMessageBytesFromReceipt(receipt: ethers.TransactionReceipt): string {
    for (const log of receipt.logs) {
      try {
        const parsed = MESSAGE_TRANSMITTER_IFACE.parseLog(log);
        if (parsed?.name === 'MessageSent') {
          const message = String(parsed.args.message);
          if (message.startsWith('0x') && message.length > 2) return message;
        }
      } catch {
        // not a MessageSent log
      }
    }
    throw new Error(`MessageSent event not found in tx ${receipt.hash}`);
  }

  private _extractDepositFromReceipt(
    receipt: ethers.TransactionReceipt,
  ): { amount: bigint; maxFee: bigint; minFinalityThreshold: number } | null {
    for (const log of receipt.logs) {
      try {
        const parsed = TOKEN_MESSENGER_IFACE.parseLog(log);
        if (parsed?.name === 'DepositForBurn') {
          return {
            amount: BigInt(parsed.args.amount),
            maxFee: BigInt(parsed.args.maxFee),
            minFinalityThreshold: Number(parsed.args.minFinalityThreshold),
          };
        }
      } catch {
        // not a DepositForBurn log
      }
    }
    return null;
  }

  private async _relayJob(job: RelayJob): Promise<void> {
    const dstProvider = this.providers.get(job.dstChainId);
    if (!dstProvider) throw new Error(`missing provider for destination chain ${job.dstChainId}`);

    const { message: relayMessage, attestation } = await this._pollAttestation(job);

    await this._withDestinationQueue(job.dstChainId, async () => {
      const relayerPk = this._readEnv('CCTP_RELAYER_PRIVATE_KEY') || this._readEnv('DEPLOYER_PRIVATE_KEY');
      if (!relayerPk) throw new Error('missing relayer private key');
      const signer = new Wallet(relayerPk, dstProvider);

      const messageTransmitter = await this._resolveMessageTransmitter(job.dstChainId, dstProvider);
      const mtContract = new Contract(messageTransmitter, MESSAGE_TRANSMITTER_ABI, signer);

      let receiveTxHash: string | undefined;
      let mintedAmount = 0n;

      try {
        const tx = await mtContract.receiveMessage(relayMessage, attestation);
        const rcpt = await tx.wait();
        receiveTxHash = rcpt?.hash;
        mintedAmount = this._extractMintedAmount(rcpt, job.settlementToken, job.receiver);

        if (receiveTxHash) this._safeMarkDestinationReceived(job.intentId, receiveTxHash);
        console.log(
          `[CCTP Relay] receiveMessage ok intent=${job.intentId} tx=${receiveTxHash ?? 'unknown'}`,
        );
      } catch (err) {
        if (this._isAccountNonceError(err) || !this._isAlreadyRelayedError(err)) throw err;
        console.log(`[CCTP Relay] message already relayed intent=${job.intentId}`);
      }

      const receiver = new Contract(job.receiver, RECEIVER_ABI, signer);
      const alreadySettled = await receiver.settledIntents(job.intentId);
      if (alreadySettled) {
        console.log(`[CCTP Relay] receiver already settled intent=${job.intentId}`);
        return;
      }

      let executeAmount = mintedAmount;
      if (executeAmount === 0n) {
        if (job.isFastTransfer) {
          throw new Error(
            `cannot determine minted amount for already-relayed fast transfer intent=${job.intentId}`,
          );
        }
        executeAmount = job.amount;
      }

      const approved = await receiver.approvedCallers(signer.address);
      if (!approved) {
        throw new Error(
          `receiver ${job.receiver} does not approve relayer ${signer.address}; set RECEIVER_APPROVED_CALLER_*`,
        );
      }

      try {
        const tx = await receiver.execute(job.settlementToken, executeAmount, job.payload);
        const rcpt = await tx.wait();
        const dstTxHash = rcpt?.hash ?? tx.hash;
        this._safeMarkSettled(job.intentId, dstTxHash);
        console.log(`[CCTP Relay] execute ok intent=${job.intentId} tx=${dstTxHash}`);
      } catch (err) {
        if (this._isIntentAlreadySettledError(err)) {
          console.log(`[CCTP Relay] receiver already settled intent=${job.intentId}`);
          return;
        }
        throw err;
      }
    });
  }

  private async _withDestinationQueue<T>(
    dstChainId: number,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.destinationQueues.get(dstChainId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );

    this.destinationQueues.set(dstChainId, tail);

    try {
      return await run;
    } finally {
      if (this.destinationQueues.get(dstChainId) === tail) {
        this.destinationQueues.delete(dstChainId);
      }
    }
  }

  private async _pollAttestation(job: RelayJob): Promise<AttestationResult> {
    const base = this._readEnv('CCTP_ATTESTATION_BASE_URL') || 'https://iris-api-sandbox.circle.com';
    const pollMs = this._readIntEnv('CCTP_ATTESTATION_POLL_MS', 4000);
    const timeoutMs = this._readIntEnv('CCTP_ATTESTATION_TIMEOUT_MS', 10 * 60_000);
    const deadline = Date.now() + timeoutMs;

    const normalizedBase = base.replace(/\/$/, '');
    const messagesBase = normalizedBase.includes('/v2/messages')
      ? normalizedBase
      : `${normalizedBase}/v2/messages`;
    const queryTx = encodeURIComponent(job.srcTxHash);
    const url = `${messagesBase}/${job.sourceDomainId}?transactionHash=${queryTx}`;
    const expectedMessage = job.message.toLowerCase();
    const expectedNoNonce = this._normalizeMessageIgnoringNonce(expectedMessage);

    while (Date.now() < deadline) {
      const response = await fetch(url);
      if (!response.ok) {
        await this._sleep(pollMs);
        continue;
      }

      const data = await response.json() as {
        messages?: IrisMessage[];
      };
      const target = this._pickIrisMessage(data.messages ?? [], expectedMessage, expectedNoNonce);
      const status = String(target?.status ?? '').toLowerCase();
      const attestation = String(target?.attestation ?? '');
      const message = String(target?.message ?? '');

      if (
        status === 'complete'
        && message.startsWith('0x')
        && message.length > 2
        && attestation.startsWith('0x')
        && attestation.length > 2
      ) {
        return { message, attestation };
      }

      await this._sleep(pollMs);
    }

    throw new Error(
      `attestation timeout for srcTx=${job.srcTxHash} sourceDomain=${job.sourceDomainId} messageHash=${job.messageHash}`,
    );
  }

  private _extractMintedAmount(
    receipt: ethers.TransactionReceipt | null,
    settlementToken: string,
    receiver: string,
  ): bigint {
    if (!receipt) return 0n;
    const transferEvent = ERC20_TRANSFER_IFACE.getEvent('Transfer');
    if (!transferEvent) return 0n;
    const receiverTopic = ethers.zeroPadValue(receiver.toLowerCase(), 32);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== settlementToken.toLowerCase()) continue;
      if (log.topics[0] !== transferEvent.topicHash) continue;
      if (log.topics.length < 3) continue;
      if (log.topics[1] !== ethers.zeroPadValue(ZeroAddress, 32)) continue;
      if (log.topics[2].toLowerCase() !== receiverTopic.toLowerCase()) continue;

      const parsed = ERC20_TRANSFER_IFACE.parseLog(log);
      if (!parsed) continue;
      return BigInt(parsed.args.value);
    }
    return 0n;
  }

  private _pickIrisMessage(
    messages: IrisMessage[],
    expectedMessage: string,
    expectedNoNonce: string | null,
  ): IrisMessage | null {
    if (messages.length === 0) return null;

    const exact = messages.find(
      (m) => String(m.message ?? '').toLowerCase() === expectedMessage,
    );
    if (exact) return exact;

    if (expectedNoNonce) {
      const relaxed = messages.find((m) => {
        const normalized = this._normalizeMessageIgnoringNonce(String(m.message ?? '').toLowerCase());
        return normalized !== null && normalized === expectedNoNonce;
      });
      if (relaxed) return relaxed;
    }

    if (messages.length === 1) return messages[0];

    return null;
  }

  private _normalizeMessageIgnoringNonce(message: string): string | null {
    if (!message.startsWith('0x')) return null;
    // CCTP header layout: version(4 bytes) + sourceDomain(4) + destinationDomain(4) + nonce(32)
    // Hex indices (with 0x prefix): nonce starts at 26 and ends before 90.
    if (message.length < 90) return null;
    return message.slice(0, 26) + message.slice(90);
  }

  private async _resolveMessageTransmitter(
    chainId: number,
    provider: JsonRpcProvider,
  ): Promise<string> {
    const cached = this.messageTransmitterByChain.get(chainId);
    if (cached) return cached;

    const configured = this._readEnv(`CHAIN_${chainId}_CCTP_MESSAGE_TRANSMITTER`)
      || this._readEnv(`CHAIN_${chainId}_MESSAGE_TRANSMITTER`)
      || this._readEnv('CCTP_MESSAGE_TRANSMITTER')
      || this._readEnv('MESSAGE_TRANSMITTER');
    if (configured) {
      const mt = ethers.getAddress(configured);
      this.messageTransmitterByChain.set(chainId, mt);
      return mt;
    }

    const tokenMessenger = this._readEnv(`CHAIN_${chainId}_TOKEN_MESSENGER`) || this._readEnv('TOKEN_MESSENGER');
    if (!tokenMessenger) {
      throw new Error(
        `missing CHAIN_${chainId}_CCTP_MESSAGE_TRANSMITTER (or TOKEN_MESSENGER fallback)`,
      );
    }

    const tokenMessengerContract = new Contract(
      ethers.getAddress(tokenMessenger),
      TOKEN_MESSENGER_ABI,
      provider,
    );
    const mt = ethers.getAddress(String(await tokenMessengerContract.localMessageTransmitter()));
    this.messageTransmitterByChain.set(chainId, mt);
    return mt;
  }

  private _safeMarkDestinationReceived(intentId: string, txHash: string): void {
    void this.intentService.markDestinationReceived(intentId, txHash, {
      actor: 'system',
      eventSource: 'cctp-relay',
    }).catch(() => {
      // intent can be unknown when tx bypasses quote server
    });
  }

  private _safeMarkSettled(intentId: string, txHash: string): void {
    void this.intentService.markSettled(intentId, txHash, {
      actor: 'system',
      eventSource: 'cctp-relay',
    }).catch(() => {
      // intent can be unknown when tx bypasses quote server
    });
  }

  private _isAlreadyRelayedError(err: unknown): boolean {
    const s = String(err).toLowerCase();
    return s.includes('noncealreadyused')
      || s.includes('nonce already used')
      || s.includes('message already');
  }

  private _isIntentAlreadySettledError(err: unknown): boolean {
    return String(err).toLowerCase().includes('intentalreadysettled');
  }

  private _isAccountNonceError(err: unknown): boolean {
    const code = typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
    const s = String(err).toLowerCase();
    return code === 'NONCE_EXPIRED'
      || s.includes('nonce too low')
      || s.includes('nonce has already been used')
      || s.includes('replacement fee too low');
  }

  private _isRetryableRelayError(err: unknown): boolean {
    if (this._isAccountNonceError(err)) return true;

    const code = typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
    const s = String(err).toLowerCase();

    return code === 'SERVER_ERROR'
      || code === 'TIMEOUT'
      || code === 'NETWORK_ERROR'
      || code === 'UNKNOWN_ERROR'
      || s.includes('attestation timeout')
      || s.includes('cannot determine minted amount for already-relayed fast transfer')
      || s.includes('timeout')
      || s.includes('too many requests')
      || s.includes('429')
      || s.includes('500 internal server error')
      || s.includes('failed to marshal batch response')
      || s.includes('could not coalesce error')
      || s.includes('filter not found')
      || s.includes('network')
      || s.includes('missing provider for destination chain');
  }

  private _errorSummary(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    return raw.replace(/\s+/g, ' ').slice(0, 180);
  }

  private _readEnv(name: string): string | undefined {
    const raw = process.env[name];
    if (!raw) return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = this._readEnv(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private _readNonNegativeIntEnv(name: string, fallback: number): number {
    const raw = this._readEnv(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private _resolveSourceDomainId(srcChainId: number): number {
    const override = this._readEnv(`CHAIN_${srcChainId}_CCTP_DOMAIN`) || this._readEnv('CCTP_SOURCE_DOMAIN');
    if (override) {
      const parsed = Number(override);
      if (Number.isInteger(parsed) && parsed >= 0) return parsed;
      throw new Error(`invalid CCTP domain override for chain ${srcChainId}: ${override}`);
    }

    const known = getCctpDomain(srcChainId);
    if (known !== undefined) return known;

    throw new Error(
      `unknown CCTP source domain for chain ${srcChainId}; set CHAIN_${srcChainId}_CCTP_DOMAIN`,
    );
  }

  private async _sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
