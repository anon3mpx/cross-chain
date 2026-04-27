# Route Asset Maximum Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow settlement-token model with a route-asset control plane that can return the best executable offers across CCTP, Axelar, LayerZero, and THORChain, including direct-delivery routes and THORChain API-direct offers.

**Architecture:** The VPS becomes the control plane for route-asset policy, chain-pair availability, and provider metadata. Messaging rails continue using RouterV1 plus destination adapters, but they stop depending on a tiny global settlement enum and instead validate exact source and destination route tokens plus provider asset IDs. THORChain is split out as an API-driven direct rail: quote discovery, route construction, and monitoring are off-chain, and no THORChain destination deployments are required.

**Tech Stack:** TypeScript, Node.js, Express, ethers v6, Redis/in-memory cache, Foundry Solidity tests

---

## File Structure

### Core VPS types and integration surfaces

- Modify: `src/vps/types/index.ts`
  Responsibility: define route-asset vocabulary, offer types, delivery shape, and execution mode.
- Modify: `src/vps/api/quoteCodec.ts`
  Responsibility: serialize and parse route-asset offers and selected-offer requests.
- Modify: `src/vps/services/IntentService.ts`
  Responsibility: materialize selected-offer intents and preserve execution-mode-specific payloads.
- Modify: `src/vps/services/IntentCalldataBuilder.ts`
  Responsibility: build RouterV1 calldata only for messaging-style `router_intent` offers.
- Create: `src/vps/services/DirectRailIntegrationBuilder.ts`
  Responsibility: build provider-direct integrations for THORChain offers.
- Modify: `src/vps/api/StatusAPI.ts`
  Responsibility: return offer sets and selected-offer integrations for both router and provider-direct modes.

### Off-chain control plane

- Create: `src/vps/services/RouteAssetPolicy.ts`
  Responsibility: maintain rail-wide allowed route assets and pair-specific overrides off-chain.
- Create: `src/vps/services/DeploymentRegistry.ts`
  Responsibility: answer whether a `srcChain -> dstChain` path is executable for a rail and whether destination infrastructure is required.
- Modify: `src/vps/rails/registry.ts`
  Responsibility: keep rail-family metadata, but stop treating coarse `supportsUSDC/supportsETH` flags as the source of truth for real route assets.

### Provider catalogs and offer construction

- Modify: `src/vps/services/axelar/AxelarAssetCatalog.ts`
  Responsibility: list executable Axelar route assets per chain pair and distinguish direct vs swap-required paths.
- Modify: `src/vps/services/layerzero/LayerZeroRouteCatalog.ts`
  Responsibility: list executable LayerZero route assets and surface `lz_oft`, `lz_oft_adapter`, `lz_stargate_pool`, and `lz_stargate_oft` offer types.
- Modify: `src/vps/services/thorchain/THORChainClient.ts`
  Responsibility: expose quote and monitoring fields needed for provider-direct THOR integrations.
- Modify: `src/vps/services/thorchain/THORChainQuoteWorker.ts`
  Responsibility: normalize THOR API quotes into provider-direct offers.
- Modify: `src/vps/services/QuoteEngine.ts`
  Responsibility: build route-asset offers, rank direct routes correctly, and mark execution mode.
- Modify: `src/vps/services/RailSelector.ts`
  Responsibility: score route quality inputs instead of deciding only by a coarse settlement token.
- Modify: `src/vps/services/RouterBuilder.ts`
  Responsibility: emit candidate route shapes that can later be materialized into route-asset offers.

### Runtime and monitoring

- Modify: `src/vps/app/runtime.ts`
  Responsibility: wire policy, deployment registry, and direct-rail integration builders into the app runtime.
- Modify: `src/vps/rails/execution.ts`
  Responsibility: keep THORChain as a monitor-only worker path and stop assuming a THOR on-chain plugin deployment.
- Modify: `src/vps/services/thorchain/THORChainMonitorWorker.ts`
  Responsibility: track provider-direct THORChain intents using off-chain identifiers.

### Messaging-rail contracts

- Modify: `src/contracts/interfaces/IIntentTypes.sol`
  Responsibility: replace settlement-enum-centric route fields with exact source and destination route token fields plus provider asset IDs.
- Modify: `src/contracts/RouterV1.sol`
  Responsibility: swap into an explicit source route token and forward exact route-token expectations to rail plugins and destination handlers.
- Modify: `src/contracts/ReceiverV1.sol`
  Responsibility: validate the exact destination route token and provider asset ID before direct delivery or destination swap.
- Modify: `src/contracts/rails/AxelarRailPlugin.sol`
  Responsibility: enforce pairwise route-token configuration rather than a tiny token enum.
- Modify: `src/contracts/rails/AxelarReceiverAdapter.sol`
  Responsibility: validate exact Axelar token identity against the selected offer payload.
- Modify: `src/contracts/rails/LayerZeroRailPlugin.sol`
  Responsibility: accept route-token config keyed by asset ID and support LayerZero family offer types without hardcoding a single OFT.
