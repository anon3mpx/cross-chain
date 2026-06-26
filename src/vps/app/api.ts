import { buildRuntime } from './runtime';
import { buildVpsApiApp, readInt } from './http';

async function main(): Promise<void> {
  const runtime = await buildRuntime({
    enableEventMonitor: false,
    enableRecovery: false,
    enablePartnerApi: false,
  });

  const app = buildVpsApiApp(runtime);

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
