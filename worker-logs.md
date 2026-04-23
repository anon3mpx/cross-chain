docker logs dcf3159e1dee

> empx-cross-chain-vps-runtime@1.0.0 vps:worker
> tsx src/vps/app/worker.ts

[CCTP Relay] started
[RecoveryEngine] Started — checking every 30 s
[VPS Worker] running eventMonitor=true recovery=true cctpRelay=true
[RecoveryEngine] Found 1 stuck intent(s)
[RecoveryEngine] Retrying 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 via VIA_LABS (attempt 1)
[CCTP Relay] receiveMessage ok intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 tx=0xdde0b3b9c73115ffbc9cd6bef8d08f7decf63cfab11712f235d68ea02b3cf781
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[RecoveryEngine] Found 1 stuck intent(s)
[RecoveryEngine] Intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 FAILED after 3 retries
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] retrying intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 attempt=1 lastError=cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[CCTP Relay] retrying intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 attempt=2 lastError=cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] retrying intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 attempt=3 lastError=cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[RecoveryEngine] Found 1 stuck intent(s)
[RecoveryEngine] Retrying 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 via AXELAR (attempt 2)
[CCTP Relay] retrying intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 attempt=4 lastError=cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[RecoveryEngine] Found 1 stuck intent(s)
[RecoveryEngine] Retrying 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 via VIA_LABS (attempt 3)
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[CCTP Relay] backfill failed chain=84532 Error: server response 502 Bad Gateway (request={  }, response={  }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at assert (/app/node_modules/ethers/src.ts/utils/errors.ts:719:25)
    at FetchResponse.assertOk (/app/node_modules/ethers/src.ts/utils/fetch.ts:950:15)
    at JsonRpcProvider._send (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1272:18)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:545:40) {
  code: 'SERVER_ERROR',
  request: FetchRequest {},
  response: FetchResponse {},
  error: undefined,
  info: {
    requestUrl: 'https://sepolia.base.org',
    responseBody: 'error code: 502',
    responseStatus: '502 Bad Gateway'
  },
  shortMessage: 'server response 502 Bad Gateway'
}
[CCTP Relay] retrying intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 attempt=5 lastError=cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: attestation timeout for srcTx=0x1b5364c237f7cfcf73a60f17d016924654894c18e4167856f69076166ba29a73 sourceDomain=2 messageHash=0x079efe64c6e958377e0a2b1b2113e0f30c61bbe2f08f703a30477f13cad262f2
    at CctpAttestationWorker._pollAttestation (/app/src/vps/services/CctpAttestationWorker.ts:565:11)
    at async CctpAttestationWorker._relayJob (/app/src/vps/services/CctpAttestationWorker.ts:432:52)
    at async CctpAttestationWorker._enqueueIntent (/app/src/vps/services/CctpAttestationWorker.ts:222:7)
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: attestation timeout for srcTx=0x8dc43656f9a6f9560d19ffe2c4437d26028a9cd8fe0b5a42d41ed2653da39d65 sourceDomain=2 messageHash=0xbad4c19b9f97d16df4ba53dfadc12856350a06df7701fe379f89eb6d1b055715
    at CctpAttestationWorker._pollAttestation (/app/src/vps/services/CctpAttestationWorker.ts:565:11)
    at async CctpAttestationWorker._relayJob (/app/src/vps/services/CctpAttestationWorker.ts:432:52)
    at async CctpAttestationWorker._enqueueIntent (/app/src/vps/services/CctpAttestationWorker.ts:222:7)
[RecoveryEngine] Found 1 stuck intent(s)
[RecoveryEngine] Intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 FAILED after 3 retries
[CCTP Relay] retrying intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 attempt=1 lastError=attestation timeout for srcTx=0x1b5364c237f7cfcf73a60f17d016924654894c18e4167856f69076166ba29a73 sourceDomain=2 messageHash=0x079efe64c6e958377e0a2b1b2113e0f30c61bbe2f08f703a30477f
[CCTP Relay] retrying intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 attempt=1 lastError=attestation timeout for srcTx=0x8dc43656f9a6f9560d19ffe2c4437d26028a9cd8fe0b5a42d41ed2653da39d65 sourceDomain=2 messageHash=0xbad4c19b9f97d16df4ba53dfadc12856350a06df7701fe379f89eb
[CCTP Relay] receiveMessage ok intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 tx=0x53c70cee5ed41f41987e29a496ddb820ffbae62c29d7fc8ca8f06f4cac150d98
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] retrying intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 attempt=6 lastError=cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] receiveMessage ok intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 tx=0x2d3e1146fa3f768653a7d3f973eb64f91dca1ad16bbddc158e3a215a9e0036bc
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] retrying intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 attempt=7 lastError=cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] backfill failed chain=84532 Error: server response 502 Bad Gateway (request={  }, response={  }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at assert (/app/node_modules/ethers/src.ts/utils/errors.ts:719:25)
    at FetchResponse.assertOk (/app/node_modules/ethers/src.ts/utils/fetch.ts:950:15)
    at JsonRpcProvider._send (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1272:18)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:545:40) {
  code: 'SERVER_ERROR',
  request: FetchRequest {},
  response: FetchResponse {},
  error: undefined,
  info: {
    requestUrl: 'https://sepolia.base.org',
    responseBody: 'error code: 502',
    responseStatus: '502 Bad Gateway'
  },
  shortMessage: 'server response 502 Bad Gateway'
}
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: server response 502 Bad Gateway (request={  }, response={  }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at assert (/app/node_modules/ethers/src.ts/utils/errors.ts:719:25)
    at FetchResponse.assertOk (/app/node_modules/ethers/src.ts/utils/fetch.ts:950:15)
    at JsonRpcProvider._send (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1272:18)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:545:40) {
  code: 'SERVER_ERROR',
  request: FetchRequest {},
  response: FetchResponse {},
  error: undefined,
  info: {
    requestUrl: 'https://sepolia.base.org',
    responseBody: 'error code: 502',
    responseStatus: '502 Bad Gateway'
  },
  shortMessage: 'server response 502 Bad Gateway'
}
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] retrying intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 attempt=1 lastError=server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 B
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] retrying intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 attempt=8 lastError=cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] message already relayed intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
[CCTP Relay] intent 0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16 failed Error: cannot determine minted amount for already-relayed fast transfer intent=0x7dea4aeb4c31216b9ee7e5dcd05ed2f3187c9cc4c9e19da8bffc2363576cbf16
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:470:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[VPS Worker] retryable provider rejection; continuing: server response 502 Bad Gateway (request={ }, response={ }, error=null, info={ "requestUrl": "https://sepolia.base.org", "responseBody": "error code: 502", "responseStatus": "502 Bad Gateway" }, code=SERVER_ERROR, versio
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450
[CCTP Relay] intent 0x0bb475fc1216542f0e19bbcc075b1ec1a1ad91b27b3eac51f6dae5ccdf216450 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[CCTP Relay] message already relayed intent=0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787
[CCTP Relay] intent 0xb964c83eee4beac0e61608f5c3309f5d24d241dc8d37c90a36d925ee3d5c5787 failed Error: receiver 0xB006c9609b8FE8d52d2a16B4463446eDa853264b does not approve relayer 0x05F8cC8753D90d67DBB8c02118440b8283F941c9; set RECEIVER_APPROVED_CALLER_*
    at <anonymous> (/app/src/vps/services/CctpAttestationWorker.ts:479:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)