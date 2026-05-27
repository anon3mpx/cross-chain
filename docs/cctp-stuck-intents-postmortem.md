# CCTP Stuck Intents Postmortem

This document explains the two stuck mainnet CCTP fast-transfer incidents that were manually recovered:

- Base receive tx: `0x117b63f46965261f65877479d1fbcc7aff42c4d66a59a6ba633c9ec035300630`
- OP receive tx: `0xdb7ee2c06e201c5eb091dea4a900b5871f00268168f666b40d38127e4556bd07`

## Summary

Both incidents had the same high-level symptom:

- Circle `receiveMessage(...)` succeeded on the destination chain.
- USDC was minted into `ReceiverV1`.
- The final `ReceiverV1.execute(...)` handoff did not complete automatically.
- Funds stayed in `ReceiverV1` until manually recovered.

They did **not** have the same root cause after mint:

- Base was blocked by a destination Empseal swap path.
- OP was a plain direct-USDC delivery and was blocked only by the relay worker recovery gap.

## Affected Intents

### 1. Arbitrum -> Base fast transfer with destination swap

- Source tx: `0x6157a7b129d0717503c5b1e6553ad265f74649c3b2e65d4eb6fae9fb1e1c64e5`
- Intent ID: `0x50e1885bd55419344cd41134372d32a3b751e4497fab5857a80853f05d0db0ac`
- Destination receive tx: `0x117b63f46965261f65877479d1fbcc7aff42c4d66a59a6ba633c9ec035300630`
- Destination receiver: `0x3Aef79E7455843A33E4c46D5Cf283A809BF50970`
- Minted to receiver: `996871` Base USDC
- Requested final output: Base WETH

### 2. Arbitrum -> OP fast transfer without destination swap

- Source tx: `0xfba3e52becde18529018188b55cc62c067f56a50be7d198bd47a89109fe113ac`
- Intent ID: `0x9b59aab47dda4ef20f1048cc442794d3988ec1b997e27c9a142a57b1d0a8320f`
- Destination receive tx: `0xdb7ee2c06e201c5eb091dea4a900b5871f00268168f666b40d38127e4556bd07`
- Destination receiver: `0x65642Ac8FD57EfF8DD4651CB76bE48814C8Bf386`
- Minted to receiver: `996871` OP USDC
- Requested final output: OP USDC

## Exact Failure Reasons

### Shared root cause: worker cannot recover already-relayed fast transfers cleanly

The relay worker assumes this sequence:

1. call Circle `receiveMessage(...)`
2. determine how much USDC was minted to `ReceiverV1`
3. call `ReceiverV1.execute(...)`

When a retry happens after `receiveMessage(...)` has already succeeded, `CctpAttestationWorker` falls into this path:

- logs `message already relayed`
- checks `settledIntents(intentId)`
- needs `executeAmount`
- if `mintedAmount === 0` and the job is a fast transfer, it throws:
  `cannot determine minted amount for already-relayed fast transfer`

This logic is in [src/vps/services/CctpAttestationWorker.ts](/Users/ganadhish/code/work/ruflo/src/vps/services/CctpAttestationWorker.ts:512).

So the core worker bug is:

- the system can successfully mint to `ReceiverV1`
- but cannot always reconstruct the amount needed for the follow-up `execute(...)` on a retry

That is the common reason both transfers became stuck in `ReceiverV1`.

### Additional Base-specific cause: missing destination receiver approval

Base originally also had a config gap:

- `ReceiverV1.approvedCallers(relayer)` was `false`

That meant even if the worker had reached `execute(...)`, Base would have reverted on:

- `UnauthorizedCaller(...)` in [src/contracts/ReceiverV1.sol](/Users/ganadhish/code/work/ruflo/src/contracts/ReceiverV1.sol:60)

This was fixed by approving the relayer on the Base receiver.

This approval issue did **not** explain the OP case.

### Additional Base-specific cause: invalid destination swap payload

The Base intent requested a destination swap:

- `tokenOut = Base WETH`
- `dstSwapPluginId = EMPSEAL`

But the source tx calldata encoded:

- `swapDataDst = 0x`

That means the signed intent said "use Empseal on destination" but did not include the trade data needed to execute it.

That led to:

- `TradeDecodeFailed()` from `EmpsealSwapPlugin`

This was not a bridge failure and not a worker-only issue. The signed destination execution payload itself was inconsistent.

### Additional Base-specific cause: deployed Empseal plugin cannot pass destination fee

After reconstructing a fresh Base Empseal trade off-chain, the next revert was:

- `EmpsealRouter: Insufficient fee`

The exact reason is in the deployed swap plugin:

- [src/contracts/plugins/EmpsealSwapPlugin.sol](/Users/ganadhish/code/work/ruflo/src/contracts/plugins/EmpsealSwapPlugin.sol:99) always calls:
  `empseal.swapNoSplit(trade, address(this), 0);`

So even if the destination swap route is valid, the plugin has no way to pass a non-zero Empseal router fee on execution.

That means:

- the current deployed Base/OP Empseal destination swap integration is incompatible with routes that now require `_fee > 0`

This is a contract-side limitation, not a worker bug.

### OP-specific outcome: no swap problem, only worker recovery gap

The OP tx was simpler:

- `tokenOut = OP USDC`
- `expectedRouteToken = OP USDC`
- `swapPluginId = 0x0`
- `swapData = 0x`

So `ReceiverV1.execute(...)` would take the direct-delivery branch in [src/contracts/ReceiverV1.sol](/Users/ganadhish/code/work/ruflo/src/contracts/ReceiverV1.sol:91) and simply forward USDC to the user.

