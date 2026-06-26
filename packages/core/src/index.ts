/**
 * @vale/core
 *
 * The knowledge engine. Pure Node.js, zero UI dependencies.
 *
 * Modules:
 *   - database/ — SQLite, FTS5, embeddings, vector index
 *   - security/ — Path traversal protection
 *   - fs/       — Filesystem utilities and watcher
 *   - scaffold/ — Workspace initialization
 *   - embedding/ — Text chunking and embedding generation
 *   - ingest/   — File parsing and knowledge pipeline
 *   - linker/   — Wikilink parsing, graph, incremental cache
 *   - lint/     — Knowledge quality checks
 *   - query/    — Search (FTS, semantic, hybrid) and context assembly
 */

// ── Database ──
export {
  getDb,
  closeDb,
  closeAllDbs,
  hasDb,
  runMigrations,
  upsertEntry,
  findEntry,
  findEntriesByExtension,
  removeEntry,
  listEntries,
  countEntries,
  searchFts,
  indexContent,
  removeContent,
  upsertEmbedding,
  removeEmbeddings,
  getAllEmbeddings,
  countEmbeddings,
  createVectorIndex,
  MemoryVectorIndex,
  cosineSimilarity,
} from "./database/index.js";
export type {
  VectorIndex,
  VectorSearchResult,
  VectorBackend,
} from "./database/index.js";

// ── Security ──
export { resolveSafePath, resolveRealSafePath } from "./security/path.js";

// ── Filesystem ──
export { readDirRecursive, collectMarkdownFiles } from "./fs/utils.js";
export {
  watchWorkspace,
  stopWatching,
  stopAllWatchers,
} from "./fs/watcher.js";
export type { FileChangeEvent, FileChangeHandler } from "./fs/types.js";

// ── Scaffold ──
export {
  initializeWorkspace,
  isWorkspaceInitialized,
  repairWorkspace,
} from "./scaffold/initializer.js";
export type { ScaffoldResult, FileTemplate } from "./scaffold/initializer.js";

// ── Embedding ──
export { chunkText } from "./embedding/chunker.js";
export { createEmbeddingClient } from "./embedding/client.js";
export type {
  EmbeddingClient,
  EmbeddingClientOptions,
} from "./embedding/client.js";
export { generateAndStoreEmbeddings } from "./embedding/indexer.js";

// ── Ingest ──
export { ingestFile, ingestDirectory } from "./ingest/pipeline.js";
export { parserRegistry } from "./ingest/parsers/registry.js";
export {
  parseMarkdown,
  writeWikiPage,
} from "./ingest/parsers/markdown.js";
export { parseHtml } from "./ingest/parsers/html.js";
export { parsePdf } from "./ingest/parsers/pdf.js";

// ── Linker ──
export { parseLinks, buildLinkIndex, findOrphanedPages, findBrokenLinks } from "./linker/parser.js";
export { buildGraph } from "./linker/graph.js";
export { IncrementalLinkCache, linkCache } from "./linker/cache.js";

// ── Lint ──
export { runLint, formatLintReport } from "./lint/runner.js";

// ── Query ──
export { runQuery, saveAnswer, searchWorkspace } from "./query/engine.js";
export { searchHybrid } from "./query/hybrid.js";
export { searchSemantic } from "./query/semantic.js";
export { buildContext } from "./query/context-builder.js";
