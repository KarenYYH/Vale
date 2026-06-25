import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repairWorkspace } from "../src/index.js";

// doctor --fix: repairWorkspace recreates missing standard directories and the
// default config WITHOUT overwriting existing content.

let ws: string;

beforeEach(async () => {
  ws = await mkdtemp(join(tmpdir(), "vale-repair-"));
});

afterEach(async () => {
  await rm(ws, { recursive: true, force: true });
});

async function exists(p: string): Promise<boolean> {
  try {
    await stat(join(ws, p));
    return true;
  } catch {
    return false;
  }
}

describe("repairWorkspace", () => {
  test("creates missing standard directories and config on a bare workspace", async () => {
    const result = await repairWorkspace(ws);
    expect(await exists(".vale/config.json")).toBe(true);
    expect(await exists("wiki/concepts")).toBe(true);
    expect(await exists("raw/documents")).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
  });

  test("does not overwrite an existing config file", async () => {
    await mkdir(join(ws, ".vale"), { recursive: true });
    await writeFile(join(ws, ".vale", "config.json"), '{"custom":true}', "utf-8");

    await repairWorkspace(ws);

    const content = await readFile(join(ws, ".vale", "config.json"), "utf-8");
    expect(content).toContain('"custom"');
  });

  test("is idempotent — a healthy workspace reports nothing newly created", async () => {
    await repairWorkspace(ws);
    const second = await repairWorkspace(ws);
    // Second run should create no new files (all already present).
    expect(second.created.length).toBe(0);
  });
});
