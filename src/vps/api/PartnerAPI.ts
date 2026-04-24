// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Partner API
// Registration is public; all operational endpoints require an API key.
// ─────────────────────────────────────────────────────────
import express, { Request, Response, NextFunction } from 'express';
import { ApiKeyManager, PartnerTier } from '../services/ApiKeyManager';
import { IntentEngine } from '../services/IntentEngine';
import { IntentService } from '../services/IntentService';
import { QuoteEngine } from '../services/QuoteEngine';
import { buildRouterIntegration } from '../services/IntentCalldataBuilder';
import { Intent } from '../types';
import { parseOfferSelection, parseQuoteRequest, serializeOfferSet, serializeQuote } from './quoteCodec';
import { getRailVariantLabel } from '../rails/registry';

export function buildPartnerAPI(
  keyManager: ApiKeyManager,
  intentService: IntentService,
  quoteEngine: QuoteEngine,
): express.Router {
  const router = express.Router();

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

      const offerSet = await quoteEngine.getOffers(quoteReq);
      if (!offerSet) {
        return res.status(400).json({ error: 'NO_ROUTE', message: 'No route available for this chain pair and token combination' });
      }
      const quote = await quoteEngine.getQuote(quoteReq);
      const bestFeeAmountToken = quote?.feeAmountToken ?? 0n;
      const { partnerRebate } = keyManager.splitFee(bestFeeAmountToken, check.partner);

      res.json({
        offerSet: serializeOfferSet(offerSet),
        ...(quote ? { quote: serializeQuote(quote) } : {}),
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

      const intent = await intentService.createQuotedIntentFromOffer(selection.offer, userAddress, apiKey);
      const { partnerRebate } = keyManager.splitFee(intent.quote.feeAmountToken, check.partner);
      const integration = await buildRouterIntegration(intent.intentId, intent.quote, userAddress);

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
