# THORChain + Multi-Asset Rails V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one V2 refactor that adds THORChain mainnet canary support, returns all viable rail offers to the client, and migrates rail execution from fixed settlement tokens to explicit multi-asset settlement validation.

**Architecture:** The VPS becomes the source of truth for provider asset catalogs, offer economics, and provider-specific execution metadata. Contracts continue enforcing execution integrity, but they stop assuming a fixed settlement-token enum and instead validate the exact expected settlement asset encoded in the signed intent payload. THORChain is implemented as a thin on-chain router plus VPS quote, execution, and monitoring workers. User rail choice is binding: recovery may retry observation or same-rail execution, but it must not silently switch to a different rail.

**Tech Stack:** TypeScript, Node.js, Express, ethers v6, Redis/in-memory cache, Foundry Solidity tests

---

## File Structure

### Core VPS model and APIs

- Modify: `src/vps/types/index.ts`
  Responsibility: replace single-quote / fixed-settlement assumptions with offer-set, provider-asset, and provider-economics types.
- Modify: `src/vps/api/quoteCodec.ts`
  Responsibility: parse quote requests and serialize offer sets and selected offers.
- Create: `src/vps/cache/OfferCache.ts`
  Responsibility: store ephemeral offer sets and individual offers until the user selects one.
- Modify: `src/vps/services/QuoteEngine.ts`
  Responsibility: build all viable offers, not only the single best quote.
- Modify: `src/vps/services/RailSelector.ts`
  Responsibility: rank offers for display only; stop acting as the sole route winner.
- Modify: `src/vps/services/RouterBuilder.ts`
  Responsibility: keep candidate route enumeration but return all viable direct routes into offer construction.
- Modify: `src/vps/services/IntentService.ts`
  Responsibility: create intents from selected offers rather than directly from `/quote`.
- Modify: `src/vps/services/IntentCalldataBuilder.ts`
  Responsibility: build router calldata from a selected offer using the new signed payload shape.
- Modify: `src/vps/api/StatusAPI.ts`
  Responsibility: return offer sets from `/quote` and add selection endpoint(s).
- Modify: `src/vps/api/PartnerAPI.ts`
  Responsibility: return offer sets to partners and let them create intents from a chosen offer.
- Modify: `src/vps/sdk/RufloSDK.ts`
  Responsibility: expose offers to integrators and create a selected-offer transaction.

### Provider catalogs and workers

- Create: `src/vps/services/thorchain/THORChainClient.ts`
  Responsibility: raw THORChain HTTP client for `/quote/swap`, `/inbound_addresses`, and tx/action lookups.
- Create: `src/vps/services/thorchain/THORChainQuoteWorker.ts`
  Responsibility: convert a user request into a normalized THORChain offer.
- Create: `src/vps/services/thorchain/THORChainMonitorWorker.ts`
  Responsibility: monitor submitted THORChain intents until destination receipt or failure.
- Create: `src/vps/services/axelar/AxelarAssetCatalog.ts`
  Responsibility: resolve Axelar dynamic token metadata into offer execution fields.
- Create: `src/vps/services/layerzero/LayerZeroRouteCatalog.ts`
  Responsibility: resolve LayerZero OFT / adapter metadata into offer execution fields.
- Modify: `src/vps/app/runtime.ts`
  Responsibility: wire new workers and offer cache into API and worker runtimes.
- Modify: `src/vps/rails/execution.ts`
  Responsibility: promote THORChain from passive to active worker mode.

### Contracts

- Modify: `src/contracts/interfaces/IIntentTypes.sol`
  Responsibility: add explicit destination settlement-asset fields and remove fixed-settlement assumptions from the signed payload.
- Modify: `src/contracts/RouterV1.sol`
  Responsibility: hash and forward the new payload fields into destination execution.
- Modify: `src/contracts/ReceiverV1.sol`
  Responsibility: reject unexpected destination settlement token / asset / amount before settling an intent.
- Modify: `src/contracts/rails/AxelarRailPlugin.sol`
  Responsibility: bridge dynamic Axelar assets rather than immutable USDC only.
- Modify: `src/contracts/rails/AxelarReceiverAdapter.sol`
  Responsibility: validate the received Axelar token against the selected-offer payload.
- Modify: `src/contracts/rails/LayerZeroRailPlugin.sol`
  Responsibility: bridge dynamic LayerZero OFT routes rather than a single fixed OFT.
- Modify: `src/contracts/rails/LayerZeroReceiverAdapter.sol`
  Responsibility: validate the expected OFT and settlement token against the selected-offer payload.
- Modify: `src/contracts/rails/THORChainRailPlugin.sol`
  Responsibility: keep the plugin thin, but accept the finalized provider asset metadata prepared by the VPS.

### Tests

