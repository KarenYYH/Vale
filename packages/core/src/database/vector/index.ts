/**
 * VectorIndex — pluggable vector search backend.
 *
 * Implementations:
 *   - memory: In-memory brute-force cosine similarity (zero deps, for prototyping)
 *   - sqlite:  SQLite BLOB + optional HNSW via hnswlib-node
 *   - lancedb: LanceDB embedded vector DB (production, IVF_PQ indexed)
 */

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorIndex {
  /** Add vectors with IDs and optional metadata */
  add(
    vectors: Float32Array[],
    ids: string[],
    metadata?: Record<string, unknown>[],
  ): Promise<void>;

  /** Search for k nearest neighbors */
  search(
    query: Float32Array,
    k: number,
    filter?: { field: string; value: string | number },
  ): Promise<VectorSearchResult[]>;

  /** Delete vectors by ID prefix (e.g., remove all chunks for a file) */
  delete(ids: string[]): Promise<void>;

  /** Total vector count */
  count(): Promise<number>;

  /** Release resources */
  close(): Promise<void>;
}

/** Backend type for factory */
export type VectorBackend = "memory" | "sqlite" | "lancedb";

/** Create a vector index instance */
export async function createVectorIndex(
  backend: VectorBackend,
  workspacePath: string,
): Promise<VectorIndex> {
  switch (backend) {
    case "memory":
      return createMemoryVectorIndex();
    case "sqlite":
      return createSqliteVectorIndex(workspacePath);
    case "lancedb":
      return createLanceDbVectorIndex(workspacePath);
    default:
      return createMemoryVectorIndex();
  }
}

// ── Memory backend (brute-force) ──

async function createMemoryVectorIndex(): Promise<VectorIndex> {
  const { MemoryVectorIndex } = await import("./memory.js");
  return new MemoryVectorIndex();
}

// ── SQLite backend (BLOB + brute-force, hnsw optional) ──

async function createSqliteVectorIndex(
  workspacePath: string,
): Promise<VectorIndex> {
  const { SqliteVectorIndex } = await import("./sqlite.js");
  return new SqliteVectorIndex(workspacePath);
}

// ── LanceDB backend (IVF_PQ indexed) ──

async function createLanceDbVectorIndex(
  workspacePath: string,
): Promise<VectorIndex> {
  const { LanceDbVectorIndex } = await import("./lancedb.js");
  return new LanceDbVectorIndex(workspacePath);
}
