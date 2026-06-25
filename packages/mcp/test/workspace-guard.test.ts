import { describe, test, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { workspaceGuard } from "../src/middleware/workspace-guard.js";
import type { ToolDefinition } from "../src/tools/types.js";

// I6: workspace-guard declared an `allowedTools` list (e.g. get_schema may run
// during init) but never used it — so EVERY tool was blocked on an
// uninitialized workspace, including the ones meant to be allowed.

function tool(name: string): ToolDefinition {
  return {
    name,
    description: "t",
    inputSchema: {},
    handler: async () => ({ content: [{ type: "text", text: "ran" }] }),
  };
}

describe("workspaceGuard allowlist (I6)", () => {
  test("blocks a normal tool on an uninitialized workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vale-guard-"));
    const ctx = { workspacePath: dir } as never;
    const res = await workspaceGuard(tool("search_wiki"), {}, ctx, async () => ({
      content: [{ type: "text", text: "HANDLER RAN" }],
    }));
    expect(res.isError).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  test("allows get_schema to run even on an uninitialized workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vale-guard-"));
    const ctx = { workspacePath: dir } as never;
    let ran = false;
    const res = await workspaceGuard(tool("get_schema"), {}, ctx, async () => {
      ran = true;
      return { content: [{ type: "text", text: "ok" }] };
    });
    expect(ran).toBe(true);
    expect(res.isError).toBeUndefined();
    await rm(dir, { recursive: true, force: true });
  });
});
