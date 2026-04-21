import { getAddress } from 'ethers';

export const SIGNATURE_WINDOW_MS = 10 * 60 * 1000;

export type IntentAction = 'submitted' | 'cancel' | 'refund';

export interface IntentActionMessageInput {
  intentId: string;
  userAddress: string;
  timestamp: number;
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

function normalizeOptional(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}
