// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Partner API
// Registration is public; all operational endpoints require an API key.
// ─────────────────────────────────────────────────────────
import express, { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { ApiKeyManager, PartnerTier } from '../services/ApiKeyManager';
import { IntentEngine } from '../services/IntentEngine';
import { IntentService } from '../services/IntentService';
import { QuoteEngine } from '../services/QuoteEngine';
import { buildSelectedOfferIntegration } from '../services/DirectRailIntegrationBuilder';
import { Intent } from '../types';
import { parseOfferSelection, parseQuoteRequest, serializeGasZipComposition, serializeOfferSet, serializeQuote } from './quoteCodec';
import { getRailVariantLabel } from '../rails/registry';
import { RpcProviderRegistry } from '../services/RpcProviderRegistry';
import { SwapAdapter, isSwapSdkChain } from '../sdk/swapAdapter';
import type { ExecutionContext, RpcProviderOverrides } from '../core/ExecutionContext';
import type { IdempotencyStore } from '../db/IdempotencyStore';
import { DestinationGasAutoFund } from '../services/DestinationGasAutoFund';
import { NativeUsdOracle } from '../services/NativeUsdOracle';
import type { BasketQuoteEngine } from '../services/BasketQuoteEngine';
import type { BasketStatusEngine } from '../services/BasketStatusEngine';
import type { WalletScanner } from '../services/WalletScanner';
import type { WalletLiquidator } from '../services/WalletLiquidator';
import type { Erc7683Adapter, Erc7683Order } from '../services/Erc7683Adapter';
import type { SolversRepository, SolverType } from '../db/SolversRepository';
import type { IntentBasket } from '../core/IntentBasket';

interface PlatformSurfaceOptions {
  basketQuoteEngine?: BasketQuoteEngine;
  basketStatusEngine?: BasketStatusEngine;
  walletScanner?: WalletScanner;
  walletLiquidator?: WalletLiquidator;
  erc7683Adapter?: Erc7683Adapter;
  solversRepository?: SolversRepository;
}

export function buildPartnerAPI(
  keyManager: ApiKeyManager,
  intentService: IntentService,
  quoteEngine: QuoteEngine,
  rpcRegistry: RpcProviderRegistry,
  idempotency?: IdempotencyStore,
  platform: PlatformSurfaceOptions = {},
): express.Router {
  const router = express.Router();
  const swapAdapter = new SwapAdapter({ registry: rpcRegistry });
  const usdOracle = new NativeUsdOracle({ swapAdapter });
  const autoFund = new DestinationGasAutoFund({ registry: rpcRegistry, oracle: usdOracle });

  // ── POST /partner/register ─────────────────────────────────────────────────
  // Self-service registration — returns apiKey + webhookSecret.
  // In production this would require email verification.
  router.post('/register', (req: Request, res: Response) => {
    const { name, contactEmail, payoutAddress, webhookUrl } = req.body;
    if (!name || !contactEmail) {
      return res.status(400).json({ error: 'name and contactEmail required' });
    }
    const partner = keyManager.registerPartner({
      name, contactEmail, payoutAddress, webhookUrl,
      tier: PartnerTier.FREE,
      feeShareBps: 0,
      quotesPerMin: 60,
      maxTxPerDay: 500,
      active: true,
    });
    res.status(201).json({
      apiKey:        partner.apiKey,
      webhookSecret: partner.webhookSecret,  // Show ONCE — partner must store this
      tier:          partner.tier,
      limits: {
        quotesPerMin: partner.quotesPerMin,
        maxTxPerDay:  partner.maxTxPerDay,
        feeShareBps:  partner.feeShareBps,
      },
      message: 'Store webhookSecret securely — it will not be shown again.',
    });
  });

  // ── Auth middleware — mandatory, no fallback ───────────────────────────────
  const requireKey = (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['x-api-key'] as string | undefined;
    if (!key) {
      return res.status(401).json({
        error: 'UNREGISTERED',
        message: 'API key required. Register at https://ruflo.io/developers',
      });
    }
    (req as any).apiKey = key;
    next();
  };
  router.use(requireKey);

  // ── POST /partner/quote ────────────────────────────────────────────────────
  router.post('/quote', async (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey;
    const check  = keyManager.checkQuote(apiKey);
    if (!check.allowed) {
      if (check.reason === 'RATE_LIMIT') res.set('Retry-After', '60');
      return res.status(check.reason === 'UNREGISTERED' || check.reason === 'INVALID_KEY' ? 401 : 429).json({
        error: check.reason,
        message: LIMIT_MESSAGES[check.reason],
      });
    }

    try {
      const quoteReq = parseQuoteRequest(req.body, 'normal');

      // Input validation
      if (!quoteReq.tokenIn || !quoteReq.tokenOut) return res.status(400).json({ error: 'tokenIn and tokenOut required' });
      if (!Number.isFinite(quoteReq.srcChainId) || !Number.isFinite(quoteReq.dstChainId)) {
        return res.status(400).json({ error: 'srcChainId and dstChainId required' });
      }
      if (!quoteReq.userAddress) return res.status(400).json({ error: 'userAddress required' });

      const effectiveReq = {
        ...quoteReq,
        autoFundDestinationGas: parseAutoFundRequest(req.body),
      };
      const destinationGasResolution = await autoFund.resolveDetailed(
        effectiveReq,
        buildExecutionContext(req, check.partner.apiKey),
      );
      const requestWithDestinationGas = {
        ...effectiveReq,
        destinationGas: destinationGasResolution.destinationGas,
      };

      const offerSet = await quoteEngine.getOffers(requestWithDestinationGas);
      if (!offerSet) {
        return res.status(400).json({ error: 'NO_ROUTE', message: 'No route available for this chain pair and token combination' });
      }
      const quote = await quoteEngine.getQuote(requestWithDestinationGas);
      const gasZipComposition = offerSet
        ? quoteEngine.buildGasZipComposition(requestWithDestinationGas, offerSet)
        : null;
      const bestFeeAmountToken = quote?.feeAmountToken ?? 0n;
      const { partnerRebate } = keyManager.splitFee(bestFeeAmountToken, check.partner);

      res.json({
        offerSet: serializeOfferSet(offerSet),
        ...(quote ? { quote: serializeQuote(quote) } : {}),
        destinationGasDecision: destinationGasResolution.decision,
        ...(gasZipComposition ? { gasZipComposition: serializeGasZipComposition(gasZipComposition) } : {}),
        partnerEarnings: {
          rebatePerTx:   partnerRebate.toString(),
          feeShareBps:   check.partner.feeShareBps,
          claimableNow:  keyManager.getRebateSummary(apiKey).totalUSDC,
        },
      });
    } catch (err) {
      const msg = String(err);
      const code = msg.toLowerCase().includes('amountin')
        || msg.toLowerCase().includes('payload')
        || msg.toLowerCase().includes('calldata')
        || msg.toLowerCase().includes('routerv1')
        ? 400
        : 500;
      res.status(code).json({ error: code === 400 ? 'INVALID_REQUEST' : 'INTERNAL', message: msg });
    }
  });

  router.post('/swap-single-chain', async (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey;
    const check = keyManager.checkQuote(apiKey);
    if (!check.allowed) {
      if (check.reason === 'RATE_LIMIT') res.set('Retry-After', '60');
      return res.status(check.reason === 'UNREGISTERED' || check.reason === 'INVALID_KEY' ? 401 : 429).json({
        error: check.reason,
        message: LIMIT_MESSAGES[check.reason],
      });
    }

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const chainId = numeric(body.chainId, 'chainId');
      const tokenIn = address(body.tokenIn, 'tokenIn');
      const tokenOut = address(body.tokenOut, 'tokenOut');
      const recipient = address(body.recipient, 'recipient');
      const amountIn = bigIntStr(body.amountIn, 'amountIn');
      const slippageBps = clampSlippage(body.slippageBps);

      if (!isSwapSdkChain(chainId)) {
        return res.status(400).json({
          error: 'UNSUPPORTED_CHAIN',
          message: `Chain ${chainId} is not supported for same-chain swaps.`,
        });
      }

      const result = await swapAdapter.swap(
        { chainId, tokenIn, tokenOut, amountIn, recipient, slippageBps },
        buildExecutionContext(req, check.partner.apiKey),
      );
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(400).json({ error: 'INVALID_REQUEST', message: msg });
    }
  });

  router.post('/quote/select', async (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey;
    const check  = keyManager.validateKey(apiKey);
    if (!check.allowed) {
      return res.status(401).json({ error: check.reason });
    }

    try {
      const { offerSetId, offerId } = parseOfferSelection(req.body);
      const userAddress = typeof req.body?.userAddress === 'string' ? req.body.userAddress.trim() : '';
      if (!userAddress) return res.status(400).json({ error: 'userAddress required' });
      if (idempotency) {
        const lease = await idempotency.acquire('offer:select', `${offerSetId}:${offerId}`, 60_000);
        if (!lease.acquired) {
          return res.status(409).json({
            error: 'OFFER_SELECTION_IN_FLIGHT',
            message: 'Another /quote/select call for this offer is in progress. Retry shortly.',
          });
        }
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

      const intent = await intentService.createQuotedIntentFromOffer(selection.offer, userAddress, {
        partnerApiKey: apiKey,
        partnerId: partnerIdFromKey(apiKey),
        integratorId: readOptionalString(req.body?.integratorId),
        agentId: readOptionalString(req.body?.agentId),
        routeSource: 'partner-api',
      });
      const { partnerRebate } = keyManager.splitFee(intent.quote.feeAmountToken, check.partner);
      const selectedIntegration = await buildSelectedOfferIntegration(intent.intentId, selection.offer, userAddress);
      const integration = selectedIntegration.mode === 'router_intent'
        ? selectedIntegration.integration
        : selectedIntegration;

      res.json({
        intentId: intent.intentId,
        quote: serializeQuote(intent.quote),
        partnerEarnings: {
          rebatePerTx: partnerRebate.toString(),
          feeShareBps: check.partner.feeShareBps,
          claimableNow: keyManager.getRebateSummary(apiKey).totalUSDC,
        },
        integration,
      });
    } catch (err) {
      const msg = String(err);
      const code = msg.toLowerCase().includes('amountin')
        || msg.toLowerCase().includes('payload')
        || msg.toLowerCase().includes('calldata')
        || msg.toLowerCase().includes('routerv1')
        ? 400
        : 500;
      res.status(code).json({ error: code === 400 ? 'INVALID_REQUEST' : 'INTERNAL', message: msg });
    }
  });

  router.post('/basket/quote', async (req: Request, res: Response) => {
    if (!platform.basketQuoteEngine) {
      return res.status(503).json({ error: 'BASKETS_UNAVAILABLE' });
    }

    try {
      const apiKey = (req as any).apiKey as string;
      const basket = parseIntentBasket(req.body?.basket ?? req.body);
      const result = await platform.basketQuoteEngine.quote(
        basket,
        buildExecutionContext(req, apiKey),
      );
      if ('error' in result) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/basket/execute', async (req: Request, res: Response) => {
    if (!platform.basketQuoteEngine) {
      return res.status(503).json({ error: 'BASKETS_UNAVAILABLE' });
    }

    try {
      const apiKey = (req as any).apiKey as string;
      const basket = parseIntentBasket(req.body?.basket ?? req.body);
      const userAddress = readOptionalString(req.body?.userAddress) ?? basket.inputs[0]?.wallet;
      if (!userAddress) return res.status(400).json({ error: 'userAddress required' });

      const plan = await platform.basketQuoteEngine.executeBasket(
        basket,
        userAddress,
        {
          partnerApiKey: apiKey,
          partnerId: partnerIdFromKey(apiKey),
          integratorId: readOptionalString(req.body?.integratorId),
          agentId: readOptionalString(req.body?.agentId),
          routeSource: 'partner-api',
        },
        buildExecutionContext(req, apiKey),
        {
          basketId: readOptionalString(req.body?.basketId),
          legIndexes: parseNumberArray(req.body?.legIndexes),
          mode: req.body?.mode === 'multicall' ? 'multicall' : 'sequential',
        },
      );
      if ('error' in plan) {
        return res.status(400).json(plan);
      }
      res.json(plan);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.get('/basket/:id/status', async (req: Request, res: Response) => {
    if (!platform.basketStatusEngine) {
      return res.status(503).json({ error: 'BASKET_STATUS_UNAVAILABLE' });
    }

    try {
      const basketId = String(req.params.id);
      const status = await platform.basketStatusEngine.getStatus(
        basketId,
        partnerIdFromKey((req as any).apiKey as string),
      );
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/wallet/scan', async (req: Request, res: Response) => {
    if (!platform.walletScanner) {
      return res.status(503).json({ error: 'WALLET_SCAN_UNAVAILABLE' });
    }

    try {
      const apiKey = (req as any).apiKey as string;
      const request = parseWalletScanRequest(req.body);
      const result = await platform.walletScanner.scan(request, buildExecutionContext(req, apiKey));
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/wallet/liquidate/quote', async (req: Request, res: Response) => {
    if (!platform.walletLiquidator) {
      return res.status(503).json({ error: 'WALLET_LIQUIDATOR_UNAVAILABLE' });
    }

    try {
      const apiKey = (req as any).apiKey as string;
      const request = parseWalletLiquidationRequest(req.body);
      const result = await platform.walletLiquidator.quote(request, buildExecutionContext(req, apiKey));
      if ('error' in result) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/wallet/liquidate/execute', async (req: Request, res: Response) => {
    if (!platform.walletLiquidator) {
      return res.status(503).json({ error: 'WALLET_LIQUIDATOR_UNAVAILABLE' });
    }

    try {
      const apiKey = (req as any).apiKey as string;
      const request = parseWalletLiquidationRequest(req.body);
      const result = await platform.walletLiquidator.execute(
        request,
        {
          partnerApiKey: apiKey,
          partnerId: partnerIdFromKey(apiKey),
          integratorId: readOptionalString(req.body?.integratorId),
          agentId: readOptionalString(req.body?.agentId),
          routeSource: 'partner-api',
        },
        buildExecutionContext(req, apiKey),
        {
          mode: req.body?.mode === 'multicall' ? 'multicall' : 'sequential',
        },
      );
      if ('error' in result) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/erc7683/resolve', async (req: Request, res: Response) => {
    if (!platform.erc7683Adapter) {
      return res.status(503).json({ error: 'ERC7683_UNAVAILABLE' });
    }

    try {
      const apiKey = (req as any).apiKey as string;
      await assertActiveSolver(platform.solversRepository, readOptionalString(req.body?.solverId));
      const order = parseErc7683Order(req.body);
      const result = await platform.erc7683Adapter.resolve(order, buildExecutionContext(req, apiKey));
      if ('error' in result) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/erc7683/open', async (req: Request, res: Response) => {
    if (!platform.erc7683Adapter) {
      return res.status(503).json({ error: 'ERC7683_UNAVAILABLE' });
    }

    try {
      const apiKey = (req as any).apiKey as string;
      await assertActiveSolver(platform.solversRepository, readOptionalString(req.body?.solverId));
      const order = parseErc7683Order(req.body);
      const result = await platform.erc7683Adapter.open(
        order,
        {
          partnerId: partnerIdFromKey(apiKey),
          integratorId: readOptionalString(req.body?.integratorId),
          agentId: readOptionalString(req.body?.agentId),
          solverId: readOptionalString(req.body?.solverId),
        },
        buildExecutionContext(req, apiKey),
      );
      if ('error' in result) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/solvers/register', async (req: Request, res: Response) => {
    if (!platform.solversRepository) {
      return res.status(503).json({ error: 'SOLVER_REGISTRY_UNAVAILABLE' });
    }

    try {
      const record = await platform.solversRepository.upsert(parseSolverRegistration(req.body));
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.get('/solvers', async (req: Request, res: Response) => {
    if (!platform.solversRepository) {
      return res.status(503).json({ error: 'SOLVER_REGISTRY_UNAVAILABLE' });
    }

    try {
      const type = readOptionalString(req.query.type) as SolverType | undefined;
      const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === '1';
      const records = await platform.solversRepository.listWithStats({ type, activeOnly });
      res.json({ solvers: records });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.post('/solvers/:id/active', async (req: Request, res: Response) => {
    if (!platform.solversRepository) {
      return res.status(503).json({ error: 'SOLVER_REGISTRY_UNAVAILABLE' });
    }

    try {
      const id = String(req.params.id);
      const active = Boolean(req.body?.active);
      await platform.solversRepository.setActive(id, active);
      res.json({ id, active });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // ── GET /partner/intent/:id ────────────────────────────────────────────────
  router.get('/intent/:id', async (req: Request, res: Response) => {
    const check = keyManager.validateKey((req as any).apiKey);
    if (!check.allowed) return res.status(401).json({ error: check.reason });

    const intentId = String(req.params.id);
    const intent = await loadIntent(intentId);
    if (intent === 'unavailable') {
      return res.status(503).json({ error: 'STATUS_UNAVAILABLE' });
    }
    if (!intent) return res.status(404).json({ error: 'NOT_FOUND' });

    res.json({
      intentId:    intent.intentId,
      status:      intent.status,
      srcTxHash:   intent.srcTxHash,
      dstTxHash:   intent.dstTxHash,
      railTxId:    intent.railTxId,
      rail:        intent.quote.rail,
      railVariant: getRailVariantLabel(intent.quote.rail, intent.quote.railPluginId),
      etaSeconds:  intent.quote.etaSeconds,
      settled:     intent.status === 'SETTLED',
      failed:      intent.status === 'FAILED' || intent.status === 'CANCELLED',
      errorMessage: intent.errorMessage,
      canCancel:   intentService.canCancel(intent.status),
      canCancelInWallet: intent.status === 'SUBMITTED' && Boolean(intent.srcTxHash),
      canRequestRefund: intentService.canRequestRefund(intent.status),
      refund:      await intentService.getRefundCase(intent.intentId),
    });
  });

  // ── GET /partner/rebates ───────────────────────────────────────────────────
  // Show accrued rebates per chain — call anytime to check yield.
  router.get('/rebates', (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey;
    const check  = keyManager.validateKey(apiKey);
    if (!check.allowed) return res.status(401).json({ error: check.reason });
    if (check.partner.tier === PartnerTier.FREE) {
      return res.status(403).json({ error: 'UPGRADE_REQUIRED', message: 'Fee sharing available on Growth tier and above.' });
    }
    res.json(keyManager.getRebateSummary(apiKey));
  });

  // ── POST /partner/withdraw ─────────────────────────────────────────────────
  // Pull-based withdrawal: partner calls this to claim their accrued rebate.
  // In production: this triggers an on-chain USDC transfer to partner.payoutAddress.
  router.post('/withdraw', (req: Request, res: Response) => {
    const apiKey  = (req as any).apiKey;
    const check   = keyManager.validateKey(apiKey);
    if (!check.allowed) return res.status(401).json({ error: check.reason });
    if (check.partner.tier === PartnerTier.FREE) {
      return res.status(403).json({ error: 'UPGRADE_REQUIRED' });
    }
    if (!check.partner.payoutAddress) {
      return res.status(400).json({ error: 'NO_PAYOUT_ADDRESS', message: 'Set payoutAddress on your partner profile first.' });
    }

    const chainId = Number(req.body.chainId ?? 1);
    const amount  = keyManager.claimRebate(apiKey, chainId);

    if (amount === 0n) {
      return res.status(200).json({ message: 'No rebate available to claim.', amount: '0' });
    }

    // TODO: Trigger actual on-chain USDC transfer here via your relayer/paymaster
    // await relayer.sendUSDC(check.partner.payoutAddress, amount, chainId);

    res.json({
      claimed:        amount.toString(),
      payoutAddress:  check.partner.payoutAddress,
      chainId,
      message:        `Payout of ${amount} USDC units initiated to ${check.partner.payoutAddress}`,
    });
  });

  // ── POST /partner/webhook/test ─────────────────────────────────────────────
  router.post('/webhook/test', async (req: Request, res: Response) => {
    const check = keyManager.validateKey((req as any).apiKey);
    if (!check.allowed || !check.partner.webhookUrl) {
      return res.status(400).json({ error: 'NO_WEBHOOK_CONFIGURED' });
    }
    const body = JSON.stringify({ event: 'WEBHOOK_TEST', ts: Date.now() });
    const sig  = keyManager.signWebhookPayload((req as any).apiKey, body);
    try {
      const response = await fetch(check.partner.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ruflo-sig': sig },
        body,
      });
      res.json({ ok: response.ok, status: response.status });
    } catch (err) {
      res.status(502).json({ error: 'WEBHOOK_UNREACHABLE', message: String(err) });
    }
  });

  return router;

  async function loadIntent(intentId: string): Promise<Intent | 'unavailable' | undefined> {
    try {
      return (await intentService.getIntent(intentId)) ?? undefined;
    } catch (err) {
      console.error(`[PartnerAPI] failed to load intent ${intentId}`, err);
      return 'unavailable';
    }
  }
}

// ── Webhook push helper ────────────────────────────────────────────────────────
export function setupWebhookPush(intentEngine: IntentEngine, keyManager: ApiKeyManager): void {
  intentEngine.onStateChange(async (intent) => {
    const apiKey = (intent as any).partnerApiKey as string | undefined;
    if (!apiKey) return;
    const result = keyManager.validateKey(apiKey);
    if (!result.allowed || !result.partner.webhookUrl) return;

    const body = JSON.stringify({
      event:     'INTENT_STATUS_CHANGE',
      intentId:  intent.intentId,
      status:    intent.status,
      dstTxHash: intent.dstTxHash,
      ts:        Date.now(),
    });
    const sig = keyManager.signWebhookPayload(apiKey, body);

    try {
      await fetch(result.partner.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ruflo-sig': sig },
        body,
      });
    } catch { /* non-fatal */ }
  });
}

// ── Error messages ─────────────────────────────────────────────────────────────
const LIMIT_MESSAGES: Record<string, string> = {
  UNREGISTERED:   'Register at https://ruflo.io/developers to get an API key.',
  INVALID_KEY:    'API key not found. Check your key or re-register.',
  INACTIVE:       'Your account has been suspended. Contact support.',
  RATE_LIMIT:     'Quote rate limit exceeded. Retry after 60s or upgrade your tier.',
  DAILY_LIMIT:    'Daily transaction limit reached. Resets at UTC midnight or upgrade.',
  ABUSE_DETECTED: 'Unusual quote pattern detected. Contact support if this is in error.',
};

function partnerIdFromKey(apiKey: string): string {
  return `ptn_${createHash('sha256').update(apiKey).digest('hex').slice(0, 24)}`;
}

function buildExecutionContext(req: Request, apiKey: string): ExecutionContext {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    partnerId: partnerIdFromKey(apiKey),
    integratorId: readOptionalString(body.integratorId),
    agentId: readOptionalString(body.agentId),
    solverId: readOptionalString(body.solverId),
    routeSource: 'partner-api',
    requestId: typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
    receivedAt: Date.now(),
    rpcProviders: parseRpcOverrides(body.rpcProviders),
  };
}

function parseAutoFundRequest(input: unknown): { thresholdUsd?: number; topUpUsd?: number; recipient?: string } | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const body = input as Record<string, unknown>;
  const value = body.autoFundDestinationGas;
  if (value !== true && (typeof value !== 'object' || value === null)) return undefined;
  if (value === true) return {};
  const config = value as Record<string, unknown>;
  return {
    thresholdUsd: typeof config.thresholdUsd === 'number' ? config.thresholdUsd : undefined,
    topUpUsd: typeof config.topUpUsd === 'number' ? config.topUpUsd : undefined,
    recipient: readOptionalString(config.recipient),
  };
}

function parseRpcOverrides(input: unknown): RpcProviderOverrides | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: RpcProviderOverrides = {};
  for (const [chainId, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    out[Number(chainId)] = value.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function numeric(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function bigIntStr(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new Error(`${field} must be a positive integer string`);
  }
  return normalized;
}

function address(value: unknown, field: string): string {
  const normalized = readOptionalString(value);
  if (!normalized || !/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error(`${field} must be a valid EVM address`);
  }
  return normalized;
}

function clampSlippage(value: unknown): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(2_000, Math.max(1, Math.round(parsed)));
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
    chainId: numeric(raw.chainId, 'input.chainId'),
    token: readRequiredString(raw.token, 'input.token'),
    amount: bigIntStr(raw.amount, 'input.amount'),
    wallet: readRequiredString(raw.wallet, 'input.wallet'),
    decimals: typeof raw.decimals === 'number' ? raw.decimals : undefined,
    slippageBps: typeof raw.slippageBps === 'number' ? raw.slippageBps : undefined,
  };
}

function parseBasketOutput(value: unknown): IntentBasket['outputs'][number] {
  if (!value || typeof value !== 'object') throw new Error('basket output must be an object');
  const raw = value as Record<string, unknown>;
  return {
    chainId: numeric(raw.chainId, 'output.chainId'),
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
  const wallet = readRequiredString(raw.wallet, 'wallet');
  const chainIds = parseNumberArray(raw.chainIds);
  if (chainIds.length === 0) throw new Error('chainIds must contain at least one chain');
  return {
    wallet,
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
      chainId: numeric(targetRaw.chainId, 'target.chainId'),
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
    type: (readRequiredString(raw.type, 'type') as SolverType),
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
      .map((token) => readOptionalString(token))
      .filter((token): token is string => Boolean(token));
    if (parsed.length) out[Number(chainId)] = parsed;
  }
  return Object.keys(out).length ? out : undefined;
}

function readRequiredString(value: unknown, field: string): string {
  const parsed = readOptionalString(value);
  if (!parsed) throw new Error(`${field} is required`);
  return parsed;
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
