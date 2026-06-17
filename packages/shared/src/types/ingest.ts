import type { SupportedExtension } from "../constants.js";

/** Result of ingesting a single file */
export interface IngestResult {
  filePath: string;
  success: boolean;
  wikiPath?: string;
  error?: string;
}

/** Parsed document from any supported format */
export interface ParsedDocument {
  frontmatter: Record<string, unknown>;
  body: string;
  title: string;
  rawSize: number;
  checksum: string;
}

/** Parser function signature */
export type DocumentParser = (
  filePath: string,
  options?: ParserOptions,
) => Promise<ParsedDocument>;

/** Options passed to parsers */
export interface ParserOptions {
  workspacePath?: string;
  encoding?: BufferEncoding;
}

/** Parser registry interface */
export interface ParserRegistry {
  register(extension: string, parser: DocumentParser): void;
  get(extension: string): DocumentParser | undefined;
  supportedExtensions(): string[];
  remove(extension: string): void;
}

/** Progress of an ingest queue */
export interface IngestProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: { filePath: string; status: string }[];
}

/** Ingest queue job priority */
export type IngestPriority = "high" | "normal" | "low";

/** Job status in the ingest queue */
export type JobStatus = "queued" | "parsing" | "writing" | "embedding" | "done" | "error";
