import { CHAIN_CONFIGS } from '../config/chains';
import { createPostgresIntentStore, PostgresIntentStore } from '../db/bootstrap';
import { assertPostgresRailSchemaCompatibility } from '../db/schemaCompatibility';
import { buildPartnerAPI, setupWebhookPush } from '../api/PartnerAPI';
import { NativeUsdOracle } from '../services/NativeUsdOracle';
import { ApiKeyManager } from '../services/ApiKeyManager';
import { EventMonitor } from '../services/EventMonitor';
import { CctpAttestationWorker } from '../services/CctpAttestationWorker';
import { IntentEngine } from '../services/IntentEngine';
import { IntentService } from '../services/IntentService';
import { QuoteEngine } from '../services/QuoteEngine';
import { RailSelector } from '../services/RailSelector';
import { RecoveryEngine } from '../services/RecoveryEngine';
import { THORChainMonitorWorker } from '../services/thorchain/THORChainMonitorWorker';
import { THORChainQuoteWorker } from '../services/thorchain/THORChainQuoteWorker';
import { LayerZeroValueTransferApiQuoteWorker } from '../services/layerzero/LayerZeroValueTransferApiQuoteWorker';
import { LayerZeroValueTransferApiMonitorWorker } from '../services/layerzero/LayerZeroValueTransferApiMonitorWorker';
import { HyperlaneNexusQuoteWorker } from '../services/hyperlane/HyperlaneNexusQuoteWorker';
import { HyperlaneNexusMonitorWorker } from '../services/hyperlane/HyperlaneNexusMonitorWorker';
import { createQuoteCacheFromEnv, QuoteCache } from '../cache/QuoteCache';
import { registerDexQuoteAdapters } from '../bootstrap/dexAdapters';
import { RailExecutionHandle, RailExecutionManager } from '../rails/execution';
import { Rail } from '../types';
import { RpcProviderRegistry } from '../services/RpcProviderRegistry';
import { SwapAdapter } from '../sdk/swapAdapter';
import { PostgresReliabilityRepository, type ReliabilityRepository } from '../db/ReliabilityRepository';
import { ReliabilityRecorder } from '../services/ReliabilityRecorder';
import { RailReliabilityCache } from '../services/RailReliabilityCache';
import { PostgresIdempotencyStore, InMemoryIdempotencyStore, type IdempotencyStore } from '../db/IdempotencyStore';
import { PostgresRelayerNonceStore, InMemoryRelayerNonceStore, type RelayerNonceStore } from '../db/RelayerNonceStore';

export interface RuntimeOptions {
  enableEventMonitor?: boolean;
  enableRecovery?: boolean;
  enableCctpRelay?: boolean;
  railExecution?: Partial<Record<Rail, boolean>>;
  enablePostgres?: boolean;
  enablePartnerApi?: boolean;
}

export interface RuntimeContext {
  intentEngine: IntentEngine;
  intentService: IntentService;
  quoteEngine: QuoteEngine;
  eventMonitor?: EventMonitor;
  recoveryEngine?: RecoveryEngine;
  railExecutionManager: RailExecutionManager;
  railExecutions: ReadonlyMap<Rail, RailExecutionHandle>;
  cctpRelayWorker?: CctpAttestationWorker;
  thorchainWorker?: THORChainMonitorWorker;
  layerZeroValueTransferApiMonitorWorker?: LayerZeroValueTransferApiMonitorWorker;
  hyperlaneNexusMonitorWorker?: HyperlaneNexusMonitorWorker;
  apiKeyManager?: ApiKeyManager;
  partnerApiRouter?: ReturnType<typeof buildPartnerAPI>;
  postgres?: PostgresIntentStore;
  reliability?: ReliabilityRepository;
  idempotency: IdempotencyStore;
  nonceStore: RelayerNonceStore;
  usdOracle: NativeUsdOracle;
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
  const enableCctpRelay = options.enableCctpRelay ?? envBool('ENABLE_CCTP_RELAY', false);
  const enableThorchainWorker =
    options.railExecution?.[Rail.THORCHAIN] ?? envBool('ENABLE_THORCHAIN_WORKER', true);
  const enableThorchainQuoteWorker = envBool('ENABLE_THORCHAIN_QUOTE_WORKER', true);
  const enableLayerZeroValueTransferApi = envBool('ENABLE_LAYERZERO_TRANSFER_API', false);
  const enableHyperlaneNexus = envBool('ENABLE_HYPERLANE_NEXUS', false);
  const enableThorchainCanary = envBool('ENABLE_THORCHAIN_CANARY', false);
  const thorchainCanaryAllowlist = parseCsv(process.env.THORCHAIN_CANARY_ALLOWLIST);
  const enablePartnerApi = options.enablePartnerApi ?? envBool('ENABLE_PARTNER_API', false);
  const enablePostgres = options.enablePostgres ?? shouldEnablePostgres();