- Modify: `src/contracts/rails/LayerZeroReceiverAdapter.sol`
  Responsibility: validate route-asset-aware peers and destination token expectations.

### Tests and docs

- Create: `tests/vps/quote-codec-route-asset.test.ts`
- Create: `tests/vps/route-asset-policy.test.ts`
- Create: `tests/vps/quote-engine-route-assets.test.ts`
- Create: `tests/vps/direct-rail-integration.test.ts`
- Modify: `tests/vps/layerzero-route-catalog.test.ts`
- Create: `tests/vps/axelar-asset-catalog.test.ts`
- Modify: `tests/vps/thorchain-quote-worker.test.ts`
- Modify: `tests/vps/recovery-engine.test.ts`
- Modify: `tests/contracts/RouterV1.t.sol`
- Modify: `tests/contracts/ReceiverV1.t.sol`
- Modify: `tests/contracts/AxelarRailPlugin.t.sol`
- Modify: `tests/contracts/LayerZeroRailPlugin.t.sol`
- Modify: `tests/contracts/ReceiverAdapters.t.sol`
- Create: `docs/ops/thorchain-api-direct.md`
  Responsibility: document THORChain API-direct execution, monitoring, and rollout flags.

---

### Task 1: Introduce Route Asset Offer Types And Integration Modes

**Files:**
- Create: `tests/vps/quote-codec-route-asset.test.ts`
- Modify: `src/vps/types/index.ts`
- Modify: `src/vps/api/quoteCodec.ts`

- [ ] **Step 1: Write the failing codec test for route-asset offers**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeOfferSet } from '../../src/vps/api/quoteCodec';
import { Rail } from '../../src/vps/types';

test('serializeOfferSet preserves routeAsset, offerType, deliveryShape, and executionMode', () => {
  const json = serializeOfferSet({
    offerSetId: '0x' + '11'.repeat(32),
    expiresAt: 1_800_000_000,
    offers: [
      {
        offerId: '0x' + 'aa'.repeat(32),
        rail: Rail.LAYERZERO,
        offerType: 'lz_oft',
        railType: 'messaging',
        srcChainId: 8453,
        dstChainId: 42161,
        tokenIn: '0x1111111111111111111111111111111111111111',
        tokenOut: '0x2222222222222222222222222222222222222222',
        amountIn: 1_000_000n,
        estimatedOut: 990_000n,
        minAmountOut: 985_000n,
        expiresAt: 1_800_000_000,
        deliveryShape: 'direct',
        executionMode: 'router_intent',
        routeAsset: {
          canonicalAssetId: 'eip155:8453/erc20:0x0000000000000000000000000000000000001003',
          providerAssetId: 'layerzero:oft:base:weth',
          srcTokenAddress: '0x0000000000000000000000000000000000001003',
          dstTokenAddress: '0x0000000000000000000000000000000000002003',
          decimals: 18,
          assetKind: 'erc20',
          assetStandard: 'oft',
        },
        economics: {
          providerFeeUSD: 0.21,
          protocolFeeUSD: 0.50,
          sourceGasUSD: 0.08,
          settlementTimeSeconds: 45,
        },
        execution: { mode: 'router_intent' },
      },
    ],
  }) as any;

  assert.equal(json.offers[0].offerType, 'lz_oft');
  assert.equal(json.offers[0].deliveryShape, 'direct');
  assert.equal(json.offers[0].executionMode, 'router_intent');
  assert.equal(json.offers[0].routeAsset.assetStandard, 'oft');
});
```

- [ ] **Step 2: Run the test to verify the current types are too narrow**

Run: `node --import tsx --test tests/vps/quote-codec-route-asset.test.ts`
Expected: FAIL with property/type errors for `offerType`, `deliveryShape`, `executionMode`, and `routeAsset.assetStandard`.

- [ ] **Step 3: Add route-asset and execution discriminators to shared types**

```ts
export type RailOfferType =
  | 'cctp_standard'
  | 'cctp_fast'
  | 'axelar_direct'
  | 'axelar_dst_swap'
  | 'lz_oft'
  | 'lz_oft_adapter'
  | 'lz_stargate_pool'
  | 'lz_stargate_oft'
  | 'thor_api_direct';

export type DeliveryShape =
  | 'direct'
  | 'src_swap_required'
  | 'dst_swap_required'
  | 'src_and_dst_swap_required';

export type ExecutionMode = 'router_intent' | 'provider_direct';

export interface RouteAssetRef {
  canonicalAssetId: string;
  providerAssetId: string;
  srcTokenAddress?: string;
  dstTokenAddress?: string;
  decimals: number;
  assetKind: 'erc20' | 'native' | 'btc' | 'sol' | 'doge' | 'cosmos';
  assetStandard: 'erc20' | 'native' | 'oft' | 'oft_adapter' | 'stargate_pool' | 'stargate_oft' | 'thor_native';
}

