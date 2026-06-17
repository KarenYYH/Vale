/** Application name */
export const APP_NAME = "Vale";

// ── Workspace layers ──
export const LAYER_WIKI = "wiki";
export const LAYER_RAW = "raw";
export const LAYER_ZETTEL = "zettel";
export const LAYER_PROJECTS = "projects";
export const LAYERS = [LAYER_ZETTEL, LAYER_WIKI, LAYER_RAW] as const;
export type Layer = (typeof LAYERS)[number];

/** Layer priority: zettel > wiki > raw (higher = more relevant for context) */
export const LAYER_PRIORITY: Record<Layer, number> = {
  zettel: 3,
  wiki: 2,
  raw: 1,
};

// ── Directories ──
export const VALE_DIR = ".vale";
export const SCHEMA_DIR = ".vale/schema";
export const SKILLS_DIR = ".vale/skills";
export const VECTORS_DIR = ".vale/vectors";
export const CONVERSATIONS_DIR = ".vale/conversations";
export const CONFIG_FILE = "vale.config.json";

// ── Default limits ──
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;
export const MAX_CONTEXT_FILES = 5;
export const MAX_CONTEXT_CHARS = 12_000;
export const MAX_CHUNK_CHARS = 1_500;
export const DEFAULT_EMBED_BATCH_SIZE = 32;
export const DEFAULT_INGEST_CONCURRENCY = 4;

// ── Supported formats ──
export const SUPPORTED_EXTENSIONS = [".md", ".txt", ".html", ".htm", ".pdf"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];
