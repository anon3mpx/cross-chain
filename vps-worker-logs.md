docker logs 611e653f9253

> empx-cross-chain-vps-runtime@1.0.0 vps:worker
> tsx src/vps/app/worker.ts

[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 2, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773d36", "toBlock": "0x2774cd6", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 2,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] started
[LayerZero Value Transfer API Monitor] started
[GasZip Monitor] started
[THORChain Monitor] started
[RecoveryEngine] Started — checking every 30 s
[VPS Worker] running eventMonitor=true recovery=true rails="CCTP_STANDARD=worker CCTP_FAST=worker CCTP_STANDARD=disabled AXELAR=passive LAYERZERO=worker VIA_LABS=passive WORMHOLE=passive GASZIP=worker THORCHAIN=worker"
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 48, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773d55", "toBlock": "0x2774cf5", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 48,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 94, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773d73", "toBlock": "0x2774d13", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 94,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 139, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773d91", "toBlock": "0x2774d31", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 139,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 186, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773daf", "toBlock": "0x2774d4f", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 186,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 233, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773dcd", "toBlock": "0x2774d6d", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 233,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 279, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773deb", "toBlock": "0x2774d8b", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 279,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 325, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773e09", "toBlock": "0x2774da9", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 325,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 370, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x2773e27", "toBlock": "0x2774dc7", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 370,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[VPS Worker] fatal exception error: terminating connection due to administrator command
    at parseErrorMessage (/app/node_modules/pg-protocol/src/parser.ts:394:9)
    at Parser.handlePacket (/app/node_modules/pg-protocol/src/parser.ts:212:19)
    at Parser.parse (/app/node_modules/pg-protocol/src/parser.ts:105:30)
    at Socket.<anonymous> (/app/node_modules/pg-protocol/src/index.ts:7:48)
    at Socket.emit (node:events:509:28)
    at addChunk (node:internal/streams/readable:563:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:514:3)
    at Readable.push (node:internal/streams/readable:394:5)
    at TCP.onStreamRead (node:internal/stream_base_commons:189:23) {
  length: 116,
  severity: 'FATAL',
  code: '57P01',
  detail: undefined,
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'postgres.c',
  line: '3286',
  routine: 'ProcessInterrupts',
  client: Client {
    _events: [Object: null prototype] { error: [Function (anonymous)] },
    _eventsCount: 1,
    _maxListeners: undefined,
    connectionParameters: ConnectionParameters {
      user: 'postgres',
      database: 'empx-cross-chain',
      port: 5432,
      host: 'postgres',
      binary: false,
      options: undefined,
      ssl: false,
      client_encoding: '',
      replication: undefined,
      isDomainSocket: false,
      application_name: undefined,
      fallback_application_name: undefined,
      statement_timeout: false,
      lock_timeout: false,
      idle_in_transaction_session_timeout: false,
      query_timeout: false,
      connect_timeout: 10
    },
    user: 'postgres',
    database: 'empx-cross-chain',
    port: 5432,
    host: 'postgres',
    replication: undefined,
    _Promise: [Function: Promise],
    _types: TypeOverrides { _types: [Object], text: {}, binary: {} },
    _ending: true,
    _ended: false,
    _connecting: false,
    _connected: true,
    _connectionError: false,
    _queryable: false,
    _activeQuery: null,
    enableChannelBinding: false,
    connection: Connection {
      _events: [Object: null prototype],
      _eventsCount: 23,
      _maxListeners: undefined,
      stream: [Socket],
      _keepAlive: false,
      _keepAliveInitialDelayMillis: 0,
      parsedStatements: {},
      ssl: false,
      _ending: true,
      _emitMessage: false,
      _connecting: true,
      Symbol(shapeMode): false,
      Symbol(kCapture): false
    },
    _queryQueue: [],
    binary: false,
    processID: 7448,
    secretKey: 737930664,
    ssl: false,
    _connectionTimeoutMillis: 10000,
    _connectionCallback: null,
    connectionTimeoutHandle: Timeout {
      _idleTimeout: -1,
      _idlePrev: null,
      _idleNext: null,
      _idleStart: 2455,
      _onTimeout: null,
      _timerArgs: undefined,
      _repeat: null,
      _destroyed: true,
      Symbol(refed): false,
      Symbol(kHasPrimitive): false,
      Symbol(asyncId): 464,
      Symbol(triggerId): 461,
      Symbol(kAsyncContextFrame): undefined
    },
    saslSession: null,
    release: [Function (anonymous)],
    readyForQuery: true,
    hasExecuted: true,
    _poolUseCount: 35,
    Symbol(shapeMode): false,
    Symbol(kCapture): false
  }
}

> empx-cross-chain-vps-runtime@1.0.0 vps:worker
> tsx src/vps/app/worker.ts

[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 2, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x277cf6c", "toBlock": "0x277df0c", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 2,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] started
[LayerZero Value Transfer API Monitor] started
[GasZip Monitor] started
[THORChain Monitor] started
[RecoveryEngine] Started — checking every 30 s
[VPS Worker] running eventMonitor=true recovery=true rails="CCTP_STANDARD=worker CCTP_FAST=worker CCTP_STANDARD=disabled AXELAR=passive LAYERZERO=worker VIA_LABS=passive WORMHOLE=passive GASZIP=worker THORCHAIN=worker"
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 48, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x277cf8b", "toBlock": "0x277df2b", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 48,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}
[CCTP Relay] backfill failed chain=84532 Error: could not coalesce error (error={ "code": -32602, "message": "query exceeds max block range 2000" }, payload={ "id": 94, "jsonrpc": "2.0", "method": "eth_getLogs", "params": [ { "address": "0x8c176efd8347cc01e6156c7cd1ba2d073ba1b255", "fromBlock": "0x277cfa9", "toBlock": "0x277df49", "topics": [ "0xc1aff4087580bedecdbd72b1f32dd5ad91522862be8f6c20ce32a1bf2e13b672" ] } ] }, code=UNKNOWN_ERROR, version=6.16.0)
    at makeError (/app/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at JsonRpcProvider.getRpcError (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:1086:25)
    at <anonymous> (/app/node_modules/ethers/src.ts/providers/provider-jsonrpc.ts:571:45)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
  code: 'UNKNOWN_ERROR',
  error: { code: -32602, message: 'query exceeds max block range 2000' },
  payload: {
    method: 'eth_getLogs',
    params: [ [Object] ],
    id: 94,
    jsonrpc: '2.0'
  },
  shortMessage: 'could not coalesce error'
}