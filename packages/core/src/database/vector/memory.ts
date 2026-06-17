import type { VectorIndex, VectorSearchResult } from "./index.js";

/**
 * In-memory brute-force cosine similarity vector index.
 *
 * Suitable for prototyping and small workspaces (< 10K chunks).
 * Zero external dependencies.
 */
export class MemoryVectorIndex implements VectorIndex {
  private vectors: Array<{
    id: string;
    embedding: Float32Array;
    metadata?: Record<string, unknown>;
  }> = [];

  async add(
    vectors: Float32Array[],
    ids: string[],
    metadata?: Record<string, unknown>[],
  ): Promise<void> {
    for (let i = 0; i < vectors.length; i++) {
      this.vectors.push({
        id: ids[i],
        embedding: vectors[i],
        metadata: metadata?.[i],
      });
    }
  }

  async search(
    query: Float32Array,
    k: number,
    filter?: { field: string; value: string | number },
  ): Promise<VectorSearchResult[]> {
    const candidates = this.vectors.filter((v) => {
      if (!filter) return true;
      return v.metadata?.[filter.field] === filter.value;
    });

    const scored = candidates.map((v) => ({
      id: v.id,
      score: cosineSimilarity(query, v.embedding),
      metadata: v.metadata,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  async delete(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    this.vectors = this.vectors.filter((v) => !idSet.has(v.id));
  }

  async count(): Promise<number> {
    return this.vectors.length;
  }

  async close(): Promise<void> {
    this.vectors = [];
  }
}

/** Compute cosine similarity between two vectors */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
