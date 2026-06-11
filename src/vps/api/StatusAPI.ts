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
import { buildSelectedOfferIntegration } from '../services/DirectRailIntegrationBuilder';
import { ComposedIntentStatus, Intent, IntentStatus, Rail } from '../types';
import type { BasketQuoteEngine } from '../services/BasketQuoteEngine';
import type { BasketStatusEngine } from '../services/BasketStatusEngine';
import type { WalletScanner } from '../services/WalletScanner';
import type { WalletLiquidator } from '../services/WalletLiquidator';
import type { Erc7683Adapter, Erc7683Order } from '../services/Erc7683Adapter';
import type { SolversRepository, SolverType } from '../db/SolversRepository';
import type { IntentBasket } from '../core/IntentBasket';
import { parseOfferSelection, parseQuoteRequest, serializeGasZipComposition, serializeOfferSet, serializeQuote } from './quoteCodec';
import { buildIntentActionId, buildIntentActionMessage, IntentAction, SIGNATURE_WINDOW_MS } from '../utils/intentActionAuth';
import { getRailVariantLabel } from '../rails/registry';
import { RpcProviderRegistry } from '../services/RpcProviderRegistry';
import {
  LayerZeroValueTransferApiBuildUserStepsRequest,
  LayerZeroValueTransferApiClient,
  LayerZeroValueTransferApiChainsResponse,
  LayerZeroValueTransferApiSubmitSignatureRequest,
  LayerZeroValueTransferApiTokensRequest,
  LayerZeroValueTransferApiTokensResponse,
  LayerZeroValueTransferApiBuildUserStepsResponse,
} from '../services/layerzero/LayerZeroValueTransferApiClient';

const STATUS_API_VERSION_PREFIX = '/api/v1';

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

interface LayerZeroValueTransferApiHttpClient {
  listLayerZeroValueTransferApiChains(): Promise<LayerZeroValueTransferApiChainsResponse>;
  listLayerZeroValueTransferApiTokens(request: LayerZeroValueTransferApiTokensRequest): Promise<LayerZeroValueTransferApiTokensResponse>;
  buildLayerZeroValueTransferApiUserSteps(request: LayerZeroValueTransferApiBuildUserStepsRequest): Promise<LayerZeroValueTransferApiBuildUserStepsResponse>;
  submitLayerZeroValueTransferApiSignature(request: LayerZeroValueTransferApiSubmitSignatureRequest): Promise<Record<string, never>>;
}

interface StatusApiOptions {
  layerZeroValueTransferApiClient?: LayerZeroValueTransferApiHttpClient;
  rpcProviderRegistry?: Pick<RpcProviderRegistry, 'getProvider' | 'getReadProvider'>;
  idempotency?: import('../db/IdempotencyStore').IdempotencyStore;
  basketQuoteEngine?: BasketQuoteEngine;
  basketStatusEngine?: BasketStatusEngine;
  walletScanner?: WalletScanner;
  walletLiquidator?: WalletLiquidator;
  erc7683Adapter?: Erc7683Adapter;
  solversRepository?: SolversRepository;
}

class MemoryIntentActionReplayStore {
  private readonly consumed = new Map<string, number>();

  claim(actionId: string, ttlMs: number): boolean {
    const now = Date.now();
    for (const [key, expiresAt] of this.consumed.entries()) {
      if (expiresAt <= now) this.consumed.delete(key);
    }
    const existing = this.consumed.get(actionId);
    if (existing && existing > now) return false;
    this.consumed.set(actionId, now + Math.max(ttlMs, 1000));
    return true;
  }

