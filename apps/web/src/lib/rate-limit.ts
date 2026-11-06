type Bucket = { count: number; resetAt: number };

/**
 * In-memory limiter is correct for a single long-lived Node process
 * (Trail9 Mumbai VPS / one Docker Compose `web` replica).
 * It does not aggregate across instances. Move to Redis (Upstash) before
 * running more than one app instance — otherwise each process keeps its
 * own Map and intended limits will not hold.
 */
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
