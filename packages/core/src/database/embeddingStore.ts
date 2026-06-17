import type { EmbeddingRow } from "@vale/shared";
import { getDb } from "./connection.js";

/** Store a single embedding chunk */
export function upsertEmbedding(
  workspacePath: string,
  filePath: string,
  chunkIndex: number,
  chunkText: string,
  embedding: number[],
  model: string,
): void {
  const db = getDb(workspacePath);
  const buffer = Buffer.from(new Float32Array(embedding).buffer);
  db.prepare(`
    INSERT INTO embeddings (file_path, chunk_index, chunk_text, embedding, model, generated_at)
    VALUES (@filePath, @chunkIndex, @chunkText, @embedding, @model, @generatedAt)
    ON CONFLICT(file_path, chunk_index) DO UPDATE SET
      chunk_text   = excluded.chunk_text,
      embedding    = excluded.embedding,
      model        = excluded.model,
      generated_at = excluded.generated_at
  `).run({
    filePath,
    chunkIndex,
    chunkText,
    embedding: buffer,
    model,
    generatedAt: Date.now() / 1000,
  });
}

/** Remove all embeddings for a file */
export function removeEmbeddings(workspacePath: string, filePath: string): void {
  const db = getDb(workspacePath);
  db.prepare("DELETE FROM embeddings WHERE file_path = ?").run(filePath);
}

/** Load all embeddings into memory (for brute-force search). Use only for small workspaces. */
export function getAllEmbeddings(workspacePath: string): EmbeddingRow[] {
  const db = getDb(workspacePath);
  const rows = db.prepare(`
    SELECT file_path, chunk_index, chunk_text, embedding, model, generated_at
    FROM embeddings
  `).all() as Array<{
    file_path: string;
    chunk_index: number;
    chunk_text: string;
    embedding: Buffer;
    model: string;
    generated_at: number;
  }>;

  return rows.map((r) => {
    const buf = r.embedding as Buffer;
    return {
      filePath: r.file_path,
      chunkIndex: r.chunk_index,
      chunkText: r.chunk_text,
      embedding: new Float32Array(
        buf.buffer,
        buf.byteOffset,
        buf.length / 4,
      ),
      model: r.model,
      generatedAt: r.generated_at,
    };
  });
}

/** Count total embedding chunks */
export function countEmbeddings(workspacePath: string): number {
  const db = getDb(workspacePath);
  const row = db.prepare("SELECT COUNT(*) as cnt FROM embeddings").get() as {
    cnt: number;
  };
  return row.cnt;
}
