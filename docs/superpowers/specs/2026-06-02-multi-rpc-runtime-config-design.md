# Multi-RPC Runtime Config Design

**Date:** 2026-06-02
**Status:** Draft for review
**Scope:** Add support for 4-5 RPC endpoints per chain with ordered failover, move chain-specific runtime settings out of the flat `.env` sprawl, and standardize provider construction across VPS services.

---

## Goal

Support a runtime model where:

- each EVM chain can define multiple RPC endpoints for read and polling workloads
- runtime failover is consistent across quote paths, monitoring, status actions, and recovery scripts
- chain-specific runtime settings are maintained in one committed config file instead of expanding flat env keys
- secrets and endpoint values still stay outside git

The immediate problem is public RPC rate limiting. The broader problem is config sprawl and inconsistent provider behavior.

---

## Decision Summary

### 1. Keep static chain metadata in the existing chain registry

[`src/vps/config/chains.ts`](/Users/ganadhish/code/work/ruflo/src/vps/config/chains.ts:1) remains the canonical source for:

- `chainId`
- chain name
- aggregator support
- settlement token defaults
- block time
- router and receiver addresses
- EVM vs non-EVM classification

This file should not become the place where 4-5 runtime RPC endpoints per chain are enumerated.

### 2. Add one committed runtime config file for operational chain settings

Add a new file:

- `src/vps/config/chainRuntime.ts`

This file becomes the single place for chain-specific runtime settings such as:

- ordered RPC endpoint env keys
- workload-specific RPC pools
- timeouts
- cooldowns
- optional per-chain runtime toggles that are operational rather than protocol-level

The file is committed, typed, and environment-agnostic. It contains env key references, not raw secrets.

### 3. Keep actual RPC URLs in env

The committed runtime config names the env variables to read, for example:

- `CHAIN_8453_RPC_1`
- `CHAIN_8453_RPC_2`
- `CHAIN_8453_RPC_3`
- `CHAIN_8453_RPC_4`
- `CHAIN_8453_RPC_5`

This keeps private or paid endpoints out of git while still centralizing chain-specific structure.

### 4. Replace ad hoc provider construction with a shared provider layer

Add one shared service:

- `src/vps/services/RpcProviderRegistry.ts`

This service resolves configured env keys into ordered endpoint lists, tracks endpoint health, and returns providers for specific workloads.

All VPS services that currently call `new JsonRpcProvider(...)` directly using one chain URL should migrate to this layer.

### 5. Use priority failover, not quorum fanout

Do not use `ethers.FallbackProvider` quorum mode for this design.

Reason:

- public RPC endpoints are rate-limited
- quorum/fanout can multiply requests across providers
- the current operational goal is graceful degradation, not multi-provider consensus

The runtime should use ordered priority failover with temporary cooldown on unhealthy endpoints.

---

## Current State

The current model in [`src/vps/types/index.ts`](/Users/ganadhish/code/work/ruflo/src/vps/types/index.ts:99) and [`src/vps/config/chains.ts`](/Users/ganadhish/code/work/ruflo/src/vps/config/chains.ts:23) exposes only:

- `rpcUrl`
- `rpcFallback`

That is insufficient for the target operational need.

Several code paths also assume a single source URL:

- [`src/vps/services/EventMonitor.ts`](/Users/ganadhish/code/work/ruflo/src/vps/services/EventMonitor.ts:29)
- [`src/vps/api/StatusAPI.ts`](/Users/ganadhish/code/work/ruflo/src/vps/api/StatusAPI.ts:935)
- [`src/vps/bootstrap/dexAdapters.ts`](/Users/ganadhish/code/work/ruflo/src/vps/bootstrap/dexAdapters.ts:17)
- [`src/vps/services/CctpAttestationWorker.ts`](/Users/ganadhish/code/work/ruflo/src/vps/services/CctpAttestationWorker.ts:192)
- [`src/vps/services/IntentCalldataBuilder.ts`](/Users/ganadhish/code/work/ruflo/src/vps/services/IntentCalldataBuilder.ts:190)
- [`src/vps/services/empseal/EmpsealQuoteWorker.ts`](/Users/ganadhish/code/work/ruflo/src/vps/services/empseal/EmpsealQuoteWorker.ts:126)
- [`src/vps/services/gaszip/GasZipMonitorWorker.ts`](/Users/ganadhish/code/work/ruflo/src/vps/services/gaszip/GasZipMonitorWorker.ts:220)