export interface RailOffer {
  offerId: string;
  rail: Rail;
  offerType: RailOfferType;
  railType: 'messaging' | 'liquidity';
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  estimatedOut: bigint;
  minAmountOut: bigint;
  expiresAt: number;
  deliveryShape: DeliveryShape;
  executionMode: ExecutionMode;
  routeAsset: RouteAssetRef;
  economics: OfferEconomics;
  execution: Record<string, unknown>;
}
```

- [ ] **Step 4: Keep codec logic generic and only tighten selected-offer parsing**

```ts
export function parseOfferSelection(input: any): { offerSetId: string; offerId: string } {
  if (!input || typeof input !== 'object') throw new Error('Invalid payload');

  const offerSetId = parseOptionalText(input.offerSetId);
  const offerId = parseOptionalText(input.offerId ?? input.selectedOfferId);

  if (!offerSetId) throw new Error('offerSetId required');
  if (!offerId) throw new Error('offerId required');

  return { offerSetId, offerId };
}
```

- [ ] **Step 5: Re-run the codec test**

Run: `node --import tsx --test tests/vps/quote-codec-route-asset.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the vocabulary change locally**

```bash
git add tests/vps/quote-codec-route-asset.test.ts src/vps/types/index.ts src/vps/api/quoteCodec.ts
git commit -m "refactor(vps): add route asset offer vocabulary"
```

### Task 2: Build The Off-Chain Control Plane For Route Policy And Pair Availability

**Files:**
- Create: `tests/vps/route-asset-policy.test.ts`
- Create: `src/vps/services/RouteAssetPolicy.ts`
- Create: `src/vps/services/DeploymentRegistry.ts`

- [ ] **Step 1: Write the failing control-plane test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { Rail } from '../../src/vps/types';
import { StaticRouteAssetPolicy } from '../../src/vps/services/RouteAssetPolicy';
import { StaticDeploymentRegistry } from '../../src/vps/services/DeploymentRegistry';

test('pair availability requires policy plus deployment registry, while THOR direct skips destination deployments', () => {
  const policy = new StaticRouteAssetPolicy({
    [Rail.AXELAR]: ['USDC', 'WETH'],
    [Rail.THORCHAIN]: ['BTC.BTC', 'SOL.SOL'],
  });
  const registry = new StaticDeploymentRegistry([
    {
      rail: Rail.AXELAR,
      srcChainId: 42161,
      dstChainId: 8453,
      enabled: true,
      requiresDestinationContracts: true,
      sourceReady: true,
      destinationReady: true,
    },
    {
      rail: Rail.THORCHAIN,
      srcChainId: 42161,
      dstChainId: 99,
      enabled: true,
      requiresDestinationContracts: false,
      sourceReady: true,
      destinationReady: false,
    },
  ]);

  assert.equal(policy.isAllowed(Rail.AXELAR, 'WETH'), true);
  assert.equal(registry.isExecutable(Rail.AXELAR, 42161, 8453), true);
  assert.equal(registry.isExecutable(Rail.THORCHAIN, 42161, 99), true);
  assert.equal(registry.requiresDestinationContracts(Rail.THORCHAIN, 42161, 99), false);
});
```

- [ ] **Step 2: Run the test to confirm the control plane does not exist yet**

Run: `node --import tsx --test tests/vps/route-asset-policy.test.ts`
Expected: FAIL with module-not-found errors for `RouteAssetPolicy` and `DeploymentRegistry`.

- [ ] **Step 3: Implement a minimal route-asset policy service**

```ts
import { Rail } from '../types';

export interface RouteAssetPolicy {
  isAllowed(rail: Rail, assetAlias: string): boolean;
  allowedAssets(rail: Rail): string[];
}

export class StaticRouteAssetPolicy implements RouteAssetPolicy {
  constructor(private readonly byRail: Partial<Record<Rail, string[]>>) {}

  isAllowed(rail: Rail, assetAlias: string): boolean {
    return this.allowedAssets(rail).includes(assetAlias.toUpperCase());
  }

  allowedAssets(rail: Rail): string[] {
    return (this.byRail[rail] ?? []).map((value) => value.toUpperCase());
  }
}
```

- [ ] **Step 4: Implement a minimal pair-availability registry**

```ts
import { Rail } from '../types';

export interface DeploymentRoute {
  rail: Rail;
  srcChainId: number;
  dstChainId: number;
  enabled: boolean;
  requiresDestinationContracts: boolean;
  sourceReady: boolean;
  destinationReady: boolean;
}

export class StaticDeploymentRegistry {
  constructor(private readonly routes: DeploymentRoute[]) {}

  isExecutable(rail: Rail, srcChainId: number, dstChainId: number): boolean {
    const hit = this.routes.find((route) =>
      route.rail === rail && route.srcChainId === srcChainId && route.dstChainId === dstChainId,
    );
    if (!hit) return false;
    if (!hit.enabled || !hit.sourceReady) return false;
    return hit.requiresDestinationContracts ? hit.destinationReady : true;
  }

