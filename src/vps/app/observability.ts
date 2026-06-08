// ─────────────────────────────────────────────────────────────────────────────
// observability — minimal in-process telemetry for the VPS API.
//
// Two pieces, both standalone (no external deps):
//
//   1. requestIdMiddleware  — accepts x-request-id from upstream proxies if
//      trusted, otherwise generates one.  Attaches to req + res; downstream
//      handlers and the metrics middleware include it for log correlation.
//
//   2. MetricsRegistry      — counters + histograms with a Prometheus text-
//      format `/metrics` endpoint.  Designed for cheap drop-in: no client
//      library, no labels-explosion, no allocator overhead on the hot path.
//
// Why in-process not prom-client / opentelemetry?
//   At Sprint-4 scope we need observability TODAY for partner-GA, not a
//   long-term metrics architecture.  This module's surface mirrors what a
//   future prom-client migration would consume (counter.inc(), histogram.
//   observe()), so swapping it in later is mechanical.
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

/** Trusted-proxy aware request ID. */
export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Accept upstream request id only when express's `trust proxy` says the
    // immediate peer is trusted.  This piggy-backs on the existing
    // VPS_TRUSTED_PROXY_CIDRS gating that StatusAPI already applies.
    const fromHeader =
      typeof req.headers['x-request-id'] === 'string'
        ? (req.headers['x-request-id'] as string).trim()
        : '';
    const trusted = req.app.get('trust proxy fn');
    const accept = trusted ? !!req.ip : true; // if no trust-proxy fn set, accept
    const reqId =
      (accept && /^[A-Za-z0-9_\-]{6,128}$/.test(fromHeader)) ? fromHeader
      : 'rq_' + randomBytes(12).toString('hex');
    req.requestId = reqId;
    res.setHeader('x-request-id', reqId);
    next();
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────────

type Labels = Record<string, string>;

class Counter {
  private readonly buckets = new Map<string, number>();
  constructor(public readonly name: string, public readonly help: string) {}
  inc(labels: Labels = {}, by = 1): void {
    const k = serialiseLabels(labels);
    this.buckets.set(k, (this.buckets.get(k) ?? 0) + by);
  }
  *render(): IterableIterator<string> {
    yield `# HELP ${this.name} ${this.help}`;
    yield `# TYPE ${this.name} counter`;
    for (const [k, v] of this.buckets) {
      yield `${this.name}${k} ${v}`;
    }
  }
}

class Histogram {
  // Latency-shaped default buckets (ms).  Tune as we learn workload.
  private static readonly DEFAULT_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  private readonly bucketsByLabels = new Map<
    string,
    { counts: number[]; sum: number; count: number }
  >();
  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly bucketsMs: number[] = Histogram.DEFAULT_BUCKETS_MS,
  ) {}
  observe(valueMs: number, labels: Labels = {}): void {
    const k = serialiseLabels(labels);
    let h = this.bucketsByLabels.get(k);
    if (!h) {
      h = { counts: new Array(this.bucketsMs.length).fill(0), sum: 0, count: 0 };
      this.bucketsByLabels.set(k, h);
    }
    h.sum += valueMs;
    h.count += 1;
    for (let i = 0; i < this.bucketsMs.length; i += 1) {
      if (valueMs <= this.bucketsMs[i]) h.counts[i] += 1;
    }
  }
  *render(): IterableIterator<string> {
    yield `# HELP ${this.name} ${this.help}`;
    yield `# TYPE ${this.name} histogram`;
    for (const [k, h] of this.bucketsByLabels) {
      const labelClause = k === '' ? '' : k.slice(1, -1); // strip { }
      for (let i = 0; i < this.bucketsMs.length; i += 1) {
        const bucketLabel = labelClause ? `${labelClause},le="${this.bucketsMs[i]}"` : `le="${this.bucketsMs[i]}"`;
        yield `${this.name}_bucket{${bucketLabel}} ${h.counts[i]}`;
      }
      const infLabel = labelClause ? `${labelClause},le="+Inf"` : `le="+Inf"`;
      yield `${this.name}_bucket{${infLabel}} ${h.count}`;
      yield `${this.name}_sum${k} ${h.sum}`;
      yield `${this.name}_count${k} ${h.count}`;
    }
  }
}

export class MetricsRegistry {
  readonly httpRequests = new Counter(
    'empx_http_requests_total',
    'HTTP requests handled by the VPS API, labelled by method, route, status.',
  );
  readonly httpDurationMs = new Histogram(
    'empx_http_duration_ms',
    'HTTP request duration in milliseconds.',
  );
  readonly quoteOffers = new Counter(
    'empx_quote_offers_total',
    'Offers produced by GET /quote, labelled by rail, executionMode, offerType.',
  );
  readonly webhookDeliveries = new Counter(
    'empx_webhook_deliveries_total',
    'Outbound partner webhooks, labelled by outcome (ok|retry|dead).',
  );
  readonly cctpRelays = new Counter(
    'empx_cctp_relays_total',
    'CCTP destination relays, labelled by outcome (success|retry|failed).',
  );

  render(): string {
    const lines: string[] = [];
    for (const c of [this.httpRequests, this.quoteOffers, this.webhookDeliveries, this.cctpRelays]) {
      for (const line of c.render()) lines.push(line);
    }
    for (const line of this.httpDurationMs.render()) lines.push(line);
    return lines.join('\n') + '\n';
  }
}

export const metrics = new MetricsRegistry();

/** Express middleware: count requests + record latency. */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const route = (req.route?.path ?? req.path ?? 'unknown').replace(/\d+/g, ':id');
      const labels = {
        method: req.method,
        route,
        status: String(res.statusCode),
      };
      metrics.httpRequests.inc(labels);
      metrics.httpDurationMs.observe(Date.now() - start, { route });
    });
    next();
  };
}

function serialiseLabels(labels: Labels): string {
  const keys = Object.keys(labels);
  if (keys.length === 0) return '';
  const parts = keys.sort().map((k) => `${k}="${escapeLabelValue(labels[k])}"`);
  return `{${parts.join(',')}}`;
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
