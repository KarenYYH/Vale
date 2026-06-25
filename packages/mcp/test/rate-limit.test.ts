import { describe, test, expect } from "vitest";
import { rateLimiter, __evictIdleBuckets, __bucketCount } from "../src/middleware/rate-limit.js";
import type { ToolDefinition } from "../src/tools/types.js";

// I7: the token-bucket burst was hardcoded to 10 (ignoring config) and the
// per-workspace bucket map grew without bound. Burst must come from config,
// and idle buckets must be evictable.

const tool: ToolDefinition = {
  name: "t",
  description: "t",
  inputSchema: {},
  handler: async () => ({ content: [{ type: "text", text: "ran" }] }),
};

function ctxFor(workspacePath: string, maxPerMinute: number, maxBurst?: number) {
  return {
    workspacePath,
    config: { mcp: { rateLimit: { enabled: true, maxPerMinute, maxBurst } } },
  } as never;
}

async function call(ctx: never) {
  return rateLimiter(tool, {}, ctx, async () => ({
    content: [{ type: "text", text: "ran" }],
  }));
}

describe("rateLimiter (I7)", () => {
  test("burst follows config maxBurst, not a hardcoded 10", async () => {
    const ctx = ctxFor("/ws-burst", 600, 25);
    let allowed = 0;
    for (let i = 0; i < 25; i++) {
      const res = await call(ctx);
      if (!res.isError) allowed++;
    }
    // With a burst of 25 we must allow ~25 immediate calls, not be capped at 10.
    expect(allowed).toBeGreaterThan(10);
  });

  test("rejects once the bucket is exhausted", async () => {
    const ctx = ctxFor("/ws-exhaust", 60, 3);
    const results: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await call(ctx);
      results.push(res.isError === true);
    }
    // 3 allowed, then rate-limit errors appear.
    expect(results.filter((isErr) => isErr).length).toBeGreaterThan(0);
  });

  test("disabled config passes through without limiting", async () => {
    const ctx = { workspacePath: "/ws-off", config: { mcp: { rateLimit: { enabled: false } } } } as never;
    for (let i = 0; i < 50; i++) {
      const res = await call(ctx);
      expect(res.isError).toBeUndefined();
    }
  });

  test("idle buckets can be evicted to bound memory", async () => {
    await call(ctxFor("/ws-evict", 60, 5));
    expect(__bucketCount()).toBeGreaterThan(0);
    // Evict everything idle for >= 0ms (i.e. all).
    __evictIdleBuckets(0);
    expect(__bucketCount()).toBe(0);
  });
});
