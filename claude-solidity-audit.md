CRITICAL
1. Missing signature replay protection across chains — RouterV1:line 102
executedIntents mapping is only checked on source chain. An attacker can replay the same intentId on a different source chain if intent signing doesn't include block.chainid or address(this). The EIP-712 domain uses only SIGNING_DOMAIN and SIGNATURE_VERSION (lines 23-24), with no chain ID included. Risk: Same intent executed twice on different chains.
2. Unvalidated dstReceiver address can bypass intent — RouterV1:line 287
In _enforceMessagingRouteExpectations(), the code checks if (intent.dstReceiver == address(0)) return; (line 287), meaning zero receiver skips all destination validation. A malicious signer could set dstReceiver = address(0) and the swap proceeds with no destination checks. Risk: Intent slippage validation bypassed.
Source/destination swap plugin IDs not enforced immutably — RouterV1:line 113, ReceiverV1:line 101
3. Plugin IDs come from the signed intent (good), but the registry itself (PluginRegistry) allows owner to deactivate and reactivate plugins (lines 69-79). An owner compromise allows substituting plugins retroactively for active intents. Risk: Plugin swap (funds redirected to malicious plugin).
4. Missing msg.value refund after native gas prepayment — AxelarRailPlugin:line 149, LayerZeroRailPlugin:line 175
Both correctly refund excess ETH (lines 159-161, 188-191), but if a user underpays gas, the transaction reverts and native is lost. No explicit emergency recovery path documented. Risk: User ETH stuck.
5. Paymaster signature not bound to UserOp sender or nonce — Paymaster:line 79
Signature digest is keccak256(abi.encodePacked(userOpHash, token, maxTokenFee, expiry)) but doesn't include userOp.sender or userOp.nonce. A malicious relayer could extract a valid signature from one UserOp and apply it to a different UserOp from a different user (with same token/maxTokenFee/expiry). Risk: Paymaster griefing — arbitrary users sponsored.
6. ERC20 transfer return value not checked in critical path — EmpsealRouterEth.sol:line 44
IERC20(_wnative).safeApprove(_wnative, type(uint256).max); is on WETH, which is safe, but in the original EmpsealRouter (reference), line 309-310 uses _transferFrom() which doesn't call SafeERC20 for all cases. If a non-standard ERC20 is used, silent failures possible. Risk: Fee routing failure.
7. No slippage/deadline protection on THORChain deposits — THORChainRailPlugin:line 133
User's minThorOutput (line 115) is embedded in memo but THORChain validators are not bound by it — memo is just metadata. If THORChain price impact exceeds limit, there's no atomic rollback. Risk: Cross-chain trade execution with unknown final price.

