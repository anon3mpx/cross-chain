# Hyperlane Nexus Route Catalog

## Current Status

Hyperlane Nexus route metadata is now catalog-backed instead of env-per-route backed.

The current implementation intentionally keeps all placeholder routes disabled. Hyperlane Nexus offers will not be produced from the default catalog until real route values are added and each verified asset route is explicitly enabled.

## Latest Updates

- Added `src/vps/config/hyperlaneNexusRoutes.ts` as the checked-in route data file for Hyperlane Nexus chain, asset, registry, warp route, gas, and ETA metadata.
- Added `src/vps/services/hyperlane/HyperlaneNexusRouteCatalog.ts` as the resolver and validator for catalog-backed route lookup.
- Updated `HyperlaneNexusQuoteWorker` so quote generation calls `HyperlaneNexusRouteCatalog.findRoute(...)` instead of reading per-route env vars.
- Removed the `HYPERLANE_WARP_ROUTE_<ASSET>_<CHAIN_ID>` fallback path from route resolution.
- Added registry-style `connections` support so a source warp route only quotes destinations explicitly connected by the route config.
- Updated Phase 2 plan docs so Hyperlane route metadata points to the catalog file and not to env-per-route config.
- Added tests proving default placeholder routes stay inactive and env route values alone do not create route coverage.

## Runtime Structure

The quote path is:

```text
QuoteEngine
  -> HyperlaneNexusQuoteWorker
    -> HyperlaneNexusRouteCatalog
      -> HYPERLANE_NEXUS_ROUTE_CHAINS
```

Key files:

- `src/vps/config/hyperlaneNexusRoutes.ts`
  - Owns the route metadata you should fill.
  - Contains one entry per source chain and asset.
  - Keeps placeholders disabled until verified.
- `src/vps/services/hyperlane/HyperlaneNexusRouteCatalog.ts`
  - Validates asset symbol, source chain, destination chain/domain, disabled state, warp route address shape, and registry connections.
  - Resolves `warpRouteAddress`, `destinationDomain`, `interchainGasFee`, and `etaSeconds`.
  - Does not create routes from per-route env vars.
- `src/vps/services/hyperlane/HyperlaneNexusQuoteWorker.ts`
  - Converts a valid catalog route into the 1:1 Hyperlane provider-direct quote.
- `src/vps/services/QuoteEngine.ts`
  - Creates `HyperlaneNexusQuoteWorker` when `ENABLE_HYPERLANE_NEXUS=true`.

## Catalog Shape

Each chain currently has `USDC` and `USDT` placeholders with explicit keys:

```ts
{
  chainId: 1,
  domain: 1,
  registryChainName: 'ethereum',
  assets: {
    USDC: {
      warpRouteAddress: '',
      collateralTokenAddress: '',
      tokenType: '',
      cctpVersion: '',
      connections: [],
      interchainGasFee: '',
      etaSeconds: 0,
      disabled: true,
    },
    USDT: {
      warpRouteAddress: '',
      collateralTokenAddress: '',
      tokenType: '',
      cctpVersion: '',
      connections: [],
      interchainGasFee: '',
      etaSeconds: 0,
      disabled: true,
    },
  },
}
```

Field meaning:

- `chainId`: EVM chain ID used by Ruflo quote requests.
- `domain`: Hyperlane destination domain for that chain.
- `registryChainName`: Hyperlane registry chain key, such as `ethereum`, `base`, or `arbitrum`.
- `warpRouteAddress`: Source-chain Hyperlane warp route contract address for the asset. This maps to `tokens[].addressOrDenom` in the Hyperlane warp route config YAML.
- `collateralTokenAddress`: Underlying local collateral token address. For CCTP routes, this maps to `token` in the Hyperlane deploy YAML.
- `tokenType`: Hyperlane token type, such as `collateralCctp`.
- `cctpVersion`: CCTP version when relevant, such as `V2`.
- `connections`: Destination warp-route connections from `tokens[].connections` in the Hyperlane route config YAML.
- `interchainGasFee`: Quoted/default IGP fee for the source route. Use a string for large integer values.
- `etaSeconds`: Expected settlement ETA for quotes.
- `disabled`: Safety switch. Keep `true` until the route has verified metadata.

## Hyperlane Registry Mapping

The Hyperlane registry keeps route deployment metadata and deployed route addresses in separate files.

For CCTP v2 fast USDC, the relevant upstream examples are:

