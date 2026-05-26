# Protocol Fee Updates

## Scope
This note captures:
1. The current protocol fee model in the VPS/Router flow.
2. The suggested model: flat `0.15%` on all transactions across all rails.

---

## Current Fee Model

### Where it is defined
- Quote computation:
  - `src/vps/services/QuoteEngine.ts`
- On-chain cap and collection:
  - `src/contracts/RouterV1.sol`
- Rail USD fee constants used in quote economics:
  - `src/vps/services/RailSelector.ts`

### Current formula
In `QuoteEngine`:
- `railFeeUSD = route.totalFeeUSD`
- `protocolFeeUSD = max(0.50, amountUSD * 0.0005)`  // min $0.50 OR 0.05%
- `totalFeeUSD = railFeeUSD + protocolFeeUSD`

Then it converts to token fee:
- `feeBpsUncapped = round((totalFeeUSD / amountUSD) * 10_000)`
- `feeRatioBps = min(feeBpsUncapped, 100)`  // capped by Router max 1%
- `feeAmountToken = amountIn * feeRatioBps / 10_000`

### Current rail fee constants (USD, used in routing/quote economics)
- `CCTP`: `0.00`
- `VIA_LABS`: `0.25`
- `AXELAR`: `0.50`
- `LAYERZERO`: `0.35`
- `WORMHOLE`: `0.40`
- `THORCHAIN`: `0.00` (slippage-based behavior)

### On-chain enforcement
In `RouterV1.sol`:
- `MAX_FEE_BPS = 100` (`1%`) hard cap.
- `intent.feeAmount` is validated against the cap.
- Fee is transferred to `feeRecipient` via `_collectFee(...)`.

---

## Suggested Model: Flat `0.15%` on All Transactions

### Target behavior
- Charge protocol fee as exactly `15 bps` (`0.15%`) on every quote/tx.
- Apply consistently regardless of selected rail.

### Suggested fee formula
- `FLAT_PROTOCOL_FEE_BPS = 15`
- `feeAmountToken = amountIn * 15 / 10_000`
- Optional reporting value:
  - `feeAmountUSD = amountUSD * 0.0015`

### Important design decision
Choose one of these explicitly:

1. **Pure flat protocol fee only**
- Do not add rail fee constants to charged user fee.
- `totalFeeUSD` displayed to user reflects only `0.15%`.

2. **Flat protocol fee + rail pass-through**
- Keep adding rail cost to displayed/charged fee.
- This is not truly "flat 0.15% on all txs"; effective fee varies by rail.

If the product requirement is strict flat fee, use option 1.

---

## Code Changes (for strict flat 0.15%)

### Primary change
- File: `src/vps/services/QuoteEngine.ts`
- Replace dynamic fee composition:
  - remove `railFeeUSD + max(0.50, 0.05%)` charging logic
  - set fixed `feeRatioBps = 15`

### Keep unchanged
- `RouterV1.MAX_FEE_BPS = 100` can remain as safety cap.
- `IntentCalldataBuilder` and Router fee transfer flow continue to work as-is.
- Partner rebate split logic (`ApiKeyManager.splitFee`) still works against `quote.feeAmountToken`.

### Optional follow-up
- If you also want route ranking to ignore static rail fee differences, revisit scoring inputs in:
  - `src/vps/services/RailSelector.ts`
  - route score usage in `RouterBuilder`

---

## Expected Impact

### User pricing
- Simpler and predictable fee: always `0.15%`.
- Small transfers become cheaper vs current `$0.50` minimum.
- Transfers above the old break-even point become more expensive than the prior `0.05%` protocol component (depends on current rail + min fee effects).

### Ops/business
- Revenue model becomes volume-proportional and rail-independent.
- Margin by rail must be reviewed if some rails have materially higher execution cost.

---

## Summary
Current model is mixed (`rail fee + min($0.50, 0.05%)` with 1% hard cap).  
Suggested model is a fixed `0.15%` fee (`15 bps`) for every transaction on every rail, best implemented in `QuoteEngine` while keeping Router's on-chain cap as a guardrail.
