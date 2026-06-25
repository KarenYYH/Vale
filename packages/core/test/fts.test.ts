import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchFts, indexContent, closeDb } from "../src/index.js";

// C6: snippet() must extract from the `content` column (index 2), not
// `file_name` (index 1). A search hit's snippet should show matching body
// text, not the file name.

let workspacePath: string;

beforeAll(async () => {
  workspacePath = await mkdtemp(join(tmpdir(), "vale-fts-"));
  await mkdir(join(workspacePath, ".vale"), { recursive: true });
  indexContent(
    workspacePath,
    "notes/attention.md",
    "The transformer architecture relies on a mechanism called self-attention " +
      "to weigh the importance of different tokens in a sequence.",
  );
});

afterAll(async () => {
  closeDb(workspacePath);
  await rm(workspacePath, { recursive: true, force: true });
});

describe("searchFts snippet column (C6)", () => {
  test("snippet contains matching body text, not the file name", () => {
    const results = searchFts(workspacePath, "self-attention mechanism", 10);
    expect(results.length).toBeGreaterThan(0);
    const snippet = results[0].content;
    // Body keyword present:
    expect(snippet.toLowerCase()).toContain("attention");
    // Not merely echoing the file name:
    expect(snippet).not.toBe("attention.md");
    expect(snippet).not.toBe("notes/attention.md");
  });

  test("matched term is highlighted from the content", () => {
    const results = searchFts(workspacePath, "transformer", 10);
    expect(results.length).toBeGreaterThan(0);
    // The highlight markers (**…**) should wrap a content word.
    expect(results[0].content).toMatch(/\*\*/);
  });
});
