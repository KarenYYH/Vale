export { getDb, closeDb, closeAllDbs, hasDb } from "./connection.js";
export { runMigrations } from "./migrations.js";
export {
  upsertEntry,
  findEntry,
  findEntriesByExtension,
  removeEntry,
  listEntries,
  countEntries,
} from "./entries.js";
export {
  searchFts,
  indexContent,
  removeContent,
} from "./fts.js";
export {
  upsertEmbedding,
  removeEmbeddings,
  getAllEmbeddings,
  countEmbeddings,
} from "./embeddingStore.js";
export {
  createVectorIndex,
  type VectorIndex,
  type VectorSearchResult,
  type VectorBackend,
} from "./vector/index.js";
export { MemoryVectorIndex, cosineSimilarity } from "./vector/memory.js";