- Create: `tests/vps/offer-cache.test.ts`
- Create: `tests/vps/quote-engine-offers.test.ts`
- Create: `tests/vps/offer-selection.test.ts`
- Create: `tests/vps/thorchain-quote-worker.test.ts`
- Create: `tests/vps/recovery-engine.test.ts`
- Create: `tests/contracts/ReceiverV1.t.sol`
- Modify: `tests/contracts/RouterV1.t.sol`
- Modify: `tests/contracts/AxelarRailPlugin.t.sol`
- Modify: `tests/contracts/LayerZeroRailPlugin.t.sol`
- Modify: `tests/contracts/ReceiverAdapters.t.sol`

### Ops docs

- Create: `docs/ops/thorchain-mainnet-canary.md`
  Responsibility: document mainnet canary allowlist, quote refresh rules, and rollback procedure.

---

### Task 1: Introduce Offer Set + Provider Economics Types

**Files:**
- Create: `tests/vps/offer-cache.test.ts`
- Modify: `src/vps/types/index.ts`
- Modify: `src/vps/api/quoteCodec.ts`
- Create: `src/vps/cache/OfferCache.ts`

- [ ] **Step 1: Write the failing VPS test for offer-set serialization and caching**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryOfferCache } from '../../src/vps/cache/OfferCache';
import { serializeOfferSet } from '../../src/vps/api/quoteCodec';
import { Rail } from '../../src/vps/types';

test('serializeOfferSet preserves multiple offers and provider economics', async () => {
  const cache = new InMemoryOfferCache();
  const offerSet = {
    offerSetId: '0x' + '11'.repeat(32),
    expiresAt: 1_800_000_000,
    offers: [
      {
        offerId: '0x' + 'aa'.repeat(32),
        rail: Rail.CCTP,
        economics: { providerFeeUSD: 0, protocolFeeUSD: 0.5, sourceGasUSD: 0.11, settlementTimeSeconds: 25 },
      },
      {
        offerId: '0x' + 'bb'.repeat(32),
        rail: Rail.THORCHAIN,
        economics: { providerFeeUSD: 0, protocolFeeUSD: 0.5, sourceGasUSD: 0.14, slippageBps: 19, settlementTimeSeconds: 24 },
      },
    ],
  };

  await cache.set(offerSet.offerSetId, offerSet, 30_000);
  const restored = await cache.get(offerSet.offerSetId);
  assert.equal(restored?.offers.length, 2);

  const json = serializeOfferSet(offerSet) as any;
  assert.equal(json.offers[1].economics.slippageBps, 19);
});
```

- [ ] **Step 2: Run the test to confirm the current model is insufficient**

Run: `node --import tsx --test tests/vps/offer-cache.test.ts`
Expected: FAIL with module/type errors because `OfferCache`, `serializeOfferSet`, and the new offer fields do not exist yet.

- [ ] **Step 3: Add normalized offer and provider-asset types**

```ts
export interface ProviderAssetRef {
  canonicalAssetId: string;
  providerAssetId: string;
  tokenAddress?: string;
  decimals: number;
  assetKind: 'erc20' | 'native' | 'btc' | 'sol' | 'doge';
}

export interface OfferEconomics {
  providerFeeUSD: number;
  protocolFeeUSD: number;
  sourceGasUSD: number;
  destinationGasUSD?: number;
  outboundFeeUSD?: number;
  slippageBps?: number;
  priceImpactPct?: number;
  settlementTimeSeconds: number;
  minimumInput?: string;
}

export interface RailOffer {
  offerId: string;
  rail: Rail;
  railType: 'messaging' | 'liquidity';
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  estimatedOut: bigint;
  minAmountOut: bigint;
  expiresAt: number;
  sourceSettlementAsset: ProviderAssetRef;
  destinationSettlementAsset: ProviderAssetRef;
  economics: OfferEconomics;
  execution: Record<string, unknown>;
}

export interface OfferSet {
  offerSetId: string;
  expiresAt: number;
  offers: RailOffer[];
  bestOfferId?: string;
}
```

- [ ] **Step 4: Implement an in-memory offer cache**

```ts
export interface OfferCache {
  get(offerSetId: string): Promise<OfferSet | null>;
  set(offerSetId: string, offerSet: OfferSet, ttlMs: number): Promise<void>;
  delete(offerSetId: string): Promise<void>;
}

export class InMemoryOfferCache implements OfferCache {
  private readonly store = new Map<string, { expiresAt: number; value: OfferSet }>();

  async get(offerSetId: string): Promise<OfferSet | null> {
    const hit = this.store.get(offerSetId);
    if (!hit || hit.expiresAt <= Date.now()) return null;
    return hit.value;
  }
}
```

- [ ] **Step 5: Add quote codec helpers for offer sets**

```ts
export function serializeOfferSet(offerSet: OfferSet): Json {
  return toJSONSafe(offerSet);
}

