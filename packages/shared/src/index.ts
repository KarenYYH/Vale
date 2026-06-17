/**
 * @vale/shared
 *
 * Shared types, constants, configuration schema, and utilities
 * used by all other Vale packages.
 */

// ── Constants ──
export {
  APP_NAME,
  LAYER_WIKI,
  LAYER_RAW,
  LAYER_ZETTEL,
  LAYER_PROJECTS,
  LAYERS,
  LAYER_PRIORITY,
  VALE_DIR,
  SCHEMA_DIR,
  SKILLS_DIR,
  VECTORS_DIR,
  CONVERSATIONS_DIR,
  CONFIG_FILE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  MAX_CONTEXT_FILES,
  MAX_CONTEXT_CHARS,
  MAX_CHUNK_CHARS,
  DEFAULT_EMBED_BATCH_SIZE,
  DEFAULT_INGEST_CONCURRENCY,
  SUPPORTED_EXTENSIONS,
} from "./constants.js";
export type { Layer, SupportedExtension } from "./constants.js";

// ── Types ──
export type {
  FileInfo,
  TreeNode,
  WorkspaceInfo,
  IndexEntry,
  EmbeddingRow,
  FtsSearchResult,
  SearchMatch,
  SemanticSearchResult,
  HybridSearchResult,
  ContextFile,
  QueryResult,
  SearchMode,
  HybridSearchOptions,
  IngestResult,
  ParsedDocument,
  DocumentParser,
  ParserOptions,
  ParserRegistry,
  IngestProgress,
  IngestPriority,
  JobStatus,
  WikiLink,
  LinkIndex,
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  LintIssue,
  LintReport,
  LintRule,
  NoteInfo,
  SkillType,
  SkillExecutionMode,
  SkillAuthor,
  SkillToolDefinition,
  SkillConfigParam,
  SkillManifest,
  InstalledSkill,
  SkillListing,
  SkillSearchResult,
  ValeMcpContext,
  CallToolResult,
  ValePermission,
  McpTransportMode,
  ValeConfig,
  PartialValeConfig,
  WorkspaceConfig,
  IngestConfig,
  VectorConfig,
  VectorBackend,
  SearchConfig,
  GraphConfig,
  LintConfig,
  McpConfig,
  SkillsConfig,
  EmbeddingConfig,
} from "./types/index.js";

// ── MCP helpers ──
export { ok, err, HIGH_RISK_PERMISSIONS, isHighRisk } from "./types/mcp.js";

// ── Frontmatter ──
export { parseFrontmatter, extractTitle, hasFrontmatter } from "./frontmatter/parser.js";

// ── Config ──
export {
  valeConfigSchema,
  DEFAULT_CONFIG,
  mergeConfig,
  loadConfig,
} from "./config/index.js";
export type { ValeConfigParsed } from "./config/index.js";