- Deploy metadata: `deployments/warp_routes/USDC/mainnet-cctp-v2-fast-deploy.yaml`
- Deployed route/config metadata: `deployments/warp_routes/USDC/mainnet-cctp-v2-fast-config.yaml`

Map them into Ruflo this way:

- `deploy.yaml` chain key -> `registryChainName`
- `deploy.yaml` `token` -> `collateralTokenAddress`
- `deploy.yaml` `type` -> `tokenType`
- `deploy.yaml` `cctpVersion` -> `cctpVersion`
- `config.yaml` `tokens[].addressOrDenom` -> `warpRouteAddress`
- `config.yaml` `tokens[].connections[].token` -> `connections`

For a connection token string like:

```text
ethereum|base|0x31169ee5A8C0D680de74461d7B5394fFc7C3576B
```

Use:

```ts
connections: [
  {
    protocol: 'ethereum',
    chainName: 'base',
    warpRouteAddress: '0x31169ee5A8C0D680de74461d7B5394fFc7C3576B',
  },
]
```

When `connections` is non-empty, `HyperlaneNexusRouteCatalog` requires the destination chain's `registryChainName` to be present in the source asset's connections before it returns a quote.

## How To Populate A Route

1. Find the source chain entry in `src/vps/config/hyperlaneNexusRoutes.ts`.
2. Find the asset entry, currently `USDC` or `USDT`.
3. Fill:
   - `warpRouteAddress`
   - `collateralTokenAddress`
   - `tokenType`
   - `cctpVersion`
   - `connections`
   - `interchainGasFee`
   - `etaSeconds`
4. Verify that `connections` includes every destination you intend to quote.
5. Set `disabled: false` only after verifying the warp route address and expected destination domain support.
6. Run the focused Hyperlane tests.

Example:

```ts
USDC: {
  warpRouteAddress: '0x0000000000000000000000000000000000000000',
  collateralTokenAddress: '0x0000000000000000000000000000000000000000',
  tokenType: 'collateralCctp',
  cctpVersion: 'V2',
  connections: [
    {
      protocol: 'ethereum',
      chainName: 'base',
      warpRouteAddress: '0x0000000000000000000000000000000000000000',
    },
  ],
  interchainGasFee: '50000000000000',
  etaSeconds: 75,
  disabled: false,
}
```

Do not use the example zero address as a real value.

## What Env Still Controls

Env remains appropriate for runtime switches and non-route defaults:

- `ENABLE_HYPERLANE_NEXUS`
- Hyperlane monitor or explorer runtime controls
- `HYPERLANE_IGP_FEE_DEFAULT`
- `HYPERLANE_ETA_DEFAULT`

Env no longer controls route coverage:

- Do not use `HYPERLANE_WARP_ROUTE_<ASSET>_<CHAIN_ID>` for production route metadata.
- Tests intentionally prove that per-route env values alone are ignored.

## Current Placeholder Chains

The initial placeholder catalog includes:

- Ethereum: `1`
- Optimism: `10`
- BNB Chain: `56`
- Polygon: `137`
- Base: `8453`
- Arbitrum: `42161`
- Avalanche: `43114`

## TODOs

- Populate verified `warpRouteAddress` values for `USDC` and `USDT` on each supported source chain from Hyperlane route config YAML.
- Populate verified `collateralTokenAddress`, `tokenType`, and `cctpVersion` values from Hyperlane deploy YAML where applicable.
- Populate registry `connections` from Hyperlane route config YAML and keep unsupported destination pairs unquoted.
- Populate realistic `interchainGasFee` values per source chain and asset.
- Populate realistic `etaSeconds` values per source chain and asset.
- Flip `disabled` to `false` only for routes verified against Hyperlane deployment data.
- Add a generator script later if route metadata should be refreshed from Hyperlane registry/deployment data instead of manually edited.
- Add a focused test case when the first real route is populated so the default catalog proves at least one enabled route can quote.

## Verification Commands

Focused Hyperlane quote-worker tests:

```bash
node --import tsx --test tests/vps/hyperlane-nexus-quote-worker.test.ts
```

Affected provider-direct set:

```bash
node --import tsx --test \
  tests/vps/hyperlane-nexus-quote-worker.test.ts \
  tests/vps/hyperlane-nexus-monitor-worker.test.ts \
  tests/vps/quote-engine-layerzero-transfer-api.test.ts \
  tests/vps/direct-rail-integration.test.ts \
  tests/vps/postgres-schema-compat.test.ts \
  tests/vps/empx-cross-chain-sdk.test.ts
```
