#!/usr/bin/env python3
"""
EMPX-Cross-Chain CLI Agent Harness
=======================
CLI-Anything compatible harness for the EMPX-Cross-Chain cross-chain swap protocol.
All output is structured JSON. Designed for AI agent consumption.

Usage:
    ruflo quote --from-chain 42161 --from-token 0xUSDC --to-chain 8453 --to-token 0xUSDC --amount 100
    ruflo swap  --from-chain 42161 --from-token 0xUSDC --to-chain 8453 --to-token 0xUSDC --amount 100 --wallet 0x...
    ruflo status --intent-id rflo_abc123
    ruflo register --name "MyApp" --email dev@example.com
    ruflo withdraw --api-key rflo_xxx --chain-id 42161
    ruflo routes --from-chain 42161 --to-chain 8453
    ruflo rails
"""

import click
import json
import os
import sys
import time
import hmac
import hashlib
from typing import Optional
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_API_URL = os.environ.get("RUFLO_API_URL", "https://api.ruflo.io")
DEFAULT_WS_URL  = os.environ.get("RUFLO_WS_URL",  "wss://ws.ruflo.io")

CHAIN_NAMES = {
    1:     "ethereum",
    42161: "arbitrum",
    8453:  "base",
    10:    "optimism",
    137:   "polygon",
    43114: "avalanche",
    56:    "bsc",
    0:     "bitcoin",
    99:    "solana",
    98:    "dogecoin",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _out(data: dict) -> None:
    """Print JSON output and exit cleanly."""
    click.echo(json.dumps(data, indent=2))


def _err(code: str, message: str, status: int = 1) -> None:
    """Print a structured error and exit."""
    _out({"ok": False, "error": {"code": code, "message": message}})
    sys.exit(status)


def _api_key() -> str:
    key = os.environ.get("RUFLO_API_KEY", "")
    if not key:
        _err("NO_API_KEY", "Set RUFLO_API_KEY env var or pass --api-key")
    return key


def _http(method: str, path: str, body: Optional[dict] = None, api_key: str = "") -> dict:
    url = f"{DEFAULT_API_URL}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {
        "content-type": "application/json",
        "x-api-key": api_key or _api_key(),
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        try:
            err_body = json.loads(body_text)
        except Exception:
            err_body = {"message": body_text}
        _err(f"HTTP_{e.code}", err_body.get("message", str(e)))
    except urllib.error.URLError as e:
        _err("NETWORK_ERROR", str(e.reason))


# ── CLI root ──────────────────────────────────────────────────────────────────

@click.group()
@click.version_option("1.0.0", prog_name="ruflo")
def cli():
    """EMPX-Cross-Chain — Cross-chain swap protocol CLI.

    All commands output structured JSON for easy agent consumption.
    Set RUFLO_API_KEY env var before use (except `register`).
    """
    pass


# ── quote ─────────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--from-chain",  required=True, type=int,  help="Source chain ID (e.g. 42161 for Arbitrum)")
@click.option("--from-token",  required=True,             help="Source token address or 'NATIVE'")
@click.option("--to-chain",    required=True, type=int,  help="Destination chain ID (e.g. 8453 for Base, 0 for Bitcoin)")
@click.option("--to-token",    required=True,             help="Destination token address or 'BTC'/'SOL'")
@click.option("--amount",      required=True,             help="Human-readable input amount (e.g. '100' for 100 USDC)")
@click.option("--wallet",      default="",               help="User wallet address (optional for quote)")
@click.option("--urgency",     default="normal",         type=click.Choice(["fast", "normal", "cheap"]),
              help="Routing priority: fast=speed, cheap=cost, normal=balanced")
@click.option("--api-key",     default="",               help="API key (or set RUFLO_API_KEY env var)")
def quote(from_chain, from_token, to_chain, to_token, amount, wallet, urgency, api_key):
    """Get a cross-chain swap quote.

    Returns estimated output amount, selected rail, ETA, and fee breakdown.
    Quote is valid for 30 seconds.

    \b
    Examples:
      ruflo quote --from-chain 42161 --from-token 0xaf88d... --to-chain 8453 --to-token 0x833589... --amount 100
      ruflo quote --from-chain 1 --from-token NATIVE --to-chain 0 --to-token BTC --amount 0.1
    """
    key = api_key or os.environ.get("RUFLO_API_KEY", "")
    if not key:
        _err("NO_API_KEY", "Set RUFLO_API_KEY env var or pass --api-key")

    payload = {
        "from": {"chainId": from_chain, "token": from_token, "amount": amount},
        "to":   {"chainId": to_chain,   "token": to_token},
        "urgency": urgency,
    }
    if wallet:
        payload["wallet"] = wallet

    result = _http("POST", "/quote", payload, key)

    _out({
        "ok": True,
        "quote": {
            "quoteId":       result.get("quoteId"),
            "rail":          result.get("rail"),
            "amountIn":      amount,
            "estimatedOut":  result.get("estimatedOut"),
            "fee":           result.get("fee"),
            "etaSeconds":    result.get("etaSeconds"),
            "expiresAt":     result.get("expiresAt"),
            "settlementToken": result.get("settlementToken"),
            "fromChain":     CHAIN_NAMES.get(from_chain, str(from_chain)),
            "toChain":       CHAIN_NAMES.get(to_chain, str(to_chain)),
        }
    })


# ── swap ──────────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--from-chain",     required=True, type=int)
@click.option("--from-token",     required=True)
@click.option("--to-chain",       required=True, type=int)
@click.option("--to-token",       required=True)
@click.option("--amount",         required=True)
@click.option("--wallet",         required=True,           help="User's source chain wallet address")
@click.option("--native-address", default="",             help="Native destination address (Bitcoin bc1q..., Solana base58...)")
@click.option("--slippage-bps",   default=50, type=int,   help="Slippage tolerance in bps (default 50 = 0.5%%)")
@click.option("--urgency",        default="normal",       type=click.Choice(["fast", "normal", "cheap"]))
@click.option("--api-key",        default="")
@click.option("--wait",           is_flag=True,           help="Poll for settlement and return final result")
@click.option("--timeout",        default=300, type=int,  help="Max seconds to wait when --wait is set")
def swap(from_chain, from_token, to_chain, to_token, amount, wallet,
         native_address, slippage_bps, urgency, api_key, wait, timeout):
    """Initiate a cross-chain swap.

    Returns an intentId and a pre-built transaction for the user to sign.
    With --wait, polls until settled and returns the final destination tx hash.

    \b
    Examples:
      ruflo swap --from-chain 42161 --from-token 0xaf88d... --to-chain 8453 --to-token 0x8335... --amount 100 --wallet 0xABC...
      ruflo swap --from-chain 1 --from-token NATIVE --to-chain 0 --to-token BTC --amount 0.05 --wallet 0xABC... --native-address bc1q...
    """
    key = api_key or os.environ.get("RUFLO_API_KEY", "")
    if not key:
        _err("NO_API_KEY", "Set RUFLO_API_KEY env var or pass --api-key")

    payload = {
        "from":       {"chainId": from_chain, "token": from_token, "amount": amount},
        "to":         {"chainId": to_chain,   "token": to_token},
        "wallet":     wallet,
        "slippageBps": slippage_bps,
        "urgency":    urgency,
    }
    if native_address:
        payload["to"]["nativeAddress"] = native_address

    result = _http("POST", "/intent", payload, key)

    intent_id = result.get("intentId")
    response = {
        "ok":       True,
        "intentId": intent_id,
        "status":   result.get("status"),
        "rail":     result.get("rail"),
        "tx":       result.get("tx"),   # Pre-built tx for wallet to sign
        "etaSeconds": result.get("etaSeconds"),
        "wsUrl":    f"{DEFAULT_WS_URL}/ws/intent/{intent_id}?key={key[:8]}...",
    }

    if not wait:
        _out(response)
        return

    # Poll until settled or timeout
    deadline = time.time() + timeout
    while time.time() < deadline:
        status_result = _http("GET", f"/intent/{intent_id}", api_key=key)
        current_status = status_result.get("status")
        if current_status in ("SETTLED", "FAILED"):
            response.update({
                "status":     current_status,
                "dstTxHash":  status_result.get("dstTxHash"),
                "amountOut":  status_result.get("amountOut"),
                "settled":    current_status == "SETTLED",
            })
            _out(response)
            return
        time.sleep(5)

    response.update({"status": "TIMEOUT", "error": {"code": "WAIT_TIMEOUT", "message": f"Did not settle within {timeout}s"}})
    _out(response)


# ── status ────────────────────────────────────────────────────────────────────

@cli.command()
@click.argument("intent_id")
@click.option("--api-key", default="")
def status(intent_id, api_key):
    """Get real-time status of a swap intent.

    \b
    Possible statuses:
      CREATED          - Intent received, not yet submitted
      QUOTED           - Rail selected, quote locked
      SUBMITTED        - Source tx submitted to chain
      IN_TRANSIT       - Bridge relay in progress
      DESTINATION_RECEIVED - Funds arrived on destination chain
      SETTLED          - Final destination tx confirmed
      STUCK            - Delayed past rail ETA threshold
      RECOVERING       - Fallback rail being attempted
      FAILED           - Unrecoverable failure

    \b
    Example:
      ruflo status rflo_abc123def456
    """
    key = api_key or os.environ.get("RUFLO_API_KEY", "")
    if not key:
        _err("NO_API_KEY", "Set RUFLO_API_KEY env var or pass --api-key")

    result = _http("GET", f"/intent/{intent_id}", api_key=key)

    _out({
        "ok":         True,
        "intentId":   result.get("intentId"),
        "status":     result.get("status"),
        "rail":       result.get("rail"),
        "srcTxHash":  result.get("srcTxHash"),
        "dstTxHash":  result.get("dstTxHash"),
        "railTxId":   result.get("railTxId"),
        "amountOut":  result.get("amountOut"),
        "etaSeconds": result.get("etaSeconds"),
        "errorMessage": result.get("errorMessage"),
        "createdAt":  result.get("createdAt"),
        "updatedAt":  result.get("updatedAt"),
    })


# ── register ──────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--name",  required=True, help="Partner / app name")
@click.option("--email", required=True, help="Contact email address")
@click.option("--tier",  default="FREE", type=click.Choice(["FREE", "GROWTH", "PARTNER", "ENTERPRISE"]),
              help="Requested tier (default FREE)")
def register(name, email, tier):
    """Register a new partner and receive an API key.

    No authentication required. The API key and webhook secret are shown
    ONCE — store them securely. They cannot be retrieved again.

    \b
    Example:
      ruflo register --name "MyWallet" --email dev@example.com --tier GROWTH
    """
    result = _http(
        "POST", "/partner/register",
        {"name": name, "contactEmail": email, "requestedTier": tier},
        api_key="PUBLIC",
    )

    _out({
        "ok":            True,
        "apiKey":        result.get("apiKey"),
        "webhookSecret": result.get("webhookSecret"),
        "tier":          result.get("tier"),
        "partnerId":     result.get("partnerId"),
        "warning":       "Store apiKey and webhookSecret now — they will not be shown again.",
        "limits": {
            "quotesPerMinute": result.get("quotesPerMinute"),
            "txPerDay":        result.get("txPerDay"),
            "feeRebatePct":    result.get("feeRebatePct"),
        }
    })


# ── rebates ───────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--api-key", default="")
def rebates(api_key):
    """View accrued fee rebates across all chains.

    \b
    Example:
      ruflo rebates
    """
    key = api_key or os.environ.get("RUFLO_API_KEY", "")
    if not key:
        _err("NO_API_KEY", "Set RUFLO_API_KEY env var or pass --api-key")

    result = _http("GET", "/partner/rebates", api_key=key)

    _out({
        "ok":          True,
        "partnerId":   result.get("partnerId"),
        "tier":        result.get("tier"),
        "totalUSD":    result.get("totalUSD"),
        "byChain":     result.get("byChain", {}),
        "claimedUSD":  result.get("claimedUSD"),
        "pendingUSD":  result.get("pendingUSD"),
    })


# ── withdraw ──────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--chain-id",   required=True, type=int, help="Chain to receive the rebate payout")
@click.option("--token",      default="USDC",          help="Token to receive payout in (default USDC)")
@click.option("--api-key",    default="")
def withdraw(chain_id, token, api_key):
    """Claim accrued fee rebates to your wallet on a specified chain.

    \b
    Example:
      ruflo withdraw --chain-id 42161 --token USDC
    """
    key = api_key or os.environ.get("RUFLO_API_KEY", "")
    if not key:
        _err("NO_API_KEY", "Set RUFLO_API_KEY env var or pass --api-key")

    result = _http("POST", "/partner/withdraw", {"chainId": chain_id, "token": token}, key)

    _out({
        "ok":         True,
        "txHash":     result.get("txHash"),
        "amountPaid": result.get("amountPaid"),
        "token":      token,
        "chainId":    chain_id,
        "chain":      CHAIN_NAMES.get(chain_id, str(chain_id)),
    })


# ── routes ────────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--from-chain", required=True, type=int)
@click.option("--to-chain",   required=True, type=int)
@click.option("--api-key",    default="")
def routes(from_chain, to_chain, api_key):
    """List available rails for a given chain pair.

    Returns all eligible rails with cost, speed, and reliability data.

    \b
    Example:
      ruflo routes --from-chain 42161 --to-chain 8453
      ruflo routes --from-chain 1 --to-chain 0
    """
    key = api_key or os.environ.get("RUFLO_API_KEY", "PUBLIC")

    result = _http("GET", f"/routes?fromChain={from_chain}&toChain={to_chain}", api_key=key)

    _out({
        "ok":        True,
        "fromChain": CHAIN_NAMES.get(from_chain, str(from_chain)),
        "toChain":   CHAIN_NAMES.get(to_chain, str(to_chain)),
        "rails":     result.get("rails", []),
        "recommended": result.get("recommended"),
    })


# ── rails ─────────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--api-key", default="")
def rails(api_key):
    """List all supported bridge rails with metadata.

    Returns each rail's type, cost, speed, chain coverage, and current status.

    \b
    Example:
      ruflo rails
    """
    key = api_key or os.environ.get("RUFLO_API_KEY", "PUBLIC")
    result = _http("GET", "/rails", api_key=key)

    _out({
        "ok":    True,
        "rails": result.get("rails", [
            {"id": "CCTP",      "type": "messaging",  "costUSD": 0,    "etaSeconds": 25,  "chains": 17, "nativeUSDC": True},
            {"id": "VIA_LABS",  "type": "messaging",  "costUSD": 0.25, "etaSeconds": 180, "chains": 30, "nativeUSDC": False},
            {"id": "AXELAR",    "type": "messaging",  "costUSD": 0.50, "etaSeconds": 90,  "chains": 60, "nativeUSDC": False},
            {"id": "LAYERZERO", "type": "messaging",  "costUSD": 0.35, "etaSeconds": 120, "chains": 80, "nativeUSDC": False},
            {"id": "THORCHAIN", "type": "liquidity",  "costUSD": None, "etaSeconds": 60,  "chains": 10,
             "note": "slip-based fee, native BTC/SOL/DOGE delivery"},
        ]),
        "priority": ["CCTP", "VIA_LABS", "AXELAR", "LAYERZERO", "THORCHAIN"],
    })


# ── health ────────────────────────────────────────────────────────────────────

@cli.command()
def health():
    """Check EMPX-Cross-Chain API health and rail statuses.

    \b
    Example:
      ruflo health
    """
    result = _http("GET", "/health", api_key="PUBLIC")
    _out({"ok": True, "health": result})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli()
