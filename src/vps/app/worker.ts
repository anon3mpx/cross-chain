import { buildRuntime } from './runtime';

function isRetryableInfraError(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code)
    : '';
  const message = err instanceof Error ? err.message : String(err);
  const text = `${code} ${message}`.toLowerCase();

  return code === 'SERVER_ERROR'
    || code === 'TIMEOUT'
    || code === 'NETWORK_ERROR'
    || text.includes('429')
    || text.includes('too many requests')
    || text.includes('rate limit')
    || text.includes('exceeded maximum retry limit')
    || text.includes('timeout')
    || text.includes('network')
    || text.includes('filter not found')
    || text.includes('failed to marshal batch response')
    || text.includes('could not coalesce error');
}

function errorSummary(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/\s+/g, ' ').slice(0, 220);
  return String(err).replace(/\s+/g, ' ').slice(0, 220);
}

function installProviderErrorGuards(): void {
  const handle = (kind: string, err: unknown): void => {
    if (isRetryableInfraError(err)) {
      console.warn(`[VPS Worker] retryable provider ${kind}; continuing: ${errorSummary(err)}`);
      return;
    }

    console.error(`[VPS Worker] fatal ${kind}`, err);
    process.exit(1);
  };

  process.on('unhandledRejection', (err) => handle('rejection', err));
  process.on('uncaughtException', (err) => handle('exception', err));
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main(): Promise<void> {
  installProviderErrorGuards();

  const enableEventMonitor = readBool('ENABLE_EVENT_MONITOR', true);
  const enableRecovery = readBool('ENABLE_RECOVERY_ENGINE', true);
  const enableCctpRelay = readBool('ENABLE_CCTP_RELAY', true);

  const runtime = await buildRuntime({
    enableEventMonitor,
    enableRecovery,
    enableCctpRelay,
  });

  const intervalMs = readInt('RECOVERY_INTERVAL_MS', 30_000);
  runtime.recoveryEngine?.start(intervalMs);

  console.log(
    `[VPS Worker] running eventMonitor=${enableEventMonitor} recovery=${enableRecovery} rails="${runtime.railExecutionManager.describe()}"`,
  );

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
