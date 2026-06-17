# API 参考

> 面向开发者的核心 API 接口

## @vale/core

知识引擎。所有函数均为纯 Node.js，零 Electron/浏览器依赖。

### Database — 连接与 CRUD

```typescript
import {
  getDb, closeDb, closeAllDbs, hasDb,
  upsertEntry, findEntry, findEntriesByExtension,
  removeEntry, listEntries, countEntries,
} from "@vale/core";
```

| 函数 | 签名 | 说明 |
|------|------|------|
| `getDb` | `(workspacePath: string) => Database` | 获取或创建 SQLite 连接（连接池） |
| `closeDb` | `(workspacePath: string) => void` | 关闭指定工作区连接 |
| `closeAllDbs` | `() => void` | 关闭所有连接 |
| `upsertEntry` | `(ws, entry: IndexEntry) => void` | 插入或更新文件索引 |
| `findEntry` | `(ws, filePath: string) => IndexEntry \| undefined` | 按路径查找 |
| `removeEntry` | `(ws, filePath: string) => void` | 删除条目及 FTS 索引 |
| `listEntries` | `(ws) => IndexEntry[]` | 列出所有条目 |
| `countEntries` | `(ws) => number` | 计数 |

### FTS5 — 全文检索

```typescript
import { searchFts, indexContent, removeContent } from "@vale/core";
```

| 函数 | 签名 | 说明 |
|------|------|------|
| `searchFts` | `(ws, query: string, limit?: number) => FtsSearchResult[]` | FTS5 全文搜索，失败时自动降级 LIKE |
| `indexContent` | `(ws, filePath: string, content: string) => void` | 索引文件内容 |
| `removeContent` | `(ws, filePath: string) => void` | 移除文件索引 |

```typescript
// FtsSearchResult
interface FtsSearchResult {
  filePath: string;
  line: number;
  content: string;   // 含 <mark> 高亮标记
  score: number;     // 0-100
}
```

### Embedding — 向量存取

```typescript
import {
  upsertEmbedding, removeEmbeddings,
  getAllEmbeddings, countEmbeddings,
} from "@vale/core";
```

| 函数 | 说明 |
|------|------|
| `upsertEmbedding` | 存储一个 chunk 的向量（BLOB） |
| `removeEmbeddings` | 移除某文件的所有向量 |
| `getAllEmbeddings` | 全量加载（⚠️ 仅小工作区用） |
| `countEmbeddings` | 计数 |

### VectorIndex — 可插拔向量索引

```typescript
import { createVectorIndex, MemoryVectorIndex, cosineSimilarity } from "@vale/core";
```

```typescript
interface VectorIndex {
  add(vectors: Float32Array[], ids: string[], metadata?: Record<string, unknown>[]): Promise<void>;
  search(query: Float32Array, k: number, filter?): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
  count(): Promise<number>;
  close(): Promise<void>;
}

interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}
```

**工厂函数**:
```typescript
const index = await createVectorIndex("memory", workspacePath);
// "memory" | "sqlite" | "lancedb"
```

### Security — 路径安全

```typescript
import { resolveSafePath, resolveRealSafePath } from "@vale/core";
```

| 函数 | 说明 |
|------|------|
| `resolveSafePath(workspace, userPath)` | 校验路径在工作区内，防 `../` 遍历 |
| `resolveRealSafePath(workspace, userPath)` | 额外解析符号链接再校验，防 symlink 逃逸 |

两个函数在校验失败时均抛出 `Error`。

### Ingest — 文件导入

```typescript
import { ingestFile, ingestDirectory, parserRegistry } from "@vale/core";
```

| 函数 | 签名 | 说明 |
|------|------|------|
| `ingestFile` | `(ws, filePath) => Promise<IngestResult>` | 单个文件 4 步管线 |
| `ingestDirectory` | `(ws, dirPath) => Promise<IngestResult[]>` | 目录递归导入 |

```typescript
interface IngestResult {
  filePath: string;
  success: boolean;
  wikiPath?: string;
  error?: string;
}
```

### Parser Registry — 解析器注册

```typescript
import { parserRegistry } from "@vale/core";

// 注册自定义解析器
parserRegistry.register(".rst", async (filePath) => {
  // 解析 RST 文件，返回 ParsedDocument
  return { frontmatter: {}, body: "...", title: "...", rawSize: 0, checksum: "..." };
});

// 查询
parserRegistry.get(".rst");          // DocumentParser | undefined
parserRegistry.supportedExtensions(); // [".md", ".txt", ...]
```

### Linker — 链接分析

```typescript
import {
  parseLinks, buildLinkIndex,
  findOrphanedPages, findBrokenLinks,
  buildGraph, IncrementalLinkCache, linkCache,
} from "@vale/core";
```

| 函数 | 说明 |
|------|------|
| `parseLinks(filePath, content)` | 从文件内容提取 `[[wikilink]]` |
| `buildLinkIndex(ws)` | 构建全工作区双向链接索引 |
| `findOrphanedPages(linkIndex)` | 查找零入链页面 |
| `findBrokenLinks(linkIndex)` | 查找指向不存在页面的链接 |
| `buildGraph(linkIndex)` | 转换为知识图谱（nodes + edges） |