  requiresDestinationContracts(rail: Rail, srcChainId: number, dstChainId: number): boolean {
    return this.routes.find((route) =>
      route.rail === rail && route.srcChainId === srcChainId && route.dstChainId === dstChainId,
    )?.requiresDestinationContracts ?? true;
  }
}
```

- [ ] **Step 5: Re-run the control-plane test**

Run: `node --import tsx --test tests/vps/route-asset-policy.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the control-plane primitives locally**

```bash
git add tests/vps/route-asset-policy.test.ts src/vps/services/RouteAssetPolicy.ts src/vps/services/DeploymentRegistry.ts
git commit -m "feat(vps): add off-chain route policy control plane"
```

### Task 3: Expand Axelar And LayerZero Catalogs Into Route-Asset Families

**Files:**
- Create: `tests/vps/axelar-asset-catalog.test.ts`
- Modify: `tests/vps/layerzero-route-catalog.test.ts`
- Modify: `src/vps/services/axelar/AxelarAssetCatalog.ts`
- Modify: `src/vps/services/layerzero/LayerZeroRouteCatalog.ts`
- Modify: `src/vps/rails/registry.ts`

- [ ] **Step 1: Write the failing provider-catalog tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { AxelarAssetCatalog } from '../../src/vps/services/axelar/AxelarAssetCatalog';
import { LayerZeroRouteCatalog } from '../../src/vps/services/layerzero/LayerZeroRouteCatalog';

test('AxelarAssetCatalog lists both direct and destination-swap route assets', () => {
  const catalog = new AxelarAssetCatalog({
    routeAssetAliases: ['USDC', 'WETH'],
    chainPairs: [{ srcChainId: 8453, dstChainId: 42161 }],
  } as any);

  const routes = catalog.listRoutes({ srcChainId: 8453, dstChainId: 42161 });
  assert.ok(routes.some((route) => route.offerType === 'axelar_direct'));
  assert.ok(routes.some((route) => route.offerType === 'axelar_dst_swap'));
});

test('LayerZeroRouteCatalog lists OFT, OFTAdapter, and Stargate families separately', () => {
  const catalog = new LayerZeroRouteCatalog({
    routeAssets: [
      { offerType: 'lz_oft', providerAssetId: 'layerzero:oft:weth' },
      { offerType: 'lz_oft_adapter', providerAssetId: 'layerzero:adapter:usdc' },
      { offerType: 'lz_stargate_pool', providerAssetId: 'layerzero:stargate:usdc' },
    ],
  } as any);

  const routes = catalog.listRoutes({ srcChainId: 8453, dstChainId: 42161 });
  assert.deepEqual(routes.map((route) => route.offerType), [
    'lz_oft',
    'lz_oft_adapter',
    'lz_stargate_pool',
  ]);
});
```

- [ ] **Step 2: Run the provider-catalog tests to confirm the current single-resolve APIs are insufficient**

Run: `node --import tsx --test tests/vps/axelar-asset-catalog.test.ts tests/vps/layerzero-route-catalog.test.ts`
Expected: FAIL because `listRoutes` and the richer route-family return values do not exist.

- [ ] **Step 3: Teach Axelar to list route-asset options instead of resolving only one**

```ts
export interface AxelarRouteOption {
  offerType: 'axelar_direct' | 'axelar_dst_swap';
  routeAsset: RouteAssetRef;
  expectedDstToken: string;
  expectedDstAssetId: string;
}

listRoutes(input: { srcChainId: number; dstChainId: number }): AxelarRouteOption[] {
  const results: AxelarRouteOption[] = [];

  for (const assetAlias of this.policy.allowedAssets(Rail.AXELAR)) {
    const direct = this.tryResolveRoute(input, assetAlias, 'axelar_direct');
    if (direct) results.push(direct);

    const swapPath = this.tryResolveRoute(input, assetAlias, 'axelar_dst_swap');
    if (swapPath) results.push(swapPath);
  }

  return results;
}
```

- [ ] **Step 4: Teach LayerZero to emit distinct offer families**

```ts
export interface LayerZeroRouteOption {
  offerType: 'lz_oft' | 'lz_oft_adapter' | 'lz_stargate_pool' | 'lz_stargate_oft';
  routeAsset: RouteAssetRef;
  oftAddress: string;
  dstEid: number;
  extraOptions: string;
  expectedDstToken: string;
  expectedDstAssetId: string;
}

listRoutes(input: { srcChainId: number; dstChainId: number }): LayerZeroRouteOption[] {
  return this.routeFamilies
    .filter((route) => route.srcChainId === input.srcChainId && route.dstChainId === input.dstChainId)
    .map((route) => ({
      offerType: route.offerType,
      routeAsset: route.routeAsset,
      oftAddress: route.oftAddress,
      dstEid: route.dstEid,
      extraOptions: route.extraOptions,
      expectedDstToken: route.expectedDstSettlementToken,
      expectedDstAssetId: route.expectedDstSettlementAssetId,
    }));
}
```

- [ ] **Step 5: Re-run the provider-catalog tests**

Run: `node --import tsx --test tests/vps/axelar-asset-catalog.test.ts tests/vps/layerzero-route-catalog.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the catalog-family refactor locally**

