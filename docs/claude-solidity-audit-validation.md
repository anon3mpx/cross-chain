# Claude Solidity Audit Validation

Validation date: 2026-06-03

Scope: every candidate in `claude-solidity-audit.md`, validated against `src/contracts`, `tests/contracts`, and the local OpenZeppelin dependency code.

Verification run:

```bash
npm run sol:test
```

Result: 48 Solidity tests passed, 0 failed.

## Rubric

- Attacker input: is the claimed input actually attacker-controlled, or only controlled by the trusted signer/owner?
- Reachability: can the path be reached through the real Router/Receiver/EntryPoint/adapter flow?
- Sink/invariant: does the claimed sink violate a concrete protocol invariant?
- Guard evidence: do Router, Receiver, registry, OpenZeppelin, or protocol-specific guards defeat the claim?
- Impact: is there an externally exploitable loss path, a signed-intent/operator risk, an owner/governance risk, or only maintainability noise?

## Executive Summary

No item from the audit validates at its stated critical/high severity as an unauthenticated or external fund-loss vulnerability.

The strongest real issues are hardening and operations:

- `RouterV1._enforceMessagingRouteExpectations()` returns early when `dstReceiver == address(0)`. That does not bypass destination slippage in the successful messaging path, because `ReceiverV1` still enforces token/asset/minimum checks, but it can let a trusted signer produce an invalid messaging intent that bridges into a reverting destination payload.
- `Paymaster` should reject zero signer addresses and use OpenZeppelin `ECDSA` recovery. The current `ecrecover` path rejects invalid signatures unless `paymasterSigner` is misconfigured to zero.
- Several rail/plugin controls rely on owner configuration and off-chain signer discipline: LayerZero `optionsOverride`, CCTP `destinationCaller == bytes32(0)`, THORChain vault/address/memo configuration, and Paymaster rate freshness.
- Many "critical/high" findings are false positives because the audit missed inherited OpenZeppelin behavior, transaction atomicity, `ReceiverV1` downstream enforcement, or EIP-4337 `userOpHash` semantics.

## Critical Findings

| ID | Audit finding | Verdict | Validation |
| --- | --- | --- | --- |
| C-01 | Missing signature replay protection across chains | Suppressed | False positive. `RouterV1` inherits OpenZeppelin `EIP712`, and `_hashTypedDataV4()` includes the domain separator. OpenZeppelin `EIP712` includes `block.chainid` and `address(this)` in the domain separator, so a signature for one router/chain does not validate on another router/chain. Evidence: `RouterV1.sol:20`, `RouterV1.sol:74`, `RouterV1.sol:130-154`, `node_modules/@openzeppelin/contracts/utils/cryptography/EIP712.sol:37-91`. |
| C-02 | `dstReceiver == address(0)` bypasses intent validation | Downgraded, valid hardening issue | The early return at `RouterV1.sol:287` skips `dstGasLimit`, `expectedDstRouteToken`, and `minRouteAmount` checks before bridging. However, successful destination execution is still guarded by `ReceiverV1.execute()` checks at `ReceiverV1.sol:73-86` and `ReceiverV1.sol:91-117`. This is not an external slippage bypass, but a trusted-signer/VPS bug could create a bridge that later reverts or gets stuck. |
| C-03 | Plugin IDs can be substituted retroactively | Suppressed | `PluginRegistry` has no function to replace the address for an existing ID. `registerRailPlugin()` and `registerSwapPlugin()` reject an existing ID at `PluginRegistry.sol:49` and `PluginRegistry.sol:62`. Deactivate/reactivate toggles only the same stored entry. Owner compromise is governance risk, not retroactive substitution by this code. |
| C-04 | Missing refund after native gas prepayment | Suppressed | The claim contradicts the code. Axelar and LayerZero refund excess ETH at `AxelarRailPlugin.sol:158-161` and `LayerZeroRailPlugin.sol:188-191`. If underpaid, the transaction reverts atomically; `msg.value` is not "lost" on revert. |
| C-05 | Paymaster signature not bound to userOp sender or nonce | Suppressed | The signature is bound to `userOpHash` at `Paymaster.sol:79`. In ERC-4337, the EntryPoint-provided `userOpHash` is for the specific UserOperation, including sender and nonce. A relayer cannot apply the same signature to a different operation unless it can collide or manipulate EntryPoint hash semantics. |
| C-06 | ERC20 transfer return value not checked in Empseal reference | Suppressed | The cited reference uses `SafeERC20`: `_transferFrom()` calls `safeTransferFrom`/`safeTransfer` at `references/EmpsealRouterEth.sol:116-120`. The local Empseal plugins also use `SafeERC20`. |
| C-07 | THORChain min output is only metadata, no slippage protection | Suppressed as contract vuln; keep as protocol assumption | The local contract passes `minThorOutput` into the THORChain memo at `THORChainRailPlugin.sol:110-116` and `THORChainRailPlugin.sol:168-169`. The EVM contract cannot atomically enforce remote AMM execution, but that is inherent to THORChain rails, not a Router/Plugin bug. Treat as an integration trust assumption, not critical Solidity vulnerability. |

