I've extracted both archives. The bridge has ~20 Solidity contracts and ~70 TypeScript files in the VPS engine, plus a React UI. To give you a thorough analysis without losing fidelity, I'll dispatch four parallel deep-dive agents — each focuses on one subsystem and reports concrete findings (file:line, severity, fix direction).


Ran 4 agents
I've completed the deep-dive analysis across all four subsystems. Here's a consolidated executive synthesis of what the parallel audits surfaced. Full per-file findings (~200 total) are above; below is the distilled picture.

1. Architecture at a glance
EMPSEAL UI (React/Vite)  ──HTTPS/WSS──►  VPS Orchestrator (Node/TS)
                                          ├─ PartnerAPI / StatusAPI / AdminAPI / WS
                                          ├─ QuoteEngine → RailSelector → RouterBuilder
                                          ├─ IntentEngine (state machine) + IntentService
                                          ├─ Rail workers: CCTP, LZ, Axelar, THOR, GasZip
                                          ├─ Recovery / Event monitor / Paymaster
                                          └─ Postgres + (optional Redis) caches
                       │
                       ▼
On-chain: RouterV1 (src) ─┬─► Rail plugins (CCTP / LZ / Axelar / THOR)
                          └─► SwapPlugin (Empseal / UniV2 / UniV3)
                              │
                          ReceiverV1 (dst) + Adapters (Axelar/LZ) + Paymaster (4337)
Plugin-registry pattern, intent-based, EIP-712 signed intents, optional CCTP relay worker, partner-tier API with rebates. Solid design intent — execution has real holes.

