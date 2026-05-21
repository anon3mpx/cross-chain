# OP <-> Base Configure Envs

These files are for `ConfigureAll.s.sol` only:
- `op-sepolia.configure.env`
- `base-sepolia.configure.env`

Use one file at a time:

```bash
set -a
source config/foundry/env/op-sepolia.configure.env
set +a
forge script config/foundry/scripts/ConfigureAll.s.sol:ConfigureAll \
  --config-path config/foundry.toml \
  --rpc-url "$RPC_URL" \
  --broadcast -vvv

set -a
source config/foundry/env/base-sepolia.configure.env
set +a
forge script config/foundry/scripts/ConfigureAll.s.sol:ConfigureAll \
  --config-path config/foundry.toml \
  --rpc-url "$RPC_URL" \
  --broadcast -vvv
```

Important:
- Do not use `npm run sol:configure:all` with these files unless your root `.env` has matching values.
- That npm script sources `.env` again and can override `RPC_URL`/addresses, leading to wrong-chain calls.
- Sanity check before broadcast:
  - `cast chain-id --rpc-url "$RPC_URL"` (Base Sepolia should be `84532`)
  - `cast code "$RAIL_PLUGIN_CCTP_FAST" --rpc-url "$RPC_URL"` (must not be `0x`)

Rules:
- `*_ADAPTER` and `RECEIVER_APPROVED_CALLER_*` must be local addresses on the chain in `RPC_URL`.
- `*_ROUTE_RECEIVER` must be destination adapter addresses on the remote chain.
- Keep both files in sync if you redeploy any plugin/adapter.
- `CCTP_ROUTE_CALLER` / `CCTP_FAST_ROUTE_CALLER` set who is allowed to relay Circle `receiveMessage` on destination.

LayerZero OFT note:
- Adapter peers configured by these files are not the same as OFT peers.
- `ConfigureAll.s.sol` can set OFT peers too when `LZ_OFT_SET_PEER=true` and `LZ_OFT*` vars are set.
