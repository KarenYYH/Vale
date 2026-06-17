# 快速上手

> 5 分钟将你的文件夹变成 AI 可查询的知识库

## 前提

- Node.js >= 20.0.0
- Claude Code 或 Codex CLI（或其他 MCP 兼容客户端）

## 1. 安装

```bash
npm install -g @vale/cli
```

验证安装：

```bash
vale version
# vale 0.1.0
```

## 2. 创建知识库

```bash
# 新建一个工作区
vale init ~/my-wiki

# 或使用自定义名称
vale init ~/my-wiki --name "我的技术笔记"
```

这会在目标目录创建四层结构：

```
~/my-wiki/
├── CLAUDE.md
├── .vale/
│   ├── config.json
│   ├── schema/
│   │   ├── wiki-rules.md
│   │   ├── ingest-protocol.md
│   │   ├── query-protocol.md
│   │   └── lint-protocol.md
│   └── skills/
├── wiki/
│   ├── index.md
│   ├── log.md
│   ├── concepts/
│   ├── summaries/
│   └── answers/
├── raw/
│   ├── documents/
│   ├── clippings/
│   └── media/
├── zettel/
├── projects/
└── template/
```

## 3. 添加内容

```bash
# 方式一：命令行导入
vale ingest ~/Downloads/article.pdf

# 方式二：直接拖文件到 raw/documents/ 目录
cp ~/Documents/notes/*.md ~/my-wiki/raw/documents/

# 然后批量导入
vale ingest ~/my-wiki/raw/

# 方式三：启动后台监听（自动 ingest 新文件）
vale ingest --watch
```

## 4. 连接 Claude Code

编辑 `~/.claude/settings.json`（或项目下的 `.claude/settings.json`）：

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

重启 Claude Code，然后直接对话：

```
> 帮我搜索知识库里关于 Transformer 的所有笔记

> 把这篇 PDF 导入知识库

> 检查我的知识库有没有断链和孤立页面

> 帮我基于最近的 zettel 写一篇关于分布式系统的综述
```

## 5. 连接 Codex

编辑 Codex 的 MCP 配置：

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

## 6. 常用命令

```bash
# 搜索
vale search "transformer attention" --mode hybrid

# 健康检查
vale doctor
vale lint

# 图谱导出
vale graph --export json > graph.json

# 查看 Skill 市场
vale skill search "pdf"

# 安装 Skill
vale skill install ingest-pdf

# 启动 Web 仪表盘
vale web
```

## 下一步

- [配置参考](./config-reference.md) — vale.config.json 详解
- [MCP 集成指南](./mcp-integration.md) — 多客户端接入
- [Skill 开发指南](./skill-development.md) — 开发自己的 Skill
