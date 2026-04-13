import { CHAIN_CONFIGS } from '../config/chains';
import { attachPostgresIntentPersistence, PostgresIntentPersistence } from '../db/bootstrap';
import { buildPartnerAPI, setupWebhookPush } from '../api/PartnerAPI';
import { ApiKeyManager } from '../services/ApiKeyManager';
import { EventMonitor } from '../services/EventMonitor';
import { IntentEngine } from '../services/IntentEngine';
import { QuoteEngine } from '../services/QuoteEngine';
import { RailSelector } from '../services/RailSelector';
import { RecoveryEngine } from '../services/RecoveryEngine';
import { createQuoteCacheFromEnv, QuoteCache } from '../cache/QuoteCache';
import { registerDexQuoteAdapters } from '../bootstrap/dexAdapters';

export interface RuntimeOptions {
  enableEventMonitor?: boolean;
  enableRecovery?: boolean;
  enablePostgres?: boolean;
  enablePartnerApi?: boolean;
}

export interface RuntimeContext {
  intentEngine: IntentEngine;
  quoteEngine: QuoteEngine;
  eventMonitor?: EventMonitor;
  recoveryEngine?: RecoveryEngine;
  apiKeyManager?: ApiKeyManager;
  partnerApiRouter?: ReturnType<typeof buildPartnerAPI>;
  postgres?: PostgresIntentPersistence;
  close(): Promise<void>;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function shouldEnablePostgres(): boolean {
  if (process.env.DATABASE_URL) return true;
  return !!process.env.PGHOST && !!process.env.PGDATABASE;
}

export async function buildRuntime(options: RuntimeOptions = {}): Promise<RuntimeContext> {
  const enableEventMonitor = options.enableEventMonitor ?? envBool('ENABLE_EVENT_MONITOR', false);
  const enableRecovery = options.enableRecovery ?? envBool('ENABLE_RECOVERY_ENGINE', false);
  const enablePartnerApi = options.enablePartnerApi ?? envBool('ENABLE_PARTNER_API', false);
  const enablePostgres = options.enablePostgres ?? shouldEnablePostgres();

  const intentEngine = new IntentEngine();
  const quoteCache: QuoteCache = await createQuoteCacheFromEnv(process.env);
  const quoteEngine = new QuoteEngine(quoteCache);
  registerDexQuoteAdapters(quoteEngine, process.env);

  const rails = new RailSelector();
  const recoveryEngine = enableRecovery
    ? new RecoveryEngine(
        intentEngine,
        rails,
        async (intent, fallbackRail) => {
          // Recovery resubmission executor hook.
          // Replace this with your relayer queue producer when settlement flow is wired.
          intentEngine.markInTransit(
            intent.intentId,
            `fallback:${fallbackRail}:${Date.now()}`,
          );
        },
      )
    : undefined;

  const eventMonitor = enableEventMonitor ? new EventMonitor(intentEngine) : undefined;
  if (eventMonitor) {
    for (const chain of Object.values(CHAIN_CONFIGS)) {
      if (!chain.isEVM) continue;
      if (!chain.rpcUrl) continue;
      if (!chain.routerV1 && !chain.receiverV1) continue;
      eventMonitor.addChain(chain);
    }
  }

  const postgres = enablePostgres
    ? attachPostgresIntentPersistence(intentEngine, {
        onError: (err, context) => {
          console.error('[IntentPersistence] error', context, err);
        },
      })
    : undefined;

  const apiKeyManager = enablePartnerApi ? new ApiKeyManager() : undefined;
  const partnerApiRouter = apiKeyManager
    ? buildPartnerAPI(apiKeyManager, intentEngine, quoteEngine)
    : undefined;
  if (apiKeyManager) {
    setupWebhookPush(intentEngine, apiKeyManager);
  }

  return {
    intentEngine,
    quoteEngine,
    eventMonitor,
    recoveryEngine,
    postgres,
    apiKeyManager,
    partnerApiRouter,
    async close() {
      try {
        recoveryEngine?.stop();
      } catch (err) {
        console.warn('[Runtime] recovery stop failed', err);
      }
      try {
        eventMonitor?.stop();
      } catch (err) {
        console.warn('[Runtime] monitor stop failed', err);
      }
      try {
        await postgres?.pool.end();
      } catch (err) {
        console.warn('[Runtime] postgres close failed', err);
      }
      try {
        await quoteCache.close();
      } catch (err) {
        console.warn('[Runtime] cache close failed', err);
      }
    },
  };
}
