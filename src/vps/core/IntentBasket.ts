import type { ExecutionContext } from './ExecutionContext';

export interface BasketLeg {
  chainId: number;
  token: string;
  decimals?: number;
}

export interface BasketInput extends BasketLeg {
  amount: string;
  wallet: string;
  slippageBps?: number;
}

export interface BasketOutput extends BasketLeg {
  allocationBps?: number;
  fixedAmount?: string;
  recipient?: string;
  nativeAddress?: string;
  gasTopUp?: {
    usd: number;
    recipient?: string;
  };
}

export type BasketMode =
  | 'multi-to-one'
  | 'one-to-many'
  | 'many-to-many'
  | 'wallet-liquidator';

export interface IntentBasket {
  basketId?: string;
  mode: BasketMode;
  inputs: BasketInput[];
  outputs: BasketOutput[];
  constraints: {
    slippageBps?: number;
    deadlineSeconds?: number;
    maxLegs?: number;
  };
}

export interface BasketLegQuote {
  legIndex: number;
  input: BasketInput;
  output: BasketOutput;
  legKind: 'single-chain' | 'cross-chain';
  estimatedInUsd?: number;
  estimatedOutUsd?: number;
  estimatedOut: string;
  minAmountOut: string;
  etaSeconds: number;
  feeUsd: number;
  revenueTier: 'agg-wired' | 'api-direct' | 'unknown';
  opaqueLegRef: string;
}

export interface BasketQuote {
  basketId: string;
  mode: BasketMode;
  legs: BasketLegQuote[];
  totals: {
    inputsUsd: number;
    outputsUsd: number;
    feeUsd: number;
    worstEtaSeconds: number;
    parallelEtaSeconds: number;
  };
  aggregateTier: 'agg-wired' | 'api-direct' | 'mixed' | 'unknown';
  skipped: Array<{
    legIndex: number;
    input?: BasketInput;
    output?: BasketOutput;
    reason: string;
  }>;
  effectiveConstraints: IntentBasket['constraints'];
  expiresAt: number;
}

export type BasketExecutionMode = 'sequential' | 'multicall';

export interface BasketExecutionRequest {
  basketId: string;
  legIndexes?: number[];
  mode?: BasketExecutionMode;
  apiContext?: { integratorId?: string; agentId?: string };
}

export const BASKET_LIMITS = {
  maxInputs: 5,
  maxOutputs: 10,
  maxLegs: 25,
} as const;

export function validateBasket(basket: IntentBasket): { ok: boolean; reason?: string } {
  if (!basket.inputs?.length) return { ok: false, reason: 'basket requires at least one input' };
  if (!basket.outputs?.length) return { ok: false, reason: 'basket requires at least one output' };
  if (basket.inputs.length > BASKET_LIMITS.maxInputs) {
    return { ok: false, reason: `too many inputs (max ${BASKET_LIMITS.maxInputs})` };
  }
  if (basket.outputs.length > BASKET_LIMITS.maxOutputs) {
    return { ok: false, reason: `too many outputs (max ${BASKET_LIMITS.maxOutputs})` };
  }
  if (basket.mode === 'multi-to-one' && basket.outputs.length !== 1) {
    return { ok: false, reason: 'multi-to-one requires exactly one output' };
  }
  if (basket.mode === 'one-to-many' && basket.inputs.length !== 1) {
    return { ok: false, reason: 'one-to-many requires exactly one input' };
  }
  if (basket.mode === 'wallet-liquidator' && basket.outputs.length !== 1) {
    return { ok: false, reason: 'wallet-liquidator requires exactly one output' };
  }

  const allocated = basket.outputs.reduce((sum, output) => sum + (output.allocationBps ?? 0), 0);
  if (
    (basket.mode === 'one-to-many' || basket.mode === 'many-to-many')
    && allocated > 0
    && Math.abs(allocated - 10_000) > 5
  ) {
    return { ok: false, reason: `output allocationBps must sum to 10000 (got ${allocated})` };
  }

  return { ok: true };
}

export type { ExecutionContext };
