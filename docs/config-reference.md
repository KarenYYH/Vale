# 配置参考

> `vale.config.json` 完整配置项说明

## 配置加载

Vale 按以下优先级加载配置（高到低）：

1. 工作区根目录 `vale.config.json`
2. `~/.vale/global.config.json`（全局默认）
3. 内置默认值（Zod schema 填充）

配置文件缺失时自动使用默认值。

## 完整 Schema

```json
{
  "$schema": "https://vale.sh/schema/v2.0/vale.config.schema.json",
  "version": "2.0",

  "workspace": {
    "name": "My Knowledge Base",
    "layers": {
      "wiki": "wiki/",
      "raw": "raw/",
      "zettel": "zettel/",
      "projects": "projects/"
    },
    "ignore": [".git", "node_modules", ".vale/vectors", ".vale/skills"]
  },

  "ingest": {
    "concurrency": 4,
    "supportedExtensions": [".md", ".txt", ".html", ".pdf"],
    "autoEmbed": true,
    "embedBatchSize": 32,
    "watcher": {
      "enabled": true,
      "paths": ["raw/**/*"],
      "stabilityThreshold": 300
    }
  },

  "vector": {
    "backend": "memory",
    "model": "Xenova/all-MiniLM-L6-v2",
    "dimension": 384,
    "indexType": "ivf_pq",
    "metric": "cosine",
    "nProbes": 20
  },

  "search": {
    "defaultMode": "hybrid",
    "hybrid": {
      "ftsWeight": 0.5,
      "vectorWeight": 0.5,
      "rrfConstant": 60,
      "maxCandidates": 200
    },
    "context": {
      "maxFiles": 5,
      "maxChars": 12000,
      "layerPriority": ["zettel", "wiki", "raw"]
    }
  },

  "graph": {
    "cacheEnabled": true,
    "incrementalUpdates": true,
    "maxNodes": 50000
  },

  "lint": {
    "enabledRules": ["broken-links", "orphans", "frontmatter", "tags"],
    "brokenLinks": { "severity": "error" },
    "orphans": { "severity": "warning" },
    "frontmatter": { "severity": "warning", "requiredFields": ["title", "tags"] },
    "tags": { "severity": "info" }
  },

  "mcp": {
    "transport": "stdio",
    "http": { "port": 4567, "host": "127.0.0.1" },
    "allowedTools": ["*"],
    "rateLimit": { "enabled": false, "maxPerMinute": 60 }
  },

  "skills": {
    "registry": "https://skills.vale.sh",
    "autoUpdate": true,
    "allowedPermissions": [
      "read:*",
      "write:wiki",
      "write:zettel",
      "ai:query",
      "ai:ingest"
    ]
  },

  "embedding": {
    "provider": "local",
    "localModel": "Xenova/all-MiniLM-L6-v2",
    "cacheDir": "~/.cache/vale/models",
    "apiEndpoint": "https://api.openai.com/v1",
    "apiModel": "text-embedding-3-small",
    "fallbackToLocal": true
  }
}
```

## 配置段详解

### workspace

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | `"Untitled Workspace"` | 工作区名称 |
| `layers.wiki` | `string` | `"wiki/"` | Wiki 层目录 |
| `layers.raw` | `string` | `"raw/"` | Raw 层目录 |
| `layers.zettel` | `string` | `"zettel/"` | Zettel 层目录 |
| `layers.projects` | `string` | `"projects/"` | 项目层目录 |
| `ignore` | `string[]` | `[".git", "node_modules", ...]` | 全局忽略目录 |

### ingest

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `concurrency` | `number` | `4` | 并行 ingest 数（1-32） |
| `supportedExtensions` | `string[]` | `[".md", ".txt", ".html", ".pdf"]` | 支持的扩展名 |
| `autoEmbed` | `boolean` | `true` | Ingest 后自动生成向量 |
| `embedBatchSize` | `number` | `32` | Embedding 批大小（1-256） |
| `watcher.enabled` | `boolean` | `true` | 启用文件监听 |
| `watcher.paths` | `string[]` | `["raw/**/*"]` | 监听路径 |
| `watcher.stabilityThreshold` | `number` | `300` | 文件稳定等待时间（ms） |