export function parseOfferSelection(input: any): { offerSetId: string; offerId: string } {
  if (!input?.offerSetId || !input?.offerId) throw new Error('offerSetId and offerId required');
  return { offerSetId: String(input.offerSetId), offerId: String(input.offerId) };
}
```

- [ ] **Step 6: Run the test again**

Run: `node --import tsx --test tests/vps/offer-cache.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tests/vps/offer-cache.test.ts src/vps/types/index.ts src/vps/api/quoteCodec.ts src/vps/cache/OfferCache.ts
git commit -m "refactor(vps): add offer set and provider economics types"
```

### Task 2: Convert Quote Engine From Winner To Offer Builder

**Files:**
- Create: `tests/vps/quote-engine-offers.test.ts`
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/services/RailSelector.ts`
- Modify: `src/vps/services/RouterBuilder.ts`

- [ ] **Step 1: Write the failing test for returning more than one viable offer**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';

test('getOffers returns multiple viable rails instead of only the top-ranked one', async () => {
  const engine = new QuoteEngine();
  const result = await engine.getOffers({
    tokenIn: '0x1111111111111111111111111111111111111111',
    tokenOut: '0x2222222222222222222222222222222222222222',
    amountIn: 1000000n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: '0x3333333333333333333333333333333333333333',
  });

  assert.ok(result);
  assert.ok(result!.offers.length >= 2);
});
```

- [ ] **Step 2: Run the test to verify the current implementation still returns only one quote**

Run: `node --import tsx --test tests/vps/quote-engine-offers.test.ts`
Expected: FAIL because `QuoteEngine.getOffers` does not exist and the engine still collapses to one `QuoteResult`.

- [ ] **Step 3: Introduce `getOffers()` and keep a temporary `getQuote()` compatibility wrapper**

```ts
async getOffers(req: QuoteRequest): Promise<OfferSet | null> {
  const amountUSD = await this._estimateUSD(req.tokenIn, req.srcChainId, req.amountIn);
  const routes = this.routeBuilder
    .buildRoutes(req.srcChainId, req.dstChainId, amountUSD, req.urgency ?? 'normal')
    .filter((route) => route.viable && route.hops.length === 1);

  const offers = (await Promise.all(routes.map((route) => this._buildOffer(req, route, amountUSD))))
    .filter((offer): offer is RailOffer => offer !== null);

  if (offers.length === 0) return null;
  return this._toOfferSet(req, offers);
}

async getQuote(req: QuoteRequest): Promise<QuoteResult | null> {
  const offerSet = await this.getOffers(req);
  if (!offerSet || offerSet.offers.length === 0) return null;
  return this._materializeLegacyQuote(offerSet.offers[0]);
}
```

- [ ] **Step 4: Move scoring to display ordering rather than single-route elimination**

```ts
return offers.sort((a, b) => {
  if (a.minAmountOut !== b.minAmountOut) return a.minAmountOut > b.minAmountOut ? -1 : 1;
  if (a.economics.settlementTimeSeconds !== b.economics.settlementTimeSeconds) {
    return a.economics.settlementTimeSeconds - b.economics.settlementTimeSeconds;
  }
  return (a.economics.providerFeeUSD + a.economics.protocolFeeUSD)
    - (b.economics.providerFeeUSD + b.economics.protocolFeeUSD);
});
```

- [ ] **Step 5: Capture provider-economics defaults for existing rails**

```ts
const economics = {
  providerFeeUSD: route.totalFeeUSD,
  protocolFeeUSD,
  sourceGasUSD: 0,
  settlementTimeSeconds: isCctpFastPluginId(railPluginId) ? Math.min(route.totalEtaSeconds, 8) : route.totalEtaSeconds,
};
```

- [ ] **Step 6: Run the offer-builder test**

Run: `node --import tsx --test tests/vps/quote-engine-offers.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tests/vps/quote-engine-offers.test.ts src/vps/services/QuoteEngine.ts src/vps/services/RailSelector.ts src/vps/services/RouterBuilder.ts
git commit -m "refactor(vps): return multi-offer quote sets"
```

### Task 3: Add Offer Selection API And SDK Flow

**Files:**
- Create: `tests/vps/offer-selection.test.ts`
- Modify: `src/vps/services/IntentService.ts`
- Modify: `src/vps/services/IntentCalldataBuilder.ts`
- Modify: `src/vps/api/StatusAPI.ts`
- Modify: `src/vps/api/PartnerAPI.ts`
- Modify: `src/vps/sdk/RufloSDK.ts`

- [ ] **Step 1: Write the failing API test for selecting one offer out of an offer set**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentService } from '../../src/vps/services/IntentService';

test('createIntentFromOffer binds the intent to the selected offer only', async () => {
  const service = new IntentService({} as any);
  const intent = await service.createIntentFromOffer({
    offerSetId: '0x' + '11'.repeat(32),
    offerId: '0x' + 'aa'.repeat(32),
    rail: 'THORCHAIN',
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(intent.quote.offerId, '0x' + 'aa'.repeat(32));
});
```

