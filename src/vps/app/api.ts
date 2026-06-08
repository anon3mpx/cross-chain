import { buildAdminAPI } from '../api/AdminAPI';
import { buildStatusAPI } from '../api/StatusAPI';
import { buildRuntime } from './runtime';
import { metrics, metricsMiddleware, requestIdMiddleware } from './observability';

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readTrustProxy(): boolean | number {
  const raw = process.env.VPS_TRUST_PROXY;
  if (!raw) return true;

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : true;
}

async function main(): Promise<void> {
  const runtime = await buildRuntime({
    enableEventMonitor: false,
    enableRecovery: false,
  });

  const app = buildStatusAPI(runtime.intentService, runtime.quoteEngine, {
    idempotency: runtime.idempotency,
  });
  app.set('trust proxy', readTrustProxy());
  app.use(requestIdMiddleware());
  app.use(metricsMiddleware());
  if (runtime.partnerApiRouter) {
    app.use('/partner', runtime.partnerApiRouter);
  }
  app.use('/admin', buildAdminAPI(runtime.intentService, runtime.reliability, runtime.usdOracle));
  app.get('/metrics', (_req, res) => {
    res.setHeader('content-type', 'text/plain; version=0.0.4');
    res.send(metrics.render());
  });

  const host = process.env.VPS_API_HOST ?? '0.0.0.0';
  const port = readInt('VPS_API_PORT', 8787);

  const server = app.listen(port, host, () => {
    console.log(`[VPS API] listening on http://${host}:${port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[VPS API] shutting down due to ${signal}`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((err) => {
  console.error('[VPS API] fatal error', err);
  process.exit(1);
});
