# PROJECT_CONTEXT

Living context file for this repository.  
Update this whenever architecture, commands, workflows, or critical paths change.

## 1) Project Snapshot

- Name: `EMPX-Cross-Chain` (intent-based cross-chain routing system).
- Stack:
- `Solidity` contracts (Foundry toolchain).
- `TypeScript/Node.js` VPS backend.
- Optional local infra with `Postgres` + `Redis` via Docker Compose.
- Primary goal:
- Build, route, execute, and track cross-chain intents across messaging/liquidity rails.

## 2) High-Level Architecture

- On-chain layer:
- [RouterV1](/Users/ganadhish/code/work/ruflo/src/contracts/RouterV1.sol): source-chain entrypoint (`initiateSwap`).
- [ReceiverV1](/Users/ganadhish/code/work/ruflo/src/contracts/ReceiverV1.sol): destination settlement executor.
- [PluginRegistry](/Users/ganadhish/code/work/ruflo/src/contracts/PluginRegistry.sol): approved rail/swap plugin registry.
- Rail plugins (bridge transports):
- [CCTPRailPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/rails/CCTPRailPlugin.sol)
- [AxelarRailPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/rails/AxelarRailPlugin.sol)
- [LayerZeroRailPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/rails/LayerZeroRailPlugin.sol)
- [THORChainRailPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/rails/THORChainRailPlugin.sol)
- Destination adapters:
- [AxelarReceiverAdapter](/Users/ganadhish/code/work/ruflo/src/contracts/rails/AxelarReceiverAdapter.sol)
- [LayerZeroReceiverAdapter](/Users/ganadhish/code/work/ruflo/src/contracts/rails/LayerZeroReceiverAdapter.sol)
- Swap plugins:
- [EmpsealSwapPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/plugins/EmpsealSwapPlugin.sol)
- [UniswapV2SwapPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/plugins/UniswapV2SwapPlugin.sol)
- [UniswapV3SwapPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/plugins/UniswapV3SwapPlugin.sol)

- VPS/backend layer:
- [QuoteEngine](/Users/ganadhish/code/work/ruflo/src/vps/services/QuoteEngine.ts): builds quotes from routes + token mappings + adapters.
- [RouterBuilder](/Users/ganadhish/code/work/ruflo/src/vps/services/RouterBuilder.ts): direct + hub-hop route construction.
- [RailSelector](/Users/ganadhish/code/work/ruflo/src/vps/services/RailSelector.ts): rail ranking + settlement token selection.
- [IntentCalldataBuilder](/Users/ganadhish/code/work/ruflo/src/vps/services/IntentCalldataBuilder.ts): encodes RouterV1 calldata.
- [IntentEngine](/Users/ganadhish/code/work/ruflo/src/vps/services/IntentEngine.ts): intent lifecycle state machine.
- [StatusAPI](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts): `/quote`, `/intent/:id`, `/health`.
- [runtime](/Users/ganadhish/code/work/ruflo/src/vps/app/runtime.ts): dependency wiring + feature toggles.
- [CctpAttestationWorker](/Users/ganadhish/code/work/ruflo/src/vps/services/CctpAttestationWorker.ts): CCTP source-event relay worker (`MessageSent` -> attestation -> `receiveMessage` -> `ReceiverV1.execute`).

## 3) Current Operational Notes

- Foundry is the active solidity workflow (Hardhat intentionally not in use).
- `/quote` is computed in VPS (not on-chain plugin quote calls).
- Direct-route rail selection for `/quote` is output-ranked: QuoteEngine evaluates all viable single-hop rails and selects the candidate with best destination receive (`minAmountOut` then `estimatedOut`).
- Quote fee modeling aligns with RouterV1 order: protocol + rail fee is applied before source swap estimation, with effective cap at RouterV1 max fee (1%).
- For swap-required routes, plugin-specific `swapData` must be valid; placeholder `0x` is not enough for production swap execution paths.
- For direct settlement-only flows, `swapPluginIdSrc`/`swapPluginIdDst` are expected to be zero-bytes32.
- Multi-hop routes are built/ranked in RouterBuilder, but current quote-to-calldata path executes only single-hop routes.
- CCTP route config now includes `CCTP_ROUTE_CALLER`:
- `0x0` = open relay caller for `receiveMessage`.
- non-zero = restricted relayer EOA/contract caller.
- Worker-side CCTP attestation relay is now part of `vps:worker` when `ENABLE_CCTP_RELAY=true`.

## 4) Key Commands

## Build/Test

```bash
npm run build
npm test
npm run sol:build
npm run sol:test
```

## Deploy/Configure (Foundry)

```bash
npm run sol:deploy:all
npm run sol:configure:all
```

Notes:
- these scripts auto-load `.env`
- `RPC_URL` must be set for the active chain