- [ ] **Step 2: Run the test to verify the current service only supports `createQuotedIntent()`**

Run: `node --import tsx --test tests/vps/offer-selection.test.ts`
Expected: FAIL because `createIntentFromOffer` and `quote.offerId` do not exist.

- [ ] **Step 3: Add `createIntentFromOffer()` to `IntentService`**

```ts
async createIntentFromOffer(offer: RailOffer, userAddress: string, partnerApiKey?: string): Promise<Intent> {
  const quote = await this.materializeSelectedQuote(offer);
  return this.createQuotedIntent(quote, userAddress, partnerApiKey);
}
```

- [ ] **Step 4: Change `/quote` endpoints to return offer sets and add selection endpoints**

```ts
app.post('/quote', async (req, res) => {
  const offerSet = await quoteEngine.getOffers(parseQuoteRequest(req.body, 'normal'));
  if (!offerSet) return res.status(400).json({ error: 'No route available for this pair' });
  res.json({ offerSet: serializeOfferSet(offerSet) });
});

app.post('/intent/select', async (req, res) => {
  const { offerSetId, offerId } = parseOfferSelection(req.body);
  const offer = await quoteEngine.getOfferOrThrow(offerSetId, offerId);
  const intent = await intentService.createIntentFromOffer(offer, req.body.userAddress);
  const integration = await buildRouterIntegration(intent.intentId, intent.quote, req.body.userAddress);
  res.json({ intentId: intent.intentId, quote: serializeQuote(intent.quote), integration });
});
```

- [ ] **Step 5: Update SDK to expose `offers[]` and a `selectOffer()` call**

```ts
export interface SwapQuoteOffer {
  offerId: string;
  rail: Rail;
  estimatedOut: string;
  economics: {
    providerFeeUSD: number;
    protocolFeeUSD: number;
    sourceGasUSD: number;
    settlementTimeSeconds: number;
    slippageBps?: number;
  };
}

async selectOffer(offerSetId: string, offerId: string): Promise<SwapHandle> {
  const res = await fetch(`${this.baseUrl}/partner/intent/select`, { method: 'POST', headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ offerSetId, offerId, userAddress: this.wallet }) });
  const body = await res.json();
  return new SwapHandle(body.quote, this.baseUrl, this.apiKey);
}
```

- [ ] **Step 6: Update calldata building to read the selected offer fields**

```ts
const payload = {
  ...,
  settlementAssetId: normalizeBytes32(quote.settlementAssetId, 'settlementAssetId'),
  expectedDstSettlementToken: normalizeAddress(quote.expectedDstSettlementToken, 'expectedDstSettlementToken'),
  expectedDstSettlementAssetId: normalizeBytes32(quote.expectedDstSettlementAssetId, 'expectedDstSettlementAssetId'),
  minSettlementAmount: toBigIntStrict(quote.minSettlementAmount, 'minSettlementAmount'),
};
```

- [ ] **Step 7: Run the selection-flow test**

Run: `node --import tsx --test tests/vps/offer-selection.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add tests/vps/offer-selection.test.ts src/vps/services/IntentService.ts src/vps/services/IntentCalldataBuilder.ts src/vps/api/StatusAPI.ts src/vps/api/PartnerAPI.ts src/vps/sdk/RufloSDK.ts
git commit -m "feat(api): add selected-offer intent creation flow"
```

### Task 4: Refactor Signed Intent + Receiver Validation For Explicit Settlement Assets

**Files:**
- Create: `tests/contracts/ReceiverV1.t.sol`
- Modify: `tests/contracts/RouterV1.t.sol`
- Modify: `src/contracts/interfaces/IIntentTypes.sol`
- Modify: `src/contracts/RouterV1.sol`
- Modify: `src/contracts/ReceiverV1.sol`
- Modify: `src/vps/services/IntentCalldataBuilder.ts`

- [ ] **Step 1: Write the failing receiver test for rejecting the wrong settlement token**

```solidity
function testExecuteRevertsOnUnexpectedSettlementToken() public {
    bytes memory payload = abi.encode(
        bytes32("intent"),
        address(0xBEEF),
        address(0xCAFE),
        uint256(90e6),
        address(usdc),
        bytes32("USDC.BASE"),
        uint256(90e6),
        bytes(""),
        bytes32(0)
    );

    vm.prank(address(0x1234));
    receiver.execute(address(0x9999), 100e6, payload);
}
```

- [ ] **Step 2: Run the receiver and router tests to capture the current payload shape**

