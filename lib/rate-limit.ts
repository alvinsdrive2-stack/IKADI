// ponytail: in-memory sliding window, per-process. Fine for a single Node instance.
// Upgrade path: swap the Map for Redis/Upstash when running more than one replica.
type Hits = { timestamps: number[] };

const buckets = new Map<string, Hits>();

export type RateLimitResult = { allowed: boolean; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits = buckets.get(key) ?? { timestamps: [] };
  hits.timestamps = hits.timestamps.filter((t) => now - t < windowMs);

  if (hits.timestamps.length >= limit) {
    buckets.set(key, hits);
    const retryAfter = Math.ceil((windowMs - (now - hits.timestamps[0])) / 1000);
    return { allowed: false, retryAfter };
  }

  hits.timestamps.push(now);
  buckets.set(key, hits);

  // ponytail: opportunistic sweep keeps the map from growing unbounded.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.timestamps.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return { allowed: true, retryAfter: 0 };
}

/** Test-only helper. */
export function resetRateLimit() {
  buckets.clear();
}
