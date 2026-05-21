# RuFlo End-to-End Mermaid Diagrams

This file contains complete Mermaid diagrams for the full cross-chain swap implementation, including rails, intents, calldata, approvals, settlement paths, fallback logic, and no-route/multi-hop scenarios.

## 1) System Topology (Entities + Contracts + Infra)

```mermaid
flowchart LR
  %% ────────────────────────────────────────────────────────────────────────────
  %% CLIENT + VPS
  %% ────────────────────────────────────────────────────────────────────────────
  subgraph CLIENT["Client / Partner Layer"]
    U["User Wallet / Smart Account"]
    APP["Partner App / SDK"]
    WS["WebSocket / Status Polling"]
  end

  subgraph VPS["VPS Orchestrator"]
    QE["QuoteEngine"]
    RS["RailSelector"]
    IE["IntentEngine"]
    EM["EventMonitor"]
    RE["RecoveryEngine"]
    PMS["PaymasterService (EIP-4337 optional)"]
    API["PartnerAPI / StatusAPI"]
  end

  %% ────────────────────────────────────────────────────────────────────────────
  %% CHAIN CATALOG
  %% ────────────────────────────────────────────────────────────────────────────
  subgraph CHAINS["Supported Chain Universe (example active set)"]
    EVMSET["EVM: 56(BSC), 42161(Arb), 8453(Base), 137(Polygon), 43114(Avax), 10(OP), 143(Monad), 146(Sonic), 1329(Sei), 80094(Berachain), 30(Rootstock), 10001(EthPOW), 999(HyperEVM), 369(Pulse)"]
    NONEVM["Non-EVM delivery rails: BTC(0), SOL(99), DOGE(98), LTC(100), BCH(101), COSMOS(102)"]
  end

  %% ────────────────────────────────────────────────────────────────────────────
  %% SOURCE CHAIN
  %% ────────────────────────────────────────────────────────────────────────────
  subgraph SRC["Source Chain"]
    ENTRY["EntryPoint (optional AA)"]
    PAYM["Paymaster"]
    RV1["RouterV1"]
    PRS["PluginRegistry"]
    EMP["EmpsealSwapPlugin (ISwapPlugin)"]
    RP_C["CCTPRailPlugin"]
    RP_A["AxelarRailPlugin"]
    RP_L["LayerZeroRailPlugin"]
    RP_T["THORChainRailPlugin"]
  end

  %% ────────────────────────────────────────────────────────────────────────────
  %% RAIL NETWORKS
  %% ────────────────────────────────────────────────────────────────────────────
  subgraph RAILS["Rail Networks / Middleware"]
    CCTP["Circle CCTP + Attestation"]
    AXL["Axelar Network (GMP/ITS)"]
    LZ["LayerZero DVN + Executor/OFT"]
    THOR["THORChain Router + Inbound Vault"]
    VIA["Via Labs (planned/optional)"]
    WH["Wormhole (planned/optional)"]
  end

  %% ────────────────────────────────────────────────────────────────────────────
  %% DESTINATION CHAIN
  %% ────────────────────────────────────────────────────────────────────────────
  subgraph DST["Destination Chain"]
    RCV["ReceiverV1"]
    PRD["PluginRegistry"]
    EMPD["EmpsealSwapPlugin"]
    AXAD["AxelarReceiverAdapter"]
    LZAD["LayerZeroReceiverAdapter"]
    USERDST["User Recipient"]
  end

  %% ────────────────────────────────────────────────────────────────────────────
  %% FLOWS
  %% ────────────────────────────────────────────────────────────────────────────
  U --> APP
  APP --> API
  API --> QE
  QE --> RS
  QE --> IE
  APP --> WS
  WS --> IE
  EM --> IE
  RE --> IE
  RE --> RS

  APP -->|tx / userOp submit| RV1
  PMS --> ENTRY
  ENTRY --> PAYM
  ENTRY --> RV1

  RV1 --> PRS
  RV1 --> EMP
  RV1 --> RP_C
  RV1 --> RP_A
  RV1 --> RP_L
  RV1 --> RP_T

  RP_C --> CCTP
  RP_A --> AXL
  RP_L --> LZ
  RP_T --> THOR

  CCTP --> RCV
  AXL --> AXAD
  LZ --> LZAD
  AXAD --> RCV
  LZAD --> RCV
  THOR --> USERDST

  RCV --> PRD
  RCV --> EMPD
  RCV --> USERDST
```

## 2) End-to-End Sequence (Intent + Calldata + Approvals + Settlement + Branches)

