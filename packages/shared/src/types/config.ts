/**
 * Vale workspace configuration types.
 *
 * These are the TypeScript interfaces corresponding to the vale.config.json schema.
 * The Zod validation schemas are in ./schema.ts.
 */

// ── Workspace section ──

export interface WorkspaceLayersConfig {
  wiki?: string;
  raw?: string;
  zettel?: string;
  projects?: string;
}

export interface WorkspaceConfig {
  name: string;
  layers?: WorkspaceLayersConfig;
  ignore?: string[];
}

// ── Ingest section ──

export interface WatcherConfig {
  enabled: boolean;
  paths: string[];
  stabilityThreshold: number;
}

export interface IngestConfig {
  concurrency: number;
  supportedExtensions: string[];
  autoEmbed: boolean;
  embedBatchSize: number;
  watcher: WatcherConfig;
}

// ── Vector section ──

export type VectorBackend = "lancedb" | "sqlite" | "memory";

export interface VectorConfig {
  backend: VectorBackend;
  model: string;
  dimension: number;
  indexType?: string;
  metric?: "cosine" | "euclidean" | "dot";
  nProbes?: number;
}

// ── Search section ──

export interface HybridConfig {
  ftsWeight: number;
  vectorWeight: number;
  rrfConstant: number;
  maxCandidates: number;
}

export interface ContextConfig {
  maxFiles: number;
  maxChars: number;
  layerPriority: string[];
}

export interface SearchConfig {
  defaultMode: "fts" | "semantic" | "hybrid";
  hybrid: HybridConfig;
  context: ContextConfig;
}

// ── Graph section ──

export interface GraphConfig {
  cacheEnabled: boolean;
  incrementalUpdates: boolean;
  maxNodes: number;
}

// ── Lint section ──

export interface LintRuleConfig {
  severity: "error" | "warning" | "info";
  ignorePatterns?: string[];
  requiredFields?: string[];
}

export interface LintConfig {
  enabledRules: string[];
  brokenLinks?: LintRuleConfig;
  orphans?: LintRuleConfig;
  frontmatter?: LintRuleConfig;
  tags?: LintRuleConfig;
}

// ── MCP section ──

export interface HttpConfig {
  port: number;
  host: string;
}

export interface RateLimitConfig {
  enabled: boolean;
  maxPerMinute: number;
}

export interface McpConfig {
  transport: "stdio" | "http";
  http: HttpConfig;
  allowedTools: string[];
  rateLimit: RateLimitConfig;
}

// ── Skills section ──

export interface SkillsConfig {
  registry: string;
  autoUpdate: boolean;
  allowedPermissions: string[];
}

// ── Embedding section ──

export interface EmbeddingConfig {
  provider: "local" | "api";
  localModel: string;
  cacheDir: string;
  apiEndpoint?: string;
  apiModel?: string;
  fallbackToLocal: boolean;
}

// ── Root config ──

export interface ValeConfig {
  /** Schema version for forward compatibility */
  version: string;
  /** Workspace identity */
  workspace: WorkspaceConfig;
  /** Ingest pipeline settings */
  ingest: IngestConfig;
  /** Vector database settings */
  vector: VectorConfig;
  /** Search and retrieval settings */
  search: SearchConfig;
  /** Knowledge graph settings */
  graph: GraphConfig;
  /** Lint rules configuration */
  lint: LintConfig;
  /** MCP server settings */
  mcp: McpConfig;
  /** Skill marketplace settings */
  skills: SkillsConfig;
  /** Embedding model settings */
  embedding: EmbeddingConfig;
}

/** Partial config — used when loading from files (may be incomplete) */
export type PartialValeConfig = DeepPartial<ValeConfig>;

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;