Preflight confirmed:

- relayer approval was already `true`
- `settledIntents(intentId)` was `false`
- gas estimation for `execute(...)` succeeded

So the OP incident was not caused by swaps, Empseal, or approval. It was only the worker's inability to resume after an already-relayed fast transfer.

## Why The Funds Were Visible On Destination But Not In The Wallet

In both incidents:

- Circle minted USDC to `ReceiverV1`
- not directly to the user wallet

That is expected behavior for messaging rails with `ReceiverV1`. The user only receives funds after `ReceiverV1.execute(...)` succeeds.

So "tokens are on the destination chain" did **not** mean "delivery is complete". It only meant the rail leg completed.

## Recovery Used

### Base

Base could not be recovered through the original WETH destination swap path because:

- the signed payload had empty `swapDataDst`
- and the deployed Empseal plugin hardcodes `_fee = 0`

Recovery used:

- manual receiver approval fix
- one-off recovery script
- direct USDC settlement path, bypassing destination Empseal swap

Result:

- funds were delivered as Base USDC instead of Base WETH

### OP

OP did not need any payload rewrite or swap bypass.

Recovery used:

- one-off recovery script
- normal `ReceiverV1.execute(...)` direct-delivery path

Result:

- funds were delivered as OP USDC as originally intended

## Permanent Fixes

### 1. Fix the relay worker recovery path for already-relayed fast transfers

This is the most important fix.

The worker must be able to recover `executeAmount` after `receiveMessage(...)` has already happened.

Permanent solution:

- when `receiveMessage(...)` reverts with "already relayed", do not fail immediately for fast transfers
- recover the minted amount from one of:
  - stored `receiveTxHash`
  - destination `Transfer` logs to `ReceiverV1`
  - receiver balance delta
  - persisted relay state in DB
- then continue to `ReceiverV1.execute(...)`

Expected code area:

- [src/vps/services/CctpAttestationWorker.ts](/Users/ganadhish/code/work/ruflo/src/vps/services/CctpAttestationWorker.ts:491)

### 2. Persist destination receive state

The worker currently has too much transient state around the handoff between:

- `receiveMessage(...)`
- `execute(...)`

Permanent solution:

- persist `receiveTxHash`, `mintedAmount`, `receiver`, `payload`, and `settlementToken`
- on retry/restart, resume from persisted state instead of recomputing from a live one-shot path

This prevents a successful mint from becoming an unrecoverable in-memory event.

### 3. Enforce receiver approval across all destination chains before enabling relay

Every destination `ReceiverV1` must approve the relayer EOA.

Permanent solution:

- make `RECEIVER_APPROVED_CALLER_*` part of required deployment/config validation
- add startup checks in VPS that fail loudly if:
  - relay is enabled
  - but `approvedCallers(relayer)` is false on any configured destination chain

This would have caught the original Base approval issue immediately.

### 4. Reject inconsistent destination swap intents before submission

The Base incident showed an invalid signed intent shape:

- `dstSwapPluginId != 0`
- but `swapDataDst == 0x`

Permanent solution:

- add a quote/build-time invariant:
  - if destination swap plugin is non-zero, destination swap data must be non-empty
- reject intent creation or signed calldata generation otherwise

Expected code areas:

- [src/vps/services/QuoteEngine.ts](/Users/ganadhish/code/work/ruflo/src/vps/services/QuoteEngine.ts)
- [src/vps/services/IntentCalldataBuilder.ts](/Users/ganadhish/code/work/ruflo/src/vps/services/IntentCalldataBuilder.ts)

### 5. Redesign Empseal fee handling in the swap plugin

This is the permanent fix for the Base destination swap issue.

Current deployed behavior:

- `EmpsealSwapPlugin` always forwards `_fee = 0`

Permanent solution:

- extend the swap integration so destination execution can pass a non-zero Empseal router fee when required
- include that fee in the signed swap payload or derive it deterministically from signed quote data
- ensure quote-time output and min-output calculations include the router fee

Without this, any destination Empseal route that requires non-zero fee can fail even when bridging succeeds.

This is a contract/plugin change, not just a worker patch.

### 6. Add a first-class recovery CLI

Manual one-off scripts worked, but this needs to be operationalized.

Permanent solution:

- build a reusable recovery CLI for stuck intents
- support:
  - direct execute for no-swap intents
  - destination payload hydration when safe
  - direct settlement fallback when swap execution is impossible
  - dry-run state inspection

This should become the standard operator tool instead of ad hoc recovery scripts.

## Practical Rules Going Forward

Use these rules operationally:

- If funds are minted to `ReceiverV1` but not in wallet, inspect `settledIntents(intentId)` first.
- If `settledIntents(intentId) == false`, the rail is done and the failure is in destination execution.
- If `tokenOut == expectedRouteToken` and `swapPluginId == 0`, recover with plain `ReceiverV1.execute(...)`.
- If destination swap plugin is non-zero but `swapDataDst == 0x`, the signed intent is malformed.
- If Empseal execution reverts with `Insufficient fee`, the deployed plugin cannot satisfy that route without contract-side fee support.

## Bottom Line

These incidents were not "CCTP failed" incidents.

They were:

- one worker recovery bug affecting already-relayed fast transfers
- one destination receiver approval/config gap on Base
- one malformed destination swap payload on Base
- one deployed Empseal integration limitation where `_fee = 0` is hardcoded

The bridge leg completed in both cases. The failures were in the destination execution layer after funds had already arrived in `ReceiverV1`.