## Local Infra (Docker)

```bash
docker compose -f config/docker/docker-compose.yml up --build -d
curl http://localhost:8787/api/v1/health
```

## VPS Runtime (without docker)

```bash
npm run vps:api
npm run vps:worker
```

## 5) Environment Conventions

- Chain-scoped keys use `CHAIN_<chainId>_*`, e.g.:
- `CHAIN_84532_RPC_URL`
- `CHAIN_84532_ROUTER_V1`
- `CHAIN_84532_RECEIVER_V1`
- `CHAIN_84532_TOKEN_CCTP_USDC`
- `CHAIN_84532_TOKEN_AXELAR_USDC`
- `CHAIN_84532_TOKEN_LAYERZERO_USDC`
- `CHAIN_84532_HAS_AGGREGATOR`
- Settlement token mapping is critical for quote viability:
- Rail-specific keys (preferred): `CHAIN_<id>_TOKEN_<RAIL>_<TOKEN>` (example: `CHAIN_84532_TOKEN_AXELAR_USDC`)
- Legacy fallback keys: `CHAIN_<id>_TOKEN_USDC`, `CHAIN_<id>_TOKEN_USDT`, `CHAIN_<id>_TOKEN_ETH`
- Runtime resolution order: rail-specific first, then legacy fallback
- Swap plugin behavior defaults via:
- `CHAIN_<id>_SWAP_PLUGIN_KIND` (`EMPSEAL`, `UNIV2`, `UNIV3`) or explicit `CHAIN_<id>_SWAP_PLUGIN_ID`
- CCTP relay worker env:
- `ENABLE_CCTP_RELAY`
- `CCTP_RELAYER_PRIVATE_KEY` (or `DEPLOYER_PRIVATE_KEY`)
- `CCTP_ATTESTATION_BASE_URL`, `CCTP_ATTESTATION_POLL_MS`, `CCTP_ATTESTATION_TIMEOUT_MS`, `CCTP_RELAY_LOOKBACK_BLOCKS`
- `CCTP_RELAY_RETRY_INTERVAL_MS`, `CCTP_RELAY_RETRY_BASE_MS`, `CCTP_RELAY_RETRY_MAX_MS`, `CCTP_RELAY_MAX_RETRY_ATTEMPTS`, `CCTP_RELAY_RECONCILE_INTERVAL_MS`
- CCTP relay retries attestation/RPC/nonce failures while running and serializes destination tx sends per destination chain.
- Optional override: `CCTP_MESSAGE_TRANSMITTER` / `CHAIN_<id>_CCTP_MESSAGE_TRANSMITTER`

## 6) Important File Map

- Contract interfaces:
- [IIntentTypes](/Users/ganadhish/code/work/ruflo/src/contracts/interfaces/IIntentTypes.sol)
- [IRailPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/interfaces/IRailPlugin.sol)
- [ISwapPlugin](/Users/ganadhish/code/work/ruflo/src/contracts/interfaces/ISwapPlugin.sol)

- Foundry scripts/config:
- [foundry.toml](/Users/ganadhish/code/work/ruflo/config/foundry.toml)
- [DeployAll.s.sol](/Users/ganadhish/code/work/ruflo/config/foundry/scripts/DeployAll.s.sol)
- [ConfigureAll.s.sol](/Users/ganadhish/code/work/ruflo/config/foundry/scripts/ConfigureAll.s.sol)
- [scripts README](/Users/ganadhish/code/work/ruflo/config/foundry/scripts/README.md)

- VPS config:
- [chains.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/chains.ts)
- [contracts.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/contracts.ts)

- Persistence/cache:
- [schema.sql](/Users/ganadhish/code/work/ruflo/src/vps/db/schema.sql)
- [QuoteCache](/Users/ganadhish/code/work/ruflo/src/vps/cache/QuoteCache.ts)

- Deployment references/output:
- `config/broadcast/*`
- [testnet deployment checklist](/Users/ganadhish/code/work/ruflo/docs/testnet-deployment-checklist.md)
- [cctp relay worker guide](/Users/ganadhish/code/work/ruflo/docs/cctp-relay-worker.md)

## 7) Codebase Conventions

- Keep source code under `src/`, tests under `tests/`, docs under `docs/`.
- Do not commit secrets or private keys.
- Prefer env-driven config (no hardcoded chain addresses in runtime logic).
- For contract changes:
- run `npm run sol:build` and `npm run sol:test`.
- For VPS/API changes:
- verify `/health` and `/quote` with realistic payloads.

## 8) Updating This File

When any of these change, update this file in the same PR:
- architecture boundaries (contracts/services)
- deploy/config commands
- required env keys
- route/swap behavior assumptions
- critical file ownership or locations