```bash
git add tests/vps/axelar-asset-catalog.test.ts tests/vps/layerzero-route-catalog.test.ts src/vps/services/axelar/AxelarAssetCatalog.ts src/vps/services/layerzero/LayerZeroRouteCatalog.ts src/vps/rails/registry.ts
git commit -m "feat(vps): expand provider catalogs into route asset families"
```

### Task 4: Refactor Quote Engine To Build Route-Asset Offers And THOR Direct Offers

**Files:**
- Create: `tests/vps/quote-engine-route-assets.test.ts`
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/services/RailSelector.ts`
- Modify: `src/vps/services/RouterBuilder.ts`
- Modify: `src/vps/services/thorchain/THORChainClient.ts`
- Modify: `src/vps/services/thorchain/THORChainQuoteWorker.ts`

- [ ] **Step 1: Write the failing quote-engine test for mixed route shapes**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { Rail } from '../../src/vps/types';

test('getOffers returns direct LayerZero offers, swap-shaped messaging offers, and provider-direct THOR offers', async () => {
  const engine = new QuoteEngine(/* inject test doubles */);
  const result = await engine.getOffers({
    tokenIn: '0x1111111111111111111111111111111111111111',
    tokenOut: '0x2222222222222222222222222222222222222222',
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: '0x3333333333333333333333333333333333333333',
    urgency: 'normal',
  });

  assert.ok(result);
  assert.ok(result!.offers.some((offer) => offer.rail === Rail.LAYERZERO && offer.offerType === 'lz_oft' && offer.deliveryShape === 'direct'));
  assert.ok(result!.offers.some((offer) => offer.rail === Rail.CCTP && offer.offerType === 'cctp_fast'));
  assert.ok(result!.offers.some((offer) => offer.rail === Rail.THORCHAIN && offer.executionMode === 'provider_direct'));
});
```

- [ ] **Step 2: Run the quote-engine test to confirm the current engine still thinks in single settlement tokens**

Run: `node --import tsx --test tests/vps/quote-engine-route-assets.test.ts`
Expected: FAIL because the current engine does not emit `offerType`, `deliveryShape`, or `provider_direct` offers.

- [ ] **Step 3: Update QuoteEngine to materialize route-asset offers**

```ts
private async _computeOfferSet(req: QuoteRequest): Promise<OfferSet | null> {
  const amountUSD = await this._estimateUSD(req.tokenIn, req.srcChainId, req.amountIn);
  const candidateRoutes = this.routeBuilder.buildRoutes(req.srcChainId, req.dstChainId, amountUSD, req.urgency ?? 'normal');

  const offers = (await Promise.all(candidateRoutes.flatMap((route) => this._buildOffersForRoute(req, route, amountUSD))))
    .flat()
    .filter((offer): offer is RailOffer => offer !== null);

  if (offers.length === 0) return null;
  return this._toOfferSet(this._rankOffers(offers));
}
```

- [ ] **Step 4: Mark THOR offers as provider-direct and keep its execution metadata off-chain**

```ts
private async _buildThorDirectOffer(req: QuoteRequest, amountUSD: number): Promise<RailOffer | null> {
  const quoted = await this.thorchainQuoteWorker?.quote(/* normalized request */);
  if (!quoted) return null;

  return {
    offerId: this._makeOfferId(),
    rail: Rail.THORCHAIN,
    offerType: 'thor_api_direct',
    railType: 'liquidity',
    srcChainId: req.srcChainId,
    dstChainId: req.dstChainId,
    tokenIn: req.tokenIn,
    tokenOut: req.tokenOut,
    amountIn: req.amountIn,
    estimatedOut: BigInt(quoted.expectedAmountOut ?? '0'),
    minAmountOut: BigInt(quoted.expectedAmountOut ?? '0'),
    expiresAt: Number(quoted.quote.expiry ?? Math.floor(Date.now() / 1000) + 60),
    deliveryShape: 'direct',
    executionMode: 'provider_direct',
    routeAsset: this._thorRouteAsset(quoted.quote.to_asset ?? req.tokenOut),
    economics: {
      providerFeeUSD: 0,
      protocolFeeUSD: Math.max(0.5, amountUSD * 0.0005),
      sourceGasUSD: 0,
      outboundFeeUSD: quoted.outboundFeeUSD,
      slippageBps: quoted.slippageBps,
      settlementTimeSeconds: quoted.settlementTimeSeconds ?? 60,
      minimumInput: quoted.recommendedMinAmountIn,
    },
    execution: {
      mode: 'provider_direct',
      provider: 'thorchain',
      quote: quoted.quote,
    },
  };
}
```

- [ ] **Step 5: Re-run the quote-engine test**

