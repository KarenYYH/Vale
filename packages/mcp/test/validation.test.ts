import { describe, test, expect } from "vitest";
import { z } from "zod";
import { validateInput } from "../src/middleware/validation.js";
import type { ToolDefinition } from "../src/tools/types.js";

// C4: tool inputSchema is a plain Zod *shape* (Record<string, ZodType>),
// not a ZodType instance. The middleware must still validate it — min/max/
// enum/type constraints must actually reject bad input, not pass through.

function makeTool(inputSchema: Record<string, unknown>): ToolDefinition {
  return {
    name: "test_tool",
    description: "test",
    inputSchema,
    handler: async (input) => ({
      content: [{ type: "text", text: JSON.stringify(input) }],
    }),
  };
}

const ctx = {} as never;

describe("validateInput middleware (C4)", () => {
  const shape = {
    path: z.string().min(1),
    count: z.number().int().min(0).max(10),
    layer: z.enum(["zettel", "wiki", "raw"]),
  };

  test("rejects input violating min-length constraint", async () => {
    const tool = makeTool(shape);
    const res = await validateInput(
      tool,
      { path: "", count: 1, layer: "zettel" },
      ctx,
      async (i) => ({ content: [{ type: "text", text: "HANDLER RAN" }] }),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("path");
  });

  test("rejects input violating enum constraint", async () => {
    const tool = makeTool(shape);
    const res = await validateInput(
      tool,
      { path: "ok.md", count: 1, layer: "INVALID" },
      ctx,
      async () => ({ content: [{ type: "text", text: "HANDLER RAN" }] }),
    );
    expect(res.isError).toBe(true);
  });

  test("rejects input violating numeric max constraint", async () => {
    const tool = makeTool(shape);
    const res = await validateInput(
      tool,
      { path: "ok.md", count: 999, layer: "wiki" },
      ctx,
      async () => ({ content: [{ type: "text", text: "HANDLER RAN" }] }),
    );
    expect(res.isError).toBe(true);
  });

  test("passes valid input through to the handler (with defaults applied)", async () => {
    const tool = makeTool({
      path: z.string().min(1),
      tags: z.array(z.string()).default([]),
    });
    let received: unknown;
    const res = await validateInput(
      tool,
      { path: "ok.md" },
      ctx,
      async (i) => {
        received = i;
        return { content: [{ type: "text", text: "ok" }] };
      },
    );
    expect(res.isError).toBeUndefined();
    expect(received).toEqual({ path: "ok.md", tags: [] });
  });

  test("tool with no inputSchema passes through unchanged", async () => {
    const tool = makeTool({});
    const res = await validateInput(
      tool,
      { anything: true },
      ctx,
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    expect(res.isError).toBeUndefined();
  });
});