2. The most dangerous findings (must fix before mainnet)
Smart contracts
#	File	Issue
C1	RouterV1.sol EIP-712 domain	block.chainid and verifyingContract not in domain ⇒ cross-chain signature replay
C2	RouterV1._enforceMessagingRouteExpectations	if (dstReceiver == address(0)) return skips ALL dst validation — a signer can disable checks
C3	Paymaster._recoverSigner	Signed digest missing userOp.sender + nonce ⇒ paymaster signature reusable across users
C4	All rail plugins	No params.deadline enforcement at the rail layer — stale intents bridge after expiry
C5	THORChainRailPlugin	minThorOutput only goes into memo (advisory). No atomic slippage protection
C6	PluginRegistry	Owner can deactivate/replace a plugin id while intents in flight; supportsInterface is spoofable
C7	CCTPFastRailPlugin	maxFee can equal amount ⇒ destination receives 0
C8	LayerZeroReceiverAdapter	minRouteAmount decoded but never compared to delivered amount
C9	UniswapV3SwapPlugin	sqrtPriceLimitX96 passed through from calldata; zero ⇒ no price guard
C10	Paymaster.withdrawFromEntryPoint	No amount cap → key compromise drains all gas reserves
VPS orchestrator
#	File	Issue
V1	CctpAttestationWorker	Idempotency is in-memory only — two VPS instances or a restart → double relay (mints duplicate USDC). Needs DB advisory lock
V2	RecoveryEngine.start	setInterval w/o re-entrancy flag → overlapping cycles call markRecovering on the same intent ⇒ double fallback relay
V3	IntentService.markRecovering	retryCount read-then-write race; MAX_RETRIES = 3 can be bypassed silently
V4	EventMonitor	No reorg / event-removed handling, no periodic queryFilter backfill → intents permanently STUCK after reorgs
V5	IntentService.createQuotedIntent	Stores raw partnerApiKey on the Intent (and in DB JSON) — leaks via logs/cache
V6	CctpAttestationWorker._relayJob	Per-chain queue, but the relayer EOA's nonce is shared globally — cross-chain nonce collisions
V7	utils/intentActionAuth.ts	10-minute signed-action window, no nonce → replayable cancel/refund
V8	RailSelector._scoreRail / RouterBuilder	float64 fee math at large notional; reliability raised to power 2/3 ⇒ multi-hop scores collapse
V9	PaymasterService.updateTokenRates	Cache stores timestamps but never checks them ⇒ stale FX rate quoted forever
V10	QuoteEngine._buildOffers	Promise.all (not allSettled) — one rail crash kills the whole quote
API / DB / deployment
#	File	Issue
A1	AdminAPI.ts:15-27	If VPS_ADMIN_API_KEY env is empty, '' === '' ⇒ anyone can hit admin/refund routes
A2	EmpxCrossChainSDK/EmpxSDK.ts:124	API key sent in WS URL query string (?key=…) — leaks via logs/proxies
A3	StatusAPI.ts:224	CORS default *
A4	StatusAPI.ts parseSignedIntentAction	No nonce/idempotency on signed actions — replay within window
A5	schemaCompatibility.ts	assertPostgresRailSchemaCompatibility never invoked anywhere
A6	docker-compose.yml	Postgres postgres:postgres hardcoded; Adminer exposed on 8080 with no auth
A7	Caddyfile	TLS only auto-enabled when $API_DOMAIN is a real domain — silent HTTP if missing
A8	StatusAPI clientKey	Trusts cf-connecting-ip / x-forwarded-for unconditionally → rate-limit bypass via spoofed headers
A9	QuoteCache (Redis)	Stored quotes unsigned ⇒ anyone with Redis access can poison estimatedOut/fees
A10	IntentRepository.transitionIntent	allowedFrom validation only enforced when caller supplies it — most callers don't
UI
#	File	Issue
U1	src/config/rpc.ts	DRPC public key hardcoded into the bundle
U2	lib/api/coingecko.ts	Pro/Demo CoinGecko API keys exposed via VITE_* env (client-side bundle)
U3	pages/cross/Cross.tsx:415-565	No invariant currentChainId === sourceChainId before sendEvmTransaction — wrong-chain submits
U4	pages/cross/Cross.tsx:474-478	Quote expiry checked on a 1s tick; race between tick and submit ⇒ stale intent executed
U5	pages/swap/SlippageCalculator.jsx	BigInt slippage math loses precision at small amounts (returns 0 ⇒ minReceived = 0)
U6	pages/swap/ConnectWallet.jsx	Wallet modal renders but has no onClick handlers — non-functional
U7	features/cross/execution/routerIntent.ts	Hardcoded 1.2M gas across all chains
U8	vercel.json	Missing CSP/X-Frame-Options/X-Content-Type-Options
U9	routerIntent execution + approval flow	No debounce/inflight guard → rapid clicks ⇒ duplicate approvals/txs
U10	public/frames/	240 raw JPEGs (~6 MB) shipped in initial bundle
3. Structural / architectural flaws (not single bugs — design issues)
No global idempotency layer. Idempotency keys table exists in schema but isn't actually used by the relay worker, the API mutation endpoints, or the recovery engine. The CCTP double-mint, the double recovery, the duplicate-offer-select, and the duplicate-approval-tx bugs all share this root cause.
Single-instance assumption. The orchestrator (recovery, CCTP worker, event monitor, in-memory caches, in-memory listeners) cannot be horizontally scaled safely. Any Kubernetes scale-out or restart-during-deploy = duplicate side effects.
State machine is enforced in 3 different places (in-memory engine, repo, sometimes service) with no single source of truth. IntentEngine._transition accepts anything; only Postgres path enforces allowedFrom, and even there only when callers pass it.
Settlement-token resolution is a fragile string-matching pipeline across RouteAssetPolicy, env keys (CHAIN_<id>_TOKEN_<RAIL>_<TOKEN>), globalTokenSupport, and route metadata. There is no startup-time validation that the cross product of (chain × rail × token) is consistent. Misconfig fails silently at execution time.
Plugin lifecycle vs in-flight intents. Plugin IDs are referenced in signed payloads, but the registry owner can deactivate/replace plugins after signing; combined with no chainId in EIP-712, replay + plugin swap is a serious vector.
Quote/intent fee math is duplicated between QuoteEngine (TS) and RouterV1._collectFee (Solidity) with subtly different ordering ("fee before swap" vs "fee on input"). PROJECT_CONTEXT mentions this is intentional, but there is no test cross-checking the two paths produce identical numbers.
No circuit breakers anywhere. THORChain / LayerZero / GasZip / CoinGecko / Pimlico / Circle attestation all hard-call out per request. One downstream outage cascades into total quote-engine failure.
Event monitoring uses ethers .on() only. Production cross-chain protocols need (a) periodic queryFilter backfill, (b) reorg-removed handling, (c) per-chain finality awareness (Optimism vs Polygon vs BSC differ wildly). None of these are present.
No observability primitives. No request IDs, no Prometheus metrics, no structured logs, no audit table for admin actions. You will not be able to debug an incident in production.
UI talks directly to Postgres-backed quote endpoint with secrets in import.meta.env. This blurs the partner-tier auth model — the SDK and the front-end use different code paths to identical endpoints, and the SDK has the API key but the UI keeps RPC/CoinGecko keys client-side. The bridge should route ALL provider calls through the VPS.
4. Efficiency findings worth knowing
RpcProviderRegistry creates a fresh JsonRpcProvider per (chain, url) and never closes them; memory and socket growth across cooldowns.
RouterBuilder & RailSelector recompute scoring from scratch on every quote; no memoization keyed on (srcChain, dstChain, asset).
QuoteEngine._buildBreakdownAmounts reads token decimals via repeated config lookups inside loops.
EmpsealSwapPlugin and Empseal+V2 do a balance-delta check and trust the inner minAmountOut — redundant SLOADs per swap.
CoinGecko client sleeps 1.5s between calls instead of batching the supported 250-address call.
public/frames/ ships 240 JPEGs in the initial bundle; trivially a 1.5s LCP regression on mobile.
Postgres lacks indexes on intents(partner_api_key, updated_at), idempotency_keys(expires_at), chain_event_offsets(updated_at) — all are hot paths.
5. Suggested fix-order
Block mainnet on:

