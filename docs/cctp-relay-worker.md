# CCTP Relay Worker (Attestation -> Mint -> Receiver Execute)

This worker completes the destination leg for CCTP:

1. Detect `RouterV1.IntentInitiated` on source chain.
2. Decode `initiateSwap` tx and keep only `rail = CCTP`.
3. Read `MessageSent` bytes from the source tx receipt.
4. Poll Circle Iris V2 API (`/v2/messages/{sourceDomainId}?transactionHash=...`) for attestation.
5. Submit `MessageTransmitter.receiveMessage(message, attestation)` on destination chain.
6. Call `ReceiverV1.execute(settlementToken, amount, payload)` on destination chain.

## Required runtime env

- `ENABLE_CCTP_RELAY=true`
- `CCTP_RELAYER_PRIVATE_KEY=0x...` (or fallback `DEPLOYER_PRIVATE_KEY`)

## Recommended runtime env

- `CCTP_ATTESTATION_BASE_URL=https://iris-api-sandbox.circle.com`
- `CCTP_ATTESTATION_POLL_MS=4000`
- `CCTP_ATTESTATION_TIMEOUT_MS=600000`
- `CCTP_RELAY_LOOKBACK_BLOCKS=4000`
- `CCTP_RELAY_RETRY_INTERVAL_MS=15000`
- `CCTP_RELAY_RETRY_BASE_MS=15000`
- `CCTP_RELAY_RETRY_MAX_MS=300000`
- `CCTP_RELAY_MAX_RETRY_ATTEMPTS=0` (0 = unlimited)
- `CCTP_RELAY_RECONCILE_INTERVAL_MS=60000`
- `CHAIN_<srcChainId>_CCTP_DOMAIN=<domainId>` (optional override; auto-mapped for common chains)

## Reliability behavior

- Attestation, RPC, and nonce failures are retried with backoff instead of requiring a worker restart.
- Recent source-chain `IntentInitiated` events are reconciled while the worker is running, not only during startup.
- Destination transactions are serialized per destination chain to avoid relayer account nonce races.

## Destination execution prerequisites

- Receiver on destination chain must approve the relayer EOA:
- `RECEIVER_APPROVED_CALLER_*=<relayer_eoa>`

- Destination chain must expose CCTP settlement token in VPS env:
- `CHAIN_<dstChainId>_TOKEN_CCTP_USDC=0x...` (or fallback `CHAIN_<dstChainId>_TOKEN_USDC`)

## CCTP route caller config (Foundry ConfigureAll)

- `CCTP_ROUTE_CALLER` controls who is allowed to call CCTP `receiveMessage` on destination.
- For open relay (recommended for now): `CCTP_ROUTE_CALLER=0x0000000000000000000000000000000000000000`
- For restricted relay: set to your relayer EOA as bytes32-converted address.

## Start command

```bash
npm run vps:worker
```