  const intentEngine = new IntentEngine();
  const postgres = enablePostgres ? createPostgresIntentStore() : undefined;
  if (postgres) {
    await assertPostgresRailSchemaCompatibility(postgres.pool);
  }
  const intentService = new IntentService(intentEngine, postgres?.repo);
  const reliability: ReliabilityRepository | undefined = postgres
    ? new PostgresReliabilityRepository(postgres.pool)
    : undefined;
  let reliabilityCache: RailReliabilityCache | undefined;
  if (reliability) {
    new ReliabilityRecorder(intentEngine, reliability).start();
    reliabilityCache = new RailReliabilityCache(reliability);
    reliabilityCache.start();
  }
  const quoteCache: QuoteCache = await createQuoteCacheFromEnv(process.env);
  const quoteEngine = new QuoteEngine(quoteCache, {
    thorchainQuoteWorker: enableThorchainQuoteWorker
      ? new THORChainQuoteWorker(undefined, {
        enableCanaryGuardrails: enableThorchainCanary,
        canaryAllowlist: thorchainCanaryAllowlist,
      })
      : undefined,
    layerZeroValueTransferApiQuoteWorker: enableLayerZeroValueTransferApi
      ? new LayerZeroValueTransferApiQuoteWorker(undefined, { enabled: true })
      : undefined,
    hyperlaneNexusQuoteWorker: enableHyperlaneNexus
      ? new HyperlaneNexusQuoteWorker()
      : undefined,
  });
  const rpcProviderRegistry = new RpcProviderRegistry();
  const usdOracle = new NativeUsdOracle({
    swapAdapter: new SwapAdapter({ registry: rpcProviderRegistry }),
  });
  registerDexQuoteAdapters(quoteEngine, process.env, rpcProviderRegistry);
  const idempotency: IdempotencyStore = postgres
    ? new PostgresIdempotencyStore(postgres.pool)
    : new InMemoryIdempotencyStore();
  const nonceStore: RelayerNonceStore = postgres
    ? new PostgresRelayerNonceStore(postgres.pool)
    : new InMemoryRelayerNonceStore();

  const rails = new RailSelector(undefined, undefined, reliabilityCache);
  const recoveryEngine = enableRecovery
    ? new RecoveryEngine(
        intentService,
        rails,
        async (intent, fallbackRail) => {
          // Recovery resubmission executor hook.
          // Replace this with your relayer queue producer when settlement flow is wired.
          await intentService.markInTransit(
            intent.intentId,
            `fallback:${fallbackRail}:${Date.now()}`,
            {
              actor: 'system',
              eventSource: 'recovery-engine',
            },
          );
        },
      )
    : undefined;

  const eventMonitor = enableEventMonitor ? new EventMonitor(intentService, rpcProviderRegistry) : undefined;
  if (eventMonitor) {
    for (const chain of Object.values(CHAIN_CONFIGS)) {
      if (!chain.isEVM) continue;
      if (!chain.rpcUrl) continue;
      if (!chain.routerV1 && !chain.receiverV1) continue;
      eventMonitor.addChain(chain);
    }
  }

  const railExecutionManager = new RailExecutionManager({
    intentService,
    rpcProviderRegistry,
    idempotency,
    nonceStore,
  });
  const railExecutions = await railExecutionManager.startAll({
    enabled: {
      [Rail.CCTP]: options.railExecution?.[Rail.CCTP] ?? enableCctpRelay,
      [Rail.THORCHAIN]: enableThorchainWorker,
      [Rail.LAYERZERO]: options.railExecution?.[Rail.LAYERZERO] ?? enableLayerZeroValueTransferApi,
      [Rail.HYPERLANE_NEXUS]: options.railExecution?.[Rail.HYPERLANE_NEXUS] ?? enableHyperlaneNexus,
      [Rail.GASZIP]: options.railExecution?.[Rail.GASZIP] ?? envBool('ENABLE_GASZIP_DIRECT_DEPOSIT', false),
    },
  });
  const cctpRelayWorker = railExecutionManager.getInstance<CctpAttestationWorker>(Rail.CCTP);
  const thorchainWorker = railExecutionManager.getInstance<THORChainMonitorWorker>(Rail.THORCHAIN);
  const layerZeroValueTransferApiMonitorWorker = railExecutionManager.getInstance<LayerZeroValueTransferApiMonitorWorker>(Rail.LAYERZERO);
  const hyperlaneNexusMonitorWorker = railExecutionManager.getInstance<HyperlaneNexusMonitorWorker>(Rail.HYPERLANE_NEXUS);

  const apiKeyManager = enablePartnerApi ? new ApiKeyManager() : undefined;
  const partnerApiRouter = apiKeyManager
    ? buildPartnerAPI(apiKeyManager, intentService, quoteEngine, rpcProviderRegistry, idempotency)
    : undefined;
  if (apiKeyManager) {
    setupWebhookPush(intentEngine, apiKeyManager);
  }

  return {
    intentEngine,
    intentService,
    quoteEngine,
    eventMonitor,
    recoveryEngine,
    railExecutionManager,
    railExecutions,
    cctpRelayWorker,
    thorchainWorker,
    layerZeroValueTransferApiMonitorWorker,
    hyperlaneNexusMonitorWorker,
    postgres,
    reliability,
    idempotency,
    nonceStore,
    usdOracle,
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
        await railExecutionManager.stopAll();
      } catch (err) {
        console.warn('[Runtime] rail execution stop failed', err);
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

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parsed = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : undefined;
}
