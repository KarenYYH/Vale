import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ingestFile,
  searchFts,
  searchSemantic,
  countEmbeddings,
  closeDb,
} from "../src/index.js";
import type { EmbeddingClient } from "../src/embedding/client.js";

// End-to-end: a real Markdown file ingested through the full pipeline
// (parse → write wiki → index FTS → embed) must be findable by BOTH
// full-text and semantic search. Only the embedding *model* is faked (via
// dependency injection) — the parser, FTS5, chunker, embedding store, SQLite
// vector backend, and search code are all exercised for real.

// Deterministic embedder: vector dimensions track presence of marker words,
// so a query sharing words with a chunk scores high.
const AXES = ["transformer", "attention", "garden", "tomato"];
function embed(text: string): number[] {
  const lower = text.toLowerCase();
  const v = AXES.map((w) => (lower.includes(w) ? 1 : 0));
  // Avoid all-zero vectors (cosine undefined): add a small constant axis.
  return [...v, 0.01];
}
const fakeClient: EmbeddingClient = {
  async generateEmbedding(t) {
    return embed(t);
  },
  async generateEmbeddings(texts) {
    return texts.map(embed);
  },
};

let ws: string;

beforeEach(async () => {
  ws = await mkdtemp(join(tmpdir(), "vale-e2e-"));
  await mkdir(join(ws, ".vale"), { recursive: true });
  await mkdir(join(ws, "raw"), { recursive: true });
});

afterEach(async () => {
  closeDb(ws);
  await rm(ws, { recursive: true, force: true });
});

describe("ingest → embed → search end-to-end", () => {
  test("ingested file is found by full-text search", async () => {
    const file = join(ws, "raw", "ml.md");
    await writeFile(
      file,
      "# Transformers\n\nThe transformer architecture uses self-attention.\n",
      "utf-8",
    );

    const result = await ingestFile(ws, file, { client: fakeClient });
    expect(result.success).toBe(true);

    const hits = searchFts(ws, "attention", 10);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].content.toLowerCase()).toContain("attention");
  });

  test("ingested file produces embeddings that semantic search retrieves", async () => {
    const mlFile = join(ws, "raw", "ml.md");
    const gardenFile = join(ws, "raw", "garden.md");
    await writeFile(
      mlFile,
      "# Transformers\n\nThe transformer architecture relies on attention.\n",
      "utf-8",
    );
    await writeFile(
      gardenFile,
      "# Gardening\n\nGrowing tomato plants in a home garden.\n",
      "utf-8",
    );

    // Inject the fake embedding client so the embed step is deterministic and
    // awaited (rather than fire-and-forget with the real model).
    expect((await ingestFile(ws, mlFile, { client: fakeClient })).success).toBe(true);
    expect((await ingestFile(ws, gardenFile, { client: fakeClient })).success).toBe(true);

    // Embeddings were actually written to the store during ingest.
    expect(countEmbeddings(ws)).toBeGreaterThan(0);

    const results = await searchSemantic(
      ws,
      "attention transformer",
      undefined,
      undefined,
      undefined,
      5,
      { client: fakeClient },
    );
    expect(results.length).toBeGreaterThan(0);
    // The ML note must outrank the gardening note.
    expect(results[0].filePath).toBe(mlFile);
  });
});
