# LayerZero Config In Simple Terms

This note explains the LayerZero config fields that usually cause confusion during Ruflo deployment.

It is written for your current mainnet setup:

- `Optimism` (`10`)
- `Arbitrum` (`42161`)

Using these deployment outputs:

- [OP deploy run](/Users/ganadhish/code/work/ruflo/config/broadcast/DeployAll.s.sol/10/run-1778768212124.json)
- [Arbitrum deploy run](/Users/ganadhish/code/work/ruflo/config/broadcast/DeployAll.s.sol/42161/run-1778769357140.json)

## 1. The 3 Different Address Types

LayerZero config is confusing because you are dealing with three different kinds of addresses at the same time.

### A) Ruflo rail contracts

These are your own contracts.

- `LayerZeroRailPlugin`
- `LayerZeroReceiverAdapter`
- `ReceiverV1`

For your current deploys:

| Chain | LayerZeroRailPlugin | LayerZeroReceiverAdapter | ReceiverV1 |
|---|---|---|---|
| `OP` | `0xdb403792c55bfe26beaef235986d4f106e40ee6f` | `0x845cd50644a9592de43bcac0212656480744aaca` | `0x65642ac8fd57eff8dd4651cb76be48814c8bf386` |
| `Arbitrum` | `0x8fb6314678a9287f9b47b96e54122444e43dde1f` | `0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3` | `0xa10914363664e46154328e6e787961641ea6e3de` |

### B) The settlement token

This is the actual token that Ruflo expects to receive on the destination chain before `ReceiverV1.execute()` runs.

Examples:

- if the route asset is `WETH`, then the settlement token is local `WETH`
- if the route asset is `USDC`, then the settlement token is local `USDC`
- if the route asset is `USDT`, then the settlement token is local `USDT`

This is what `LZ_SETTLEMENT_TOKEN` means.

### C) The LayerZero asset transport contract

This is the LayerZero-side token contract that actually performs the cross-chain send.

Depending on the route family, this may be:

- an `OFT`
- an `OFT Adapter`
- a `Stargate` asset/pool contract

This is what `LZ_OFT`, `LZ_COMPOSE_SENDER`, and `LZ_OFT_PEER_ADDRESS` refer to.

It is not your Ruflo rail plugin.

## 2. What Each Field Means

### `LZ_SETTLEMENT_TOKEN`

Simple meaning:

- "What token should arrive on this chain before Ruflo swaps or delivers it?"

This is always a local token on the chain you are configuring.

Examples:

- configuring Arbitrum inbound `OP -> Arbitrum` for a `WETH` route:
  - `LZ_SETTLEMENT_TOKEN=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`
- configuring OP inbound `Arbitrum -> OP` for a `WETH` route:
  - `LZ_SETTLEMENT_TOKEN=0x4200000000000000000000000000000000000006`

### `LZ_COMPOSE_SENDER`

Simple meaning:

- "Which remote LayerZero asset contract is allowed to call into this destination adapter for this asset?"

This is not:

- not your remote `LayerZeroRailPlugin`
- not your remote `LayerZeroReceiverAdapter`
- not your remote `ReceiverV1`

It is the remote OFT / OFT adapter / Stargate asset contract for the route asset you are configuring.

### `LZ_OFT_PEER_ADDRESS`

Simple meaning:

- "What is the remote LayerZero asset contract that my local OFT should trust as its peer?"

This is used when setting peer config on the local OFT itself:

```bash
LZ_OFT_SET_PEER=true
LZ_OFT=<local OFT>
LZ_OFT_PEER_EID=<remote eid>
LZ_OFT_PEER_ADDRESS=<remote OFT>
```

In most cases:

- `LZ_COMPOSE_SENDER` and `LZ_OFT_PEER_ADDRESS` end up being the same remote asset contract address
- the difference is only the place where you use them

## 3. What `LZ_SOURCE_PEER_ADDRESS` Means

This one is different from the three above.

`LZ_SOURCE_PEER_ADDRESS` is the remote Ruflo `LayerZeroRailPlugin`.

It is used for trusted-peer validation in `LayerZeroReceiverAdapter`.

For your current deploys:

- OP plugin: `0xdb403792c55bfe26beaef235986d4f106e40ee6f`
- Arbitrum plugin: `0x8fb6314678a9287f9b47b96e54122444e43dde1f`

So:

- configuring OP destination for inbound `Arbitrum -> OP`:
  - `LZ_SOURCE_PEER_ADDRESS=0x8fb6314678a9287f9b47b96e54122444e43dde1f`
- configuring Arbitrum destination for inbound `OP -> Arbitrum`:
  - `LZ_SOURCE_PEER_ADDRESS=0xdb403792c55bfe26beaef235986d4f106e40ee6f`

## 4. The EIDs For Your Two Chains

From [layer-zero-deployment-metadata.json](/Users/ganadhish/code/work/ruflo/references/layer-zero-deployment-metadata.json):

- `Arbitrum mainnet` EID = `30110`
- `Optimism mainnet` EID = `30111`

So:

- remote OP source = `30111`
- remote Arbitrum source = `30110`

## 5. What Your Metadata File Can And Cannot Tell You

