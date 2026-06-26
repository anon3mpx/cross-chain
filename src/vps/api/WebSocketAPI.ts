// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — WebSocket API
// Real-time intent status streaming. Eliminates polling.
// Partners connect once and receive push updates until settled.
// Compatible with: browsers, Node.js, React Native.
// ─────────────────────────────────────────────────────────

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { IntentEngine } from '../services/IntentEngine';
import { ApiKeyManager } from '../services/ApiKeyManager';
import { Intent, IntentStatus } from '../types';

interface WsClient {
  ws:       WebSocket;
  apiKey:   string;
  intentId: string;
}

export class WebSocketAPI {
  private wss: WebSocketServer;
  // intentId → set of connected clients watching it
  private subs = new Map<string, Set<WsClient>>();

  constructor(
    port: number,
    private intentEngine: IntentEngine,
    private keyManager: ApiKeyManager,
  ) {
    this.wss = new WebSocketServer({
      port,
      handleProtocols: (protocols) => protocols.has('rflo-auth') ? 'rflo-auth' : false,
    });
    this._setup();
    this._listenToIntentEngine();
    console.log(`[WebSocketAPI] Listening on ws://0.0.0.0:${port}`);
  }

  private _setup(): void {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      // URL format: /ws/intent/:intentId?key=rflo_xxx
      const url    = new URL(req.url ?? '', 'http://localhost');
      const parts  = url.pathname.split('/');          // ['', 'ws', 'intent', ':id']
      const intentId = parts[3];
      const apiKey   = this._readApiKey(req, url);

      // Auth check
      const check = await this.keyManager.validateKey(apiKey);
      if (!check.allowed) {
        ws.send(JSON.stringify({ error: check.reason }));
        ws.close(1008, check.reason);
        return;
      }

      // Send current state immediately on connect (no polling gap)
      const intent = this.intentEngine.get(intentId);
      if (!intent) {
        ws.send(JSON.stringify({ error: 'NOT_FOUND' }));
        ws.close(1008, 'NOT_FOUND');
        return;
      }

      const client: WsClient = { ws, apiKey, intentId };
      this._addSub(intentId, client);

      // Optimistic pre-confirmation: if intent is already in a terminal state, send immediately
      ws.send(JSON.stringify(this._serialize(intent)));
      if (this._isTerminal(intent.status)) {
        ws.close(1000, 'SETTLED');
        return;
      }

      ws.on('close', () => this._removeSub(intentId, client));
      ws.on('error', () => this._removeSub(intentId, client));

      // Keepalive ping every 30s
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
        else clearInterval(ping);
      }, 30_000);
      ws.on('close', () => clearInterval(ping));
      ws.on('error', () => clearInterval(ping));
    });
  }

  // ── Subscribe to IntentEngine state changes, push to all watching clients ──

  private _listenToIntentEngine(): void {
    this.intentEngine.onStateChange((intent) => {
      const clients = this.subs.get(intent.intentId);
      if (!clients || clients.size === 0) return;

      const msg = JSON.stringify(this._serialize(intent));

      clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(msg);
          // Close connection once terminal state reached
          if (this._isTerminal(intent.status)) {
            client.ws.close(1000, intent.status);
          }
        }
      });

      if (this._isTerminal(intent.status)) {
        this.subs.delete(intent.intentId);
      }
    });
  }

  private _serialize(intent: Intent) {
    return {
      intentId:     intent.intentId,
      status:       intent.status,
      rail:         intent.quote.rail,
      srcTxHash:    intent.srcTxHash,
      dstTxHash:    intent.dstTxHash,
      railTxId:     intent.railTxId,
      etaSeconds:   intent.quote.etaSeconds,
      amountOut:    intent.quote.estimatedOut?.toString(),
      errorMessage: intent.errorMessage,
      ts:           Date.now(),
    };
  }

  private _isTerminal(status: IntentStatus): boolean {
    return status === IntentStatus.SETTLED || status === IntentStatus.FAILED || status === IntentStatus.CANCELLED;
  }

  private _addSub(intentId: string, client: WsClient): void {
    if (!this.subs.has(intentId)) this.subs.set(intentId, new Set());
    this.subs.get(intentId)!.add(client);
  }

  private _removeSub(intentId: string, client: WsClient): void {
    this.subs.get(intentId)?.delete(client);
  }

  private _readApiKey(req: IncomingMessage, url: URL): string {
    const header = req.headers['sec-websocket-protocol'];
    const requestedProtocols = typeof header === 'string'
      ? header.split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    if (requestedProtocols.includes('rflo-auth')) {
      const key = requestedProtocols.find((value) => value !== 'rflo-auth');
      if (key) return key;
    }
    return url.searchParams.get('key') ?? '';
  }

  get connectionCount(): number {
    let n = 0;
    this.subs.forEach(s => { n += s.size; });
    return n;
  }
}