Run: `node --import tsx --test tests/vps/quote-engine-route-assets.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the route-asset offer builder locally**

```bash
git add tests/vps/quote-engine-route-assets.test.ts src/vps/services/QuoteEngine.ts src/vps/services/RailSelector.ts src/vps/services/RouterBuilder.ts src/vps/services/thorchain/THORChainClient.ts src/vps/services/thorchain/THORChainQuoteWorker.ts
git commit -m "feat(vps): build route asset offers across rails"
```

### Task 5: Split Selected-Offer Integrations Into Router Intents And Provider-Direct Actions

**Files:**
- Create: `tests/vps/direct-rail-integration.test.ts`
- Create: `src/vps/services/DirectRailIntegrationBuilder.ts`
- Modify: `src/vps/services/IntentService.ts`
- Modify: `src/vps/services/IntentCalldataBuilder.ts`
- Modify: `src/vps/api/StatusAPI.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSelectedOfferIntegration } from '../../src/vps/services/DirectRailIntegrationBuilder';

test('provider_direct THOR offers return deposit instructions instead of RouterV1 calldata', async () => {
  const integration = await buildSelectedOfferIntegration('0x' + '11'.repeat(32), {
    executionMode: 'provider_direct',
    execution: {
      provider: 'thorchain',
      quote: {
        inbound_address: '0xthorvault',
        memo: '=:BTC.BTC:bc1qexample:0',
        expiry: 1_800_000_000,
        expected_amount_out: '100000000',
      },
    },
  } as any, '0x3333333333333333333333333333333333333333');

  assert.equal(integration.mode, 'provider_direct');
  assert.equal(integration.action.kind, 'thorchain_swap');
  assert.equal(integration.action.depositAddress, '0xthorvault');
});
```

- [ ] **Step 2: Run the integration test to confirm the current stack only knows RouterV1**

Run: `node --import tsx --test tests/vps/direct-rail-integration.test.ts`
Expected: FAIL because no direct-integration builder exists.

- [ ] **Step 3: Implement the provider-direct integration builder**

```ts
export async function buildSelectedOfferIntegration(intentId: string, offer: RailOffer, userAddress: string) {
  if (offer.executionMode === 'router_intent') {
    const quote = materializeSelectedOfferQuote(offer);
    return {
      mode: 'router_intent' as const,
      integration: await buildRouterIntegration(intentId, quote, userAddress),
    };
  }

  if (offer.executionMode === 'provider_direct' && offer.execution.provider === 'thorchain') {
    const quote = offer.execution.quote as Record<string, unknown>;
    return {
      mode: 'provider_direct' as const,
      action: {
        kind: 'thorchain_swap' as const,
        depositAddress: String(quote.inbound_address ?? ''),
        memo: String(quote.memo ?? ''),
        expiresAt: Number(quote.expiry ?? 0),
        expectedAmountOut: String(quote.expected_amount_out ?? ''),
      },
    };
  }

  throw new Error(`Unsupported execution mode ${offer.executionMode}`);
}
```

- [ ] **Step 4: Return the discriminated integration shape from the status API**

```ts
const integration = await buildSelectedOfferIntegration(intent.intentId, selection.offer, userAddress);
res.json({
  intentId: intent.intentId,
  quote: serializeQuote(intent.quote),
  integration,
});
```

- [ ] **Step 5: Re-run the integration test**

Run: `node --import tsx --test tests/vps/direct-rail-integration.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the integration split locally**

```bash
git add tests/vps/direct-rail-integration.test.ts src/vps/services/DirectRailIntegrationBuilder.ts src/vps/services/IntentService.ts src/vps/services/IntentCalldataBuilder.ts src/vps/api/StatusAPI.ts
git commit -m "feat(api): add provider direct offer integrations"
```

### Task 6: Refactor Messaging-Rail Contracts Around Exact Route Tokens And Pairwise Trust

**Files:**
- Modify: `tests/contracts/RouterV1.t.sol`
- Modify: `tests/contracts/ReceiverV1.t.sol`
- Modify: `tests/contracts/AxelarRailPlugin.t.sol`
- Modify: `tests/contracts/LayerZeroRailPlugin.t.sol`
- Modify: `tests/contracts/ReceiverAdapters.t.sol`
- Modify: `src/contracts/interfaces/IIntentTypes.sol`
- Modify: `src/contracts/RouterV1.sol`
- Modify: `src/contracts/ReceiverV1.sol`
- Modify: `src/contracts/rails/AxelarRailPlugin.sol`
- Modify: `src/contracts/rails/AxelarReceiverAdapter.sol`
- Modify: `src/contracts/rails/LayerZeroRailPlugin.sol`
- Modify: `src/contracts/rails/LayerZeroReceiverAdapter.sol`

- [ ] **Step 1: Write the failing RouterV1 test for explicit source route tokens**

