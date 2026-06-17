/** A row in the entries table — file metadata index */
export interface IndexEntry {
  filePath: string;
  fileName: string;
  extension: string;
  size: number;
  modifiedAt: number;
  ingestedAt: number | null;
  wikiPath: string | null;
  checksum: string;
}

/** A row in the embeddings table — one chunk's vector */
export interface EmbeddingRow {
  filePath: string;
  chunkIndex: number;
  chunkText: string;
  embedding: Float32Array;
  model: string;
  generatedAt: number;
}

/** Result from FTS5 full-text search */
export interface FtsSearchResult {
  filePath: string;
  line: number;
  content: string;
  score: number;
}