C1, C2, C3, C4, C5 (contracts) · V1, V2, V3 (worker/recovery) · A1, A6, A7 (auth/deploy) · U1, U2, U3, U4 (UI key + chain-mismatch)
Hard-required before public partner onboarding:

C6–C10 · V4–V10 · A2–A5, A8–A10 · U5–U10
Engineering health (next 1–2 sprints):

All architectural items in §3 (especially #1 idempotency, #2 multi-instance, #3 state-machine unification, #8 reorg handling, #9 observability).

---

I've read the notes — this changes the audit framing meaningfully. Below is a re-prioritization of the technical findings through the lens of the "Execution Infrastructure / Solver SDK" vision, plus the architectural gaps the vision creates that the current code is quietly blocking.

1. Strategic vision ↔️ current code: gap map
Vision pillar	What it requires	What EMPX has today	Gap severity
BYO-RPC (agents pass their own RPC)	RPC is a per-request input, not a global config	RpcProviderRegistry reads from process.env / chainRuntime; SDK has no rpcProviders constructor option; UI hardcodes DRPC public key in the bundle	🔴 Architectural blocker
Unified Intent schema everywhere	One Intent type from SDK → API → DB → contract; same shape for swap/bridge/cross	IIntentTypes.sol exists; TS Intent exists; but state machine is enforced in 3 different places (engine vs repo vs service) with inconsistent rules	🟠 Leaky abstraction
Uniform Rail/Solver adapter	Single Solver { canSolve, quote, execute, settle } interface; rails are plugins	IRailPlugin.sol exists on-chain. Off-chain: DirectRailIntegrationBuilder hard-codes THORChain vs LayerZero vs GasZip branches; QuoteEngine._buildOffers calls each provider explicitly	🟠 Half-built
Reliability scoring engine (the actual moat)	Capture every quote → actual outcome forever; route by price + speed + success	RailSelector.reliabilityScore is a static config constant. No quote_vs_actual table. intent_events exists but isn't aggregated. No backfill.	🔴 Not built — and this is the moat
Intent cache (10–30s)	Hot-path identical-route reuse	QuoteCache + OfferCache exist but have bugs: TTL inconsistent across in-mem/Redis, unsigned (poisonable), no per-rail TTL	🟡 Exists but unsafe
Revenue attribution	Per-swap: route_source, integrator, wallet, agent, partner	partner_api_key stored (leakily); no integrator_id, no agent_id, no route_source column	🟠 Partial
Solver registry placeholder	registerSolver / solverHealth stubs so future external solvers plug in	Not present. PluginRegistry.sol is for on-chain rail/swap plugins only	🟡 Greenfield (cheap to stub now)
ERC-7683 compatibility	Standard IOriginSettler / IDestinationSettler interface; CrossChainOrder struct	Bespoke IIntentTypes; not 7683-shaped	🟡 Future wrapping
Partner API as scale path	Hardened tier enforcement, audit trail, webhook reliability	Tier exists but isn't enforced on fee-share endpoints; webhook code mostly TODO; admin key empty-string bypass	🔴 Blocking partner GA
2. Audit findings, re-ranked against the vision
Some "Low" findings are actually critical given the strategic direction; some "High" findings are less urgent than I initially ranked.

Promoted in priority (because of the vision)
Finding	Original	Re-ranked	Why
U1 / U2 Hardcoded DRPC + CoinGecko keys in client bundle	High	🔴 Vision-Critical	BYO-RPC vision is impossible if the system itself bakes in a default RPC key. RPC has to become a parameter, not a constant.
V13 RpcProviderRegistry not pluggable per partner/request	Medium	🔴 Vision-Critical	Must support per-intent / per-partner RPC injection (new EMPX({ rpcProviders: { … } })). Today it's a process-wide singleton keyed on env.
No reliability/quote-vs-actual capture (not even in the bug list because it's just missing)	—	🔴 Vision-Critical	This is the moat. Without it EMPX is just another router. Cheap to start: one route_outcomes table + insert hook on settled / failed.
V8 RailSelector uses static reliability score	Medium	🔴 Vision-Critical	Same root cause as above — score has to come from observed data, not a config constant.
A1 Empty VPS_ADMIN_API_KEY allows unauth admin access	Critical	🔴 Critical (unchanged)	Blocks any partner onboarding.
A8 Partner tier not enforced on fee-share endpoints	Critical	🔴 Critical (unchanged)	Vision is partner-led growth — billing must be airtight.
V5 Partner API key stored on Intent	High	🔴 Critical	When wallets/agents/aggregators all consume the API, key hygiene becomes the #1 incident surface.
Revenue attribution columns missing (not a "bug", a hole)	—	🟠 Vision-High	route_source, integrator_id, agent_id need to land in the schema before you have data to migrate.
Demoted (still real bugs, but not blocking the vision)
Finding	Original	Re-ranked	Why
Frame bundle 6 MB JPEGs (U10)	High	🟡 Medium	Pure UI optimization; doesn't affect the SDK/API surface that the vision sells.
Tailwind plugins duplication, Vite chunking	Medium	🟢 Low	UI polish.
Logging gaps, no NatSpec, etc.	Info	🟢 Low	Real but not blocking.
Unchanged criticals (still mandatory before mainnet, regardless of vision)
C1 cross-chain replay · C2 zero dstReceiver skip · C3 paymaster sig binding · C5 THOR slippage · V1 CCTP double-relay · V2 recovery race · V4 reorg handling · A6 default DB creds · A7 silent HTTP.

3. Architectural changes the vision implies
These are architecture moves, not bug fixes — they reshape the codebase so the strategy is possible:

A. Make RPC a first-class parameter
Today:

// services/RpcProviderRegistry.ts
selectRpcUrl(chainId, workload) // reads process.env + chainRuntime
Needed:

interface ExecutionContext {
  apiKey?: string;
  rpcProviders?: Record<number, string | JsonRpcProvider>;
  integratorId?: string;
  agentId?: string;
}
quote(req, ctx) ; execute(intent, ctx); status(id, ctx);
RpcProviderRegistry becomes a factory that prefers ctx.rpcProviders[chainId] first, then partner-configured, then platform default.
SDK EmpxSDK accepts rpcProviders in its constructor and threads it through every call.
Eliminates U1/U2 entirely (UI just passes its own provider; no key in the bundle).
B. Collapse provider_direct vs router_intent into one Solver interface
Today: DirectRailIntegrationBuilder switches on rail name. QuoteEngine has bespoke _buildTHORChainProviderDirectOffer, _buildLayerZeroValueTransferApiProviderDirectOffer, _buildGasZipProviderDirectOffer.

Needed (matches the doc):

interface RailSolver {
  id: string;
  canSolve(intent: Intent): boolean;
  quote(intent: Intent, ctx: ExecutionContext): Promise<RailOffer>;
  buildExecution(offer: RailOffer, ctx): Promise<Integration>;
  watch(intent: Intent, ctx): AsyncIterable<IntentEvent>;
  settle(intent: Intent, ctx): Promise<SettleResult>;
}
Every existing rail becomes a RailSolver. QuoteEngine becomes solvers.flatMap(s => s.canSolve(i) ? s.quote(i) : []) + Promise.allSettled. This single refactor:

Fixes V10 (Promise.all cascade failure).
Unifies provider-direct and router-intent paths.
Drops the future cost of adding Wormhole / Via / 1inch / CoW / Across to "one file".
Removes the dead-code smell in DirectRailIntegrationBuilder.
C. Reliability data plane (the moat — cheap to start)
Tiny v0: one table.

CREATE TABLE route_outcomes (
  id bigserial PRIMARY KEY,
  intent_id text NOT NULL,
  src_chain int, dst_chain int,
  rail text, route_signature text,           -- (rail, src_token, dst_token, src_chain, dst_chain)
  quoted_out numeric, actual_out numeric,
  quoted_eta_s int, actual_eta_s int,
  status text,                                -- SETTLED | FAILED | STUCK
  failure_reason text,
  created_at timestamptz, settled_at timestamptz
);
CREATE INDEX ON route_outcomes (route_signature, created_at DESC);
Hook insertion at IntentService.markSettled / markFailed. After two weeks of mainnet you have proprietary data nobody else can replicate. Then RailSelector.reliabilityScore becomes a windowed query instead of a static config constant — fixes V8 with real signal.

D. Revenue attribution before you have revenue
Add now (zero cost while volume is small, painful later):

ALTER TABLE intents ADD COLUMN integrator_id text;
ALTER TABLE intents ADD COLUMN agent_id text;
ALTER TABLE intents ADD COLUMN route_source text;   -- 'partner-api' | 'ui' | 'agent-sdk' | 'cowswap-solver'
Drop the raw partner_api_key field (V5) — store only partner_id resolved at auth time. Build a single RevenueAttribution helper that decorates intents on creation.

E. Solver-registry placeholder (per the doc's "future-proofing now")
Even before any external solver participates, define the interface and a SOLVER_INTERNAL row in a solvers table:

CREATE TABLE solvers (
  id text PRIMARY KEY,
  type text CHECK (type IN ('internal','external','third-party')),
  capabilities jsonb,                -- chains, rails, tokens
  reliability jsonb,                 -- computed from route_outcomes
  active boolean,
  created_at timestamptz
);
The existing rails become rows. Later, an external solver (a 1inch fusion resolver bridge, a CoW solver bridge) is just another row. No refactor.

F. Intent schema versioning + 7683 wrapper later
Add quote_version and intent_version columns (fixes finding A43). When ERC-7683 stabilizes you wrap, not migrate.

4. Sequencing for a single-dev team (12 months, vision-aligned)
This integrates the audit fixes into the strategic roadmap rather than treating them as separate. The principle: don't fix bugs that the next refactor will erase, and don't refactor what isn't a moat.

Sprint 0 — Stop-the-bleed (2 weeks)
Pure security; nothing that depends on architecture choices.

A1 empty admin key, A6 hardcoded postgres creds, A7 silent HTTP
U1/U2 strip RPC + CoinGecko keys from UI bundle (move CoinGecko behind VPS, RPC gets handled by item B below)
C1 add chainId + verifyingContract to EIP-712 domain
C3 bind paymaster signature to userOp.sender + nonce
Sprint 1 — BYO-RPC + Solver interface refactor (4 weeks)
This is the single highest-ROI engineering work, per the strategy doc.

Introduce ExecutionContext { rpcProviders?, integratorId?, agentId? }
Refactor RpcProviderRegistry to factory + context-aware
Define RailSolver interface; port CCTP, LayerZero, Axelar, THORChain, GasZip to it
Delete DirectRailIntegrationBuilder branching
SDK constructor accepts rpcProviders and threads through
Sprint 2 — State-machine unification + idempotency (3 weeks)
Erases ~10 audit findings in one move.

Single IntentStateMachine module owning all allowed transitions
transitionIntent always validates allowedFrom (fixes A10, V3)
DB-backed idempotency keys actually used by CCTP worker (V1), recovery engine (V2), offer-select (A32)
IntentEvent writes become the only side-effect path
Sprint 3 — Reliability data + revenue attribution (2 weeks)
route_outcomes table + insert hook
integrator_id, agent_id, route_source columns
Drop raw partner_api_key field, replace with partner_id
RailSelector reads windowed reliability instead of config constant
Sprint 4 — Partner API hardening (3 weeks)
Tier enforcement on fee endpoints (A8)
Signed-action nonce + reduced window (V7/A4)
Webhook HMAC + retries + DLQ
Schema-compatibility check at startup (A5)
Request-ID middleware + Prometheus
Sprint 5+ — Solver registry stub + ERC-7683 wrapper + agent SDK distribution
Per the doc's Phase 3/4.

5. Honest things the strategy doc didn't address but the audit reveals
The doc focuses on what to build. The audit shows what will break the moment volume arrives, and these aren't optional:

Multi-instance safety. The current orchestrator literally cannot scale horizontally — CCTP worker, recovery engine, event monitor, in-memory caches, and listener subscriptions all assume one process. The moment you sell "Execution Infrastructure" to a wallet, single-instance is a non-starter.
Event-monitor reorg blindness (V4). Cross-chain infra without reorg-aware backfill will accumulate stuck intents weekly on chains like Polygon/BSC.
Float math in routing (V8, U5). Quote selection over $100M notionals is unsafe with number. Move to bigint everywhere before institutional partners arrive.
No circuit breakers on external providers. THORChain / Pimlico / Circle attestation / CoinGecko outages today take the whole quote engine down.
Paymaster gas reserve has no withdraw cap (C10). A single key compromise drains operational gas.
These five do not appear in the strategy doc but are blocking the strategy.

6. What I'd tell a 1-dev team to ignore for now
Per the doc's correct advice ("DAO, staking, solver auctions, bonding, tokenomics, intent mempools" are not the priority), and matching what I see in the codebase:

Multi-hop hub routing (RouterBuilder hub-hop logic). Doc says single-hop only; current quote→calldata path only executes single-hop anyway. Don't invest in the hub-hop ranking math yet.
THORChain native BTC/SOL polish until volume justifies (it's exotic).
Bundle/Tailwind/Vite micro-optimizations.
NatSpec completeness on internal contracts.
Implementing a real solver auction.