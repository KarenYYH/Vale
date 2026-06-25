import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchSemantic, upsertEmbedding, closeDb } from "../src/index.js";
import type { EmbeddingClient } from "../src/embedding/client.js";

// C5: semantic search must return persisted embeddings BY DEFAULT (no config
// file present). Previously it defaulted to an empty in-memory backend and a
// wrong config path, so search always returned []. We inject a deterministic
// embedding client to avoid the optional @huggingface/transformers dep.

const MODEL = "test-model";

// A tiny deterministic embedder: maps known phrases to fixed unit vectors.
const VECTORS: Record<string, number[]> = {
  cats: [1, 0, 0],
  dogs: [0, 1, 0],
  finance: [0, 0, 1],
};

function vecFor(text: string): number[] {
  const key = Object.keys(VECTORS).find((k) => text.toLowerCase().includes(k));
  return key ? VECTORS[key] : [0.5, 0.5, 0.5];
}

const fakeClient: EmbeddingClient = {
  async generateEmbedding(text) {
    return vecFor(text);
  },
  async generateEmbeddings(texts) {
    return texts.map(vecFor);
  },
};

let workspacePath: string;

beforeAll(async () => {
  workspacePath = await mkdtemp(join(tmpdir(), "vale-sem-"));
  await mkdir(join(workspacePath, ".vale"), { recursive: true });
  // Seed embeddings directly into the SQLite store (as ingest would).
  upsertEmbedding(workspacePath, "notes/cats.md", 0, "all about cats", VECTORS.cats, MODEL);
  upsertEmbedding(workspacePath, "notes/dogs.md", 0, "all about dogs", VECTORS.dogs, MODEL);
  upsertEmbedding(workspacePath, "notes/money.md", 0, "personal finance", VECTORS.finance, MODEL);
});

afterAll(async () => {
  closeDb(workspacePath);
  await rm(workspacePath, { recursive: true, force: true });
});

describe("searchSemantic default behavior (C5)", () => {
  test("returns persisted results with no config file present", async () => {
    const results = await searchSemantic(
      workspacePath,
      "cats",
      undefined,
      undefined,
      undefined,
      5,
      { client: fakeClient },
    );
    expect(results.length).toBeGreaterThan(0);
    // Closest match must be the cats note.
    expect(results[0].filePath).toBe("notes/cats.md");
  });

  test("ranks the semantically nearest chunk first", async () => {
    const results = await searchSemantic(
      workspacePath,
      "dogs",
      undefined,
      undefined,
      undefined,
      5,
      { client: fakeClient },
    );
    expect(results[0].filePath).toBe("notes/dogs.md");
  });

  test("returns chunk text in results", async () => {
    const results = await searchSemantic(
      workspacePath,
      "finance",
      undefined,
      undefined,
      undefined,
      5,
      { client: fakeClient },
    );
    expect(results[0].chunkText).toContain("finance");
  });
});
