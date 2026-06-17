import type { VectorIndex, VectorSearchResult } from "./index.js";
import { getAllEmbeddings } from "../embeddingStore.js";
import { cosineSimilarity } from "./memory.js";

/**
 * SQLite-backed vector index.
 *
 * Stores embeddings as BLOBs in the SQLite embeddings table.
 * Search is brute-force cosine similarity over all embeddings.
 *
 * For production at scale, prefer the LanceDB backend.
 * Optionally wraps hnswlib-node for in-process ANN.
 */
export class SqliteVectorIndex implements VectorIndex {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async add(
    _vectors: Float32Array[],
    _ids: string[],
    _metadata?: Record<string, unknown>[],
  ): Promise<void> {
    // Embeddings are already stored via embeddingStore.upsertEmbedding()
    // This backend reads from the existing SQLite table.
    // For direct writes, use embeddingStore directly.
  }

  async search(
    query: Float32Array,
    k: number,
    filter?: { field: string; value: string | number },
  ): Promise<VectorSearchResult[]> {
    const all = getAllEmbeddings(this.workspacePath);

    const candidates = all
      .filter((row) => {
        if (!filter) return true;
        if (filter.field === "filePath") return row.filePath === filter.value;
        return true;
      })
      .map((row) => ({
        id: `${row.filePath}::${row.chunkIndex}`,
        score: cosineSimilarity(query, row.embedding),
        metadata: {
          filePath: row.filePath,
          chunkIndex: row.chunkIndex,
          chunkText: row.chunkText,
          model: row.model,
        },
      }));

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, k);
  }

  async delete(_ids: string[]): Promise<void> {
    // Deletion is handled by embeddingStore.removeEmbeddings()
  }

  async count(): Promise<number> {
    const { countEmbeddings } = await import("../embeddingStore.js");
    return countEmbeddings(this.workspacePath);
  }

  async close(): Promise<void> {
    // No persistent state to release
  }
}
