import type { SemanticSearchResult } from "@vale/shared";
import { createVectorIndex } from "../database/vector/index.js";
import { getAllEmbeddings } from "../database/embeddingStore.js";
import { createEmbeddingClient, type EmbeddingClientOptions } from "../embedding/client.js";
import { cosineSimilarity } from "../database/vector/memory.js";

/**
 * Semantic (vector) search.
 *
 * For large workspaces (>10K chunks), install LanceDB for ANN search.
 * For small workspaces, uses brute-force cosine similarity over the SQLite embedding store.
 */
export async function searchSemantic(
  workspacePath: string,
  query: string,
  _apiKey?: string,
  _baseUrl?: string,
  _provider?: string,
  limit = 10,
  options?: EmbeddingClientOptions,
): Promise<SemanticSearchResult[]> {
  if (!query.trim()) return [];

  const client = createEmbeddingClient(options);
  const queryEmbedding = await client.generateEmbedding(query);
  if (queryEmbedding.length === 0) return [];

  const queryVec = new Float32Array(queryEmbedding);

  // Try vector index first (handles LanceDB/SQLite/memory backends)
  try {
    const { vectorBackend } = await loadConfig(workspacePath);
    const index = await createVectorIndex(vectorBackend, workspacePath);
    const results = await index.search(queryVec, limit);

    return results.map((r) => ({
      filePath: (r.metadata?.filePath as string) ?? r.id.split("::")[0],
      chunkIndex: (r.metadata?.chunkIndex as number) ?? 0,
      chunkText: (r.metadata?.chunkText as string) ?? r.id,
      score: r.score,
    }));
  } catch {
    // Fall back to brute-force
    const all = getAllEmbeddings(workspacePath);
    const scored = all.map((row) => ({
      filePath: row.filePath,
      chunkIndex: row.chunkIndex,
      chunkText: row.chunkText,
      score: cosineSimilarity(queryVec, row.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
}

/** Lazy-load config to determine vector backend */
async function loadConfig(workspacePath: string): Promise<{
  vectorBackend: "memory" | "sqlite" | "lancedb";
}> {
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const configPath = join(workspacePath, "vale.config.json");
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    return {
      vectorBackend: config?.vector?.backend ?? "memory",
    };
  } catch {
    return { vectorBackend: "memory" };
  }
}
