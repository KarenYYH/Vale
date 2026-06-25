import { z } from "zod";

// ── Workspace ──

const workspaceLayersSchema = z.object({
  wiki: z.string().default("wiki/"),
  raw: z.string().default("raw/"),
  zettel: z.string().default("zettel/"),
  projects: z.string().default("projects/"),
}).partial().default({});

const workspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required"),
  layers: workspaceLayersSchema,
  ignore: z.array(z.string()).default([".git", "node_modules", ".vale/vectors", ".vale/skills"]),
});

// ── Ingest ──

const watcherSchema = z.object({
  enabled: z.boolean().default(true),
  paths: z.array(z.string()).default(["raw/**/*"]),
  stabilityThreshold: z.number().int().min(0).max(10_000).default(300),
});

const ingestSchema = z.object({
  concurrency: z.number().int().min(1).max(32).default(4),
  supportedExtensions: z.array(z.string()).default([".md", ".txt", ".html", ".pdf"]),
  autoEmbed: z.boolean().default(true),
  embedBatchSize: z.number().int().min(1).max(256).default(32),
  watcher: watcherSchema.default({}),
});

// ── Vector ──

const vectorSchema = z.object({
  backend: z.enum(["lancedb", "sqlite", "memory"]).default("memory"),
  model: z.string().default("Xenova/all-MiniLM-L6-v2"),
  dimension: z.number().int().default(384),
  indexType: z.string().optional(),
  metric: z.enum(["cosine", "euclidean", "dot"]).default("cosine"),
  nProbes: z.number().int().min(1).max(100).default(20),
});

// ── Search ──

const hybridSchema = z.object({
  ftsWeight: z.number().min(0).max(1).default(0.5),
  vectorWeight: z.number().min(0).max(1).default(0.5),
  rrfConstant: z.number().min(1).default(60),
  maxCandidates: z.number().int().min(10).max(1000).default(200),
});

const contextSchema = z.object({
  maxFiles: z.number().int().min(1).max(50).default(5),
  maxChars: z.number().int().min(100).max(100_000).default(12_000),
  layerPriority: z.array(z.string()).default(["zettel", "wiki", "raw"]),
});

const searchSchema = z.object({
  defaultMode: z.enum(["fts", "semantic", "hybrid"]).default("hybrid"),
  hybrid: hybridSchema.default({}),
  context: contextSchema.default({}),
});

// ── Graph ──

const graphSchema = z.object({
  cacheEnabled: z.boolean().default(true),
  incrementalUpdates: z.boolean().default(true),
  maxNodes: z.number().int().min(100).max(1_000_000).default(50_000),
});

// ── Lint ──

const lintRuleConfigSchema = z.object({
  severity: z.enum(["error", "warning", "info"]).default("warning"),
  ignorePatterns: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
}).partial();

const lintSchema = z.object({
  enabledRules: z.array(z.string()).default(["broken-links", "orphans", "frontmatter", "tags"]),
  brokenLinks: lintRuleConfigSchema.default({ severity: "error" }),
  orphans: lintRuleConfigSchema.default({ severity: "warning" }),
  frontmatter: lintRuleConfigSchema.default({ severity: "warning", requiredFields: ["title", "tags"] }),
  tags: lintRuleConfigSchema.default({ severity: "info" }),
});

// ── MCP ──

const httpSchema = z.object({
  port: z.number().int().min(1024).max(65535).default(4567),
  host: z.string().default("127.0.0.1"),
});

const rateLimitSchema = z.object({
  enabled: z.boolean().default(false),
  maxPerMinute: z.number().int().min(1).max(10_000).default(60),
  maxBurst: z.number().int().min(1).max(10_000).optional(),
});

const mcpSchema = z.object({
  transport: z.enum(["stdio", "http"]).default("stdio"),
  http: httpSchema.default({}),
  allowedTools: z.array(z.string()).default(["*"]),
  rateLimit: rateLimitSchema.default({}),
});

// ── Skills ──

const skillsSchema = z.object({
  registry: z.string().url().default("https://skills.vale.sh"),
  autoUpdate: z.boolean().default(true),
  allowedPermissions: z.array(z.string()).default([
    "read:*", "write:wiki", "write:zettel", "ai:query", "ai:ingest",
  ]),
});

// ── Embedding ──

const embeddingSchema = z.object({
  provider: z.enum(["local", "api"]).default("local"),
  localModel: z.string().default("Xenova/all-MiniLM-L6-v2"),
  cacheDir: z.string().default("~/.cache/vale/models"),
  apiEndpoint: z.string().url().optional(),
  apiModel: z.string().optional(),
  fallbackToLocal: z.boolean().default(true),
});

// ── Auth ──

const authSchema = z.object({
  provider: z.enum(["local"]).default("local"),
  jwtSecret: z.string().optional(),      // read from env at runtime if omitted
  sessionTtl: z.string().default("7d"),  // jose duration string
});

// ── Agent (干活引擎) ──

const agentUpdateCheckSchema = z.object({
  enabled: z.boolean().default(true),
  intervalHours: z.number().int().min(1).max(168).default(24),
});

const agentSchema = z.object({
  engine: z.enum(["auto", "claude", "codex", "api", "none"]).default("auto"),
  preferredCli: z.enum(["claude", "codex"]).default("claude"),
  apiEndpoint: z.string().url().optional(),
  apiModel: z.string().optional(),
  keyRef: z.string().optional(),         // reference only — never store key value
  updateCheck: agentUpdateCheckSchema.default({}),
});

// ── Root config schema ──

export const valeConfigSchema = z.object({
  version: z.string().default("2.0"),
  workspace: workspaceSchema.default({ name: "Untitled Workspace" }),
  ingest: ingestSchema.default({}),
  vector: vectorSchema.default({}),
  search: searchSchema.default({}),
  graph: graphSchema.default({}),
  lint: lintSchema.default({}),
  mcp: mcpSchema.default({}),
  skills: skillsSchema.default({}),
  embedding: embeddingSchema.default({}),
  auth: authSchema.default({}),
  agent: agentSchema.default({}),
});

export type ValeConfigParsed = z.infer<typeof valeConfigSchema>;
