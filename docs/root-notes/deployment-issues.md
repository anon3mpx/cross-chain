npm run sol:deploy:all

> sol:deploy:all
> set -a; [ -f .env ] && . ./.env; set +a; test -n "$RPC_URL" || (echo "RPC_URL is required (set env or .env)" && exit 1); forge script config/foundry/scripts/DeployAll.s.sol:DeployAll --config-path config/foundry.toml --rpc-url "$RPC_URL" --broadcast -vvv

[⠊] Compiling...
No files changed, compilation skipped
Script ran successfully.

## Setting up 1 EVM.

==========================

Chain 8453

Estimated gas price: 0.011 gwei

Estimated total gas used for script: 11863047

Estimated amount required: 0.000130493517 ETH

==========================

Transactions saved to: /Users/ganadhish/code/work/ruflo/config/broadcast/DeployAll.s.sol/8453/run-latest.json

Sensitive values saved to: /Users/ganadhish/code/work/ruflo/build/foundry-cache/DeployAll.s.sol/8453/run-latest.json

Error: Failed to send transaction after 4 attempts Err(server returned an error response: error code -32000: in-flight transaction limit reached for delegated accounts)

Context:
- server returned an error response: error code -32000: gapped-nonce tx from delegated accounts

# RPC url in .env file
RPC_URL=https://lb.drpc.live/base/Alj6-PidlEmLn_S7Ly5es5HretM-VDoR8a-xtiKh6MJI
