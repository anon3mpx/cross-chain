const RETRYABLE_CODES = new Set([
  'SERVER_ERROR',
  'TIMEOUT',
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'ABORT_ERR',
]);

const RETRYABLE_TEXT_SNIPPETS = [
  '429',
  'too many requests',
  'rate limit',
  'exceeded maximum retry limit',
  'timeout',
  'timed out',
  'network',
  'fetch failed',
  'connect error',
  'connection error',
  'socket hang up',
  'filter not found',
  'failed to marshal batch response',
  'could not coalesce error',
  'service unavailable',
];

export function isRetryableInfraError(err: unknown): boolean {
  for (const candidate of flattenErrorCandidates(err)) {
    const code = readCode(candidate);
    if (code && RETRYABLE_CODES.has(code)) return true;

    const text = readText(candidate);
    if (RETRYABLE_TEXT_SNIPPETS.some((snippet) => text.includes(snippet))) {
      return true;
    }
  }

  return false;
}

function flattenErrorCandidates(err: unknown): unknown[] {
  const queue: unknown[] = [err];
  const seen = new Set<unknown>();
  const flattened: unknown[] = [];

  while (queue.length > 0) {
    const candidate = queue.shift();
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === 'object') {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
    }
    flattened.push(candidate);

    if (typeof candidate !== 'object') continue;

    const nestedErrors = 'errors' in candidate ? (candidate as { errors?: unknown }).errors : undefined;
    if (Array.isArray(nestedErrors)) {
      queue.push(...nestedErrors);
    }

    const cause = 'cause' in candidate ? (candidate as { cause?: unknown }).cause : undefined;
    if (cause !== undefined) {
      queue.push(cause);
    }
  }

  return flattened;
}

function readCode(err: unknown): string {
  if (typeof err !== 'object' || err === null || !('code' in err)) return '';
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code.trim().toUpperCase() : String(code ?? '').trim().toUpperCase();
}

function readText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.toLowerCase();
}
