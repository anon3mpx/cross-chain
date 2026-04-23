// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Status API
// Lightweight Express REST API for frontend / SDK to poll intent status.
// No auth needed — intentId is a random bytes32 hex ID.
// ─────────────────────────────────────────────────────────

import express, { Request, Response } from 'express';
import { createClient, RedisClientType } from 'redis';
import { ethers, getAddress, verifyMessage } from 'ethers';
import { CHAIN_CONFIGS } from '../config/chains';
import { IntentService, IntentLifecycleError } from '../services/IntentService';
import { QuoteEngine } from '../services/QuoteEngine';
import { buildRouterIntegration } from '../services/IntentCalldataBuilder';
import { Intent, IntentStatus } from '../types';
import { parseQuoteRequest, serializeQuote } from './quoteCodec';
import { buildIntentActionMessage, IntentAction, SIGNATURE_WINDOW_MS } from '../utils/intentActionAuth';
import { getRailVariantLabel } from '../rails/registry';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitBucket>;
  prune?(): void;
}

class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, RateLimitBucket>();

  async increment(key: string, windowMs: number): Promise<RateLimitBucket> {
    const now = Date.now();
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);
    return bucket;
  }

  prune(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private client?: RedisClientType;
  private connectPromise?: Promise<void>;
  private warnedFallback = false;

  constructor(
    private readonly fallback: RateLimitStore,
    private readonly url: string,
    private readonly prefix: string,
  ) {}

  async increment(key: string, windowMs: number): Promise<RateLimitBucket> {
    try {
      const client = await this.getClient();
      const redisKey = `${this.prefix}:${key}`;
      const count = await client.incr(redisKey);
      let ttlMs = await client.pTTL(redisKey);

      if (count === 1 || ttlMs < 0) {
        await client.pExpire(redisKey, windowMs);
        ttlMs = windowMs;
      }

      return {
        count,
        resetAt: Date.now() + Math.max(1, ttlMs),
      };
    } catch (err) {
      if (!this.warnedFallback) {
        console.warn('[RateLimit] Redis unavailable; using in-memory fallback', err);
        this.warnedFallback = true;
      }
      return this.fallback.increment(key, windowMs);
    }
  }

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isOpen) return this.client;

    if (!this.client) {
      this.client = createClient({ url: this.url });
      this.client.on('error', (err) => {
        console.warn('[RateLimit] Redis client error', err);
      });
    }

    if (!this.connectPromise) {
      this.connectPromise = this.client.connect().then(
        () => undefined,
        (err) => {
          this.connectPromise = undefined;
          throw err;
        },
      );
    }

    await this.connectPromise;
    return this.client;
  }
}

const memoryRateLimitStore = new MemoryRateLimitStore();

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0];
  return (firstForwarded || req.ip || req.socket.remoteAddress || 'unknown').trim();
}

function buildRateLimitStore(): RateLimitStore {
  const store = (process.env.VPS_RATE_LIMIT_STORE ?? 'memory').trim().toLowerCase();
  if (store !== 'redis') return memoryRateLimitStore;

  const redisUrl = process.env.VPS_RATE_LIMIT_REDIS_URL || process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[RateLimit] VPS_RATE_LIMIT_STORE=redis but no Redis URL is configured; using memory');
    return memoryRateLimitStore;
  }

  return new RedisRateLimitStore(
    memoryRateLimitStore,
    redisUrl,
    process.env.VPS_RATE_LIMIT_REDIS_PREFIX ?? 'empx:rate-limit',
  );
}

function rateLimit(
  { windowMs, max, keyPrefix }: RateLimitOptions,
  store: RateLimitStore,
): express.RequestHandler {
  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const key = `${keyPrefix}:${clientKey(req)}`;
    void store.increment(key, windowMs).then((bucket) => {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
      res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

      if (bucket.count > max) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          error: 'RATE_LIMITED',
          message: 'Too many requests. Try again shortly.',
        });
        return;
      }

      next();
    }).catch(next);
  };
}

