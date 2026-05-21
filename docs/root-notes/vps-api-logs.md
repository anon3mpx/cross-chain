docker logs 000e8f6566f6

> empx-cross-chain-vps-runtime@1.0.0 vps:api
> tsx src/vps/app/api.ts

[LayerZero Value Transfer API Monitor] started
[GasZip Monitor] started
[THORChain Monitor] started
[AdminAPI] VPS_ADMIN_API_KEY is not configured; admin routes will reject all requests
[VPS API] listening on http://0.0.0.0:8787
node:events:487
      throw er; // Unhandled 'error' event
      ^

error: terminating connection due to administrator command
    at parseErrorMessage (/app/node_modules/pg-protocol/src/parser.ts:394:9)
    at Parser.handlePacket (/app/node_modules/pg-protocol/src/parser.ts:212:19)
    at Parser.parse (/app/node_modules/pg-protocol/src/parser.ts:105:30)
    at Socket.<anonymous> (/app/node_modules/pg-protocol/src/index.ts:7:48)
    at Socket.emit (node:events:509:28)
    at addChunk (node:internal/streams/readable:563:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:514:3)
    at Readable.push (node:internal/streams/readable:394:5)
    at TCP.onStreamRead (node:internal/stream_base_commons:189:23)
Emitted 'error' event on BoundPool instance at:
    at Client.idleListener (/app/node_modules/pg-pool/index.js:62:10)
    at Client.emit (node:events:509:28)
    at Client._handleErrorEvent (/app/node_modules/pg/lib/client.js:393:10)
    at Client._handleErrorMessage (/app/node_modules/pg/lib/client.js:404:12)
    at Connection.emit (node:events:509:28)
    at /app/node_modules/pg/lib/connection.js:115:12
    at Parser.parse (/app/node_modules/pg-protocol/src/parser.ts:106:9)
    at Socket.<anonymous> (/app/node_modules/pg-protocol/src/index.ts:7:48)
    at Socket.emit (node:events:509:28)
    at addChunk (node:internal/streams/readable:563:12) {
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
    _types: TypeOverrides {
      _types: {
        getTypeParser: [Function: getTypeParser],
        setTypeParser: [Function: setTypeParser],
        arrayParser: { create: [Function: create] },
        builtins: {
          BOOL: 16,
          BYTEA: 17,
          CHAR: 18,
          INT8: 20,
          INT2: 21,
          INT4: 23,
          REGPROC: 24,
          TEXT: 25,
          OID: 26,
          TID: 27,
          XID: 28,
          CID: 29,
          JSON: 114,
          XML: 142,
          PG_NODE_TREE: 194,
          SMGR: 210,
          PATH: 602,
          POLYGON: 604,
          CIDR: 650,
          FLOAT4: 700,
          FLOAT8: 701,
          ABSTIME: 702,
          RELTIME: 703,
          TINTERVAL: 704,
          CIRCLE: 718,
          MACADDR8: 774,
          MONEY: 790,
          MACADDR: 829,
          INET: 869,
          ACLITEM: 1033,
          BPCHAR: 1042,
          VARCHAR: 1043,
          DATE: 1082,
          TIME: 1083,
          TIMESTAMP: 1114,
          TIMESTAMPTZ: 1184,
          INTERVAL: 1186,
          TIMETZ: 1266,
          BIT: 1560,
          VARBIT: 1562,
          NUMERIC: 1700,
          REFCURSOR: 1790,
          REGPROCEDURE: 2202,
          REGOPER: 2203,
          REGOPERATOR: 2204,
          REGCLASS: 2205,
          REGTYPE: 2206,
          UUID: 2950,
          TXID_SNAPSHOT: 2970,
          PG_LSN: 3220,
          PG_NDISTINCT: 3361,
          PG_DEPENDENCIES: 3402,
          TSVECTOR: 3614,
          TSQUERY: 3615,
          GTSVECTOR: 3642,
          REGCONFIG: 3734,
          REGDICTIONARY: 3769,
          JSONB: 3802,
          REGNAMESPACE: 4089,
          REGROLE: 4096
        }
      },
      text: {},
      binary: {}
    },
    _ending: true,
    _ended: false,
    _connecting: false,
    _connected: true,
    _connectionError: false,
    _queryable: false,
    _activeQuery: null,
    enableChannelBinding: false,
    connection: Connection {
      _events: [Object: null prototype] {
        newListener: [Function (anonymous)],
        connect: [Function (anonymous)],
        sslconnect: [Function (anonymous)],
        authenticationCleartextPassword: [Function: bound _handleAuthCleartextPassword],
        authenticationMD5Password: [Function: bound _handleAuthMD5Password],
        authenticationSASL: [Function: bound _handleAuthSASL],
        authenticationSASLContinue: [Function: bound _handleAuthSASLContinue] AsyncFunction,
        authenticationSASLFinal: [Function: bound _handleAuthSASLFinal],
        backendKeyData: [Function: bound _handleBackendKeyData],
        error: [Function: bound _handleErrorEvent],
        errorMessage: [Function: bound _handleErrorMessage],
        readyForQuery: [Function: bound _handleReadyForQuery],
        notice: [Function: bound _handleNotice],
        rowDescription: [Function: bound _handleRowDescription],
        dataRow: [Function: bound _handleDataRow],
        portalSuspended: [Function: bound _handlePortalSuspended],
        emptyQuery: [Function: bound _handleEmptyQuery],
        commandComplete: [Function: bound _handleCommandComplete],
        parseComplete: [Function: bound _handleParseComplete],
        copyInResponse: [Function: bound _handleCopyInResponse],
        copyData: [Function: bound _handleCopyData],
        notification: [Function: bound _handleNotification],
        end: [
          [Function: bound onceWrapper] {
            listener: [Function (anonymous)]
          },
          [Function: bound onceWrapper] {
            listener: [Function (anonymous)]
          },
          Symbol(events.emitting): 0
        ]
      },
      _eventsCount: 23,
      _maxListeners: undefined,
      stream: Socket {
        connecting: false,
        _hadError: false,
        _parent: null,
        _host: 'postgres',
        _closeAfterHandlingError: false,
        _events: {
          close: [Function (anonymous)],
          error: [Function: reportStreamError],
          prefinish: undefined,
          finish: undefined,
          drain: undefined,
          data: [Function (anonymous)],
          end: [
            [Function: onReadableStreamEnd],
            [Function (anonymous)],
            Symbol(events.emitting): 0
          ],
          readable: undefined,
          connect: undefined
        },
        _readableState: ReadableState {
          highWaterMark: 65536,
          buffer: [],
          bufferIndex: 0,
          length: 0,
          pipes: [],
          awaitDrainWriters: null,
          Symbol(kState): 194519348
        },
        _writableState: WritableState {
          highWaterMark: 65536,
          length: 0,
          corked: 0,
          onwrite: [Function (anonymous)],
          writelen: 0,
          bufferedIndex: 0,
          pendingcb: 0,
          Symbol(kState): 17563956,
          Symbol(kBufferedValue): null,
          Symbol(kWriteCbValue): null
        },
        allowHalfOpen: false,
        _maxListeners: undefined,
        _eventsCount: 4,
        _sockname: null,
        _pendingData: null,
        _pendingEncoding: '',
        server: null,
        _server: null,
        Symbol(async_id_symbol): 83,
        Symbol(kHandle): null,
        Symbol(lastWriteQueueSize): 0,
        Symbol(timeout): null,
        Symbol(kBuffer): null,
        Symbol(kBufferCb): null,
        Symbol(kBufferGen): null,
        Symbol(shapeMode): true,
        Symbol(kCapture): false,
        Symbol(kSetNoDelay): true,
        Symbol(kSetKeepAlive): false,
        Symbol(kSetKeepAliveInitialDelay): 0,
        Symbol(kSetTOS): undefined,
        Symbol(kBytesRead): 16085,
        Symbol(kBytesWritten): 13516
      },
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
    processID: 7443,
    secretKey: -1594109196,
    ssl: false,
    _connectionTimeoutMillis: 10000,
    _connectionCallback: null,
    connectionTimeoutHandle: Timeout {
      _idleTimeout: -1,
      _idlePrev: null,
      _idleNext: null,
      _idleStart: 394,
      _onTimeout: null,
      _timerArgs: undefined,
      _repeat: null,
      _destroyed: true,
      Symbol(refed): false,
      Symbol(kHasPrimitive): false,
      Symbol(asyncId): 82,
      Symbol(triggerId): 0,
      Symbol(kAsyncContextFrame): undefined
    },
    saslSession: null,
    release: [Function (anonymous)],
    readyForQuery: true,
    hasExecuted: true,
    _poolUseCount: 36,
    Symbol(shapeMode): false,
    Symbol(kCapture): false
  }
}

Node.js v24.15.0

> empx-cross-chain-vps-runtime@1.0.0 vps:api
> tsx src/vps/app/api.ts

[LayerZero Value Transfer API Monitor] started
[GasZip Monitor] started
[THORChain Monitor] started
[AdminAPI] VPS_ADMIN_API_KEY is not configured; admin routes will reject all requests
[VPS API] listening on http://0.0.0.0:8787