import type { Middleware } from "./chain.js";
import { err } from "../tools/types.js";

/** Simple token bucket rate limiter per workspace */
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

/** Default: 60 calls per minute, burst of 10 */
const DEFAULT_RATE = 60;
const DEFAULT_BURST = 10;
const WINDOW_MS = 60_000;

/**
 * Middleware: rate-limit tool calls.
 * Uses a token bucket algorithm with per-workspace state.
 */
export const rateLimiter: Middleware = async (tool, input, ctx, next) => {
  const config = ctx.config?.mcp?.rateLimit;
  if (!config?.enabled) return next(input);

  const maxPerMinute = config.maxPerMinute ?? DEFAULT_RATE;
  const key = ctx.workspacePath;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: DEFAULT_BURST, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens
  const elapsed = now - bucket.lastRefill;
  const refillAmount = (elapsed / WINDOW_MS) * maxPerMinute;
  bucket.tokens = Math.min(DEFAULT_BURST, bucket.tokens + refillAmount);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return err("Rate limit exceeded. Please wait before making more requests.");
  }

  bucket.tokens -= 1;
  return next(input);
};
