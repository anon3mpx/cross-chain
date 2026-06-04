# Runtime RPC Config

## Numbered read endpoints

Set up to five ordered read endpoints per chain:

- `CHAIN_<id>_RPC_1`
- `CHAIN_<id>_RPC_2`
- `CHAIN_<id>_RPC_3`
- `CHAIN_<id>_RPC_4`
- `CHAIN_<id>_RPC_5`

These are used for request-time reads such as quote helpers, status actions, gas estimation, and recovery tooling.

## Optional dedicated polling endpoints

Set up to two ordered polling endpoints per chain:

- `CHAIN_<id>_RPC_POLL_1`
- `CHAIN_<id>_RPC_POLL_2`

These are used by long-lived workers such as the event monitor and CCTP relay.

If `CHAIN_<id>_RPC_POLL_*` is unset, poll workloads fall back to the numbered read endpoints.

## Legacy fallback window

Existing environments that still use:

- `CHAIN_<id>_RPC_URL`
- `CHAIN_<id>_RPC_FALLBACK`

continue to boot during the migration window.

If any numbered `CHAIN_<id>_RPC_<n>` values are set, they take precedence over the legacy keys.

## Recommended operating model

- Put at least one paid or dedicated RPC first for high-traffic chains.
- Keep public RPCs lower in the ordered list as failover targets.
- Split read and polling workloads when possible so workers do not consume the same RPC budget as user-facing reads.
