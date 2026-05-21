To move from Standard CCTP to Fast CCTP, the key change is on the source burn, not the destination worker.

  Right now our contract is explicitly Standard:

  - src/contracts/rails/CCTPRailPlugin.sol:17: FINALITY_THRESHOLD_FINALIZED = 2000
  - src/contracts/rails/CCTPRailPlugin.sol:103: maxFee = 0
  - src/contracts/rails/CCTPRailPlugin.sol:104: minFinalityThreshold = 2000

  Fast CCTP requires:

  - minFinalityThreshold = 1000
  - maxFee > 0, enough to cover Circle’s Fast fee
  - Fast allowance available from Circle
  - quote output must account for the Circle fee so user’s destination receive amount is honest

  Circle docs confirm:

  - Fast messages are minFinalityThreshold <= 1000; Standard is 2000.
  - Fast attestations on Base/Arbitrum are typically seconds.
  - Fees come from GET /v2/burn/USDC/fees/{sourceDomainId}/{destDomainId}.
  - Fast allowance comes from GET /v2/fastBurn/USDC/allowance.

  Sources:

  - https://developers.circle.com/cctp/references/technical-guide
  - https://developers.circle.com/cctp/concepts/finality-and-block-confirmations
  - https://developers.circle.com/cctp/howtos/get-transfer-fee
  - https://developers.circle.com/cctp/howtos/get-fast-transfer-allowance

  For our codebase, there are two viable paths.
  - Plugin calls depositForBurn / depositForBurnWithHook with maxFee and 1000.
  - Quote subtracts the expected Circle fee from estimatedOut / minAmountOut.

  This is the cleanest because the user’s signed calldata binds the exact max fee/finality policy. It likely
  requires redeploying Router + plugin because the calldata struct changes.

  Lower-redeploy path
  Deploy a separate CCTPFastRailPlugin:

  - railId = keccak256("CCTP_V2_FAST")
  - hardcode/use admin-configured minFinalityThreshold = 1000
  - store per-route maxFeeBps or maxFee config
  - register it as a new rail plugin
  - update VPS quote/routing to choose CCTP_FAST plugin ID for fast mode

  This avoids changing RouterV1, but it is less precise because the max fee is controlled by plugin config, not
  directly by the user’s signed intent. The user is still protected by minAmountOut, but if the fee config
  drifts, the destination execute can fail or receive less than quoted.

  The worker side is mostly already compatible after our V2 message fix. The main worker change would be
  operational: shorter expected attestation times, keep retry/reconcile anyway, and ensure it handles
  finalityThresholdExecuted < 2000 messages correctly. The burn call is the real switch.