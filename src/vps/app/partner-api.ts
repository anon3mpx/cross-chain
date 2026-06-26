import { buildRuntime } from './runtime';
import { buildPartnerApiApp, readInt } from './http';

async function main(): Promise<void> {
  const runtime = await buildRuntime({
    enableEventMonitor: false,
    enableRecovery: false,
    enablePartnerApi: true,
  });

  const app = buildPartnerApiApp(runtime);
  const host = process.env.PARTNER_API_HOST ?? process.env.VPS_API_HOST ?? '0.0.0.0';
  const port = readInt('PARTNER_API_PORT', readInt('VPS_PARTNER_API_PORT', 8788));

  const server = app.listen(port, host, () => {
    console.log(`[Partner API] listening on http://${host}:${port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Partner API] shutting down due to ${signal}`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((err) => {
  console.error('[Partner API] fatal error', err);
  process.exit(1);
});

