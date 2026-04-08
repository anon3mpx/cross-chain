# SKILL: ruflo

## Description
EMPX-Cross-Chain cross-chain swap protocol CLI. Routes any token on any chain to any token on any chain via CCTP, Axelar, LayerZero, Via Labs, and THORChain. Supports native Bitcoin and Solana delivery. Zero native gas via EIP-4337 Paymaster.

## Version
1.0.0

## Install
```bash
pip install -e cli/agent-harness/
# or directly:
python cli/agent-harness/ruflo_cli.py <command>
```

## Authentication
All commands except `register` and `health` require an API key.
```bash
export RUFLO_API_KEY=rflo_your_key_here
```

## Commands

### quote
Get a price quote for a cross-chain swap.
```bash
ruflo quote --from-chain <chainId> --from-token <address|NATIVE> --to-chain <chainId> --to-token <address|BTC|SOL> --amount <human_amount>
```
**Input params:** from-chain (int), from-token (str), to-chain (int), to-token (str), amount (str), urgency (fast|normal|cheap)
**Output:** `{ ok, quote: { quoteId, rail, amountIn, estimatedOut, fee, etaSeconds, expiresAt } }`

### swap
Initiate a cross-chain swap. Returns pre-built transaction for wallet to sign.
```bash
ruflo swap --from-chain <chainId> --from-token <addr> --to-chain <chainId> --to-token <addr> --amount <n> --wallet <0x...> [--wait]
```
**Input params:** from-chain, from-token, to-chain, to-token, amount, wallet, native-address (for BTC/SOL), slippage-bps (default 50), urgency, wait (bool), timeout (int)
**Output:** `{ ok, intentId, status, rail, tx, etaSeconds, wsUrl }`
**With --wait:** also returns `{ dstTxHash, amountOut, settled }`

### status
Poll intent status by ID.
```bash
ruflo status <intentId>
```
**Output:** `{ ok, intentId, status, rail, srcTxHash, dstTxHash, amountOut, etaSeconds, errorMessage }`
**Status values:** CREATED | QUOTED | SUBMITTED | IN_TRANSIT | DESTINATION_RECEIVED | SETTLED | STUCK | RECOVERING | FAILED

### register
Register a new partner and receive an API key.
```bash
ruflo register --name <name> --email <email> [--tier FREE|GROWTH|PARTNER|ENTERPRISE]
```
**No auth required.**
**Output:** `{ ok, apiKey, webhookSecret, tier, partnerId, limits }` — shown once, store securely.

### rebates
View accrued fee rebates.
```bash
ruflo rebates
```
**Output:** `{ ok, totalUSD, byChain, pendingUSD, claimedUSD }`

### withdraw
Claim fee rebates to your wallet on a specified chain.
```bash
ruflo withdraw --chain-id <chainId> [--token USDC]
```
**Output:** `{ ok, txHash, amountPaid, token, chainId }`

### routes
List available rails for a chain pair.
```bash
ruflo routes --from-chain <chainId> --to-chain <chainId>
```
**Output:** `{ ok, rails: [...], recommended }`

### rails
List all bridge rails with cost/speed metadata.
```bash
ruflo rails
```
**Output:** `{ ok, rails: [...], priority: [...] }`

### health
Check API health.
```bash
ruflo health
```

## Chain IDs

| Chain | ID |
|---|---|
| Ethereum | 1 |
| Arbitrum | 42161 |
| Base | 8453 |
| Optimism | 10 |
| Polygon | 137 |
| Avalanche | 43114 |
| BSC | 56 |
| Bitcoin | 0 |
| Solana | 99 |
| Dogecoin | 98 |

## Rail Priority
`CCTP → Via Labs → Axelar → LayerZero → THORChain`
- THORChain is the only rail for native BTC, SOL, DOGE delivery.
- CCTP is preferred for USDC transfers (free, native, ~25s).

## Error Format
All errors follow: `{ ok: false, error: { code: string, message: string } }`

## Environment Variables
| Var | Default | Description |
|---|---|---|
| `RUFLO_API_KEY` | — | Required for most commands |
| `RUFLO_API_URL` | `https://api.ruflo.io` | Override API endpoint |
| `RUFLO_WS_URL`  | `wss://ws.ruflo.io` | Override WebSocket endpoint |
