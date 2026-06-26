import express, { Request, Response, NextFunction } from 'express';
import { buildAdminAPI } from '../api/AdminAPI';
import { buildStatusAPI } from '../api/StatusAPI';
import { metrics, metricsMiddleware, requestIdMiddleware } from './observability';
import type { RuntimeContext } from './runtime';

export function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readTrustProxy(): boolean | number {
  const raw = process.env.VPS_TRUST_PROXY;
  if (!raw) return true;

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : true;
}

export function buildVpsApiApp(runtime: RuntimeContext): express.Application {
  const app = buildStatusAPI(runtime.intentService, runtime.quoteEngine, {
    idempotency: runtime.idempotency,
    rpcProviderRegistry: runtime.rpcProviderRegistry,
    basketQuoteEngine: runtime.basketQuoteEngine,
    basketStatusEngine: runtime.basketStatusEngine,
    walletScanner: runtime.walletScanner,
    walletLiquidator: runtime.walletLiquidator,
    erc7683Adapter: runtime.erc7683Adapter,
    solversRepository: runtime.solversRepository,
  });

  app.set('trust proxy', readTrustProxy());
  app.use(requestIdMiddleware());
  app.use(metricsMiddleware());
  app.use('/admin', buildAdminAPI(runtime.intentService, runtime.reliability, runtime.usdOracle, {
    partnerRepository: runtime.partnerRepository,
  }));
  mountMetrics(app);
  return app;
}

export function buildPartnerApiApp(runtime: RuntimeContext): express.Application {
  if (!runtime.partnerApiRouter) {
    throw new Error('Partner API runtime is not enabled. Start with enablePartnerApi=true or ENABLE_PARTNER_API=true.');
  }

  const app = express();
  app.set('trust proxy', readTrustProxy());
  app.use(createCorsMiddleware('PARTNER_API_CORS_ORIGIN'));
  app.use(express.json({ limit: process.env.PARTNER_API_JSON_LIMIT ?? process.env.VPS_JSON_LIMIT ?? '32kb' }));
  app.use(requestIdMiddleware());
  app.use(metricsMiddleware());
  app.use('/partner', runtime.partnerApiRouter);
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'partner-api', ts: Date.now() });
  });
  mountMetrics(app);
  return app;
}

function mountMetrics(app: express.Application): void {
  app.get('/metrics', (_req, res) => {
    res.setHeader('content-type', 'text/plain; version=0.0.4');
    res.send(metrics.render());
  });
}

function createCorsMiddleware(envName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const allowed = parseAllowedOrigins(process.env[envName]);

    if (origin && (allowed.has('*') || allowed.has(origin))) {
      res.setHeader('Access-Control-Allow-Origin', allowed.has('*') ? '*' : origin);
      if (!allowed.has('*')) res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'accept,content-type,x-api-key,x-request-id');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

function parseAllowedOrigins(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}