## High Findings

| ID | Audit finding | Verdict | Validation |
| --- | --- | --- | --- |
| H-01 | Paymaster invalid signature validation is insufficient | Downgraded, valid hardening issue | Invalid `ecrecover` returns `address(0)` and then fails unless `paymasterSigner == address(0)`. The real issue is lack of zero-signer validation in constructor/setter and no low-S malleability check. Use OpenZeppelin `ECDSA` and reject zero signer. Evidence: `Paymaster.sol:58-61`, `Paymaster.sol:136-138`, `Paymaster.sol:161-164`. |
| H-02 | `CCTPFastRailPlugin` allows `maxFee > amount` / zero receive | Suppressed | Code rejects `maxFee > params.amount` at `CCTPFastRailPlugin.sol:97` and rejects `maxFee > amount * maxFeeBpsCap / 10000` at `CCTPFastRailPlugin.sol:99-100`. The cap defaults to 1% and the owner setter caps it at 10% (`CCTPFastRailPlugin.sol:151-153`). |
| H-03 | Axelar adapter uses `address(0)` as unsupported marker | Suppressed | EVM ERC20 token address zero is not a real token address here, and `setTrustedToken()` rejects trusting zero at `AxelarReceiverAdapter.sol:132-134`. This is a normal sentinel pattern. |
| H-04 | LayerZero adapter does not check `amount >= minRouteAmount` | Suppressed | The adapter forwards to `ReceiverV1.execute()` at `LayerZeroReceiverAdapter.sol:124-125`; `ReceiverV1` enforces `amount >= decoded.minRouteAmount` at `ReceiverV1.sol:84-86`. Existing tests cover adapter forwarding and Receiver route-minimum enforcement. |
| H-05 | Router validates `dstGasLimit` only after signature | Suppressed | A signed intent with zero gas fails during `_bridgeIntent()` before bridge call. That is not a security bypass; it means the trusted signer can produce an invalid signed intent. |
| H-06 | Rail plugins do not enforce intent deadlines | Suppressed | `RouterV1` enforces `deadline` before signature verification and bridge invocation at `RouterV1.sol:215-221`. Direct public calls to rail plugins require the caller's own tokens/approvals and do not execute a signed Router intent. |
| H-07 | UniswapV3 `sqrtPriceLimitX96` misuse | Suppressed | `amountOutMinimum` is set from signed `minAmountOut` at `UniswapV3SwapPlugin.sol:87-97`, and output is checked again at `UniswapV3SwapPlugin.sol:100-102`. A zero sqrt limit disables an extra Uniswap V3 price-bound feature, but does not remove slippage protection. |
| H-08 | UniswapV2 missing balance check before swap | Suppressed | `safeTransferFrom()` at `UniswapV2SwapPlugin.sol:90` reverts on insufficient allowance/balance. This is not a vulnerability. |
| H-09 | ReceiverV1 slippage check executed twice | Suppressed | Direct delivery and swap paths are mutually exclusive because the direct path returns at `ReceiverV1.sol:97`. The second check applies only after destination swap. |
| H-10 | Plugin registry does not prevent plugin ID collisions | Suppressed | A malicious plugin returning an existing ID is rejected by `PluginAlreadyRegistered` at `PluginRegistry.sol:49` or `PluginRegistry.sol:62`. ERC165 spoofing matters only if the owner registers a malicious plugin. |
| H-11 | CCTP `supportsRoute()` off-by-one | Suppressed | Circle Ethereum domain is zero, so the `dstChainId == 1` special case is intentional sentinel handling. Actual bridging still requires `destinationReceivers[dstChainId] != bytes32(0)` at `CCTPRailPlugin.sol:77-80`. |

## Medium Findings