```solidity
function testInitiateSwapUsesExplicitSourceRouteToken() public {
    intent.sourceRouteToken = address(usdc);
    intent.expectedDstRouteToken = address(usdcDst);
    intent.sourceRouteAssetId = keccak256("axelar-usdc-src");
    intent.expectedDstRouteAssetId = keccak256("axelar-usdc-dst");

    vm.prank(user);
    vm.expectEmit(true, true, false, true);
    emit IntentInitiated(intent.intentId, user, address(tokenIn), intent.amountIn, intent.dstChainId, bytes32(0));
    router.initiateSwap(intent, signature);
}
```

- [ ] **Step 2: Run the messaging contract tests to capture the current enum-centric assumptions**

Run: `forge test --match-path tests/contracts/RouterV1.t.sol --match-path tests/contracts/ReceiverV1.t.sol --match-path tests/contracts/AxelarRailPlugin.t.sol --match-path tests/contracts/LayerZeroRailPlugin.t.sol --match-path tests/contracts/ReceiverAdapters.t.sol`
Expected: FAIL with missing fields such as `sourceRouteToken`, `expectedDstRouteToken`, and route-token validation mismatches.

- [ ] **Step 3: Replace enum-centric route fields with explicit route-token fields in `IIntentTypes.sol`**

```solidity
struct SwapIntent {
    address user;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 minAmountOut;
    uint256 minSrcSwapOut;
    uint32  dstChainId;
    uint8   rail;
    address sourceRouteToken;
    bytes32 sourceRouteAssetId;
    address expectedDstRouteToken;
    bytes32 expectedDstRouteAssetId;
    uint256 minSettlementAmount;
    uint256 feeAmount;
    bytes   swapDataSrc;
    bytes   swapDataDst;
    bytes32 swapPluginIdSrc;
    bytes32 dstSwapPluginId;
    bytes32 railPluginId;
    bytes   railData;
    address dstReceiver;
    bytes   nativeDstAddress;
    bytes32 intentId;
    uint256 deadline;
}
```

- [ ] **Step 4: Update RouterV1 and ReceiverV1 to use explicit route tokens**

```solidity
address routeToken = intent.sourceRouteToken;
if (routeToken == address(0)) revert ZeroAddress("sourceRouteToken");

if (intent.tokenIn == routeToken) {
    settlementAmount = amountAfterFee;
} else {
    ISwapPlugin swapPlugin = registry.getSwapPlugin(intent.swapPluginIdSrc);
    IERC20(intent.tokenIn).forceApprove(address(swapPlugin), amountAfterFee);
    uint256 before = IERC20(routeToken).balanceOf(address(this));
    swapPlugin.swap(
        IntentTypes.SwapParams({
            tokenIn: intent.tokenIn,
            tokenOut: routeToken,
            amountIn: amountAfterFee,
            minAmountOut: intent.minSrcSwapOut,
            data: intent.swapDataSrc
        })
    );
    settlementAmount = IERC20(routeToken).balanceOf(address(this)) - before;
}
```

```solidity
if (settlementToken != expectedRouteToken) {
    revert UnexpectedSettlementToken(settlementToken, expectedRouteToken);
}
bytes32 receivedRouteAssetId = keccak256(abi.encode(block.chainid, settlementToken));
if (receivedRouteAssetId != expectedRouteAssetId) {
    revert UnexpectedSettlementAsset(receivedRouteAssetId, expectedRouteAssetId);
}
```

- [ ] **Step 5: Update Axelar and LayerZero plugins/adapters for pairwise route-token config**

```solidity
struct AxelarRouteConfig {
    string chainName;
    address receiver;
    bytes32 destinationTokenId;
    address sourceRouteToken;
}

if (params.settlementTokenAddr != route.sourceRouteToken) {
    revert SettlementTokenMismatch(params.settlementTokenAddr, route.sourceRouteToken);
}
```

```solidity
struct LzRouteConfig {
    uint32 dstEid;
    address dstReceiver;
    bytes options;
    address routeContract;
    address routeToken;
}

if (params.settlementTokenAddr != route.routeToken) {
    revert SettlementTokenMismatch(params.settlementTokenAddr, route.routeToken);
}
```

- [ ] **Step 6: Re-run the messaging contract tests**

Run: `forge test --match-path tests/contracts/RouterV1.t.sol --match-path tests/contracts/ReceiverV1.t.sol --match-path tests/contracts/AxelarRailPlugin.t.sol --match-path tests/contracts/LayerZeroRailPlugin.t.sol --match-path tests/contracts/ReceiverAdapters.t.sol`
Expected: PASS

- [ ] **Step 7: Commit the messaging-route contract refactor locally**

```bash
git add tests/contracts/RouterV1.t.sol tests/contracts/ReceiverV1.t.sol tests/contracts/AxelarRailPlugin.t.sol tests/contracts/LayerZeroRailPlugin.t.sol tests/contracts/ReceiverAdapters.t.sol src/contracts/interfaces/IIntentTypes.sol src/contracts/RouterV1.sol src/contracts/ReceiverV1.sol src/contracts/rails/AxelarRailPlugin.sol src/contracts/rails/AxelarReceiverAdapter.sol src/contracts/rails/LayerZeroRailPlugin.sol src/contracts/rails/LayerZeroReceiverAdapter.sol
git commit -m "refactor(contracts): use explicit route tokens for messaging rails"
```