Run: `forge test --config-path config/foundry.toml --match-contract ReceiverV1Test -vv`
Expected: FAIL because `ReceiverV1Test` does not exist and `ReceiverV1.execute` does not decode expected settlement-asset fields.

Run: `forge test --config-path config/foundry.toml --match-contract RouterV1Test -vv`
Expected: FAIL after the payload shape changes are introduced.

- [ ] **Step 3: Extend `SwapIntent` and `BridgeParams` with explicit settlement-asset fields**

```solidity
struct SwapIntent {
    ...
    bytes32 settlementAssetId;
    address expectedDstSettlementToken;
    bytes32 expectedDstSettlementAssetId;
    uint256 minSettlementAmount;
    ...
}

struct BridgeParams {
    ...
    bytes32 settlementAssetId;
    address expectedDstSettlementToken;
    bytes32 expectedDstSettlementAssetId;
    uint256 minSettlementAmount;
    ...
}
```

- [ ] **Step 4: Update RouterV1 hashing and destination payload encoding**

```solidity
bytes memory dstCalldata = abi.encode(
    intent.intentId,
    intent.user,
    intent.tokenOut,
    intent.minAmountOut,
    intent.expectedDstSettlementToken,
    intent.expectedDstSettlementAssetId,
    intent.minSettlementAmount,
    intent.swapDataDst,
    intent.dstSwapPluginId
);
```

- [ ] **Step 5: Make ReceiverV1 reject wrong settlement token / asset / amount before settlement**

```solidity
if (settlementToken != expectedSettlementToken) {
    revert UnexpectedSettlementToken(settlementToken, expectedSettlementToken);
}
if (amount < minSettlementAmount) {
    revert SettlementOutputTooLow(intentId, amount, minSettlementAmount);
}
```

- [ ] **Step 6: Update the Foundry tests to sign and decode the new payload**

```solidity
intent.settlementAssetId = keccak256("USDC.BASE");
intent.expectedDstSettlementToken = address(usdc);
intent.expectedDstSettlementAssetId = keccak256("USDC.ARB");
intent.minSettlementAmount = 99e6;
```

- [ ] **Step 7: Run the contract tests again**

Run: `forge test --config-path config/foundry.toml --match-contract RouterV1Test -vv`
Expected: PASS

Run: `forge test --config-path config/foundry.toml --match-contract ReceiverV1Test -vv`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add tests/contracts/ReceiverV1.t.sol tests/contracts/RouterV1.t.sol src/contracts/interfaces/IIntentTypes.sol src/contracts/RouterV1.sol src/contracts/ReceiverV1.sol src/vps/services/IntentCalldataBuilder.ts
git commit -m "refactor(contracts): validate explicit settlement assets"
```

### Task 5: Migrate Axelar To Dynamic Multi-Asset Settlement

**Files:**
- Modify: `tests/contracts/AxelarRailPlugin.t.sol`
- Modify: `tests/contracts/ReceiverAdapters.t.sol`
- Modify: `src/contracts/rails/AxelarRailPlugin.sol`
- Modify: `src/contracts/rails/AxelarReceiverAdapter.sol`
- Create: `src/vps/services/axelar/AxelarAssetCatalog.ts`
- Modify: `src/vps/rails/registry.ts`

- [ ] **Step 1: Write the failing Axelar test for a non-USDC asset route**

```solidity
function testBridgeAcceptsDynamicAxelarToken() public {
    bytes32 tokenId = keccak256("AXELAR_WETH");
    plugin.setRouteConfig(DST_CHAIN, "arbitrum", address(0xBEEF), tokenId);

    IntentTypes.BridgeParams memory params = _bridgeParams(address(weth), tokenId);
    bytes32 railTxId = plugin.bridge{value: GAS_FEE}(params);

    assertTrue(railTxId != bytes32(0));
}
```

- [ ] **Step 2: Run the Axelar-related test suites**

Run: `forge test --config-path config/foundry.toml --match-contract AxelarRailPluginTest -vv`
Expected: FAIL because `AxelarRailPlugin` only supports immutable `usdc`.

Run: `forge test --config-path config/foundry.toml --match-contract ReceiverAdaptersTest -vv`
Expected: FAIL once the adapter payload starts requiring dynamic token validation.

- [ ] **Step 3: Replace immutable USDC-only assumptions with per-route token metadata**

```solidity
struct AxelarRouteConfig {
    string chainName;
    address receiver;
    bytes32 destinationTokenId;
    address sourceSettlementToken;
}

