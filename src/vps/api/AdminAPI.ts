import express, { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import {
  RefundCaseStatus,
  RefundCustodyLocation,
  RefundResolutionKind,
} from '../types';
import { IntentService, IntentLifecycleError } from '../services/IntentService';
import type { ReliabilityRepository } from '../db/ReliabilityRepository';
import type { NativeUsdOracle } from '../services/NativeUsdOracle';

const REFUND_STATUSES = new Set(Object.values(RefundCaseStatus));
const REFUND_CUSTODY_LOCATIONS = new Set(Object.values(RefundCustodyLocation));
const REFUND_RESOLUTION_KINDS = new Set(Object.values(RefundResolutionKind));

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function buildAdminAPI(
  intentService: IntentService,
  reliability?: ReliabilityRepository,
  oracle?: NativeUsdOracle,
): express.Router {
  const router = express.Router();
  const adminKey = (process.env.VPS_ADMIN_API_KEY ?? '').trim();
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
  const isProductionLike = nodeEnv === 'production' || nodeEnv === 'staging';

  if (!adminKey) {
    if (isProductionLike) {
      throw new Error('[AdminAPI] VPS_ADMIN_API_KEY is required in production/staging.');
    }
    console.warn('[AdminAPI] VPS_ADMIN_API_KEY is not configured; admin routes will reject all requests');
  }

  router.use((req: Request, res: Response, next: NextFunction) => {
    const supplied = String(req.headers['x-admin-key'] ?? '').trim();
    if (!adminKey || !supplied || supplied.length !== adminKey.length || !timingSafeEqualStr(supplied, adminKey)) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    next();
  });

  router.get('/reliability', async (req: Request, res: Response) => {
    if (!reliability) {
      return res.status(503).json({ error: 'RELIABILITY_DISABLED' });
    }
    const windowMs = clampWindowMs(req.query.windowMs, 7 * 24 * 60 * 60 * 1000);
    try {
      const stats = await reliability.windowedRailStats(windowMs);
      res.json({ windowMs, stats, generatedAt: Date.now() });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL', message: err instanceof Error ? err.message : 'unknown' });
    }
  });

  router.get('/reliability/route', async (req: Request, res: Response) => {
    if (!reliability) {
      return res.status(503).json({ error: 'RELIABILITY_DISABLED' });
    }
    const signature = typeof req.query.signature === 'string' ? req.query.signature.trim() : '';
    if (!signature) {
      return res.status(400).json({ error: 'signature query required' });
    }
    const windowMs = clampWindowMs(req.query.windowMs, 7 * 24 * 60 * 60 * 1000);
    try {
      const stats = await reliability.windowedRouteStats(signature, windowMs);
      res.json({ signature, windowMs, stats });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL', message: err instanceof Error ? err.message : 'unknown' });
    }
  });

  router.get('/reliability/tier', async (req: Request, res: Response) => {
    if (!reliability) {
      return res.status(503).json({ error: 'RELIABILITY_DISABLED' });
    }
    const windowMs = clampWindowMs(req.query.windowMs, 7 * 24 * 60 * 60 * 1000);
    try {
      const stats = await reliability.windowedTierStats(windowMs);
      res.json({ windowMs, stats, generatedAt: Date.now() });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL', message: err instanceof Error ? err.message : 'unknown' });
    }
  });

  router.get('/oracle/snapshot', (_req: Request, res: Response) => {
    if (!oracle) {
      return res.status(503).json({ error: 'ORACLE_DISABLED' });
    }
    res.json({ generatedAt: Date.now(), ...oracle.snapshot() });
  });

  router.post('/oracle/counters/reset', (_req: Request, res: Response) => {
    if (!oracle) {
      return res.status(503).json({ error: 'ORACLE_DISABLED' });
    }
    oracle.resetCounters();
    res.json({ ok: true, resetAt: Date.now() });
  });

  router.post('/intents/:id/refund', async (req: Request, res: Response) => {
    const intentId = String(req.params.id);
    const body = req.body as Record<string, unknown>;

    try {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!reason) {
        return res.status(400).json({ error: 'reason is required' });
      }

      const status = parseEnum(body.status, REFUND_STATUSES, RefundCaseStatus.UNDER_REVIEW);
      const refund = await intentService.adminUpdateRefund({
        intentId,
        status,
        reason,
        reviewedBy: readOptionalString(body.reviewedBy) ?? 'admin',
        reviewNotes: readOptionalString(body.reviewNotes),
        adminNotes: readOptionalString(body.adminNotes),
        custodyLocation: parseOptionalEnum(body.custodyLocation, REFUND_CUSTODY_LOCATIONS),
        resolutionKind: parseOptionalEnum(body.resolutionKind, REFUND_RESOLUTION_KINDS),
        rescueContract: readOptionalString(body.rescueContract),
        rescueToken: readOptionalString(body.rescueToken),
        rescueAmount: readOptionalString(body.rescueAmount),
        rescueTxHash: readOptionalString(body.rescueTxHash),
        payoutAddress: readOptionalString(body.payoutAddress),
        payoutTxHash: readOptionalString(body.payoutTxHash),
      });

      res.json({ ok: true, refund, ts: Date.now() });
    } catch (err) {
      handleLifecycleError(res, err);
    }
  });

  return router;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase() as T;
  if (!allowed.has(normalized)) {
    throw new IntentLifecycleError('INVALID_ADMIN_REFUND_STATE', `Unsupported status ${value}`);
  }
  return normalized;
}

function parseOptionalEnum<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase() as T;
  if (!allowed.has(normalized)) {
    throw new IntentLifecycleError('INVALID_ADMIN_REFUND_VALUE', `Unsupported enum value ${value}`);
  }
  return normalized;
}

function clampWindowMs(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(60_000, Math.min(90 * 24 * 60 * 60 * 1000, parsed));
}

function handleLifecycleError(res: Response, err: unknown): void {
  if (err instanceof IntentLifecycleError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message });
    return;
  }
  console.error('[AdminAPI] request failed', err);
  res.status(500).json({ error: 'INTERNAL', message: 'Unexpected server error.' });
}