| ID | Audit finding | Verdict | Validation |
| --- | --- | --- | --- |
| M-01 | THORChain 15-minute hardcoded expiry | Valid low/medium operations issue | `block.timestamp + 15 minutes` is hardcoded at `THORChainRailPlugin.sol:128-145`. This is not exploitable by an external attacker, but it is inflexible and may diverge from quote/intent expectations. |
| M-02 | Empseal balance-delta check is redundant | Valid code smell, positive redundancy | The check at `EmpsealSwapPlugin.sol:101-106` duplicates the reference router's output check at `references/EmpsealRouterEth.sol:319`. This is harmless defense-in-depth. |
| M-03 | Paymaster does not emit failure events | Valid observability issue | `postOpReverted` returns silently at `Paymaster.sol:105-106`. This can hurt monitoring/accounting but does not create fund loss. |
| M-04 | Axelar payload prefix coupling | Valid code smell | Source prepends `bytes4(0)` at `AxelarRailPlugin.sol:151-155`; adapter strips it at `AxelarReceiverAdapter.sol:82-85`. Existing tests cover this, but it is version-coupled protocol glue. |
| M-05 | LayerZero options override lacks validation | Downgraded | `optionsOverride` is signed inside `railData` and decoded at `LayerZeroRailPlugin.sol:140` and used at `LayerZeroRailPlugin.sol:162-168`. An external relayer cannot inject it, but signer/VPS policy should restrict unsafe options. |
| M-06 | THORChain vault fallback to ETH mainnet | Valid configuration risk | `_resolveVault()` falls back to `inboundVaults[1]` at `THORChainRailPlugin.sol:172-177`. It reverts if unset, but the fallback assumption should be documented/tested against THORChain current behavior. |
| M-07 | Fee collection before route failure | Suppressed | Fee transfer occurs before route/swap/bridge, but any later revert reverts the whole transaction, including `safeTransfer` fee movement. There is no permanent fee loss on failed transaction. |
| M-08 | Missing zero-amount check in rail plugins | Downgraded hardening | `RouterV1` rejects zero `amountIn` at `RouterV1.sol:215-217`, so Router-mediated calls are safe. Public direct plugin calls could waste gas or hit protocol-specific behavior with zero amount; add plugin-level checks for defense-in-depth. |
| M-09 | Paymaster rate staleness | Valid operations/economic risk | Rates are stored without timestamp at `Paymaster.sol:32-33` and used at `Paymaster.sol:87-90`. Add freshness metadata or signed per-operation rate data if stale rates are unacceptable. |
| M-10 | Receiver does not validate destination swap plugin clearly | Suppressed | `registry.getSwapPlugin()` distinguishes not found vs inactive with custom errors at `PluginRegistry.sol:90-94`. Failure mode is already specific. |
| M-11 | ERC165 interface check can be spoofed | Downgraded governance risk | True in general: a malicious contract can lie about ERC165. In this registry, only owner can register plugins (`PluginRegistry.sol:44`, `PluginRegistry.sol:57`), and plugin behavior is ultimately a governance/signer trust issue. |
| M-12 | CCTP destinationCaller defaults to open relay | Valid configuration risk | `destinationCallers` defaults to `bytes32(0)` and is passed to Circle at `CCTPRailPlugin.sol:86-109`. This may be intended, but configuration should make open relay explicit. |

## Low Findings

