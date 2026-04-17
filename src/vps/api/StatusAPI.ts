// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Status API
// Lightweight Express REST API for frontend / SDK to poll intent status.
// No auth needed — intentId is a random bytes32 hex ID.
// ─────────────────────────────────────────────────────────

import express, { Request, Response } from 'express';
import { IntentEngine } from '../services/IntentEngine';
import { QuoteEngine } from '../services/QuoteEngine';
import { buildRouterIntegration } from '../services/IntentCalldataBuilder';
import { IntentStatus } from '../types';
import { parseQuoteRequest, serializeQuote } from './quoteCodec';

export function buildStatusAPI(
  intentEngine: IntentEngine,
  quoteEngine: QuoteEngine,
): express.Application {
  const app = express();
  app.use(express.json());

  // ── GET /quote ─────────────────────────────────────────────────────────────
  // Returns a full quote with intentId. Frontend uses this to build the tx.
  app.post('/quote', async (req: Request, res: Response) => {
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
      const intent = intentEngine.create(quote, quoteReq.userAddress);
      const integration = buildRouterIntegration(intent.intentId, quote, quoteReq.userAddress);
      res.json({ quote: serializeQuote(quote), intentId: intent.intentId, integration });
    } catch (err) {
      const msg = String(err);
      const code = msg.toLowerCase().includes('calldata') || msg.toLowerCase().includes('routerv1') ? 503 : 400;
      res.status(code).json({ error: msg });
    }
  });

  // ── GET /intent/:id ────────────────────────────────────────────────────────
  // Poll this for intent status. Frontend shows progress to user.
  app.get('/intent/:id', (req: Request, res: Response) => {
    const intent = intentEngine.get(String(req.params.id));
    if (!intent) return res.status(404).json({ error: 'Intent not found' });

    res.json({
      intentId:    intent.intentId,
      status:      intent.status,
      srcTxHash:   intent.srcTxHash,
      dstTxHash:   intent.dstTxHash,
      railTxId:    intent.railTxId,
      rail:        intent.quote.rail,
      etaSeconds:  intent.quote.etaSeconds,
      createdAt:   intent.createdAt,
      updatedAt:   intent.updatedAt,
      errorMessage: intent.errorMessage,
    });
  });

  // ── GET /health ────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    const counts = Object.values(IntentStatus).reduce((acc, s) => {
      acc[s] = intentEngine.getByStatus(s as IntentStatus).length;
      return acc;
    }, {} as Record<string, number>);

    res.json({ ok: true, intents: counts, ts: Date.now() });
  });

  return app;
}
