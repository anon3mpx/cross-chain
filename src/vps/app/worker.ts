import { buildRuntime } from './runtime';

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main(): Promise<void> {
  const runtime = await buildRuntime({
    enableEventMonitor: true,
    enableRecovery: true,
  });

  const intervalMs = readInt('RECOVERY_INTERVAL_MS', 30_000);
  runtime.recoveryEngine?.start(intervalMs);

  console.log('[VPS Worker] event monitor + recovery engine running');

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[VPS Worker] shutting down due to ${signal}`);
    await runtime.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((err) => {
  console.error('[VPS Worker] fatal error', err);
  process.exit(1);
});