export function buildStatusAPI(
  intentService: IntentService,
  quoteEngine: QuoteEngine,
): express.Application {
  const app = express();
  const providers = new Map<number, ethers.JsonRpcProvider>();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.VPS_CORS_ORIGIN ?? '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'accept,content-type,x-api-key,x-admin-key');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const rateLimitStore = buildRateLimitStore();
  app.use(express.json({ limit: process.env.VPS_JSON_LIMIT ?? '32kb' }));
  app.use(rateLimit({
    windowMs: readIntEnv('VPS_RATE_LIMIT_WINDOW_MS', 60_000),
    max: readIntEnv('VPS_RATE_LIMIT_MAX', 120),
    keyPrefix: 'global',
  }, rateLimitStore));

  const quoteRateLimit = rateLimit({
    windowMs: readIntEnv('VPS_QUOTE_RATE_LIMIT_WINDOW_MS', 60_000),
    max: readIntEnv('VPS_QUOTE_RATE_LIMIT_MAX', 20),
    keyPrefix: 'quote',
  }, rateLimitStore);

  setInterval(() => {
    rateLimitStore.prune?.();
  }, readIntEnv('VPS_RATE_LIMIT_PRUNE_MS', 60_000)).unref?.();

  // ── GET /quote ─────────────────────────────────────────────────────────────
  // Returns a full quote with intentId. Frontend uses this to build the tx.
  app.post('/quote', quoteRateLimit, async (req: Request, res: Response) => {
    try {
      const quoteReq = parseQuoteRequest(req.body, 'normal');
      if (!quoteReq.tokenIn || !quoteReq.tokenOut || !quoteReq.userAddress) {
        return res.status(400).json({ error: 'tokenIn, tokenOut and userAddress are required' });
      }
      if (!Number.isFinite(quoteReq.srcChainId) || !Number.isFinite(quoteReq.dstChainId)) {
        return res.status(400).json({ error: 'srcChainId and dstChainId are required' });
      }
      const quote = await quoteEngine.getQuote(quoteReq);
      if (!quote) return res.status(400).json({ error: 'No route available for this pair' });

      // Pre-create intent in QUOTED state
      const intent = await intentService.createQuotedIntent(quote, quoteReq.userAddress);
      const integration = await buildRouterIntegration(intent.intentId, quote, quoteReq.userAddress);
      res.json({ quote: serializeQuote(quote), intentId: intent.intentId, integration });
    } catch (err) {
      const msg = String(err);
      const code = msg.toLowerCase().includes('calldata') || msg.toLowerCase().includes('routerv1') ? 503 : 400;
      res.status(code).json({ error: msg });
    }
  });

  // ── GET /intent/:id ────────────────────────────────────────────────────────
  // Poll this for intent status. Frontend shows progress to user.
  app.get('/intent/:id', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    const intent = await loadIntent(intentId);
    if (intent === 'unavailable') {
      return res.status(503).json({ error: 'STATUS_UNAVAILABLE' });
    }
    if (!intent) return res.status(404).json({ error: 'Intent not found' });

    res.json(await serializeIntent(intent));
  });

  app.post('/intent/:id/submitted', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    try {
      const auth = parseSignedIntentAction(req, intentId, 'submitted');
      const intent = await intentService.markSubmitted(intentId, auth.srcTxHash, {
        actor: auth.userAddress,
        eventSource: 'wallet-submit',
      });
      res.status(202).json(await serializeIntent(intent));
    } catch (err) {
      handleLifecycleError(res, err);
    }
  });

  app.post('/intent/:id/cancel', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    try {
      const auth = parseSignedIntentAction(req, intentId, 'cancel');
      const current = await intentService.getIntent(intentId);
      if (!current) {
        throw new IntentLifecycleError('INTENT_NOT_FOUND', `Intent not found: ${intentId}`, 404);
      }

      const intent = current.status === IntentStatus.SUBMITTED
        ? await cancelSubmittedIntent(current, auth.userAddress, auth.reason, auth.replacementTxHash)
        : await intentService.cancel(intentId, auth.userAddress, auth.reason);
      res.json(await serializeIntent(intent));
    } catch (err) {
      handleLifecycleError(res, err);
    }
  });

  app.post('/intent/:id/refund', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    try {
      const auth = parseSignedIntentAction(req, intentId, 'refund');
      const reason = auth.reason?.trim();
      if (!reason) {
        return res.status(400).json({ error: 'reason is required' });
      }
      const refund = await intentService.requestRefund(intentId, auth.userAddress, reason);
      res.status(202).json({ ok: true, refund, ts: Date.now() });
    } catch (err) {
      handleLifecycleError(res, err);
    }
  });

  // ── GET /health ────────────────────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    try {
      const counts = await intentService.countIntentsByStatus();
      return res.json({ ok: true, intents: counts, ts: Date.now() });
    } catch (err) {
      console.error('[StatusAPI] failed to load health counts', err);
      return res.status(503).json({ ok: false, ts: Date.now() });
    }
  });

  return app;

  async function loadIntent(intentId: string): Promise<Intent | 'unavailable' | undefined> {
    try {
      return (await intentService.getIntent(intentId)) ?? undefined;
    } catch (err) {
      console.error(`[StatusAPI] failed to load intent ${intentId}`, err);
      return 'unavailable';
    }
  }

  async function serializeIntent(intent: Intent) {
    const refund = await intentService.getRefundCase(intent.intentId);
    return {
      intentId: intent.intentId,
      status: intent.status,
      srcTxHash: intent.srcTxHash,
      dstTxHash: intent.dstTxHash,
      railTxId: intent.railTxId,
      rail: intent.quote.rail,
      railVariant: getRailVariantLabel(intent.quote.rail, intent.quote.railPluginId),
      etaSeconds: intent.quote.etaSeconds,
      createdAt: intent.createdAt,
      updatedAt: intent.updatedAt,
      errorMessage: intent.errorMessage,
      canCancel: intentService.canCancel(intent.status),
      canCancelInWallet: intent.status === IntentStatus.SUBMITTED && Boolean(intent.srcTxHash),
      canRequestRefund: intentService.canRequestRefund(intent.status),
      refund,
    };
  }

  function parseSignedIntentAction(
    req: Request,
    intentId: string,
    action: IntentAction,
  ): { userAddress: string; reason?: string; srcTxHash: string; replacementTxHash?: string } {
    const body = req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {};
    const userAddress = typeof body.userAddress === 'string' ? body.userAddress.trim() : '';
    const signature = typeof body.signature === 'string' ? body.signature.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    const srcTxHash = typeof body.srcTxHash === 'string' ? body.srcTxHash.trim() : '';
    const replacementTxHash = typeof body.replacementTxHash === 'string'
      ? body.replacementTxHash.trim()
      : undefined;
    const timestamp = Number(body.timestamp);

    if (!userAddress || !signature || !Number.isFinite(timestamp)) {
      throw new IntentLifecycleError('INVALID_SIGNATURE_PAYLOAD', 'userAddress, signature and timestamp are required.');
    }
    if (action === 'submitted' && !srcTxHash) {
      throw new IntentLifecycleError('INVALID_SIGNATURE_PAYLOAD', 'srcTxHash is required for submitted intents.');
    }

    if (Math.abs(Date.now() - timestamp) > SIGNATURE_WINDOW_MS) {
      throw new IntentLifecycleError('SIGNATURE_EXPIRED', 'Signed request has expired.', 401);
    }

    try {
      const normalized = getAddress(userAddress);
      const message = buildIntentActionMessage(action, {
        intentId,
        userAddress: normalized,
        timestamp,
        reason,
        srcTxHash,
        replacementTxHash,
      });
      const recovered = getAddress(verifyMessage(message, signature));
      if (recovered !== normalized) {
        throw new IntentLifecycleError('INVALID_SIGNATURE', 'Wallet signature does not match the provided address.', 401);
      }

      return { userAddress: normalized, reason, srcTxHash, replacementTxHash };
    } catch (err) {
      if (err instanceof IntentLifecycleError) throw err;
      throw new IntentLifecycleError('INVALID_SIGNATURE', 'Unable to verify wallet signature.', 401);
    }
  }

  async function cancelSubmittedIntent(
    intent: Intent,
    userAddress: string,
    reason: string | undefined,
    replacementTxHash: string | undefined,
  ): Promise<Intent> {
    if (!intent.srcTxHash) {
      throw new IntentLifecycleError(
        'SOURCE_TX_REQUIRED',
        'Intent is submitted but the source transaction hash is missing.',
        409,
      );
    }
    if (!replacementTxHash) {
      throw new IntentLifecycleError(
        'CANCEL_IN_WALLET',
        'Cancel the pending transaction in the wallet with the same nonce and a higher fee, then resubmit with replacementTxHash once that transaction is confirmed.',
        409,
      );
    }
    if (replacementTxHash.toLowerCase() === intent.srcTxHash.toLowerCase()) {
      throw new IntentLifecycleError(
        'INVALID_REPLACEMENT_TX',
        'replacementTxHash must be different from the original source transaction hash.',
      );
    }

    const provider = getSourceProvider(intent.quote.srcChainId);
    const [originalTx, originalReceipt, replacementTx, replacementReceipt] = await Promise.all([
      provider.getTransaction(intent.srcTxHash),
      provider.getTransactionReceipt(intent.srcTxHash),
      provider.getTransaction(replacementTxHash),
      provider.getTransactionReceipt(replacementTxHash),
    ]);

    if (originalReceipt?.blockNumber) {
      throw new IntentLifecycleError(
        'SOURCE_TX_ALREADY_MINED',
        'Source transaction is already mined. Cancellation is no longer possible; request refund review instead.',
        409,
      );
    }
    if (!originalTx) {
      throw new IntentLifecycleError(
        'SOURCE_TX_UNAVAILABLE',
        'Original source transaction is no longer available from the RPC. Verify wallet cancellation manually and request refund review if needed.',
        409,
      );
    }
    if (!replacementTx || !replacementReceipt) {
      throw new IntentLifecycleError(
        'CANCEL_PENDING_WALLET_CONFIRMATION',
        'Replacement transaction is not confirmed yet. Retry after the wallet cancellation is mined.',
        409,
      );
    }
    if (replacementReceipt.status !== 1) {
      throw new IntentLifecycleError(
        'CANCEL_REPLACEMENT_FAILED',
        'Replacement transaction did not succeed. Intent remains submitted.',
        409,
      );
    }

    const originalFrom = getAddress(originalTx.from);
    const replacementFrom = getAddress(replacementTx.from);
    if (originalFrom !== getAddress(userAddress) || replacementFrom !== getAddress(userAddress)) {
      throw new IntentLifecycleError(
        'INVALID_REPLACEMENT_TX',
        'Replacement transaction must come from the same wallet as the source transaction.',
        409,
      );
    }
    if (replacementTx.nonce !== originalTx.nonce) {
      throw new IntentLifecycleError(
        'INVALID_REPLACEMENT_TX',
        'Replacement transaction must use the same nonce as the source transaction.',
        409,
      );
    }

    return intentService.markCancelled(
      intent.intentId,
      reason?.trim() || `Cancelled in wallet via replacement transaction ${replacementTxHash}`,
      {
        actor: userAddress,
        eventSource: 'wallet-cancel',
        chainId: intent.quote.srcChainId,
        txHash: replacementTxHash,
        allowedFrom: [IntentStatus.SUBMITTED],
      },
    );
  }

  function getSourceProvider(chainId: number): ethers.JsonRpcProvider {
    const existing = providers.get(chainId);
    if (existing) return existing;

    const chain = CHAIN_CONFIGS[chainId];
    if (!chain?.isEVM || !chain.rpcUrl) {
      throw new IntentLifecycleError(
        'CHAIN_RPC_UNAVAILABLE',
        `No EVM RPC is configured for source chain ${chainId}.`,
        503,
      );
    }

    const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chainId, {
      staticNetwork: true,
    });
    providers.set(chainId, provider);
    return provider;
  }

  function handleLifecycleError(res: Response, err: unknown): void {
    if (err instanceof IntentLifecycleError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    console.error('[StatusAPI] request failed', err);
    res.status(500).json({ error: 'INTERNAL', message: 'Unexpected server error.' });
  }
}