**增量缓存**:
```typescript
const cache = new IncrementalLinkCache();
const index = await cache.getLinkIndex(workspacePath);  // 首次全量，后续增量
cache.invalidate("zettel/some-file.md");                // 标记脏页
cache.invalidateAll();                                  // 强制重建
```

### Query — 检索

```typescript
import {
  runQuery, saveAnswer, searchWorkspace,
  searchHybrid, searchSemantic, buildContext,
} from "@vale/core";
```

| 函数 | 说明 |
|------|------|
| `runQuery(ws, question)` | 结构化查询：搜索 + 上下文组装 |
| `searchHybrid(ws, query, options?)` | RRF 混合检索（推荐） |
| `searchSemantic(ws, query, ...)` | 纯向量语义搜索 |
| `searchWorkspace(ws, query)` | 快捷搜索（默认 hybrid） |
| `saveAnswer(ws, question, answer)` | 保存 AI 回答到 wiki/answers/ |
| `buildContext(ws, matches, options?)` | 组装上下文字符串 |

```typescript
interface HybridSearchOptions {
  ftsWeight?: number;     // default 0.5
  vectorWeight?: number;  // default 0.5
  rrfConstant?: number;   // default 60
  limit?: number;         // default 20
  maxCandidates?: number; // default 200
}
```

### Lint — 质量检查

```typescript
import { runLint, formatLintReport } from "@vale/core";
```

| 函数 | 说明 |
|------|------|
| `runLint(ws, rules?)` | 运行质量规则（不传则全部） |
| `formatLintReport(report)` | 格式化为 Markdown |

### Scaffold — 工作区初始化

```typescript
import { initializeWorkspace, isWorkspaceInitialized } from "@vale/core";
```

| 函数 | 签名 |
|------|------|
| `initializeWorkspace` | `(path, name?) => Promise<ScaffoldResult>` |
| `isWorkspaceInitialized` | `(path) => Promise<boolean>` |

---

## @vale/mcp

### 创建 MCP Server

```typescript
import { createValeMcpServer } from "@vale/mcp";

const server = createValeMcpServer("/path/to/workspace", config);

// 工具列表
server.tools; // ToolDefinition[]

// 执行工具
const result = await server.executeTool("search_hybrid", { query: "test" }, ctx);
```

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;  // Zod schema
  handler: (input: Record<string, unknown>, ctx: ValeMcpContext) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
    _meta?: Record<string, unknown>;
  }>;
}
```

---

## @vale/skills

### 加载和查找

```typescript
import {
  initSkills,
  getInstalledSkills,
  findSkill,
  loadSkillFromPath,
  executeSkill,
} from "@vale/skills";

// 初始化
await initSkills(workspacePath);

// 查找
const skill = findSkill("hello-knowledge");
if (skill) {
  const result = await executeSkill(skill, { topic: "AI" }, workspacePath);
  console.log(result.output);
}
```

### 市场客户端

```typescript
import { MarketplaceClient } from "@vale/skills";

const client = new MarketplaceClient({ baseUrl: "https://skills.vale.sh/api/v1" });

// 搜索
const { skills, total } = await client.search("pdf", { type: "ingest" });

// 热门
const popular = await client.popularSkills(10);

// 下载
const url = await client.getDownloadUrl("ingest-pdf", "2.0.0");
```

---

## @vale/shared

### Frontmatter 解析

```typescript
import { parseFrontmatter, extractTitle, hasFrontmatter } from "@vale/shared";

const { frontmatter, body } = parseFrontmatter(content);
// frontmatter: Record<string, unknown>
// body: string（去除 frontmatter 的主体）

const title = extractTitle(frontmatter, body, filename);
// 优先级: frontmatter.title > body 中的 # heading > filename
```

### 配置校验

```typescript
import { valeConfigSchema, mergeConfig, DEFAULT_CONFIG } from "@vale/shared";

// 严格校验
const config = valeConfigSchema.parse(jsonData);

// 合并默认值
const merged = mergeConfig(DEFAULT_CONFIG, userPartial);
```

### MCP 工具辅助函数

```typescript
import { ok, err, isHighRisk, HIGH_RISK_PERMISSIONS } from "@vale/shared";

return ok("Success message", { key: "value" });
return err("Error message");

if (isHighRisk(["write:wiki", "network"])) {
  // trigger confirmation dialog
}
```

### 常量

```typescript
import {
  APP_NAME,                     // "Vale"
  LAYER_WIKI, LAYER_RAW,       // "wiki", "raw"
  LAYER_ZETTEL,                // "zettel"
  LAYERS,                      // ["zettel", "wiki", "raw"]
  LAYER_PRIORITY,              // { zettel: 3, wiki: 2, raw: 1 }
  VALE_DIR,                    // ".vale"
  MAX_SEARCH_LIMIT,            // 50
  MAX_CONTEXT_FILES,           // 5
  MAX_CONTEXT_CHARS,           // 12000
  DEFAULT_EMBED_BATCH_SIZE,    // 32
} from "@vale/shared";
```