```mermaid
sequenceDiagram
  autonumber
  actor User as User / Partner App
  participant VPS as VPS(API+Quote+Intent+Recovery)
  participant RSel as RailSelector
  participant SrcWallet as Source Wallet / Smart Account
  participant Router as RouterV1
  participant SReg as Source PluginRegistry
  participant SwapP as EmpsealSwapPlugin
  participant RailP as Selected Rail Plugin
  participant RailNet as Rail Network
  participant DAdapter as Axelar/LZ Adapter (if used)
  participant Receiver as ReceiverV1
  participant DReg as Destination PluginRegistry
  participant DSwapP as EmpsealSwapPlugin (dst)
  participant DestUser as Destination Recipient

  User->>VPS: POST /partner/quote(tokenIn, tokenOut, amountIn, srcChain, dstChain, urgency, nativeDstAddress?)
  VPS->>RSel: rank rails + settlement token
  Note over VPS,RSel: Ranking considers route support, reliability, ETA, fee, urgency, native-address needs, token support.

  alt No rail supports source->destination for any settlement token
    RSel-->>VPS: NO_ROUTE
    VPS-->>User: 400 NO_ROUTE
  else Single-rail route exists
    RSel-->>VPS: rail + settlementToken + pluginId
    VPS-->>User: quote + intentId + prebuilt tx data
  else No single rail route, but multi-hop policy enabled
    RSel-->>VPS: Multi-hop plan (Intent A + Intent B)
    VPS-->>User: staged quote with 2 intents / intermediate chain+asset
  end

  User->>SrcWallet: sign tx or UserOp
  SrcWallet->>Router: initiateSwap(intent, swapPluginId, railPluginId)
  Router->>Router: validate deadline, replay, fee caps, min amount

  Note over Router: dstCalldata = abi.encode(intentId,user,tokenOut,minAmountOut,swapDataDst,dstSwapPluginId)
  Note over Router: bridgeParams = {intentId, settlementTokenAddr, amount, dstChainId, dstReceiver, dstCalldata, gasForDst, finalRecipient, nativeDstAddress, thorAssetIdentifier, minThorOutput}

  Router->>SReg: getSwapPlugin(swapPluginId)
  SReg-->>Router: EmpsealSwapPlugin

  alt tokenIn != settlement token
    Router->>SwapP: swap(SwapParams{tokenIn, settlementToken, amountInAfterFee, minSrcSwapOut, swapDataSrc})
    SwapP->>SwapP: decode Trade from swapDataSrc
    SwapP->>SwapP: validate trade path/adapters/token consistency
    SwapP->>SwapP: transferFrom(Router -> SwapPlugin)
    SwapP->>SwapP: approve EmpsealRouter
    SwapP->>SwapP: call EmpsealRouter.swapNoSplit(trade, plugin, fee=0)
    SwapP-->>Router: settlement amount returned
  else tokenIn already settlement token
    Router->>Router: skip source swap
  end

  Router->>SReg: getRailPlugin(railPluginId)
  SReg-->>Router: selected rail plugin
  Router->>RailP: bridge(bridgeParams)

  alt Messaging rail: CCTP
    RailP->>RailNet: burn/attest/mint flow (CCTP)
    RailNet->>Receiver: execute(settlementToken, amount, payload=dstCalldata)
  else Messaging rail: Axelar
    RailP->>RailNet: interchain transfer + payload
    RailNet->>DAdapter: executeWithToken(...)
    DAdapter->>Receiver: execute(settlementToken, amount, payload=dstCalldata)
  else Messaging rail: LayerZero
    RailP->>RailNet: OFT send + compose payload
    RailNet->>DAdapter: lzReceive(...)
    DAdapter->>Receiver: execute(settlementToken, amount, payload=dstCalldata)
  else Liquidity rail: THORChain
    RailP->>RailNet: depositWithExpiry(memo with native dest address/asset/limit)
    RailNet->>DestUser: direct native delivery (BTC/SOL/DOGE/etc.)
  end

  alt Receiver path used (messaging rails)
    Receiver->>DReg: getSwapPlugin(dstSwapPluginId)
    alt tokenOut == settlement token OR dstSwapPluginId==0
      Receiver-->>DestUser: direct settlement token transfer
    else destination swap available
      Receiver->>DSwapP: swap(SwapParams{settlementToken, tokenOut, amount, minAmountOut, swapDataDst})
      DSwapP-->>Receiver: amountOut
      Receiver-->>DestUser: tokenOut transfer
    else desired token swap unavailable on destination
      Receiver-->>DestUser: fallback direct settlement token
      Note over Receiver,DestUser: Optional policy: mark partial/settlement-only success.
    end
  end

  VPS->>VPS: EventMonitor updates IntentEngine state
  VPS-->>User: WS/Poll status transitions
```