### vector

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `backend` | `"memory" \| "sqlite" \| "lancedb"` | `"memory"` | 向量存储后端 |
| `model` | `string` | `"Xenova/all-MiniLM-L6-v2"` | Embedding 模型 |
| `dimension` | `number` | `384` | 向量维度 |
| `metric` | `"cosine" \| "euclidean" \| "dot"` | `"cosine"` | 距离度量 |
| `nProbes` | `number` | `20` | ANN 搜索探针数 |

**后端选择指南：**

| 后端 | 规模 | 延迟 | 依赖 |
|------|------|------|------|
| `memory` | <10K chunks | <5ms | 零 |
| `sqlite` | <50K chunks | <50ms | better-sqlite3 |
| `lancedb` | 100K+ chunks | <5ms | @lancedb/lancedb（可选） |

### search

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultMode` | `"fts" \| "semantic" \| "hybrid"` | `"hybrid"` | 默认检索模式 |
| `hybrid.ftsWeight` | `number` | `0.5` | FTS 权重（0-1） |
| `hybrid.vectorWeight` | `number` | `0.5` | 向量权重（0-1） |
| `hybrid.rrfConstant` | `number` | `60` | RRF 常数 k |
| `hybrid.maxCandidates` | `number` | `200` | 候选结果上限 |
| `context.maxFiles` | `number` | `5` | 注入 AI 的最大文件数 |
| `context.maxChars` | `number` | `12000` | 注入 AI 的最大字符数 |
| `context.layerPriority` | `string[]` | `["zettel", "wiki", "raw"]` | 层级优先级 |

### lint

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabledRules` | `string[]` | `["broken-links", "orphans", "frontmatter", "tags"]` | 启用的规则 |
| `<rule>.severity` | `"error" \| "warning" \| "info"` | 各异 | 规则严重级别 |
| `<rule>.ignorePatterns` | `string[]` | — | 忽略的文件模式 |
| `frontmatter.requiredFields` | `string[]` | `["title", "tags"]` | 必选字段 |

### mcp

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `transport` | `"stdio" \| "http"` | `"stdio"` | 传输协议 |
| `http.port` | `number` | `4567` | HTTP 端口 |
| `http.host` | `string` | `"127.0.0.1"` | HTTP 绑定地址 |
| `allowedTools` | `string[]` | `["*"]` | 暴露的工具（`*` = 全部） |
| `rateLimit.enabled` | `boolean` | `false` | 启用限流 |
| `rateLimit.maxPerMinute` | `number` | `60` | 每分钟最大调用数 |

### skills

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `registry` | `string` | `"https://skills.vale.sh"` | 市场 API URL |
| `autoUpdate` | `boolean` | `true` | 自动更新 Skill |
| `allowedPermissions` | `string[]` | 见上 | 允许的权限范围 |

### embedding

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `provider` | `"local" \| "api"` | `"local"` | Embedding 来源 |
| `localModel` | `string` | `"Xenova/all-MiniLM-L6-v2"` | 本地模型 |
| `cacheDir` | `string` | `"~/.cache/vale/models"` | 模型缓存目录 |
| `apiEndpoint` | `string` | — | API 端点 URL |
| `apiModel` | `string` | — | API 模型名 |
| `fallbackToLocal` | `boolean` | `true` | API 失败时降级到本地 |

## 常用场景

### 个人笔记库（默认配置开箱即用）

```json
{
  "version": "2.0",
  "workspace": { "name": "我的笔记" }
}
```

### 团队知识库（高并发 + 大文件）

```json
{
  "version": "2.0",
  "workspace": { "name": "团队知识库" },
  "ingest": {
    "concurrency": 8,
    "supportedExtensions": [".md", ".txt", ".html", ".pdf", ".rst"]
  },
  "vector": { "backend": "sqlite" },
  "lint": {
    "frontmatter": { "severity": "error", "requiredFields": ["title", "tags", "author", "updated"] }
  }
}
```

### 严格治理（企业）

```json
{
  "version": "2.0",
  "workspace": { "name": "企业知识资产" },
  "lint": {
    "brokenLinks": { "severity": "error" },
    "orphans": { "severity": "error" },
    "frontmatter": { "severity": "error", "requiredFields": ["title", "tags", "author", "updated", "reviewer", "status"] }
  },
  "mcp": {
    "rateLimit": { "enabled": true, "maxPerMinute": 120 },
    "allowedTools": ["search_*", "run_query", "run_lint", "get_*", "list_skills"]
  },
  "skills": {
    "allowedPermissions": ["read:*", "ai:query"]
  }
}
```
