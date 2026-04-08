# Partner Integration Guide — EMPX-Cross-Chain Cross-Chain Settlement

## Integration Modes

### Mode A — API Integration (Rubic, Rango, light wallets)
Partner calls our REST API for quotes and intent tracking.
RouterV1 transaction is built by our API and submitted by the user's wallet.

```
Partner Frontend → POST /partner/quote → receive {quote, calldata}
User Wallet      → sign + submit calldata to RouterV1 on-chain
Partner Frontend → GET /partner/intent/:id (poll) OR receive webhook push
```

### Mode B — On-Chain Integration (advanced, self-routed)
Partner computes their own route (or uses any solver) and calls RouterV1 directly.
Our contracts are fully permissionless. No API key needed for execution.
Partner uses our status API only for tracking.

```
Partner Solver → compute route off-chain
Partner         → call RouterV1.initiateSwap(intent, swapPluginId, railPluginId)
Partner         → GET /partner/intent/:id to track settlement
```

### Mode C — SDK Integration (wallet providers, embedded)
We provide a TypeScript SDK that wraps Mode A. One function call:

```typescript
const { intentId, txData } = await ruflo.quote({ tokenIn, tokenOut, amountIn, srcChain, dstChain });
await wallet.sendTransaction(txData);
ruflo.track(intentId, (status) => updateUI(status));
```

---

## Partner Tiers

| Tier | Quotes/min | Intents/day | Fee Rebate | SLA | Cost |
|---|---|---|---|---|---|
| **Public** | 10 | 50 | 0% | None | Free, no key |
| **Hobbyist** | 60 | 500 | 0% | None | Free, register for key |
| **Partner** | 600 | 10,000 | 20% | 99.5% | Revenue share agreement |
| **Enterprise** | 6,000 | 500,000 | 30% | 99.9% | Custom contract |

---

## Anti-Abuse Protections

| Protection | Mechanism |
|---|---|
| Rate limiting | Sliding 60s window per API key — 429 on exceed |
| Daily cap | Per-key intent submission limit, resets at UTC midnight |
| Quote spam detection | Quote:execute ratio monitored — throttled above 80:1 |
| Cloudflare WAF | In front of all API endpoints (standard tier sufficient for T1–T2) |
| HMAC webhook signing | All webhook pushes signed with `x-ruflo-sig` — partners verify |
| On-chain replay guard | `executedIntents[intentId]` mapping prevents double-execution |
| No VPS needed for settlement | RouterV1 is permissionless — DDoS on VPS doesn't block user funds |

---

## Quick Start (Mode A)

```bash
# 1. Get API key (register at dashboard)
# 2. Request a quote
curl -X POST https://api.ruflo.io/partner/quote \
  -H "x-api-key: YOUR_KEY" \
  -H "content-type: application/json" \
  -d '{
    "tokenIn": "0xTokenAddress",
    "tokenOut": "0xTokenAddress",
    "amountIn": "1000000",
    "srcChainId": 42161,
    "dstChainId": 8453,
    "userAddress": "0xUserWallet"
  }'

# Response includes: quote, intentId, calldata for RouterV1
# 3. User signs and submits calldata with their wallet
# 4. Track status
curl https://api.ruflo.io/partner/intent/INTENT_ID \
  -H "x-api-key: YOUR_KEY"
```