mapping(uint32 => mapping(bytes32 => AxelarRouteConfig)) public routeConfigs;
```

- [ ] **Step 4: Validate the incoming Axelar token using the selected-offer payload**

```solidity
(..., address expectedSettlementToken, bytes32 expectedSettlementAssetId, ..., bytes memory downstreamPayload) = abi.decode(data, (...));
if (token != expectedSettlementToken) revert UntrustedToken(tokenId, token, expectedSettlementToken);
if (tokenId != expectedSettlementAssetId) revert UntrustedToken(tokenId, token, expectedSettlementToken);
```

- [ ] **Step 5: Add a VPS Axelar catalog that resolves token IDs dynamically**

```ts
export class AxelarAssetCatalog {
  async resolve(input: { srcChainId: number; dstChainId: number; canonicalAssetId: string }) {
    return {
      sourceSettlementToken: '0x...',
      destinationTokenId: '0x' + '12'.repeat(32),
      expectedDstSettlementToken: '0x...',
    };
  }
}
```

- [ ] **Step 6: Run the Axelar tests again**

Run: `forge test --config-path config/foundry.toml --match-contract AxelarRailPluginTest -vv`
Expected: PASS

Run: `forge test --config-path config/foundry.toml --match-contract ReceiverAdaptersTest -vv`
Expected: PASS for the Axelar adapter cases.

- [ ] **Step 7: Commit**

```bash
git add tests/contracts/AxelarRailPlugin.t.sol tests/contracts/ReceiverAdapters.t.sol src/contracts/rails/AxelarRailPlugin.sol src/contracts/rails/AxelarReceiverAdapter.sol src/vps/services/axelar/AxelarAssetCatalog.ts src/vps/rails/registry.ts
git commit -m "feat(axelar): support dynamic multi-asset settlement"
```

### Task 6: Migrate LayerZero To Dynamic OFT Route Metadata

**Files:**
- Modify: `tests/contracts/LayerZeroRailPlugin.t.sol`
- Modify: `tests/contracts/ReceiverAdapters.t.sol`
- Modify: `src/contracts/rails/LayerZeroRailPlugin.sol`
- Modify: `src/contracts/rails/LayerZeroReceiverAdapter.sol`
- Create: `src/vps/services/layerzero/LayerZeroRouteCatalog.ts`
- Modify: `src/vps/rails/registry.ts`

- [ ] **Step 1: Write the failing LayerZero test for a route-specific OFT config**

```solidity
function testBridgeUsesDynamicOftRouteConfig() public {
    plugin.setRouteConfig(DST_CHAIN, DST_EID, address(0xBEEF), hex"01020304", address(oft), address(usdc));

    IntentTypes.BridgeParams memory params = _bridgeParams(address(usdc));
    bytes32 railTxId = plugin.bridge{value: LZ_NATIVE_FEE}(params);

    assertTrue(railTxId != bytes32(0));
}
```

- [ ] **Step 2: Run the LayerZero-related suites**

Run: `forge test --config-path config/foundry.toml --match-contract LayerZeroRailPluginTest -vv`
Expected: FAIL because the plugin currently assumes one immutable OFT and settlement token.

Run: `forge test --config-path config/foundry.toml --match-contract ReceiverAdaptersTest -vv`
Expected: FAIL once the adapter begins validating dynamic route metadata.

- [ ] **Step 3: Introduce per-route OFT configuration**

```solidity
struct LzRouteConfig {
    uint32 dstEid;
    address dstReceiver;
    bytes options;
    address oft;
    address settlementToken;
}

mapping(uint32 => mapping(bytes32 => LzRouteConfig)) public routeConfigs;
```

- [ ] **Step 4: Validate both the compose sender and expected settlement token from payload**

```solidity
if (_from != expectedOft) revert UnauthorizedComposeSender(_from, expectedOft);
if (settlementToken != expectedSettlementToken) {
    revert UnexpectedSettlementToken(settlementToken, expectedSettlementToken);
}
```

- [ ] **Step 5: Add a VPS LayerZero route catalog**

```ts
export class LayerZeroRouteCatalog {
  async resolve(input: { srcChainId: number; dstChainId: number; canonicalAssetId: string }) {
    return {
      oftAddress: '0x...',
      settlementToken: '0x...',
      dstEid: 30111,
      extraOptions: '0x01020304',
    };
  }
}
```

- [ ] **Step 6: Run the LayerZero tests again**

Run: `forge test --config-path config/foundry.toml --match-contract LayerZeroRailPluginTest -vv`
Expected: PASS

Run: `forge test --config-path config/foundry.toml --match-contract ReceiverAdaptersTest -vv`
Expected: PASS for the LayerZero adapter cases.

- [ ] **Step 7: Commit**

```bash
git add tests/contracts/LayerZeroRailPlugin.t.sol tests/contracts/ReceiverAdapters.t.sol src/contracts/rails/LayerZeroRailPlugin.sol src/contracts/rails/LayerZeroReceiverAdapter.sol src/vps/services/layerzero/LayerZeroRouteCatalog.ts src/vps/rails/registry.ts
git commit -m "feat(layerzero): support dynamic route settlement assets"
```

### Task 7: Add THORChain Quote, Execution, And Monitoring Workers

**Files:**
- Create: `tests/vps/thorchain-quote-worker.test.ts`
- Create: `src/vps/services/thorchain/THORChainClient.ts`
- Create: `src/vps/services/thorchain/THORChainQuoteWorker.ts`
- Create: `src/vps/services/thorchain/THORChainMonitorWorker.ts`
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/app/runtime.ts`
- Modify: `src/vps/rails/execution.ts`
- Modify: `src/contracts/rails/THORChainRailPlugin.sol`

