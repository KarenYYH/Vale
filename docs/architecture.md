# Vale 架构设计

> 版本: 0.1.0 | 更新: 2026-06-02

## 定位

Vale 是 **AI 知识管理的标准协议层**。不是又一个笔记 App，而是一套 MCP Server + CLI + Skill 市场。

它有两种被使用的方式:
- **借宿主 agent** — 运行在 Claude Code、Codex、Cursor 或任何 MCP 兼容客户端之上(本文档主述)。
- **自带接入面 + 干活引擎** — 部署成 Vale Server,通过 PWA/手机/OA 等接入面被访问;设备上没有宿主 agent 时,由 Server 侧 spawn CLI(claude/codex)或注入模型补上"干活的循环"。详见 [多端场景与架构设计](multi-surface-design.md)(§3.4 干活引擎、§3.5 Agent Provider)。

### 三层产品结构

```
┌──────────────────────────────────────────────┐
│  Layer 3: Vale Cloud（企业版）                │
│  团队知识库同步 · 知识资产治理 · 离职知识留存    │
├──────────────────────────────────────────────┤
│  Layer 2: Vale Skills 市场（主要商业产品）       │
│  知识管理专用 Skill · 工作流模板 · 主动洞察 Agent │
├──────────────────────────────────────────────┤
│  Layer 1: Vale MCP Server（免费，开源）         │
│  四层架构引擎 · FTS5+向量混合检索 · Lint       │
└──────────────────────────────────────────────┘
```

### 四层知识架构

遵循 Karpathy LLM Wiki 模型：

| 层 | 目录 | 内容 | 用途 |
|----|------|------|------|
| **Schema** | `.vale/schema/` | wiki-rules, ingest-protocol, query-protocol, lint-protocol | 知识库治理规则 |
| **Wiki** | `wiki/` | concepts/, summaries/, answers/ | 结构化、精心整理的知识 |
| **Raw** | `raw/` | documents/, clippings/, media/ | 原始导入资料 |
| **Zettel** | `zettel/` | 原子笔记，`[[wikilink]]` 互连 | Zettelkasten 方法 |

---

## Monorepo 包结构

```
vale/
├── packages/
│   ├── shared/       # @vale/shared    类型 · 常量 · 配置 Schema · Frontmatter
│   ├── core/         # @vale/core      知识引擎（零 UI 依赖）
│   ├── mcp/          # @vale/mcp       MCP Server（13 工具 + 中间件）
│   ├── cli/          # @vale/cli       CLI 命令行工具
│   ├── skills/       # @vale/skills    Skill SDK
│   └── web/          # @vale/web       可选 Web Dashboard
```

### 依赖方向（严格无环）

```
@vale/cli ──→ @vale/mcp ──→ @vale/core ──→ @vale/shared
@vale/skills ──→ @vale/core ──→ @vale/shared
@vale/web ──→ @vale/shared
```

---

## @vale/shared — 共享类型层

### 类型模块（9 个 domain）

| 模块 | 核心类型 |
|------|---------|
| `types/fs.ts` | `FileInfo`, `TreeNode`, `WorkspaceInfo` |
| `types/database.ts` | `IndexEntry`, `EmbeddingRow`, `FtsSearchResult` |
| `types/search.ts` | `SearchMatch`, `HybridSearchResult`, `QueryResult`, `HybridSearchOptions` |
| `types/ingest.ts` | `IngestResult`, `ParsedDocument`, `ParserRegistry` |
| `types/graph.ts` | `WikiLink`, `LinkIndex`, `GraphNode`, `KnowledgeGraph` |
| `types/lint.ts` | `LintIssue`, `LintReport`, `LintRule` |
| `types/skill.ts` | `SkillManifest`, `InstalledSkill`, `SkillType`, `SkillListing` |
| `types/mcp.ts` | `ValeMcpContext`, `CallToolResult`, `ValePermission` |
| `types/config.ts` | `ValeConfig` 及所有子配置段 |

### 统一 Frontmatter 解析

```typescript
import { parseFrontmatter, extractTitle } from "@vale/shared";

const { frontmatter, body } = parseFrontmatter(content);
const title = extractTitle(frontmatter, body, filename);
```

### Zod 配置校验

