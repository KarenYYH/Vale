import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LanceDbVectorIndex } from "../src/database/vector/lancedb.js";
import { upsertEmbedding, closeDb } from "../src/index.js";

// LanceDB native dep is optional. When it is absent, the backend must fall
// back to the SQLite store (which reads persisted embeddings) — NOT to an
// empty in-memory index that always returns [] (the C5 failure mode).

let ws: string;

beforeEach(async () => {
  ws = await mkdtemp(join(tmpdir(), "vale-lance-"));
  await mkdir(join(ws, ".vale"), { recursive: true });
  upsertEmbedding(ws, "notes/a.md", 0, "alpha", [1, 0, 0], "m");
  upsertEmbedding(ws, "notes/b.md", 0, "beta", [0, 1, 0], "m");
});

afterEach(async () => {
  closeDb(ws);
  await rm(ws, { recursive: true, force: true });
});

describe("LanceDbVectorIndex fallback", () => {
  test("falls back to the SQLite store and finds persisted embeddings", async () => {
    const index = new LanceDbVectorIndex(ws);
    const results = await index.search(new Float32Array([1, 0, 0]), 5);
    // Must surface the persisted vector closest to the query, not return [].
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toContain("notes/a.md");
    await index.close();
  });

  test("count reflects the persisted embedding store", async () => {
    const index = new LanceDbVectorIndex(ws);
    expect(await index.count()).toBe(2);
    await index.close();
  });
});