Your [layer-zero-deployment-metadata.json](/Users/ganadhish/code/work/ruflo/references/layer-zero-deployment-metadata.json) is useful for:

- `endpointV2`
- `eid`
- LayerZero infra contracts
- general chain metadata

It is not enough by itself to fill every Ruflo asset row.

Why:

- Ruflo needs the actual asset contract you chose for the route family
- that means the exact `OFT`, `OFT adapter`, or `Stargate` asset contract for `USDC`, `USDT`, or `WETH`
- those are asset-specific choices, not just chain-level LayerZero infra

So the metadata file gives you:

- `LZ_SOURCE_EID`

But it does not automatically give you:

- `LZ_SETTLEMENT_TOKEN`
- `LZ_COMPOSE_SENDER`
- `LZ_OFT`
- `LZ_OFT_PEER_ADDRESS`

Those must come from the exact LayerZero asset you decided to support.

## 6. The Mental Model

When you configure one inbound asset row on a destination chain, think:

1. What token lands here?
2. What remote LayerZero asset contract sent it?
3. What remote Ruflo rail plugin is allowed to have initiated it?

Map those answers to:

| Question | Env var |
|---|---|
| what token lands here? | `LZ_SETTLEMENT_TOKEN` |
| what remote LayerZero asset contract sent it? | `LZ_COMPOSE_SENDER` |
| what remote Ruflo rail plugin is trusted? | `LZ_SOURCE_PEER_ADDRESS` |

And for OFT peer wiring:

| Question | Env var |
|---|---|
| what is my local asset transport contract? | `LZ_OFT` |
| what remote asset transport contract should it trust? | `LZ_OFT_PEER_ADDRESS` |

## 7. Concrete Example: Configuring Arbitrum For Inbound OP -> Arbitrum

This section is for the destination chain `Arbitrum`.

Values you already know from deploy + metadata:

```bash
LZ_ADAPTER=0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3
LZ_SOURCE_EID=30111
LZ_SOURCE_PEER_ADDRESS=0xdb403792c55bfe26beaef235986d4f106e40ee6f
```

If your route asset is `WETH`, then:

```bash
LZ_ADAPTER_SET_ASSET=true
LZ_SETTLEMENT_TOKEN=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
LZ_COMPOSE_SENDER=<OP_WETH_OFT_OR_STARGATE_CONTRACT>
```

And OFT peer config becomes:

```bash
LZ_OFT_SET_PEER=true
LZ_OFT=<ARB_WETH_OFT_OR_STARGATE_CONTRACT>
LZ_OFT_PEER_EID=30111
LZ_OFT_PEER_ADDRESS=<OP_WETH_OFT_OR_STARGATE_CONTRACT>
```

## 8. Concrete Example: Configuring OP For Inbound Arbitrum -> OP

This section is for the destination chain `OP`.

Values you already know from deploy + metadata:

```bash
LZ_ADAPTER=0x845cd50644a9592de43bcac0212656480744aaca
LZ_SOURCE_EID=30110
LZ_SOURCE_PEER_ADDRESS=0x8fb6314678a9287f9b47b96e54122444e43dde1f
```

If your route asset is `WETH`, then:

```bash
LZ_ADAPTER_SET_ASSET=true
LZ_SETTLEMENT_TOKEN=0x4200000000000000000000000000000000000006
LZ_COMPOSE_SENDER=<ARB_WETH_OFT_OR_STARGATE_CONTRACT>
```

And OFT peer config becomes:

```bash
LZ_OFT_SET_PEER=true
LZ_OFT=<OP_WETH_OFT_OR_STARGATE_CONTRACT>
LZ_OFT_PEER_EID=30110
LZ_OFT_PEER_ADDRESS=<ARB_WETH_OFT_OR_STARGATE_CONTRACT>
```

## 9. Easy Mistakes

These are the common mistakes:

1. Putting the remote `LayerZeroRailPlugin` into `LZ_COMPOSE_SENDER`.
   - Wrong.
   - `LZ_COMPOSE_SENDER` must be the remote asset transport contract.

2. Putting the remote `LayerZeroReceiverAdapter` into `LZ_OFT_PEER_ADDRESS`.
   - Wrong.
   - `LZ_OFT_PEER_ADDRESS` must be the remote OFT / OFT adapter / Stargate asset contract.

3. Using the wrong local token in `LZ_SETTLEMENT_TOKEN`.
   - It must be the token that actually lands on the destination chain.

4. Thinking `layer-zero-deployment-metadata.json` alone gives the asset-level addresses.
   - It gives chain infra and EIDs.
   - It does not completely replace asset-level routing metadata.

## 10. Short Answer

If you remember only one thing, remember this:

- `LZ_SETTLEMENT_TOKEN` = local token received here
- `LZ_COMPOSE_SENDER` = remote asset transport contract that sent it
- `LZ_OFT_PEER_ADDRESS` = remote asset transport contract my local OFT should trust
- `LZ_SOURCE_PEER_ADDRESS` = remote Ruflo `LayerZeroRailPlugin`

If you want, the next step is for me to turn this into two exact env blocks:

- `OP -> Arbitrum`
- `Arbitrum -> OP`

for the specific asset family you want to enable first, such as `WETH` or `USDC`.
