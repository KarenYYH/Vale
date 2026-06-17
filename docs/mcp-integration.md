# MCP 集成指南

> 将 Vale 接入 Claude Code、Codex、Cursor 或其他 MCP 兼容客户端

## 工作原理

```
┌──────────────┐    MCP (stdio/HTTP)    ┌──────────────┐
│  Claude Code │ ◄────────────────────► │  Vale Server │
│  / Codex     │    JSON-RPC             │  (MCP)       │
│  / Cursor    │                         │              │
│              │                         │  13 tools    │
│              │                         │  SQLite      │
│              │                         │  Embeddings  │
└──────────────┘                         └──────────────┘
```

Vale 作为 MCP Server 运行，暴露 13 个知识库工具。客户端（Claude Code / Codex）通过 MCP 协议发现并调用这些工具。

## 传输模式

### stdio（推荐，用于 CLI 客户端）

Vale 启动为子进程，通过 stdin/stdout 通信。零网络配置，最安全。

```bash
vale serve --stdio --workspace ~/my-wiki
```

### HTTP+SSE（用于 Web Dashboard 或远程访问）

```bash
vale serve --http --port 4567 --workspace ~/my-wiki
```

## Claude Code 配置

编辑 `~/.claude/settings.json`（全局）或项目下的 `.claude/settings.json`（项目级）：

```json
{
  "mcpServers": {
    "vale": {
      "command": "vale",
      "args": [
        "serve",
        "--stdio",
        "--workspace",
        "/Users/me/my-knowledge-base"
      ]
    }
  }
}
```

### 多工作区

为每个知识库注册独立的 MCP Server：

```json
{
  "mcpServers": {
    "vale-tech": {
      "command": "vale",
      "args": ["serve", "--stdio", "--workspace", "~/kb/tech-notes"]
    },
    "vale-law": {
      "command": "vale",
      "args": ["serve", "--stdio", "--workspace", "~/kb/legal-research"]
    }
  }
}
```

Claude Code 中通过工具名前缀区分：`vale-tech__search_hybrid` vs `vale-law__search_hybrid`。

### 克隆项目自带的配置

如果你的团队在知识库仓库里放了 `.claude/settings.json`，克隆后自动生效：

```bash
git clone git@github.com:team/knowledge-base.git
cd knowledge-base
# Claude Code 启动后自动加载 .claude/settings.json 中的 Vale 配置
```

## Codex 配置

Codex 使用类似的 MCP 配置格式。在 Codex 设置中添加：

```json
{
  "mcpServers": {
    "vale": {
      "command": "vale",
      "args": ["serve", "--stdio", "--workspace", "~/my-wiki"]
    }
  }
}
```

## Cursor 配置

在 Cursor 设置中搜索 "MCP"，添加 server：

- **Name:** Vale
- **Command:** `vale`
- **Args:** `serve, --stdio, --workspace, /Users/me/my-wiki`

## 验证连接

启动客户端后，检查 Vale 工具是否被发现：

**Claude Code：**
```
/list-mcp-tools
```
应该看到 13 个 `vale__` 开头的工具。

**Codex：**
```
/mcp-tools
```
或在对话中直接尝试：
```
> 用 search_hybrid 搜索 "设计模式"
```

## 安全

### 权限控制

Vale 工具分为普通和**高危**两类。高危工具在调用前会请求用户确认：

| 级别 | 工具 | 为何高危 |
|------|------|---------|
| 🔴 高危 | `run_ingest` | 写入 wiki 目录 |
| 🔴 高危 | `link_notes` | 修改文件内容 |
| 🔴 高危 | `create_note` | 创建新文件 |
| 🔴 高危 | `run_skill` | 执行第三方代码 |
| 🟢 普通 | `search_*`, `run_query`, `run_lint`, `get_*`, `list_skills` | 只读操作 |

### 路径安全

Vale 强制所有文件操作限制在工作区目录内。`resolveSafePath` 和 `resolveRealSafePath` 防止：
- 路径遍历攻击（`../../../etc/passwd`）
- 符号链接逃逸

### 限流

在 `vale.config.json` 中启用：

```json
{
  "mcp": {
    "rateLimit": {
      "enabled": true,
      "maxPerMinute": 60
    }
  }
}
```

## 故障排查

```bash
# 运行自诊断
vale doctor

# 查看配置
vale config show

# 检查工作区是否初始化
vale doctor

# 详细日志
VALE_LOG_LEVEL=debug vale serve --stdio --workspace ~/my-wiki
```

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Claude Code 看不到 Vale 工具 | serve 未启动或路径错误 | 检查 `vale serve` 进程，确认 `--workspace` 路径存在 |
| `run_ingest` 报 "unsupported format" | 文件类型不在支持列表中 | 安装对应 Skill 或确认文件后缀为 .md/.txt/.html/.pdf |
| 搜索返回空 | 未导入内容或索引未更新 | 先 `vale ingest` 再搜索 |
| "Workspace not initialized" | 未执行 `vale init` | 运行 `vale init` 创建工作区 |
