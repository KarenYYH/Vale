import type { Layer } from "../constants.js";

/** A single search match (from FTS, vector, or hybrid) */
export interface SearchMatch {
  filePath: string;
  line: number;
  content: string;
  score: number;
}

/** Result from semantic (vector) search */
export interface SemanticSearchResult {
  filePath: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
}

/** Result from hybrid search (FTS + vector fusion) */
export interface HybridSearchResult {
  filePath: string;
  line: number;
  content: string;
  score: number;
  /** Which search method(s) matched this result */
  matchType: "fts" | "vector" | "both";
}

/** A file assembled into the AI context window */
export interface ContextFile {
  filePath: string;
  content: string;
  layer: Layer | "other";
  matchScore: number;
}

/** Structured query result with assembled context */
export interface QueryResult {
  question: string;
  context: string;
  matches: SearchMatch[];
  answerPath?: string;
}

/** Search mode selection */
export type SearchMode = "fts" | "semantic" | "hybrid";

/** Configuration for hybrid search fusion */
export interface HybridSearchOptions {
  ftsWeight?: number;
  vectorWeight?: number;
  rrfConstant?: number;
  limit?: number;
  maxCandidates?: number;
}