The result is inconsistent outage behavior and duplicated fallback logic.

---

## Target Architecture

### A. Static chain registry

Keep the existing chain registry focused on protocol and product metadata.

It should answer questions like:

- what chain is this
- is it EVM
- does Ruflo have an aggregator here
- what are the deployed contract addresses

It should not answer:

- which five RPC endpoints should status reads try
- which two RPC endpoints should long-lived pollers prefer
- how long should a rate-limited provider stay on cooldown

### B. Runtime chain config

Add a typed runtime map keyed by chain ID.

Illustrative shape:

```ts
export interface ChainRpcRuntimeConfig {
  readEnvKeys: string[];
  pollEnvKeys?: string[];
  timeoutMs?: number;
  cooldownMs?: number;
}

export interface ChainRuntimeConfig {
  rpc?: ChainRpcRuntimeConfig;
}

export const CHAIN_RUNTIME_CONFIG: Record<number, ChainRuntimeConfig> = {
  8453: {
    rpc: {
      readEnvKeys: [
        'CHAIN_8453_RPC_1',
        'CHAIN_8453_RPC_2',
        'CHAIN_8453_RPC_3',
        'CHAIN_8453_RPC_4',
        'CHAIN_8453_RPC_5',
      ],
      pollEnvKeys: [
        'CHAIN_8453_RPC_POLL_1',
        'CHAIN_8453_RPC_POLL_2',
      ],
      timeoutMs: 4000,
      cooldownMs: 30000,
    },
  },
};
```

Rules:

- `readEnvKeys` is the primary ordered endpoint list for ad hoc read traffic
- `pollEnvKeys` is optional and used by long-lived workers if present
- if `pollEnvKeys` is absent, polling falls back to `readEnvKeys`
- missing env vars are ignored
- duplicate resolved URLs are deduplicated
- non-EVM chains may omit `rpc`

### C. Shared provider registry

Add a provider registry responsible for:

- loading chain runtime config
- resolving env keys to URLs
- validating that at least one endpoint exists for required EVM workloads
- returning provider handles for workload classes
- tracking endpoint health
- rotating on failure

The core API should be small:

- `getReadProvider(chainId)`
- `getPollingProvider(chainId)`
- `getRpcUrls(chainId, workload)`
- `reportFailure(chainId, workload, rpcUrl, error)`

The internal behavior should be:

1. resolve ordered URLs
2. skip endpoints on active cooldown
3. create or reuse a provider for the first healthy endpoint
4. on retryable provider failure, mark the endpoint unhealthy for `cooldownMs`
5. advance to the next endpoint
6. allow cooled-down endpoints to re-enter later

This service should encapsulate provider policy so the rest of the codebase stops re-implementing it.

---

## Workload Split

The runtime should distinguish at least two workloads:

### Read workload

Used by:

- status reads
- quote helpers
- route checks
- gas estimation helpers
- recovery scripts

Traits:

- bursty
- synchronous with request handling
- sensitive to latency spikes

### Poll workload

Used by:

- event monitor
- CCTP attestation worker
- GasZip monitor
- any future long-running chain watchers

Traits:

- steady, repetitive traffic
- long-lived provider lifecycle
- can easily burn public RPC quotas if mixed with user-facing traffic

This split is important even if both workloads temporarily resolve to the same underlying endpoints.

---

## Error Handling

### Failover triggers

An endpoint should be considered temporarily unhealthy when a provider call fails with signals such as:

- timeout
- HTTP 429
- HTTP 5xx
- malformed or incomplete JSON-RPC payload
- connection reset or transport failure

Not every contract-level revert should trigger endpoint failover. Business-logic failures must remain business-logic failures.

### Cooldown behavior

Each endpoint gets a per-workload cooldown window.

Default:

- `cooldownMs = 30000`

During cooldown:

- the endpoint is skipped for new provider selection
- existing callers do not block waiting for it to recover

After cooldown:

- the endpoint becomes eligible again in original priority order

### Exhaustion behavior

If all configured endpoints are unavailable:

- APIs should surface a clear infrastructure-style error
- workers should log one concise aggregated error per cycle
- the registry should avoid tight-loop recreation of broken providers

---

## Backward Compatibility

The migration should be staged rather than disruptive.

### Phase 1 compatibility

While moving to `CHAIN_<id>_RPC_<n>` keys, the registry should also support legacy fallback sources:

- `CHAIN_<id>_RPC_URL`
- `CHAIN_<id>_RPC_FALLBACK`

This lets existing environments boot without immediate full env migration.

Compatibility rule:

- if new array-style env keys resolve to at least one URL, prefer them
- otherwise fall back to legacy `RPC_URL` and `RPC_FALLBACK`

### Phase 2 cleanup

After environments are migrated and verified:

- deprecate direct use of `rpcUrl` and `rpcFallback`
- remove direct provider construction from services
- optionally simplify `ChainConfig` so RPC data no longer lives there at all

---

## Data Model Changes

### `ChainConfig`

Current `ChainConfig` includes:

- `rpcUrl`
- `rpcFallback`

These fields should no longer be the primary runtime interface.

Two acceptable end states:

1. Transitional:
- keep the fields for compatibility but derive them from the runtime config

2. Final:
- remove RPC fields from `ChainConfig`
- make all provider consumers depend on the provider registry instead

The recommended implementation path is transitional first, final later.

### New runtime types

Add explicit runtime config types so chain operational config is type-checked and reviewable in code review.

---

## Migration Scope

The initial implementation should migrate the most important direct provider call sites:

- `EventMonitor`
- `StatusAPI`
- `CctpAttestationWorker`
- `dexAdapters`
- `IntentCalldataBuilder`
- `EmpsealQuoteWorker`
- `GasZipMonitorWorker`

The recovery script already contains a multi-candidate pattern and should be aligned with the shared registry helpers afterward.

The main requirement is consistency for runtime services, not perfect one-shot conversion of every standalone script.

---

## Testing Strategy

### Unit tests

Add focused tests for the provider registry:

- resolves env-key lists in order
- ignores missing env vars
- deduplicates repeated URLs
- falls back to legacy keys when new keys are absent
- marks endpoints unhealthy on retryable failures
- skips cooled-down endpoints
- re-enables endpoints after cooldown

### Integration tests

Update or add tests around services that consume providers:

- `StatusAPI` uses registry-provided source providers
- `dexAdapters` can initialize from multi-endpoint runtime config
- monitoring services can start when only `pollEnvKeys` are configured

### Regression protection

Preserve these properties:

- EVM chains with at least one configured endpoint still boot normally
- non-EVM chains do not require RPC config
- existing environments with only `CHAIN_<id>_RPC_URL` still work during migration

---

## Operational Guidance

This design improves failover, but it does not eliminate the need for better providers.

Operational recommendation:

- use at least one paid or dedicated RPC per high-traffic chain
- use public endpoints as lower-priority failover, not as the only production source

Adding five public endpoints is better than two, but it still leaves the system exposed to shared infrastructure instability.

---

## Implementation Notes

The intended repo shape after implementation is:

- [`src/vps/config/chains.ts`](/Users/ganadhish/code/work/ruflo/src/vps/config/chains.ts:1) for static chain metadata
- `src/vps/config/chainRuntime.ts` for chain-specific runtime operational config
- `src/vps/services/RpcProviderRegistry.ts` for provider selection and failover policy

This keeps protocol metadata, runtime configuration, and provider behavior clearly separated.

---

## Decisions Locked By This Spec

- Single committed runtime config file: yes
- Actual endpoint URLs committed to git: no
- Multiple RPCs per chain: yes, ordered lists
- Different endpoint pools for reads and pollers: yes
- Failover strategy: priority-based with cooldown
- Keep giant flat `.env` as the system of record: no

---

## Out Of Scope

This design does not include:

- admin UI for editing RPC configs
- dynamic config reload from database or remote control plane
- non-EVM transport redesign
- chain-specific latency scoring or adaptive endpoint ranking

Those can be added later if operational complexity justifies them.