  release(actionId: string): void {
    this.consumed.delete(actionId);
  }
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
const intentActionReplayStore = new MemoryIntentActionReplayStore();

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function clientKey(req: Request): string {
  if (readBoolEnv('VPS_TRUST_PROXY_HEADERS', false)) {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    const firstCfConnectingIp = Array.isArray(cfConnectingIp)
      ? cfConnectingIp[0]
      : cfConnectingIp;
    const forwardedFor = req.headers['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    if (firstCfConnectingIp || firstForwarded) {
      return (firstCfConnectingIp || firstForwarded || '').trim();
    }
  }
  return (req.ip || req.socket.remoteAddress || 'unknown').trim();
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
  options: StatusApiOptions = {},
): express.Application {
  const app = express();
  app.set('trust proxy', readBoolEnv('VPS_TRUST_PROXY_HEADERS', false));
  const providers = new Map<number, ethers.AbstractProvider>();
  const layerZeroValueTransferApiClient =
    options.layerZeroValueTransferApiClient ?? new LayerZeroValueTransferApiClient();
  const rpcProviderRegistry = options.rpcProviderRegistry ?? new RpcProviderRegistry();
  const idempotency = options.idempotency;
  const basketQuoteEngine = options.basketQuoteEngine;
  const basketStatusEngine = options.basketStatusEngine;
  const walletScanner = options.walletScanner;
  const walletLiquidator = options.walletLiquidator;
  const erc7683Adapter = options.erc7683Adapter;
  const solversRepository = options.solversRepository;

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

  const router = express.Router();

  // ── POST /api/v1/quote ────────────────────────────────────────────────────
  // Returns an offer set. Client selects one offer, then requests integration.
  router.post('/quote', quoteRateLimit, async (req: Request, res: Response) => {
    try {
      const quoteReq = parseQuoteRequest(req.body, 'normal');
      if (!quoteReq.tokenIn || !quoteReq.tokenOut || !quoteReq.userAddress) {
        return res.status(400).json({ error: 'tokenIn, tokenOut and userAddress are required' });
      }
      if (!Number.isFinite(quoteReq.srcChainId) || !Number.isFinite(quoteReq.dstChainId)) {
        return res.status(400).json({ error: 'srcChainId and dstChainId are required' });
      }
      const offerSet = await quoteEngine.getOffers(quoteReq);
      if (!offerSet) return res.status(400).json({ error: 'No route available for this pair' });

      const quote = offerSetHasProviderDirectOffer(offerSet) ? null : await quoteEngine.getQuote(quoteReq);
      const gasZipComposition = quoteEngine.buildGasZipComposition(quoteReq, offerSet);
      res.json({
        offerSet: serializeOfferSet(offerSet),
        ...(quote ? { quote: serializeQuote(quote) } : {}),
        ...(gasZipComposition ? { gasZipComposition: serializeGasZipComposition(gasZipComposition) } : {}),
      });
    } catch (err) {
      const msg = String(err);
      const code = msg.toLowerCase().includes('calldata') || msg.toLowerCase().includes('routerv1') ? 503 : 400;
      res.status(code).json({ error: msg });
    }
  });

  router.post('/quote/select', async (req: Request, res: Response) => {
    try {
      const { offerSetId, offerId } = parseOfferSelection(req.body);
      const userAddress = typeof req.body?.userAddress === 'string' ? req.body.userAddress.trim() : '';
      if (!userAddress) {
        return res.status(400).json({ error: 'userAddress is required' });
      }

      const selection = await quoteEngine.selectOffer(offerSetId, offerId);
      if (!selection.offer) {
        if (selection.fallbackOfferSet) {
          return res.status(409).json({
            error: 'OFFER_UNAVAILABLE',
            message: 'Selected offer is unavailable. Please select a fallback offer.',
            fallbackOfferSet: serializeOfferSet(selection.fallbackOfferSet),
          });
        }
        return res.status(404).json({
          error: selection.reason ?? 'OFFER_NOT_FOUND',
          message: 'Offer selection is unavailable or expired.',
        });
      }

      const intent = await intentService.createQuotedIntentFromOffer(selection.offer, userAddress);
      const integration = await buildSelectedOfferIntegration(intent.intentId, selection.offer, userAddress);
      res.json({ quote: serializeQuote(intent.quote), intentId: intent.intentId, integration });
    } catch (err) {
      const msg = String(err);
      const code = msg.toLowerCase().includes('calldata') || msg.toLowerCase().includes('routerv1') ? 503 : 400;
      res.status(code).json({ error: msg });
    }
  });

  router.post('/basket/quote', async (req: Request, res: Response) => {
    if (!basketQuoteEngine) return res.status(503).json({ error: 'BASKETS_UNAVAILABLE' });
    try {
      // Agent-facing Phase 4 surfaces mirror the partner features, but they
      // stay on the public `/api/v1/*` namespace and use `routeSource=agent-sdk`.
      const basket = parseIntentBasket(req.body?.basket ?? req.body);
      const result = await basketQuoteEngine.quote(basket, buildAgentExecutionContext(req));
      if ('error' in result) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/basket/execute', async (req: Request, res: Response) => {
    if (!basketQuoteEngine) return res.status(503).json({ error: 'BASKETS_UNAVAILABLE' });
    try {
      const basket = parseIntentBasket(req.body?.basket ?? req.body);
      const userAddress = typeof req.body?.userAddress === 'string' ? req.body.userAddress.trim() : basket.inputs[0]?.wallet;
      if (!userAddress) return res.status(400).json({ error: 'userAddress is required' });
      const plan = await basketQuoteEngine.executeBasket(
        basket,
        userAddress,
        {
          partnerApiKey: readOptionalString(req.body?.partnerApiKey),
          partnerId: readOptionalString(req.body?.partnerId),
          integratorId: readOptionalString(req.body?.integratorId),
          agentId: readOptionalString(req.body?.agentId),
          solverId: readOptionalString(req.body?.solverId),
          routeSource: 'agent-sdk',
        },
        buildAgentExecutionContext(req),
        {
          basketId: readOptionalString(req.body?.basketId),
          legIndexes: parseNumberArray(req.body?.legIndexes),
          mode: req.body?.mode === 'multicall' ? 'multicall' : 'sequential',
        },
      );
      if ('error' in plan) return res.status(400).json(plan);
      res.json(plan);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.get('/basket/:id/status', async (req: Request, res: Response) => {
    if (!basketStatusEngine) return res.status(503).json({ error: 'BASKET_STATUS_UNAVAILABLE' });
    try {
      const basketId = String(req.params.id);
      const status = await basketStatusEngine.getStatus(basketId, readOptionalString(req.query.partnerId));
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/wallet/scan', async (req: Request, res: Response) => {
    if (!walletScanner) return res.status(503).json({ error: 'WALLET_SCAN_UNAVAILABLE' });
    try {
      const result = await walletScanner.scan(
        parseWalletScanRequest(req.body),
        buildAgentExecutionContext(req),
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/wallet/liquidate/quote', async (req: Request, res: Response) => {
    if (!walletLiquidator) return res.status(503).json({ error: 'WALLET_LIQUIDATOR_UNAVAILABLE' });
    try {
      const result = await walletLiquidator.quote(
        parseWalletLiquidationRequest(req.body),
        buildAgentExecutionContext(req),
      );
      if ('error' in result) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/wallet/liquidate/execute', async (req: Request, res: Response) => {
    if (!walletLiquidator) return res.status(503).json({ error: 'WALLET_LIQUIDATOR_UNAVAILABLE' });
    try {
      const result = await walletLiquidator.execute(
        parseWalletLiquidationRequest(req.body),
        {
          partnerApiKey: readOptionalString(req.body?.partnerApiKey),
          partnerId: readOptionalString(req.body?.partnerId),
          integratorId: readOptionalString(req.body?.integratorId),
          agentId: readOptionalString(req.body?.agentId),
          solverId: readOptionalString(req.body?.solverId),
          routeSource: 'agent-sdk',
        },
        buildAgentExecutionContext(req),
        {
          mode: req.body?.mode === 'multicall' ? 'multicall' : 'sequential',
        },
      );
      if ('error' in result) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/erc7683/resolve', async (req: Request, res: Response) => {
    if (!erc7683Adapter) return res.status(503).json({ error: 'ERC7683_UNAVAILABLE' });
    try {
      await assertActiveSolver(solversRepository, readOptionalString(req.body?.solverId));
      const result = await erc7683Adapter.resolve(
        parseErc7683Order(req.body),
        buildAgentExecutionContext(req),
      );
      if ('error' in result) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/erc7683/open', async (req: Request, res: Response) => {
    if (!erc7683Adapter) return res.status(503).json({ error: 'ERC7683_UNAVAILABLE' });
    try {
      await assertActiveSolver(solversRepository, readOptionalString(req.body?.solverId));
      const result = await erc7683Adapter.open(
        parseErc7683Order(req.body),
        {
          partnerId: readOptionalString(req.body?.partnerId),
          integratorId: readOptionalString(req.body?.integratorId),
          agentId: readOptionalString(req.body?.agentId),
          solverId: readOptionalString(req.body?.solverId),
        },
        buildAgentExecutionContext(req),
      );
      if ('error' in result) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.get('/solvers', async (req: Request, res: Response) => {
    if (!solversRepository) return res.status(503).json({ error: 'SOLVER_REGISTRY_UNAVAILABLE' });
    try {
      const type = readOptionalString(req.query.type) as SolverType | undefined;
      const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === '1';
      res.json({ solvers: await solversRepository.listWithStats({ type, activeOnly }) });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/solvers/register', async (req: Request, res: Response) => {
    if (!solversRepository) return res.status(503).json({ error: 'SOLVER_REGISTRY_UNAVAILABLE' });
    try {
      const record = await solversRepository.upsert(parseSolverRegistration(req.body));
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/solvers/:id/active', async (req: Request, res: Response) => {
    if (!solversRepository) return res.status(503).json({ error: 'SOLVER_REGISTRY_UNAVAILABLE' });
    try {
      const id = String(req.params.id);
      const active = Boolean(req.body?.active);
      await solversRepository.setActive(id, active);
      res.json({ id, active });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.get('/layerzero-value-transfer-api/chains', quoteRateLimit, async (_req: Request, res: Response) => {
    try {
      const response = await layerZeroValueTransferApiClient.listLayerZeroValueTransferApiChains();
      res.json(response);
    } catch (err) {
      res.status(502).json({ error: 'LAYERZERO_VALUE_TRANSFER_API_UNAVAILABLE', message: String(err) });
    }
  });

  router.get('/layerzero-value-transfer-api/tokens', quoteRateLimit, async (req: Request, res: Response) => {
    try {
      const tokenRequest = parseLayerZeroValueTransferApiTokensRequest(req.query);
      const response = await layerZeroValueTransferApiClient.listLayerZeroValueTransferApiTokens(tokenRequest);
      res.json(response);
    } catch (err) {
      const status = err instanceof IntentLifecycleError ? err.statusCode : 502;
      const error = err instanceof IntentLifecycleError ? err.code : 'LAYERZERO_VALUE_TRANSFER_API_UNAVAILABLE';
      res.status(status).json({ error, message: String(err instanceof Error ? err.message : err) });
    }
  });

  router.post('/layerzero-value-transfer-api/intents/:id/build-user-steps', async (req: Request, res: Response) => {
    try {
      const intent = await requireLayerZeroValueTransferApiIntent(req.params.id);
      const quoteId = requireLayerZeroValueTransferApiQuoteId(intent);
      const response = await layerZeroValueTransferApiClient.buildLayerZeroValueTransferApiUserSteps({ quoteId });
      await intentService.upsertProviderTransfer?.({
        intentId: intent.intentId,
        provider: 'layerzero_value_transfer_api',
        providerQuoteId: quoteId,
        status: 'USER_STEPS_BUILT',
        latestProviderStatus: 'USER_STEPS_BUILT',
        routeStepTypes: extractLayerZeroValueTransferApiRouteStepTypes(intent),
        metadata: { userStepCount: response.userSteps.length },
      });
      res.json(response);
    } catch (err) {
      writeLayerZeroValueTransferApiError(res, err);
    }
  });

  router.post('/layerzero-value-transfer-api/intents/:id/submitted', async (req: Request, res: Response) => {
    try {
      const intent = await requireLayerZeroValueTransferApiIntent(req.params.id);
      const quoteId = requireLayerZeroValueTransferApiQuoteId(intent);
      const submission = parseLayerZeroValueTransferApiSubmission(req.body);
      if (submission.userAddress.toLowerCase() !== intent.userAddress.toLowerCase()) {
        throw new IntentLifecycleError('UNAUTHORIZED_INTENT', 'Intent does not belong to the provided wallet.', 403);
      }

      await intentService.upsertProviderTransfer({
        intentId: intent.intentId,
        provider: 'layerzero_value_transfer_api',
        providerQuoteId: quoteId,
        status: 'SUBMITTED',
        sourceTxHash: submission.sourceTxHash,
        latestProviderStatus: 'SOURCE_SUBMITTED',
        routeStepTypes: extractLayerZeroValueTransferApiRouteStepTypes(intent),
      });

      const updated = intent.status === IntentStatus.SUBMITTED
        ? intent
        : await intentService.markSubmitted(intent.intentId, submission.sourceTxHash, {
          actor: submission.userAddress,
          eventSource: 'layerzero-value-transfer-api-submitted',
          allowedFrom: [IntentStatus.QUOTED, IntentStatus.SUBMITTED],
        });
      res.status(202).json(await serializeIntent(updated));
    } catch (err) {
      writeLayerZeroValueTransferApiError(res, err);
    }
  });

  router.post('/layerzero-value-transfer-api/intents/:id/submit-signature', async (req: Request, res: Response) => {
    try {
      const intent = await requireLayerZeroValueTransferApiIntent(req.params.id);
      const quoteId = requireLayerZeroValueTransferApiQuoteId(intent);
      const signatures = parseLayerZeroValueTransferApiSignatures(req.body);
      await layerZeroValueTransferApiClient.submitLayerZeroValueTransferApiSignature({ quoteId, signatures });
      await intentService.upsertProviderTransfer?.({
        intentId: intent.intentId,
        provider: 'layerzero_value_transfer_api',
        providerQuoteId: quoteId,
        status: 'SUBMITTED',
        sourceSignature: signatures[0],
        latestProviderStatus: 'SIGNATURE_SUBMITTED',
        routeStepTypes: extractLayerZeroValueTransferApiRouteStepTypes(intent),
        metadata: { signatureCount: signatures.length },
      });
      const updated = intent.status === IntentStatus.SUBMITTED
        ? intent
        : await intentService.markSubmitted(intent.intentId, quoteId, {
          actor: 'layerzero-value-transfer-api',
          eventSource: 'layerzero-value-transfer-api-submit-signature',
          allowedFrom: [IntentStatus.QUOTED, IntentStatus.SUBMITTED],
        });
      res.json({ ok: true, intent: await serializeIntent(updated) });
    } catch (err) {
      writeLayerZeroValueTransferApiError(res, err);
    }
  });

  router.post('/quote/select-composed', async (req: Request, res: Response) => {
    try {
      const {
        offerSetId,
        primaryTransferOfferId,
        gasZipDestinationGasOfferId,
      } = parseComposedOfferSelection(req.body);
      const userAddress = typeof req.body?.userAddress === 'string' ? req.body.userAddress.trim() : '';
      if (!userAddress) {
        return res.status(400).json({ error: 'userAddress is required' });
      }

      const [primaryTransferOffer, gasZipDestinationGasOffer] = await Promise.all([
        quoteEngine.getOfferBySelection(offerSetId, primaryTransferOfferId),
        quoteEngine.getOfferBySelection(offerSetId, gasZipDestinationGasOfferId),
      ]);
      if (!primaryTransferOffer || !gasZipDestinationGasOffer) {
        return res.status(404).json({
          error: 'OFFER_NOT_FOUND',
          message: 'One or more composed offers are unavailable or expired.',
        });
      }
      if (primaryTransferOffer.rail === Rail.GASZIP) {
        return res.status(400).json({ error: 'primaryTransferOfferId must reference a non-GASZIP offer' });
      }
      if (gasZipDestinationGasOffer.rail !== Rail.GASZIP) {
        return res.status(400).json({ error: 'gasZipDestinationGasOfferId must reference a GASZIP offer' });
      }

      const [primaryTransferIntent, gasZipDestinationGasIntent] = await Promise.all([
        intentService.createQuotedIntentFromOffer(primaryTransferOffer, userAddress),
        intentService.createQuotedIntentFromOffer(gasZipDestinationGasOffer, userAddress),
      ]);
      const [primaryTransferIntegration, gasZipDestinationGasIntegration] = await Promise.all([
        buildSelectedOfferIntegration(primaryTransferIntent.intentId, primaryTransferOffer, userAddress),
        buildSelectedOfferIntegration(gasZipDestinationGasIntent.intentId, gasZipDestinationGasOffer, userAddress),
      ]);
      const tracking = buildComposedTracking(
        primaryTransferIntent.intentId,
        gasZipDestinationGasIntent.intentId,
      );

      res.json({
        composedIntentId: tracking.composedIntentId,
        status: 'QUOTED' satisfies ComposedIntentStatus,
        executionPlan: [
          {
            step: 1,
            label: 'primary_transfer',
            intentId: primaryTransferIntent.intentId,
            rail: primaryTransferIntent.quote.rail,
          },
          {
            step: 2,
            label: 'gaszip_destination_gas',
            intentId: gasZipDestinationGasIntent.intentId,
            rail: gasZipDestinationGasIntent.quote.rail,
          },
        ],
        primaryTransfer: {
          intentId: primaryTransferIntent.intentId,
          quote: serializeQuote(primaryTransferIntent.quote),
          integration: primaryTransferIntegration,
        },
        gasZipDestinationGas: {
          intentId: gasZipDestinationGasIntent.intentId,
          quote: serializeQuote(gasZipDestinationGasIntent.quote),
          integration: gasZipDestinationGasIntegration,
        },
        tracking,
      });
    } catch (err) {
      const msg = String(err);
      const code = msg.toLowerCase().includes('calldata') || msg.toLowerCase().includes('routerv1') ? 503 : 400;
      res.status(code).json({ error: msg });
    }
  });

  // ── GET /api/v1/intent/:id ────────────────────────────────────────────────
  // Poll this for intent status. Frontend shows progress to user.
  router.get('/intent/:id', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    const intent = await loadIntent(intentId);
    if (intent === 'unavailable') {
      return res.status(503).json({ error: 'STATUS_UNAVAILABLE' });
    }
    if (!intent) return res.status(404).json({ error: 'Intent not found' });

    res.json(await serializeIntent(intent));
  });

  router.get('/intent/composed/:primaryIntentId/:gasZipIntentId', async (req: Request, res: Response) => {
    const primaryIntentId = String(req.params.primaryIntentId);
    const gasZipIntentId = String(req.params.gasZipIntentId);
    const [primaryIntent, gasZipIntent] = await Promise.all([
      loadIntent(primaryIntentId),
      loadIntent(gasZipIntentId),
    ]);
    if (primaryIntent === 'unavailable' || gasZipIntent === 'unavailable') {
      return res.status(503).json({ error: 'STATUS_UNAVAILABLE' });
    }
    if (!primaryIntent || !gasZipIntent) {
      return res.status(404).json({ error: 'Intent not found' });
    }
    if (gasZipIntent.quote.rail !== Rail.GASZIP) {
      return res.status(400).json({ error: 'gasZipIntentId must reference a GASZIP intent' });
    }

    const primaryTransfer = await serializeIntent(primaryIntent);
    const gasZipDestinationGas = await serializeIntent(gasZipIntent);
    const tracking = buildComposedTracking(primaryIntentId, gasZipIntentId);

    res.json({
      composedIntentId: tracking.composedIntentId,
      status: composeIntentStatus(primaryIntent.status, gasZipIntent.status),
      createdAt: Math.min(primaryIntent.createdAt, gasZipIntent.createdAt),
      updatedAt: Math.max(primaryIntent.updatedAt, gasZipIntent.updatedAt),
      executionPlan: [
        {
          step: 1,
          label: 'primary_transfer',
          intentId: primaryIntent.intentId,
          rail: primaryIntent.quote.rail,
        },
        {
          step: 2,
          label: 'gaszip_destination_gas',
          intentId: gasZipIntent.intentId,
          rail: gasZipIntent.quote.rail,
        },
      ],
      primaryTransfer,
      gasZipDestinationGas,
      canCancel: intentService.canCancel(primaryIntent.status) && intentService.canCancel(gasZipIntent.status),
      canRequestRefund: intentService.canRequestRefund(primaryIntent.status) || intentService.canRequestRefund(gasZipIntent.status),
      tracking,
    });
  });

  router.post('/intent/:id/submitted', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    let actionId: string | undefined;
    let claimed = false;
    try {
      const auth = parseSignedIntentAction(req, intentId, 'submitted');
      actionId = auth.actionId;
      if (actionId) {
        claimed = await claimIntentAction(actionId);
        if (!claimed) {
          throw new IntentLifecycleError('ACTION_ALREADY_USED', 'Signed request has already been used.', 409);
        }
      }
      const intent = await intentService.markSubmitted(intentId, auth.srcTxHash, {
        actor: auth.userAddress,
        eventSource: 'wallet-submit',
      });
      res.status(202).json(await serializeIntent(intent));
    } catch (err) {
      if (actionId && claimed) await releaseIntentAction(actionId);
      handleLifecycleError(res, err);
    }
  });

  router.post('/intent/:id/cancel', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    let actionId: string | undefined;
    let claimed = false;
    try {
      const auth = parseSignedIntentAction(req, intentId, 'cancel');
      actionId = auth.actionId;
      if (actionId) {
        claimed = await claimIntentAction(actionId);
        if (!claimed) {
          throw new IntentLifecycleError('ACTION_ALREADY_USED', 'Signed request has already been used.', 409);
        }
      }
      const current = await intentService.getIntent(intentId);
      if (!current) {
        throw new IntentLifecycleError('INTENT_NOT_FOUND', `Intent not found: ${intentId}`, 404);
      }

      const intent = current.status === IntentStatus.SUBMITTED
        ? await cancelSubmittedIntent(current, auth.userAddress, auth.reason, auth.replacementTxHash)
        : await intentService.cancel(intentId, auth.userAddress, auth.reason);
      res.json(await serializeIntent(intent));
    } catch (err) {
      if (actionId && claimed) await releaseIntentAction(actionId);
      handleLifecycleError(res, err);
    }
  });

  router.post('/intent/:id/refund', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    let actionId: string | undefined;
    let claimed = false;
    try {
      const auth = parseSignedIntentAction(req, intentId, 'refund');
      actionId = auth.actionId;
      if (actionId) {
        claimed = await claimIntentAction(actionId);
        if (!claimed) {
          throw new IntentLifecycleError('ACTION_ALREADY_USED', 'Signed request has already been used.', 409);
        }
      }
      const reason = auth.reason?.trim();
      if (!reason) {
        return res.status(400).json({ error: 'reason is required' });
      }
      const refund = await intentService.requestRefund(intentId, auth.userAddress, reason);
      res.status(202).json({ ok: true, refund, ts: Date.now() });
    } catch (err) {
      if (actionId && claimed) await releaseIntentAction(actionId);
      handleLifecycleError(res, err);
    }
  });

  // ── GET /api/v1/health ────────────────────────────────────────────────────
  router.get('/health', async (_req, res) => {
    try {
      const counts = await intentService.countIntentsByStatus();
      return res.json({ ok: true, intents: counts, ts: Date.now() });
    } catch (err) {
      console.error('[StatusAPI] failed to load health counts', err);
      return res.status(503).json({ ok: false, ts: Date.now() });
    }
  });

  app.use(STATUS_API_VERSION_PREFIX, router);
  app.use(router);

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
  ): { userAddress: string; reason?: string; srcTxHash: string; replacementTxHash?: string; actionId?: string } {
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
    const nonce = typeof body.nonce === 'string' ? body.nonce.trim() : '';
    const timestamp = Number(body.timestamp);
    const requireNonce = readBoolEnv('VPS_REQUIRE_INTENT_ACTION_NONCE', false);

    if (!userAddress || !signature || !Number.isFinite(timestamp)) {
      throw new IntentLifecycleError('INVALID_SIGNATURE_PAYLOAD', 'userAddress, signature and timestamp are required.');
    }
    if (requireNonce && !nonce) {
      throw new IntentLifecycleError('INVALID_SIGNATURE_PAYLOAD', 'nonce is required.');
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
        nonce,
        reason,
        srcTxHash,
        replacementTxHash,
      });
      const recovered = getAddress(verifyMessage(message, signature));
      if (recovered !== normalized) {
        throw new IntentLifecycleError('INVALID_SIGNATURE', 'Wallet signature does not match the provided address.', 401);
      }

      return {
        userAddress: normalized,
        reason,
        srcTxHash,
        replacementTxHash,
        actionId: nonce ? buildIntentActionId(action, {
          intentId,
          userAddress: normalized,
          timestamp,
          nonce,
          reason,
          srcTxHash,
          replacementTxHash,
        }) : undefined,
      };
    } catch (err) {
      if (err instanceof IntentLifecycleError) throw err;
      throw new IntentLifecycleError('INVALID_SIGNATURE', 'Unable to verify wallet signature.', 401);
    }
  }

  function parseLayerZeroValueTransferApiTokensRequest(query: Request['query']): LayerZeroValueTransferApiTokensRequest {
    const transferrableFromChainKey = parseShortText(query.transferrableFromChainKey, 'transferrableFromChainKey', 80, false);
    const transferrableFromTokenAddress = parseShortText(query.transferrableFromTokenAddress, 'transferrableFromTokenAddress', 160, false);
    const nextToken = parseShortText(query.nextToken, 'nextToken', 512, false);
    return {
      ...(transferrableFromChainKey ? { transferrableFromChainKey } : {}),
      ...(transferrableFromTokenAddress ? { transferrableFromTokenAddress } : {}),
      ...(nextToken ? { nextToken } : {}),
    };
  }

  function parseLayerZeroValueTransferApiSignatures(body: unknown): string[] {
    const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const raw = input.signatures;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 8) {
      throw new IntentLifecycleError(
        'INVALID_LAYERZERO_VALUE_TRANSFER_API_SIGNATURES',
        'signatures must be a non-empty array with at most 8 entries.',
      );
    }

    return raw.map((signature, index) =>
      parseShortText(signature, `signatures[${index}]`, 10_000, true)
    );
  }

  function parseLayerZeroValueTransferApiSubmission(body: unknown): { userAddress: string; sourceTxHash: string } {
    const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const userAddress = parseShortText(input.userAddress, 'userAddress', 160, true);
    const sourceTxHash = parseShortText(
      input.sourceTxHash ?? input.sourceSignature,
      'sourceTxHash',
      512,
      true,
    );
    return { userAddress, sourceTxHash };
  }

  function parseShortText(value: unknown, name: string, maxLength: number, required: true): string;
  function parseShortText(value: unknown, name: string, maxLength: number, required: false): string | undefined;
  function parseShortText(value: unknown, name: string, maxLength: number, required: boolean): string | undefined {
    if (Array.isArray(value)) {
      throw new IntentLifecycleError('INVALID_LAYERZERO_VALUE_TRANSFER_API_REQUEST', `${name} must be a string.`);
    }
    if (typeof value !== 'string') {
      if (required) {
        throw new IntentLifecycleError('INVALID_LAYERZERO_VALUE_TRANSFER_API_REQUEST', `${name} is required.`);
      }
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      if (required) {
        throw new IntentLifecycleError('INVALID_LAYERZERO_VALUE_TRANSFER_API_REQUEST', `${name} is required.`);
      }
      return undefined;
    }
    if (trimmed.length > maxLength) {
      throw new IntentLifecycleError('INVALID_LAYERZERO_VALUE_TRANSFER_API_REQUEST', `${name} is too long.`);
    }
    return trimmed;
  }

  async function requireLayerZeroValueTransferApiIntent(intentOrQuoteId: unknown): Promise<Intent> {
    const normalizedId = parseShortText(intentOrQuoteId, 'id', 256, true);
    const intent = /^0x[0-9a-fA-F]{64}$/.test(normalizedId)
      ? (await intentService.getIntent(normalizedId))
        ?? (await intentService.findLayerZeroValueTransferApiIntentByQuoteId(normalizedId))
      : await intentService.findLayerZeroValueTransferApiIntentByQuoteId(normalizedId);

    if (!intent) {
      throw new IntentLifecycleError(
        'LAYERZERO_VALUE_TRANSFER_API_INTENT_NOT_FOUND',
        'LayerZero Value Transfer API intent not found for the provided intent id or quote id.',
        404,
      );
    }
    if (intent.quote.rail !== Rail.LAYERZERO || !intent.quote.layerZeroValueTransferApiQuoteId) {
      throw new IntentLifecycleError(
        'NOT_LAYERZERO_VALUE_TRANSFER_API_INTENT',
        'Intent is not a LayerZero Value Transfer API provider-direct intent.',
        409,
      );
    }
    return intent;
  }

  function requireLayerZeroValueTransferApiQuoteId(intent: Intent): string {
    const quoteId = intent.quote.layerZeroValueTransferApiQuoteId?.trim();
    if (!quoteId) {
      throw new IntentLifecycleError(
        'MISSING_LAYERZERO_VALUE_TRANSFER_API_QUOTE_ID',
        'Intent is missing LayerZero Value Transfer API quote id.',
        409,
      );
    }
    return quoteId;
  }

  function extractLayerZeroValueTransferApiRouteStepTypes(intent: Intent): string[] {
    const execution = intent.quote as unknown as Record<string, unknown>;
    const rawSteps = execution.layerZeroValueTransferApiRouteSteps;
    if (!Array.isArray(rawSteps)) return [];
    return rawSteps
      .map((step) => step && typeof step === 'object' ? String((step as Record<string, unknown>).type ?? '').trim() : '')
      .filter(Boolean)
      .slice(0, 16);
  }

  function writeLayerZeroValueTransferApiError(res: Response, err: unknown): void {
    if (err instanceof IntentLifecycleError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    res.status(502).json({
      error: 'LAYERZERO_VALUE_TRANSFER_API_UNAVAILABLE',
      message: String(err instanceof Error ? err.message : err),
    });
  }

  function offerSetHasProviderDirectOffer(offerSet: { offers?: Array<{ executionMode?: string }> }): boolean {
    return offerSet.offers?.some((offer) => offer.executionMode === 'provider_direct') ?? false;
  }

  function parseComposedOfferSelection(input: any): {
    offerSetId: string;
    primaryTransferOfferId: string;
    gasZipDestinationGasOfferId: string;
  } {
    if (!input || typeof input !== 'object') throw new Error('Invalid payload');
    const offerSetId = typeof input.offerSetId === 'string' ? input.offerSetId.trim() : '';
    const primaryTransferOfferId = typeof input.primaryTransferOfferId === 'string' ? input.primaryTransferOfferId.trim() : '';
    const gasZipDestinationGasOfferId = typeof input.gasZipDestinationGasOfferId === 'string'
      ? input.gasZipDestinationGasOfferId.trim()
      : '';
    if (!offerSetId || !primaryTransferOfferId || !gasZipDestinationGasOfferId) {
      throw new Error('offerSetId, primaryTransferOfferId and gasZipDestinationGasOfferId are required');
    }
    return {
      offerSetId,
      primaryTransferOfferId,
      gasZipDestinationGasOfferId,
    };
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

  function getSourceProvider(chainId: number): ethers.AbstractProvider {
    const existing = providers.get(chainId);
    if (existing) return existing;

    const chain = CHAIN_CONFIGS[chainId];
    if (!chain?.isEVM) {
      throw new IntentLifecycleError(
        'CHAIN_RPC_UNAVAILABLE',
        `No EVM RPC is configured for source chain ${chainId}.`,
        503,
      );
    }

    const provider = 'getProvider' in rpcProviderRegistry
      ? rpcProviderRegistry.getProvider(chainId).asEthersProvider()
      : rpcProviderRegistry.getReadProvider(chainId);
    providers.set(chainId, provider);
    return provider;
  }

  function buildComposedTracking(primaryIntentId: string, gasZipIntentId: string) {
    const composedIntentId = ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'bytes32'], [primaryIntentId, gasZipIntentId]),
    );
    return {
      composedIntentId,
      primaryTransferIntentId: primaryIntentId,
      gasZipDestinationGasIntentId: gasZipIntentId,
      statusPath: `${STATUS_API_VERSION_PREFIX}/intent/composed/${primaryIntentId}/${gasZipIntentId}`,
    };
  }

  function composeIntentStatus(
    primaryStatus: IntentStatus,
    gasZipStatus: IntentStatus,
  ): ComposedIntentStatus {
    const statuses = [primaryStatus, gasZipStatus];
    if (statuses.every((status) => status === IntentStatus.CANCELLED)) return 'CANCELLED';
    if (statuses.includes(IntentStatus.RECOVERING)) return 'RECOVERING';
    if (statuses.includes(IntentStatus.STUCK)) return 'STUCK';
    if (statuses.every((status) => status === IntentStatus.SETTLED)) return 'SETTLED';
    if (statuses.includes(IntentStatus.FAILED)) {
      return statuses.includes(IntentStatus.SETTLED) ? 'PARTIALLY_FAILED' : 'FAILED';
    }
    if (statuses.includes(IntentStatus.SETTLED)) return 'PARTIALLY_SETTLED';
    if (statuses.includes(IntentStatus.IN_TRANSIT) || statuses.includes(IntentStatus.DESTINATION_RECEIVED)) return 'IN_TRANSIT';
    if (statuses.includes(IntentStatus.SUBMITTED)) return 'SUBMITTED';
    return 'QUOTED';
  }

  function handleLifecycleError(res: Response, err: unknown): void {
    if (err instanceof IntentLifecycleError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    console.error('[StatusAPI] request failed', err);
    res.status(500).json({ error: 'INTERNAL', message: 'Unexpected server error.' });
  }

  async function claimIntentAction(actionId: string): Promise<boolean> {
    if (idempotency) {
      const lease = await idempotency.acquire('admin:refund', actionId, SIGNATURE_WINDOW_MS + 5_000);
      return lease.acquired;
    }
    return intentActionReplayStore.claim(actionId, SIGNATURE_WINDOW_MS);
  }

  async function releaseIntentAction(actionId: string): Promise<void> {
    if (idempotency) {
      await idempotency.release('admin:refund', actionId);
      return;
    }
    intentActionReplayStore.release(actionId);
  }

  function buildAgentExecutionContext(req: Request) {
    const body = req.body && typeof req.body === 'object'
      ? req.body as Record<string, unknown>
      : {};
    return {
      partnerId: readOptionalString(body.partnerId),
      integratorId: readOptionalString(body.integratorId),
      agentId: readOptionalString(body.agentId),
      solverId: readOptionalString(body.solverId),
      routeSource: 'agent-sdk' as const,
      requestId: typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
      receivedAt: Date.now(),
      rpcProviders: parseRpcOverrides(body.rpcProviders),
    };
  }

  function parseIntentBasket(value: unknown): IntentBasket {
    if (!value || typeof value !== 'object') throw new Error('basket payload required');
    const raw = value as Record<string, unknown>;
    const mode = readOptionalString(raw.mode) as IntentBasket['mode'] | undefined;
    const inputs = Array.isArray(raw.inputs) ? raw.inputs.map((entry) => parseBasketInput(entry)) : [];
    const outputs = Array.isArray(raw.outputs) ? raw.outputs.map((entry) => parseBasketOutput(entry)) : [];
    const constraints = raw.constraints && typeof raw.constraints === 'object'
      ? raw.constraints as Record<string, unknown>
      : {};
    return {
      basketId: readOptionalString(raw.basketId),
      mode: mode ?? 'multi-to-one',
      inputs,
      outputs,
      constraints: {
        slippageBps: typeof constraints.slippageBps === 'number' ? constraints.slippageBps : undefined,
        deadlineSeconds: typeof constraints.deadlineSeconds === 'number' ? constraints.deadlineSeconds : undefined,
        maxLegs: typeof constraints.maxLegs === 'number' ? constraints.maxLegs : undefined,
      },
    };
  }

  function parseBasketInput(value: unknown): IntentBasket['inputs'][number] {
    if (!value || typeof value !== 'object') throw new Error('basket input must be an object');
    const raw = value as Record<string, unknown>;
    return {
      chainId: parsePositiveInt(raw.chainId, 'input.chainId'),
      token: readRequiredString(raw.token, 'input.token'),
      amount: parseBigIntString(raw.amount, 'input.amount'),
      wallet: readRequiredString(raw.wallet, 'input.wallet'),
      decimals: typeof raw.decimals === 'number' ? raw.decimals : undefined,
      slippageBps: typeof raw.slippageBps === 'number' ? raw.slippageBps : undefined,
    };
  }

  function parseBasketOutput(value: unknown): IntentBasket['outputs'][number] {
    if (!value || typeof value !== 'object') throw new Error('basket output must be an object');
    const raw = value as Record<string, unknown>;
    return {
      chainId: parsePositiveInt(raw.chainId, 'output.chainId'),
      token: readRequiredString(raw.token, 'output.token'),
      decimals: typeof raw.decimals === 'number' ? raw.decimals : undefined,
      allocationBps: typeof raw.allocationBps === 'number' ? raw.allocationBps : undefined,
      fixedAmount: readOptionalString(raw.fixedAmount),
      recipient: readOptionalString(raw.recipient),
      nativeAddress: readOptionalString(raw.nativeAddress),
    };
  }

  function parseWalletScanRequest(value: unknown): { wallet: string; chainIds: number[]; tokensByChain?: Record<number, string[]> } {
    if (!value || typeof value !== 'object') throw new Error('wallet scan payload required');
    const raw = value as Record<string, unknown>;
    const chainIds = parseNumberArray(raw.chainIds);
    if (chainIds.length === 0) throw new Error('chainIds must contain at least one chain');
    return {
      wallet: readRequiredString(raw.wallet, 'wallet'),
      chainIds,
      tokensByChain: parseTokensByChain(raw.tokensByChain),
    };
  }

  function parseWalletLiquidationRequest(value: unknown) {
    if (!value || typeof value !== 'object') throw new Error('wallet liquidation payload required');
    const raw = value as Record<string, unknown>;
    const target = raw.target;
    if (!target || typeof target !== 'object') throw new Error('target required');
    const targetRaw = target as Record<string, unknown>;
    return {
      wallet: readRequiredString(raw.wallet, 'wallet'),
      chainIds: parseNumberArray(raw.chainIds),
      tokensByChain: parseTokensByChain(raw.tokensByChain),
      minBalanceWei: readOptionalString(raw.minBalanceWei),
      slippageBps: typeof raw.slippageBps === 'number' ? raw.slippageBps : undefined,
      target: {
        chainId: parsePositiveInt(targetRaw.chainId, 'target.chainId'),
        token: readRequiredString(targetRaw.token, 'target.token'),
        recipient: readOptionalString(targetRaw.recipient),
        nativeAddress: readOptionalString(targetRaw.nativeAddress),
      },
    };
  }

  function parseErc7683Order(value: unknown): Erc7683Order {
    if (!value || typeof value !== 'object') throw new Error('erc7683 order payload required');
    return value as Erc7683Order;
  }

  function parseSolverRegistration(value: unknown) {
    if (!value || typeof value !== 'object') throw new Error('solver registration payload required');
    const raw = value as Record<string, unknown>;
    return {
      id: readRequiredString(raw.id, 'id'),
      type: readRequiredString(raw.type, 'type') as SolverType,
      displayName: readRequiredString(raw.displayName, 'displayName'),
      contactEmail: readOptionalString(raw.contactEmail),
      capabilities: raw.capabilities && typeof raw.capabilities === 'object'
        ? raw.capabilities as Record<string, unknown>
        : {},
      reliability: raw.reliability && typeof raw.reliability === 'object'
        ? raw.reliability as Record<string, unknown>
        : undefined,
      active: Boolean(raw.active),
    };
  }

  function parseNumberArray(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry > 0);
  }

  function parseTokensByChain(value: unknown): Record<number, string[]> | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const out: Record<number, string[]> = {};
    for (const [chainId, tokens] of Object.entries(value as Record<string, unknown>)) {
      if (!Array.isArray(tokens)) continue;
      const parsed = tokens
        .map((entry) => readOptionalString(entry))
        .filter((entry): entry is string => Boolean(entry));
      if (parsed.length) out[Number(chainId)] = parsed;
    }
    return Object.keys(out).length ? out : undefined;
  }

  function parseRpcOverrides(value: unknown) {
    if (!value || typeof value !== 'object') return undefined;
    const out: Record<number, string> = {};
    for (const [chainId, url] of Object.entries(value as Record<string, unknown>)) {
      if (typeof url !== 'string' || !url.trim()) continue;
      out[Number(chainId)] = url.trim();
    }
    return Object.keys(out).length ? out : undefined;
  }

  function readOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  function readRequiredString(value: unknown, field: string): string {
    const parsed = readOptionalString(value);
    if (!parsed) throw new Error(`${field} is required`);
    return parsed;
  }

  function parsePositiveInt(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} must be a positive integer`);
    return parsed;
  }

  function parseBigIntString(value: unknown, field: string): string {
    const normalized = typeof value === 'string' ? value.trim() : String(value ?? '');
    if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
      throw new Error(`${field} must be a positive integer string`);
    }
    return normalized;
  }

  async function assertActiveSolver(
    repo: SolversRepository | undefined,
    solverId: string | undefined,
  ): Promise<void> {
    if (!repo || !solverId) return;
    const solver = await repo.get(solverId);
    if (!solver) throw new Error(`solver ${solverId} is not registered`);
    if (!solver.active) throw new Error(`solver ${solverId} is not active`);
  }
}
