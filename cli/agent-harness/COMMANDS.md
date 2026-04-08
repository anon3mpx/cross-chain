# EMPX-Cross-Chain CLI — Command Reference

All commands output structured JSON. Set `RUFLO_API_KEY` env var before use.

---

## Global Options

| Flag | Description |
|---|---|
| `--help` | Show help for any command |
| `--version` | Show CLI version |

---

## quote

Get a swap quote (valid 30s).

```bash
ruflo quote \
  --from-chain 42161 \
  --from-token 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
  --to-chain 8453 \
  --to-token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --amount 100 \
  --urgency normal
```

**Response:**
```json
{
  "ok": true,
  "quote": {
    "quoteId": "q_abc123",
    "rail": "CCTP",
    "amountIn": "100",
    "estimatedOut": "99.82",
    "fee": "0.18",
    "etaSeconds": 25,
    "expiresAt": 1711234567,
    "settlementToken": "USDC",
    "fromChain": "arbitrum",
    "toChain": "base"
  }
}
```

---

## swap

Initiate a swap. Returns pre-built tx for wallet signing.

```bash
ruflo swap \
  --from-chain 42161 \
  --from-token 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
  --to-chain 8453 \
  --to-token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --amount 100 \
  --wallet 0xUserWalletAddress \
  --slippage-bps 50
```

**EVM → Bitcoin:**
```bash
ruflo swap \
  --from-chain 1 \
  --from-token NATIVE \
  --to-chain 0 \
  --to-token BTC \
  --amount 0.05 \
  --wallet 0xUserWallet \
  --native-address bc1qrecipientaddress...
```

**With --wait (blocks until settled):**
```bash
ruflo swap ... --wait --timeout 120
```

**Response:**
```json
{
  "ok": true,
  "intentId": "rflo_xyz789",
  "status": "QUOTED",
  "rail": "CCTP",
  "tx": { "to": "0xRouter...", "data": "0x...", "value": "0x0" },
  "etaSeconds": 25,
  "wsUrl": "wss://ws.ruflo.io/ws/intent/rflo_xyz789?key=rflo_xxx..."
}
```

---

## status

```bash
ruflo status rflo_xyz789
```

**Response:**
```json
{
  "ok": true,
  "intentId": "rflo_xyz789",
  "status": "SETTLED",
  "rail": "CCTP",
  "srcTxHash": "0xsource...",
  "dstTxHash": "0xdestination...",
  "amountOut": "99.82",
  "etaSeconds": 25
}
```

**Status lifecycle:**
```
CREATED → QUOTED → SUBMITTED → IN_TRANSIT → DESTINATION_RECEIVED → SETTLED
                                    ↓
                                  STUCK → RECOVERING → SETTLED | FAILED
```

---

## register

```bash
ruflo register \
  --name "My DeFi App" \
  --email dev@example.com \
  --tier GROWTH
```

**Response (shown once — store securely):**
```json
{
  "ok": true,
  "apiKey": "rflo_a1b2c3d4e5f6...",
  "webhookSecret": "whs_x9y8z7...",
  "tier": "GROWTH",
  "partnerId": "p_abc",
  "warning": "Store apiKey and webhookSecret now — they will not be shown again.",
  "limits": {
    "quotesPerMinute": 300,
    "txPerDay": 5000,
    "feeRebatePct": 15
  }
}
```

---

## rebates

```bash
ruflo rebates
```

**Response:**
```json
{
  "ok": true,
  "partnerId": "p_abc",
  "tier": "GROWTH",
  "totalUSD": "142.50",
  "byChain": {
    "42161": "88.20",
    "8453":  "54.30"
  },
  "claimedUSD": "50.00",
  "pendingUSD": "92.50"
}
```

---

## withdraw

```bash
ruflo withdraw --chain-id 42161 --token USDC
```

**Response:**
```json
{
  "ok": true,
  "txHash": "0xpayout...",
  "amountPaid": "92.50",
  "token": "USDC",
  "chainId": 42161,
  "chain": "arbitrum"
}
```

---

## routes

```bash
ruflo routes --from-chain 42161 --to-chain 8453
```

**Response:**
```json
{
  "ok": true,
  "fromChain": "arbitrum",
  "toChain": "base",
  "rails": [
    { "id": "CCTP",      "costUSD": 0,    "etaSeconds": 25,  "score": 9.8 },
    { "id": "LAYERZERO", "costUSD": 0.35, "etaSeconds": 120, "score": 6.2 }
  ],
  "recommended": "CCTP"
}
```

---

## rails

```bash
ruflo rails
```

**Response:**
```json
{
  "ok": true,
  "rails": [
    { "id": "CCTP",      "type": "messaging", "costUSD": 0,    "etaSeconds": 25,  "chains": 17, "nativeUSDC": true  },
    { "id": "VIA_LABS",  "type": "messaging", "costUSD": 0.25, "etaSeconds": 180, "chains": 30, "nativeUSDC": false },
    { "id": "AXELAR",    "type": "messaging", "costUSD": 0.50, "etaSeconds": 90,  "chains": 60, "nativeUSDC": false },
    { "id": "LAYERZERO", "type": "messaging", "costUSD": 0.35, "etaSeconds": 120, "chains": 80, "nativeUSDC": false },
    { "id": "THORCHAIN", "type": "liquidity", "costUSD": null, "etaSeconds": 60,  "chains": 10,
      "note": "slip-based fee, native BTC/SOL/DOGE delivery" }
  ],
  "priority": ["CCTP", "VIA_LABS", "AXELAR", "LAYERZERO", "THORCHAIN"]
}
```

---

## health

```bash
ruflo health
```

---

## Error Format

All errors return a non-zero exit code and:
```json
{
  "ok": false,
  "error": {
    "code": "HTTP_429",
    "message": "Rate limit exceeded. Retry-After: 12s"
  }
}
```

Common error codes: `NO_API_KEY`, `HTTP_401`, `HTTP_429`, `HTTP_404`, `NETWORK_ERROR`, `WAIT_TIMEOUT`
