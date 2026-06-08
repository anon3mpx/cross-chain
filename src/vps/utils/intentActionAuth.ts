import { createHash, randomUUID } from 'crypto';
import { getAddress } from 'ethers';

export const SIGNATURE_WINDOW_MS = 10 * 60 * 1000;

export type IntentAction = 'submitted' | 'cancel' | 'refund';

export interface IntentActionMessageInput {
  intentId: string;
  userAddress: string;
  timestamp: number;
  nonce?: string;
  srcTxHash?: string;
  reason?: string;
  replacementTxHash?: string;
}

export function buildIntentActionMessage(
  action: IntentAction,
  input: IntentActionMessageInput,
): string {
  const normalizedAddress = getAddress(input.userAddress);
  const timestamp = Math.trunc(input.timestamp);
  const lines = [
    `EMPX-Cross-Chain intent ${action}`,
    `intentId:${input.intentId}`,
    `wallet:${normalizedAddress}`,
    `timestamp:${timestamp}`,
  ];

  if (input.nonce) {
    lines.push(`nonce:${normalizeOptional(input.nonce)}`);
  }

  if (action === 'submitted') {
    lines.push(`srcTxHash:${normalizeOptional(input.srcTxHash)}`);
    return lines.join('\n');
  }

  lines.push(`reason:${normalizeOptional(input.reason)}`);
  if (action === 'cancel') {
    lines.push(`replacementTxHash:${normalizeOptional(input.replacementTxHash)}`);
  }
  return lines.join('\n');
}

export function buildIntentActionId(
  action: IntentAction,
  input: IntentActionMessageInput,
): string {
  return createHash('sha256')
    .update(action)
    .update('\n')
    .update(buildIntentActionMessage(action, input))
    .digest('hex');
}

export function generateIntentActionNonce(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function normalizeOptional(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}