```typescript
import { valeConfigSchema, mergeConfig, DEFAULT_CONFIG } from "@vale/shared";

const config = valeConfigSchema.parse(loadedJson);       // 严格校验
const merged  = mergeConfig(DEFAULT_CONFIG, userPartial);  // 合并默认值
```

---

## @vale/core — 知识引擎

### 模块图

```
@vale/core
├── database/         ← SQLite + FTS5 + Embeddings + VectorIndex
│   ├── connection    连接池（Map<workspace, Database>）
│   ├── migrations    版本化 Schema 迁移
│   ├── entries       Upsert / Find / Remove / List
│   ├── fts           FTS5 全文检索 + LIKE 降级
│   ├── embeddingStore BLOB 向量存取
│   └── vector/       可插拔向量索引
│       ├── memory    暴力余弦（零依赖，原型可用）
│       ├── sqlite    SQLite BLOB + 可选 HNSW
│       └── lancedb   LanceDB IVF_PQ（生产环境，待集成）
│
├── security/
│   └── path          resolveSafePath / resolveRealSafePath（防遍历 + 防符号链接）
│
├── fs/
│   ├── utils         readDirRecursive / collectMarkdownFiles
│   └── watcher       chokidar 文件监听
│
├── scaffold/
│   ├── initializer   工作区初始化（四层目录 + schema 模板）
│   └── templates/    模板内容（CLAUDE.md, wiki-rules, 各协议文件）
│
├── embedding/
│   ├── chunker       段落感知文本切分（CJK+Latin 友好）
│   ├── client        Transformers.js 批量推理 + API 降级
│   └── indexer       chunk → embed → store 编排器
│
├── ingest/
│   ├── pipeline      4 步管线：Parse → Write → Index → Embed
│   ├── parsers/
│   │   ├── registry  可扩展解析器注册表
│   │   ├── markdown  YAML frontmatter + SHA-256 校验
│   │   ├── html      HTML 标签剥离 + 实体解码
│   │   └── pdf       PDF 文本提取（存根，待集成 pdfjs-dist）
│
├── linker/
│   ├── parser        [[wikilink]] 双向索引 + 孤立/断链检测
│   ├── graph         图谱转换（nodes + edges）
│   └── cache         增量链接缓存
│
├── lint/
│   ├── runner        规则引擎 + Markdown 格式化
│   └── rules/        4 条规则：broken-links, orphans, frontmatter, tags
│
└── query/
    ├── engine        结构化查询 + 答案持久化
    ├── hybrid        RRF 混合检索（FTS5 + 向量并行）
    ├── semantic      向量语义搜索
    └── context-builder  上下文组装（层级优先级 + 长度截断）
```

### 数据流示例：用户提问

```
Claude Code 调用 search_hybrid(query)
  → @vale/mcp search-hybrid 工具 handler
  → @vale/core searchHybrid(workspacePath, query)
    → 并行: FTS5 全文检索 + 向量 ANN 搜索
    → RRF 分数融合（k=60）
    → 返回 top-20
  → context-builder.buildContext()
    → 按层级优先级排序: zettel > wiki > raw
    → 截断到 5 文件 / 12,000 字符
  → 上下文注入 Claude 回复
  → 用户看到带 [[wikilink]] 引用的回答
```

### 规模容量

| 笔记量 | FTS5 | 向量 | Ingest | 图谱 | 状态 |
|--------|------|------|--------|------|------|
| 1,000 | <1ms | <5ms | 秒级 | <100ms | ✅ |
| 10,000 | ~5ms | <20ms | 分钟级 | <50ms | ✅ |
| 100,000 | ~100ms | <50ms | 分钟级 | <500ms | ✅ |
| 1,000,000+ | ~500ms | 需 LanceDB | 小时级 | <2s | 待优化 |

---

## @vale/mcp — MCP Server

### 13 个工具

