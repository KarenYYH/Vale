import type { Middleware } from "./chain.js";
import { err } from "../tools/types.js";

/** Simple token bucket rate limiter per workspace */
const buckets = new Map<string, { tokens: number; lastRefill: number; burst: number }>();

/** Default: 60 calls per minute */
const DEFAULT_RATE = 60;
const DEFAULT_BURST = 10;
const WINDOW_MS = 60_000;
/** Evict buckets idle longer than this on each call (bounds memory). */
const IDLE_EVICT_MS = 10 * 60_000; // 10 minutes

/**
 * Middleware: rate-limit tool calls.
 * Uses a token bucket algorithm with per-workspace state. Burst capacity comes
 * from config (maxBurst, defaulting to maxPerMinute) rather than a hardcoded
 * cap, and idle buckets are evicted to bound memory (I7).
 */
export const rateLimiter: Middleware = async (tool, input, ctx, next) => {
  const config = ctx.config?.mcp?.rateLimit;
  if (!config?.enabled) return next(input);

  const maxPerMinute = config.maxPerMinute ?? DEFAULT_RATE;
  const burst = config.maxBurst ?? maxPerMinute ?? DEFAULT_BURST;
  const key = ctx.workspacePath;
  const now = Date.now();

  evictIdleBuckets(IDLE_EVICT_MS, now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: burst, lastRefill: now, burst };
    buckets.set(key, bucket);
  }

  // Refill tokens, capped at the configured burst capacity.
  const elapsed = now - bucket.lastRefill;
  const refillAmount = (elapsed / WINDOW_MS) * maxPerMinute;
  bucket.tokens = Math.min(burst, bucket.tokens + refillAmount);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return err("Rate limit exceeded. Please wait before making more requests.");
  }

  bucket.tokens -= 1;
  return next(input);
};

/** Remove buckets whose last activity is older than maxIdleMs. */
function evictIdleBuckets(maxIdleMs: number, now = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill >= maxIdleMs) buckets.delete(key);
  }
}

// ── Test hooks (not part of the public API) ──
export function __evictIdleBuckets(maxIdleMs: number): void {
  evictIdleBuckets(maxIdleMs);
}
export function __bucketCount(): number {
  return buckets.size;
}