## 3) Intent State Machine + Recovery/Fallback Logic

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> QUOTED: Quote issued
  QUOTED --> SUBMITTED: User tx/userOp sent
  SUBMITTED --> IN_TRANSIT: IntentInitiated(railTxId)

  IN_TRANSIT --> SETTLED: Destination settled/direct delivery
  IN_TRANSIT --> STUCK: Timeout threshold exceeded

  STUCK --> RECOVERING: RecoveryEngine selects fallback rail
  RECOVERING --> IN_TRANSIT: Resubmitted via fallback

  RECOVERING --> FAILED: Resubmit failed
  STUCK --> FAILED: No fallback rail or max retries reached

  SETTLED --> [*]
  FAILED --> [*]

  note right of STUCK
    Fallback examples:
    CCTP -> VIA -> AXELAR -> LAYERZERO
    VIA  -> AXELAR -> LAYERZERO -> CCTP
    AXELAR -> LAYERZERO -> VIA -> CCTP
    LAYERZERO -> AXELAR -> VIA -> CCTP
    THORCHAIN: no messaging fallback path
  end note
```

## 4) Route Decision + No-Route + Multi-Hop Through Rails

```mermaid
flowchart TD
  A["Input: tokenIn, tokenOut, amountIn, srcChain, dstChain, urgency, nativeDstAddress?"] --> B["Find settlement candidates (USDC/USDT/ETH + native rails)"]
  B --> C["Filter rails that support both chains"]

  C --> D{"Any single rail supports route?"}
  D -- No --> E{"Multi-hop rail policy enabled?"}
  E -- No --> X["NO_ROUTE (hard fail)"]
  E -- Yes --> F{"Can compose 2-step path via intermediate chain/asset?"}
  F -- No --> X
  F -- Yes --> G["Build Intent A (src->mid) + Intent B (mid->dst)"]
  G --> H["Execute staged intents with dependency checks"]

  D -- Yes --> I["Score rails by reliability/fee/ETA/urgency/native-asset needs"]
  I --> J["Select best rail + fallback order"]

  J --> K{"Source token swappable to chosen settlement token?"}
  K -- No --> K2{"Alternative settlement token on another rail?"}
  K2 -- No --> X
  K2 -- Yes --> I
  K -- Yes --> L{"Destination can produce desired token?"}

  L -- Yes --> M["Normal flow: dst swap -> tokenOut"]
  L -- No --> N{"Settlement-only acceptable?"}
  N -- Yes --> O["Deliver settlement token to user"]
  N -- No --> P{"Try alternate rail/settlement plan?"}
  P -- Yes --> I
  P -- No --> X

  M --> S["SETTLED"]
  O --> S
  H --> S

  style X fill:#ffdddd,stroke:#cc0000,stroke-width:2px
  style S fill:#ddffdd,stroke:#006600,stroke-width:2px
```

## 5) Approval/Allowance Matrix (Who Approves Whom)

```mermaid
flowchart LR
  U["User / Smart Account"] -->|"approve tokenIn"| RV1["RouterV1"]
  U -->|"optional: approve gas token"| PM["Paymaster"]

  RV1 -->|"approve amountAfterFee"| SSP["EmpsealSwapPlugin (src)"]
  SSP -->|"approve params.amountIn"| ER["Empseal Router"]

  RV1 -->|"approve settlementAmount"| RAIL["Rail Plugin"]

  MSG["Messaging rails deliver settlement"] --> RCV["ReceiverV1"]
  RCV -->|"approve amount"| DSP["EmpsealSwapPlugin (dst)"]
  DSP -->|"approve amount"| DER["Empseal Router (dst chain)"]
```

## 6) Calldata Contract Boundaries

```mermaid
flowchart TB
  I["SwapIntent (signed/off-chain intent object)"] --> I1["RouterV1.initiateSwap(intent, swapPluginId, railPluginId)"]

  I1 --> C1["swapDataSrc: abi.encode(IEmpsealRouter.Trade)"]
  I1 --> C2["swapDataDst: abi.encode(IEmpsealRouter.Trade) or empty for direct delivery"]

  I1 --> C3["dstCalldata = abi.encode(intentId,user,tokenOut,minAmountOut,swapDataDst,dstSwapPluginId)"]
  C3 --> C4["bridgeParams.dstCalldata"]
  C4 --> C5["Rail network payload"]
  C5 --> C6["ReceiverV1.execute(settlementToken, amount, payload=dstCalldata)"]
```