| 工具 | 类别 | 说明 |
|------|------|------|
| `search_wiki` | 检索 | FTS5 全文搜索 |
| `search_semantic` | 检索 | 向量语义搜索 |
| `search_hybrid` | 检索 | RRF 混合检索（推荐默认） |
| `run_query` | 引擎 | 结构化查询 + 上下文组装 |
| `run_ingest` | 引擎 | 文件导入管线 |
| `run_lint` | 检查 | 4 条质量规则 |
| `get_graph` | 图谱 | 节点/边 JSON 数据 |
| `get_schema` | 配置 | 读取 .vale/schema/ 规则 |
| `get_health` | 统计 | 文件/链接/向量计数 + 健康评分 |
| `link_notes` | 编辑 | 创建 [[wikilink]] |
| `create_note` | 编辑 | 新建笔记（含 YAML frontmatter） |
| `list_skills` | Skill | 列出已安装 Skill |
| `run_skill` | Skill | 执行指定 Skill |

### 中间件链

```
logging → workspace-guard → validation → rate-limit → permissions → handler
```

- **logging** — 结构化日志，含耗时统计
- **workspace-guard** — 校验工作区已初始化
- **validation** — Zod schema 校验输入
- **rate-limit** — Token Bucket 限流（按工作区）
- **permissions** — 标注权限级别（高危工具标记）

### 权限系统

| 权限 | 适用工具 |
|------|----------|
| `read:wiki` | search_*, run_query, run_lint, get_* |
| `write:wiki` | run_ingest, link_notes, create_note |
| `ai:query` | run_query |
| `ai:embedding` | search_semantic, search_hybrid |
| `ai:ingest` | run_ingest |
| `skill:execute` | run_skill |
| `network` | （预留） |

**高危操作**（需用户确认）：`write:wiki`, `write:raw`, `network`

---

## @vale/cli — 命令行工具

### 用户安装

```bash
npm install -g @vale/cli
```

### 命令树

```
vale init [path]          新建工作区（四层目录 + schema 模板）
vale serve                 启动 MCP Server
  --stdio                   stdio 传输（默认，用于 Claude Code）
  --http --port 4567        HTTP+SSE 传输（Streamable HTTP，用于 Web Dashboard）
  --workspace <path>        指定工作区路径
vale doctor                工作区健康诊断
  --fix                     自动修复
vale ingest [paths...]     导入文件
  --watch                   监听 raw/ 变化自动 ingest
vale search <query>        搜索知识库
  --mode hybrid             检索模式：fts | semantic | hybrid
vale graph                 知识图谱
  --export json             导出格式：json | dot | csv
vale lint                  质量检查
  --rule <name>             指定规则
vale skill                 管理 Skill
  list                     列出已安装
  install <name>           安装
  search <query>           搜索市场
vale config                管理配置
  show                     查看当前配置
  schema                   打印 JSON Schema
vale web                   启动 Web Dashboard
  --port 4568
```

---

## @vale/skills — Skill SDK

### Skill 类型 v2

| 类型 | 说明 | 关键属性 |
|------|------|---------|
| `ingest` | 文档导入适配器 | 解析器注册 |
| `query` | 检索策略 | 上下文组装规则 |
| `generate` | 文档生成模板 | 输出格式 |
| `scaffold` | 知识库结构模板 | 目录模板 |
| `lint` | 质量检查规则包 | 规则函数 |
| `prompt` | AI 行为定制 | system prompt 注入 |
| `theme` | 可视化主题 | 样式变量 |
| **`agent`** 🆕 | 主动洞察代理 | `schedule`(cron), `trigger`(事件) |
| **`workflow`** 🆕 | 多步骤工作流 | `steps[]`, `rollback` |
| **`connector`** 🆕 | 外部系统同步 | `source`, `target`, `syncStrategy` |

### Skill 目录结构

```
my-skill/
├── skill.json              # SkillManifest（必选）
├── prompts/
│   └── system.md           # System prompt 文本（prompt 类型必选）
├── tools/                  # MCP 工具定义（可选）
│   └── index.ts            # 导出 tool factory 数组
├── src/                    # 沙箱执行代码（native 模式）
└── tests/
```

### 执行模式

| 模式 | 说明 | 状态 |
|------|------|------|
| `prompt-only` | 返回 prompt 文本，AI 用内置工具执行 | ✅ 已实现 |
| `sandbox` | isolated-vm 沙箱隔离执行（30s 超时/256MB 限制） | 🔲 待实现 |
| `native` | Worker Threads 直接执行 | 🔲 待实现 |