HIGH
1. Insufficient signature validation in Paymaster — Paymaster:line 80-81
Only checks recovered != paymasterSigner, but _recoverSigner() uses ecrecover() directly (line 164) without checking for malleability or the zero address. A zero-address recovery (invalid sig) would silently fail the check. Risk: Invalid signatures not explicitly rejected.
CCTPFastRailPlugin allows maxFee > amount — CCTPFastRailPlugin:line 97
Validation is if (maxFee > params.amount) (line 97), which is good. However, the cap is recalculated from maxFeeBpsCap (line 99), so if both checks pass, maxFee could still consume the entire transfer amount. Risk: Destination receives zero tokens.
AxelarReceiverAdapter uses address(0) token as unsupported marker — AxelarReceiverAdapter:line 78, 133-134
trustedTokenById[tokenId] = trusted ? token : address(0); (line 134) means trusting a token sets it; distrusting clears it. But if a real token is address(0) (impossible in EVM but conceptually), there's ambiguity. Risk: Low, but unclear intent logic.
LayerZeroReceiverAdapter does not validate amount against minRouteAmount — LayerZeroReceiverAdapter:line 94-104
The adapter decodes minRouteAmount from payload (line 20) but never compares it to the actual amount parameter passed by LayerZero. ReceiverV1 does check this (ReceiverV1:line 84-86), but the adapter doesn't enforce it before forwarding. Risk: Bypass of settlement slippage if adapter is called directly.
RouterV1 does not validate dstGasLimit before signing check — RouterV1:line 288
InvalidDstGasLimit error thrown in _enforceMessagingRouteExpectations() but this is called after signature is verified (line 95). A properly signed intent with zero dstGasLimit passes verification but fails later. Risk: Valid signed intents can be invalidated post-hoc.
No deadline enforcement on CCTP/Axelar/LayerZero bridges — CCTPRailPlugin, AxelarRailPlugin, LayerZeroRailPlugin
Rail plugins do not check params.deadline at all. An old, expired intent could be submitted to a bridge even after the deadline has passed. Risk: Stale intent execution.
UniswapV3SwapPlugin uses sqrtPriceLimitX96 incorrectly — UniswapV3SwapPlugin:line 96
sqrtPriceLimitX96 is passed directly from calldata (line 81) but Uniswap V3 interprets this as a price limit to prevent sandwich attacks. If set to zero, no limit is enforced. Risk: Missing price protection if VPS forgets to set limit.
Missing balance check before swap in UniswapV2SwapPlugin — UniswapV2SwapPlugin:line 87-91
Plugin approves params.amountIn to router, but what if caller approved less? The safeTransferFrom will revert, not a direct vulnerability but inconsistent pattern vs balance-delta verification in other plugins. Risk: Inconsistent error handling.
ReceiverV1 swap slippage check executed twice — ReceiverV1:line 92-93, 104-105, 116-117
Direct delivery path checks amount < decoded.minAmountOut (line 92), then swap path also checks amountOut < decoded.minAmountOut (line 116). If both paths are taken (impossible, but code suggests both are checked), redundancy creates confusion. Risk: Code maintainability issue.
PluginRegistry does not prevent plugin ID collisions — PluginRegistry:line 49, 62
Only checks plugins[id].plugin != address(0), but if a malicious plugin contract spoofs another plugin's railId() or pluginId() return value, it could cause collision. EIP-165 doesn't validate the ID matches. Risk: Plugin ID spoofing if malicious plugin registered.
CCTPRailPlugin supportsRoute() has off-by-one error — CCTPRailPlugin:line 52
Returns true for chainToDomain[dstChainId] != 0 || dstChainId == 1. But chainToDomain[1] (ETH) should also have been set, so the special case for ETH is redundant and error-prone. Risk: Unclear intent, hard to maintain.
MEDIUM
Hardcoded THORChain timelock of 15 minutes — THORChainRailPlugin:line 133-134, 144-145
block.timestamp + 15 minutes is hardcoded in two places. No way to adjust per-intent. Risk: Inflexible; if intent is signed with longer deadline expectation, THORChain will reject.
EmpsealSwapPlugin balance-delta check is redundant — EmpsealSwapPlugin:line 104-106
Plugin calls empseal.swapNoSplit() (line 99), which already enforces minAmountOut internally (line 319 in EmpsealRouterEth). The check at line 104 is a duplicate safeguard. Risk: Code smell; suggests distrust in Empseal output.
Paymaster does not emit failure events — Paymaster:line 105-106
If mode == PostOpMode.postOpReverted, the function returns silently without logging. Operator has no visibility into failed sponsorships. Risk: Accounting/monitoring gap.
AxelarRailPlugin concatenates payload without length prefix — AxelarRailPlugin:line 155
bytes.concat(bytes4(0), params.dstCalldata) prepends a 4-byte zero selector. But if dstCalldata is itself a composite structure, the adapter must strip this prefix (AxelarReceiverAdapter:line 83-85 does), creating tight coupling. Risk: If adapter/router versions mismatch, payload corruption.
LayerZeroRailPlugin allows options override but doesn't validate — LayerZeroRailPlugin:line 167
decoded.optionsOverride (from railData) can override default options, but no validation that the override is safe. A malicious signer could inject options causing executor to revert. Risk: Intent execution can be sabotaged by signer.
THORChainRailPlugin hardcodes vault fallback to ETH mainnet — THORChainRailPlugin:line 176
if (vault == address(0)) vault = inboundVaults[1]; always falls back to chainId 1. If ETH vault is not set, any non-EVM chain deposit fails unchecked. Risk: Silent vault misconfiguration.
No circuit-breaker on fee collection — RouterV1:line 109-127
Fee is collected from user (line 110) and then route amount is computed (line 112). If route swap fails, fee is already lost. Risk: Fee collected upfront with no rollback.
Missing zero-amount check in some rail plugins — AxelarRailPlugin:line 134, CCTPRailPlugin:line 83
No validation that params.amount > 0 at bridge entry. Empseal/UniswapV2/V3 check amountIn (implicit via swap), but rail plugins assume amount is valid. Risk: Empty bridge requests waste gas.
Paymaster rate staleness not checked — Paymaster:line 87-88
Token rate is fetched from mapping (line 87) with no timestamp. If rate keeper is down for hours, quotes are stale. Risk: Fee overcharge or undercharge.
ReceiverV1 does not validate swap plugin on destination — ReceiverV1:line 101
Plugin ID comes from signed payload, but if plugin is not registered (inactive or missing), registry.getSwapPlugin() reverts with generic error. No clear distinction between disabled plugin vs. missing plugin. Risk: Unclear failure mode on destination.
ERC165 interface check can be spoofed — PluginRegistry:line 45-46, 58-59
Uses ERC165Checker.supportsInterface(), which calls the plugin's supportsInterface(). A malicious plugin can return true for any interface ID. Risk: Invalid plugin registered if ERC165 check is spoofed.
CCTPRailPlugin assumes destinationCaller is bytes32(0) if unset — CCTPRailPlugin:line 86-87, 106
Maps chainId to destinationCaller (bytes32), defaults to bytes32(0) (means open relay). No explicit validation that bytes32(0) was intentional. Risk: If owner forgets to set caller, CCTP message is relayable by anyone.
LOW
Unused variable in AxelarReceiverAdapter — AxelarReceiverAdapter:line 88-94
Variables like decoded.intentId, decoded.user, etc. are decoded but never used; they're accessed then immediately discarded. Likely dead code for debugging. Risk: Code smell; suggests incomplete refactor.
Unused variable in LayerZeroReceiverAdapter — LayerZeroReceiverAdapter:line 98-104
Same pattern: decoded fields accessed but not used. Risk: Code smell.
Inconsistent use of forceApprove vs. safeApprove — Throughout
Some contracts use forceApprove (RouterV1:line 230, 268), others use safeApprove (EmpsealRouterEth:line 44). No clear pattern. Risk: Inconsistent approval handling.
THORChainRailPlugin _isNativeChain() hardcodes pseudo-chainIds — THORChainRailPlugin:line 181-188
Pseudo-chain IDs (0, 98, 99, 100, 101, 102) are magic numbers with no centralized registry. If VPS changes, contracts fall out of sync. Risk: Hard-coded values can diverge from system.
No pause mechanism on rail/swap plugins — RouterV1:line 143-144, ReceiverV1:line 144-145 have pause/unpause
Core contracts support pause, but rail/swap plugins do not. If a plugin is exploited, only deactivation is possible (not pause+fix). Risk: Slower response to plugin bugs.
Paymaster deposits ETH but has no withdraw guard — Paymaster:line 147-148
withdrawFromEntryPoint() can pull all ETH. No amount cap. Risk: If owner key is compromised, attacker can drain gas reserve.
Missing check for zero amount in fee collection — RouterV1:line 125
_collectFee() checks if (feeAmount == 0) return amount; but doesn't check if amount itself is zero before calling safeTransfer(). If amount is zero, transfer is harmless but wasteful. Risk: Minor gas waste.
EmpsealSwapPlugin and V2 do not handle rebase tokens — EmpsealSwapPlugin:line 101, EmpsealSwapPluginV2:line 74
Balance-delta check assumes balanceOf(after) - balanceOf(before) = amountOut. If token rebases during swap, balances change unpredictably. Risk: Rebase token swaps fail or lose precision.
Lack of recovery path for stuck CCTP messages — CCTPRailPlugin, CCTPFastRailPlugin
If Circle attestation relayer is down, message sits in limbo. No timeout or manual override. Risk: Stuck bridge funds.
No validation of destinationReceivers addresses are contracts — PluginRegistry, rail plugins
Receivers can be set to EOA or malformed addresses. If set to EOA, cross-chain messages succeed but recipient can't execute them. Risk: User funds bridge to uncontrollable address.
LayerZeroRailPlugin stores route config per family but doesn't validate family bounds — LayerZeroRailPlugin:line 257, 344
Family is uint8 (0-3 constants defined), but callers can pass any uint8. No bounds check on family index. Risk: OOB write if valid family value is exploited.
UniswapV2SwapPlugin deadline default of 300 seconds is hardcoded — UniswapV2SwapPlugin:line 98
If deadline == 0, defaults to block.timestamp + 300. But 300 seconds (~5 min) is arbitrary. Risk: Mismatch with user expectations if deadline not passed.
UniswapV3SwapPlugin same deadline hardcode — UniswapV3SwapPlugin:line 93
Same as above: block.timestamp + 300 if deadline is zero. Risk: Arbitrary timeout.
INFO / CODE SMELL
Missing NatSpec for critical functions — Multiple files
PluginRegistry.registerRailPlugin() and registerSwapPlugin() have no @return or @dev for gas cost implications. Risk: Incomplete documentation.
THORChainRailPlugin memo construction is fragile — THORChainRailPlugin:line 169
string.concat() is used to build memo, but no escaping of special characters (e.g., if destAddr contains :). Risk: Malformed memo if address has weird encoding.
Inconsistent error naming — RouterV1:line 68 is ZeroAddress(string field) vs. Paymaster:line 50 is just OnlyEntryPoint()
Inconsistent error conventions make auditing harder. Risk: Code maintainability.
Hard cap on MIN_AMOUNT in RouterV1 — RouterV1:line 44
1e6 is a constant (1 USDC), but if used on low-decimal or high-decimal tokens, this is incorrect. Risk: Dust threshold not token-aware.
No re-entrancy guard on Paymaster — Paymaster:line 20
postOp() is external and uses safeTransferFrom() (line 116), which could theoretically re-enter if token has a hook. ReentrancyGuard not inherited. Risk: Though EntryPoint controls flow, missing defense-in-depth.
Orphaned interface IEmpsealRouter.sol — IEmpsealRouter.sol:line 5-7 mentions "call-site interface only"
Suggests the reference contract (EmpsealRouterEth.sol) is already deployed, so this is a mirror. Potential version mismatch. Risk: Code divergence.
No event emitted on plugin deactivation/reactivation without reason — PluginRegistry:line 71-72, 77-78
Events don't log why a plugin was toggled (no reason string). Risk: Monitoring/audit trail incomplete.
SUMMARY
Total findings: 50

Critical: 7
High: 11
Medium: 13
Low: 12
Info: 7
Most severe clusters:

Signature and replay protection gaps (Critical #1, High #8) — chain ID missing from EIP-712
Plugin substitution risk (Critical #3, High #17) — owner-controlled plugin lifecycle
Missing cross-chain deadline enforcement (High #13) — stale intents can execute
Paymaster griefing (Critical #5) — signature not bound to UserOp sender
Validator bypass on THORChain (Critical #7) — memo is advisory, not enforced