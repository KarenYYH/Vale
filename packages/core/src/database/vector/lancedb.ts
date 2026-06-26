import type { VectorIndex, VectorSearchResult } from "./index.js";

/**
 * LanceDB-backed vector index.
 *
 * LanceDB is an embedded columnar vector database with IVF_PQ indexing for
 * sub-5ms ANN search over 100K+ vectors. Native LanceDB integration is not
 * yet wired; when the optional `@lancedb/lancedb` dependency is absent (or
 * until integration lands) this falls back to the SQLite-backed index, which
 * reads the persisted embeddings table and performs brute-force cosine search.
 * (The fallback must NOT be the in-memory index — that is never populated and
 * would always return empty results.)
 */
export class LanceDbVectorIndex implements VectorIndex {
  private workspacePath: string;
  private fallback: VectorIndex | null = null;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  private async getBackend(): Promise<VectorIndex> {
    if (this.fallback) return this.fallback;
    // Native LanceDB integration is deferred; use the SQLite store, which is
    // backed by the real persisted embeddings.
    const { SqliteVectorIndex } = await import("./sqlite.js");
    this.fallback = new SqliteVectorIndex(this.workspacePath);
    return this.fallback;
  }

  async add(
    vectors: Float32Array[],
    ids: string[],
    metadata?: Record<string, unknown>[],
  ): Promise<void> {
    const backend = await this.getBackend();
    return backend.add(vectors, ids, metadata);
  }

  async search(
    query: Float32Array,
    k: number,
    filter?: { field: string; value: string | number },
  ): Promise<VectorSearchResult[]> {
    const backend = await this.getBackend();
    return backend.search(query, k, filter);
  }

  async delete(ids: string[]): Promise<void> {
    const backend = await this.getBackend();
    return backend.delete(ids);
  }

  async count(): Promise<number> {
    const backend = await this.getBackend();
    return backend.count();
  }

  async close(): Promise<void> {
    if (this.fallback) await this.fallback.close();
  }
}