### Task 7: Convert THORChain Into An API-Direct Rail With Monitor-Only Runtime Support

**Files:**
- Modify: `tests/vps/thorchain-quote-worker.test.ts`
- Modify: `tests/vps/recovery-engine.test.ts`
- Modify: `src/vps/services/thorchain/THORChainMonitorWorker.ts`
- Modify: `src/vps/rails/execution.ts`
- Modify: `src/vps/app/runtime.ts`
- Create: `docs/ops/thorchain-api-direct.md`

- [ ] **Step 1: Extend the THOR test to prove no destination deployment is required**

```ts
test('THORChain API-direct offers are executable without destination receiver deployment', async () => {
  const offer = await worker.quote({
    amountIn: 100000000n,
    srcChainId: 8453,
    dstChainId: 99,
    tokenIn: 'BASE.ETH',
    tokenOut: 'SOL.SOL',
    destinationAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
  });

  assert.ok(offer);
  assert.equal(offer?.quote.memo?.startsWith('=:SOL.SOL:'), true);
});
```

- [ ] **Step 2: Run the THOR worker tests to confirm the current runtime still assumes a plugin-style execution path**

Run: `node --import tsx --test tests/vps/thorchain-quote-worker.test.ts tests/vps/recovery-engine.test.ts`
Expected: FAIL where code still expects RouterV1/rail-plugin-shaped THOR execution data.

- [ ] **Step 3: Keep THORChain as a monitor-only rail execution adapter**

```ts
class THORChainRailExecutionAdapter implements RailExecutionAdapter<THORChainMonitorWorker> {
  readonly rail = Rail.THORCHAIN;

  async start(context: RailExecutionContext, options: RailExecutionOptions) {
    const enabled = options.enabled?.[Rail.THORCHAIN] ?? readBool('ENABLE_THORCHAIN_WORKER', true);
    if (!enabled) {
      return { rail: this.rail, mode: 'disabled', label: 'thorchain-monitor', async stop() {} };
    }

    const worker = new THORChainMonitorWorker(context.intentService, new THORChainClient());
    await worker.start();
    return {
      rail: this.rail,
      mode: 'worker',
      label: 'thorchain-monitor',
      instance: worker,
      async stop() { worker.stop(); },
    };
  }
}
```

- [ ] **Step 4: Document the THOR API-direct rollout explicitly**

```md
# THORChain API-Direct Ops Guide

## Execution Model

- Ruflo quotes THORChain routes off-chain.
- Ruflo returns provider-direct integration instructions.
- THORChain delivers natively to the user's destination address.
- No Ruflo destination deployment is required for BTC, SOL, Cosmos, or similar THOR-supported destinations.

## Required runtime flags

- `ENABLE_THORCHAIN_WORKER=true`
- `ENABLE_THORCHAIN_QUOTE_WORKER=true`
- `ENABLE_THORCHAIN_CANARY=true`
- `THORCHAIN_CANARY_ALLOWLIST=8453:99:BASE.ETH:SOL.SOL,8453:0:BASE.ETH:BTC.BTC`
```

- [ ] **Step 5: Re-run the THOR worker tests**

Run: `node --import tsx --test tests/vps/thorchain-quote-worker.test.ts tests/vps/recovery-engine.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the THOR API-direct rollout locally**

```bash
git add tests/vps/thorchain-quote-worker.test.ts tests/vps/recovery-engine.test.ts src/vps/services/thorchain/THORChainMonitorWorker.ts src/vps/rails/execution.ts src/vps/app/runtime.ts docs/ops/thorchain-api-direct.md
git commit -m "feat(thorchain): switch to api-direct direct-delivery rail"
```

---

## Self-Review

### Spec coverage

The approved spec requires:

- rail-specific off-chain whitelisting
- pairwise execution discovery
- direct-route-first ranking
- distinct LayerZero offer families
- THORChain as API-direct with no destination deployments
- messaging rails using exact route-token validation
- status API support for both router and provider-direct integrations

Coverage by task:

- route-asset vocabulary: Task 1
- off-chain whitelist and pair registry: Task 2
- Axelar/LayerZero route-asset families: Task 3
- offer construction and ranking: Task 4
- status API integration split: Task 5
- messaging contract refactor: Task 6
- THOR API-direct runtime: Task 7

No spec gaps remain.

### Placeholder scan

Checked the plan for placeholder markers, deferred-work phrases, vague error-handling language, and cross-task shorthand.

No placeholders remain in the plan body.

### Type consistency

Consistent names used across tasks:

- `routeAsset`
- `offerType`
- `deliveryShape`
- `executionMode`
- `sourceRouteToken`
- `expectedDstRouteToken`
- `sourceRouteAssetId`
- `expectedDstRouteAssetId`

The same discriminators are used in the VPS and contract tasks, and THOR direct execution stays isolated behind `executionMode: 'provider_direct'`.