- [ ] **Step 1: Write the failing THORChain quote-worker test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { THORChainQuoteWorker } from '../../src/vps/services/thorchain/THORChainQuoteWorker';

test('THORChainQuoteWorker omits offers below recommended_min_amount_in', async () => {
  const worker = new THORChainQuoteWorker({ quoteSwap: async () => ({ recommended_min_amount_in: '500000' }) } as any);
  const offer = await worker.quote({
    amountIn: 30000n,
    srcChainId: 8453,
    dstChainId: 0,
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: 'BTC',
  } as any);

  assert.equal(offer, null);
});
```

- [ ] **Step 2: Run the THORChain worker test**

Run: `node --import tsx --test tests/vps/thorchain-quote-worker.test.ts`
Expected: FAIL because the worker and client do not exist.

- [ ] **Step 3: Implement a thin THORChain HTTP client**

```ts
export class THORChainClient {
  constructor(private readonly baseUrl = process.env.THORCHAIN_BASE_URL ?? 'https://thornode.ninerealms.com') {}

  async quoteSwap(params: URLSearchParams) {
    return this.getJson(`/thorchain/quote/swap?${params.toString()}`);
  }

  async inboundAddresses() {
    return this.getJson('/thorchain/inbound_addresses');
  }
}
```

- [ ] **Step 4: Implement the quote worker with economics normalization**

```ts
return {
  offerId: this.makeOfferId(),
  rail: Rail.THORCHAIN,
  railType: 'liquidity',
  ...,
  economics: {
    providerFeeUSD: 0,
    protocolFeeUSD,
    sourceGasUSD,
    outboundFeeUSD: quote.fees.outboundUsd,
    slippageBps: Number(quote.fees.slippage_bps),
    settlementTimeSeconds: Number(quote.total_swap_seconds ?? quote.inbound_confirmation_seconds),
    minimumInput: quote.recommended_min_amount_in,
  },
  execution: {
    thorAssetIdentifier: quote.to_asset,
    minThorOutput: quote.expected_amount_out,
    router: quote.router,
    inboundAddress: quote.inbound_address,
    memo: quote.memo,
  },
};
```

- [ ] **Step 5: Promote THORChain to an active worker in runtime and rail execution manager**

```ts
const thorchainWorker = new THORChainMonitorWorker(intentService, thorchainClient);
const railExecutions = await railExecutionManager.startAll({
  enabled: {
    [Rail.CCTP]: enableCctpRelay,
    [Rail.THORCHAIN]: envBool('ENABLE_THORCHAIN_WORKER', true),
  },
});
```

- [ ] **Step 6: Keep the plugin thin but emit enough metadata for monitoring**

```solidity
event THORSwapInitiated(
    bytes32 indexed intentId,
    address asset,
    uint256 amount,
    string memo,
    uint256 expiry
);
```

- [ ] **Step 7: Run the THORChain worker test**

Run: `node --import tsx --test tests/vps/thorchain-quote-worker.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add tests/vps/thorchain-quote-worker.test.ts src/vps/services/thorchain/THORChainClient.ts src/vps/services/thorchain/THORChainQuoteWorker.ts src/vps/services/thorchain/THORChainMonitorWorker.ts src/vps/services/QuoteEngine.ts src/vps/app/runtime.ts src/vps/rails/execution.ts src/contracts/rails/THORChainRailPlugin.sol
git commit -m "feat(thorchain): add quote and monitoring workers"
```

### Task 8: Remove Cross-Rail Auto-Fallback And Add Mainnet Canary Guardrails

**Files:**
- Create: `tests/vps/recovery-engine.test.ts`
- Modify: `src/vps/services/RecoveryEngine.ts`
- Modify: `src/vps/services/IntentService.ts`
- Modify: `src/vps/app/runtime.ts`
- Create: `docs/ops/thorchain-mainnet-canary.md`

- [ ] **Step 1: Write the failing recovery-engine test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryEngine } from '../../src/vps/services/RecoveryEngine';

test('RecoveryEngine does not silently switch a user-selected rail', async () => {
  let fallbackRail: string | null = null;
  const engine = new RecoveryEngine({} as any, {} as any, async (_intent, nextRail) => {
    fallbackRail = nextRail;
  });

  await (engine as any)._recover({
    intentId: '0x' + '11'.repeat(32),
    retryCount: 0,
    quote: { rail: 'THORCHAIN', offerId: '0x' + 'aa'.repeat(32) },
    selectedByUser: true,
  });

  assert.equal(fallbackRail, null);
});
```