| ID | Audit finding | Verdict | Validation |
| --- | --- | --- | --- |
| L-01 | Unused variables in Axelar adapter | Valid code smell | Decoded fields are touched but unused at `AxelarReceiverAdapter.sol:87-94`. |
| L-02 | Unused variables in LayerZero adapter | Valid code smell | Decoded fields are touched but unused at `LayerZeroReceiverAdapter.sol:97-104`. |
| L-03 | Inconsistent `forceApprove` vs `safeApprove` | Mostly suppressed | Current local contracts consistently use `forceApprove` for changing allowances. The cited `safeApprove` usage is in a reference contract. |
| L-04 | THORChain pseudo-chain IDs hardcoded | Valid maintainability issue | `_isNativeChain()` hardcodes pseudo IDs at `THORChainRailPlugin.sol:181-188`. Centralize with VPS config or document invariants. |
| L-05 | No pause mechanism on rail/swap plugins | Valid operations issue | Router/Receiver can pause, and registry deactivation stops Router-mediated plugin lookup, but plugin contracts themselves remain directly callable with caller-owned funds. Add plugin pause if emergency response requires it. |
| L-06 | Paymaster withdraw has no amount cap | Suppressed | `withdrawFromEntryPoint()` is `onlyOwner` at `Paymaster.sol:146-148`. A compromised owner can drain reserves regardless of cap; this is governance risk, not a contract vulnerability. |
| L-07 | Missing zero-amount check in fee collection | Suppressed | `RouterV1._validateIntent()` rejects zero `amountIn` before `_collectFee()` is reachable. |
| L-08 | Empseal plugins do not handle rebase tokens | Valid unsupported-token risk | Balance-delta accounting at `EmpsealSwapPlugin.sol:94-106` and `EmpsealSwapPluginV2.sol:72-78` can misbehave with rebasing/fee-on-transfer assets. Restrict supported tokens or document unsupported classes. |
| L-09 | Lack of recovery path for stuck CCTP messages | Valid operations issue | This is a cross-chain operations concern, not an immediate Solidity exploit. Recovery/monitoring should live in relay/runbook design. |
| L-10 | Destination receivers not checked as contracts | Valid configuration hardening | Owner can configure EOA/malformed receivers in rail plugins. This can cause stuck messages. Some remote receivers cannot be checked on source chain, but EVM-local setters can at least reject zero and optionally check code length where applicable. |
| L-11 | LayerZero family bounds missing | Suppressed as stated | There is no array out-of-bounds risk; `family` indexes a mapping at `LayerZeroRailPlugin.sol:32` and `LayerZeroRailPlugin.sol:294-307`. Unknown families simply have no route unless owner configures them. |
| L-12 | UniswapV2 default deadline hardcoded | Valid design issue | Default `block.timestamp + 300` at `UniswapV2SwapPlugin.sol:93-99` is arbitrary. Signed calldata can provide a deadline. |
| L-13 | UniswapV3 default deadline hardcoded | Valid design issue | Default `block.timestamp + 300` at `UniswapV3SwapPlugin.sol:87-97` is arbitrary. Signed calldata can provide a deadline. |

## Info / Code Smell Findings

| ID | Audit finding | Verdict | Validation |
| --- | --- | --- | --- |
| I-01 | Missing NatSpec for critical functions | Valid documentation issue | Several admin functions are lightly documented. This is not a security bug. |
| I-02 | THORChain memo construction is fragile | Valid input-validation/design issue | Memo uses raw `thorAssetIdentifier` and native address bytes in `string.concat()` at `THORChainRailPlugin.sol:155-169`. If the signer/VPS accepts malformed strings containing memo separators, the remote protocol may parse unexpectedly. |
| I-03 | Inconsistent error naming | Valid style issue | Error conventions differ between contracts. No runtime impact. |
| I-04 | Hard cap `MIN_AMOUNT = 1e6` is token-decimal specific | Valid design issue | `RouterV1.MIN_AMOUNT` at `RouterV1.sol:43-44` assumes 6 decimals. This is inappropriate for arbitrary token decimals unless `tokenIn` is restricted to 6-decimal assets. |
| I-05 | No reentrancy guard on Paymaster | Suppressed as stated | `Paymaster` inherits `ReentrancyGuard` at `Paymaster.sol:20`. `postOp()` does not use `nonReentrant`, but only EntryPoint can call it, and token callback reentry cannot satisfy `onlyEntryPoint`. Add the modifier only as defense-in-depth. |
| I-06 | Orphaned `IEmpsealRouter` interface | Valid divergence risk | The interface is intentionally call-site-only (`IEmpsealRouter.sol:4-7`). Keep it synchronized with deployed Empseal router ABI. |
| I-07 | Plugin toggle events lack reason | Valid observability issue | `PluginDeactivated` and `PluginReactivated` emit only the ID at `PluginRegistry.sol:69-78`. Reason strings can improve incident auditability. |

## Recommended Fix Order

1. Harden `RouterV1._enforceMessagingRouteExpectations()` by applying messaging-route checks based on selected rail type/plugin or by requiring nonzero `dstReceiver` for messaging rails while exempting THORChain/native delivery explicitly.
2. Harden `Paymaster`: reject zero `_entryPoint`, `_signer`, and owner-adjacent signer updates; replace raw `ecrecover` with OpenZeppelin `ECDSA`; consider binding token fee data to chain/paymaster explicitly even though EntryPoint `userOpHash` already scopes the operation.
3. Add explicit configuration safety checks/events: CCTP open-relay marker, plugin pause or deactivation runbook, receiver address checks where locally knowable, and timestamped paymaster rates.
4. Clean up code smells after security hardening: unused adapter decoded fields, THORChain pseudo-chain constants/memo validation, NatSpec, and default DEX deadlines.
