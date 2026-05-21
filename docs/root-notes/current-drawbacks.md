# Current Drawbacks: Single USDC Across Multiple Rails

## Problem

The current deploy/runtime configuration assumes one USDC address per chain (`USDC` and `CHAIN_<id>_TOKEN_USDC`) and reuses it across all rails.

That breaks down when rails require different settlement assets on the same chain:

- CCTP: must use Circle-native USDC.
- Axelar: may use aUSDC / axlUSDC.
- LayerZero: may use an OFT settlement token different from Circle USDC.

## Why This Is a Blocker

1. Incorrect token wiring causes quote-to-execution mismatch.
2. Multi-rail operation becomes fragile because one rail's token choice pollutes another rail.
3. Scaling to many routes/chains needs rail-level asset control, not chain-global assumptions.

## Implemented Direction

### VPS runtime token resolution

Settlement token address lookup now resolves by rail first, then falls back:

1. `CHAIN_<id>_TOKEN_<RAIL>_<TOKEN>`
2. `CHAIN_<id>_TOKEN_<TOKEN>` (legacy fallback)

Examples:

- `CHAIN_421614_TOKEN_CCTP_USDC`
- `CHAIN_421614_TOKEN_AXELAR_USDC`
- `CHAIN_421614_TOKEN_LAYERZERO_USDC`
- `CHAIN_421614_TOKEN_USDC` (fallback only)

### Foundry deploy token resolution

`DeployAll.s.sol` now supports per-rail token env keys with compatibility fallback:

- `CCTP_USDC`
- `AXELAR_USDC`
- `LAYERZERO_USDC` (or `LZ_USDC`)
- `THOR_USDC`
- `THOR_USDT`
- Falls back to `USDC` / `USDT` when rail-specific values are missing.

## Migration Guidance

1. Keep existing global `USDC` / `CHAIN_<id>_TOKEN_USDC` values as safety fallback.
2. Add rail-specific keys for active rails chain-by-chain.
3. Validate quoting and execution for each active route after updates.
4. Remove reliance on global fallback once all rails are explicitly configured.
