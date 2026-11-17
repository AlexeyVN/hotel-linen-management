/**
 * Rate limiting в памяти процесса (single-node, ТЗ v2.3 §10.3).
 * Redis/лежащего хранилища в среде нет, поэтому счётчики живут в Map
 * и сбрасываются при перезапуске — это осознанное упрощение.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function prune(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

/** Только для тестов/диагностики. */
export function resetRateLimits(): void {
  buckets.clear();
}

export function rateLimitSize(): number {
  return buckets.size;
}