- [ ] **Step 2: Run the recovery test**

Run: `node --import tsx --test tests/vps/recovery-engine.test.ts`
Expected: FAIL because the current engine is designed to hop to a different rail automatically.

- [ ] **Step 3: Make selected rail binding in recovery**

```ts
if (intent.quote.selectedByUser) {
  await this.intentService.markFailed(intent.intentId, 'Selected rail became unrecoverable; user must request a fresh quote', {
    actor: 'system',
    eventSource: 'recovery-engine',
  });
  return;
}
```

- [ ] **Step 4: Add canary gating for THORChain**

```ts
const allowedPairs = new Set((process.env.THORCHAIN_CANARY_ALLOWLIST ?? '8453:1:BASE.ETH:ETH.ETH,8453:0:BASE.ETH:BTC.BTC').split(','));
if (!allowedPairs.has(`${srcChainId}:${dstChainId}:${fromAsset}:${toAsset}`)) return null;
```

- [ ] **Step 5: Document the mainnet runbook**

```md
# THORChain Mainnet Canary

- Only enable pairs in `THORCHAIN_CANARY_ALLOWLIST`
- Reject stale quotes older than 30s or past provider expiry
- Do not switch rails after user selection
- Disable `ENABLE_THORCHAIN_WORKER` to halt new THORChain intents
```

- [ ] **Step 6: Run the recovery test**

Run: `node --import tsx --test tests/vps/recovery-engine.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tests/vps/recovery-engine.test.ts src/vps/services/RecoveryEngine.ts src/vps/services/IntentService.ts src/vps/app/runtime.ts docs/ops/thorchain-mainnet-canary.md
git commit -m "fix(recovery): preserve user-selected rail and add canary guardrails"
```

### Task 9: End-To-End Verification

**Files:**
- Verify only: `src/vps/**`, `src/contracts/**`, `tests/**`, `docs/ops/thorchain-mainnet-canary.md`

- [ ] **Step 1: Run the VPS unit tests**

Run: `node --import tsx --test tests/vps/offer-cache.test.ts tests/vps/quote-engine-offers.test.ts tests/vps/offer-selection.test.ts tests/vps/thorchain-quote-worker.test.ts tests/vps/recovery-engine.test.ts`
Expected: PASS

- [ ] **Step 2: Run the targeted Foundry suites**

Run: `forge test --config-path config/foundry.toml --match-contract RouterV1Test -vv`
Expected: PASS

Run: `forge test --config-path config/foundry.toml --match-contract ReceiverV1Test -vv`
Expected: PASS

Run: `forge test --config-path config/foundry.toml --match-contract AxelarRailPluginTest -vv`
Expected: PASS

Run: `forge test --config-path config/foundry.toml --match-contract LayerZeroRailPluginTest -vv`
Expected: PASS

Run: `forge test --config-path config/foundry.toml --match-contract ReceiverAdaptersTest -vv`
Expected: PASS

- [ ] **Step 3: Run the full Solidity suite**

Run: `npm run sol:test`
Expected: PASS

- [ ] **Step 4: Run TypeScript type-checking**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Smoke test the API runtime**

Run: `ENABLE_THORCHAIN_WORKER=1 ENABLE_PARTNER_API=1 tsx src/vps/app/api.ts`
Expected: server starts without boot-time exceptions and reports THORChain worker enabled in logs.

- [ ] **Step 6: Commit the integrated result**

```bash
git add src/vps src/contracts tests docs/ops/thorchain-mainnet-canary.md
git commit -m "feat(v2): add THORChain and multi-asset rail architecture"
```

---

## Self-Review

- Spec coverage:
  - multi-offer marketplace: covered by Tasks 1-3
  - explicit provider economics: covered by Tasks 1, 2, and 7
  - explicit destination settlement validation: covered by Task 4
  - Axelar and LayerZero migration: covered by Tasks 5 and 6
  - THORChain integration: covered by Tasks 7 and 8
  - mainnet canary rollout: covered by Task 8
- Placeholder scan:
  - no `TODO`, `TBD`, or “similar to Task N” placeholders remain
- Type consistency:
  - `OfferSet`, `RailOffer`, `ProviderAssetRef`, and `OfferEconomics` are introduced before they are referenced by later tasks
  - settlement-asset fields are introduced in Task 4 before Axelar / LayerZero / THORChain tasks depend on them

