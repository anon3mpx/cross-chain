 node src/vps/scripts/approveErc20.js
wallet:   0x05F8cC8753D90d67DBB8c02118440b8283F941c9
token:    0x036CbD53842c5426634e7929541eC2318f3dCF7e (USDC)
spender:  0xd11bd7b46f10477fe61134fddd6538a383f8978e
allowance before: 0
approving raw amount: 10000000
txHash: 0xb5c106b106d59b04287813754c6c8a3d13e2cc9a761650a73cb7cc7787dfa4db
status: success
allowance after: 0

Ganadhishs-MacBook-Air:ruflo ganadhish$   node src/vps/scripts/sendManualTx.js
network chainId: 84532
from: 0x05F8cC8753D90d67DBB8c02118440b8283F941c9
to: 0xd11bd7b46f10477fe61134fddd6538a383f8978e
value(wei): 0
gasLimit: 1200000
dataBytes: 836

Decoded RouterV1 intent:
  tokenIn: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  amountIn(raw): 2000000
  feeAmount(raw): 20000
  amountAfterFee(raw): 1980000
  deadline: 1776172723 (in 43s)

Token checks:
  token: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (USDC, decimals=6)
  wallet balance(raw): 68879000
  allowance to spender(raw): 10000000

txHash: 0x9af6c38393d071d4639704f8c93ce67c3767fe3179dd21b0feebfd8499bd9bc8
status: success
blockNumber: 40202198


Some information from block explorer: 


All Transfers
Net Transfers
From
0x05F8cC87...283F941c9
To
0xD11bD7B4...383f8978e
For
2

ERC-20: USDC (USDC)
From
0xD11bD7B4...383f8978e
To
0x05F8cC87...283F941c9
For
0.02

ERC-20: USDC (USDC)
From
0xD11bD7B4...383f8978e
To
0x7149aCBd...BE39cf148
For
1.98

ERC-20: USDC (USDC)
From
0x7149aCBd...BE39cf148
To
0xb43db544...EfAbcF192
For
1.98

ERC-20: USDC (USDC)
From
0xb43db544...EfAbcF192
To
0x00000000...000000000
For
1.98

ERC-20: USDC (USDC)


https://sepolia.basescan.org/tx/0x9af6c38393d071d4639704f8c93ce67c3767fe3179dd21b0feebfd8499bd9bc8#eventlog#5

https://sepolia.basescan.org/tx/0x9af6c38393d071d4639704f8c93ce67c3767fe3179dd21b0feebfd8499bd9bc8#eventlog#10

https://sepolia.basescan.org/tx/0x9af6c38393d071d4639704f8c93ce67c3767fe3179dd21b0feebfd8499bd9bc8#eventlog#12

https://sepolia.basescan.org/tx/0x9af6c38393d071d4639704f8c93ce67c3767fe3179dd21b0feebfd8499bd9bc8#eventlog#13