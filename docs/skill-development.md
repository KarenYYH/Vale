# Skill 开发指南

> 开发可被 Claude Code / Codex 使用的知识管理 Skill

## Skill 是什么

一个 Skill 是：

```
Skill = MCP 工具定义 + System Prompt + 工作流描述
```

安装后，Skill 自动注册 MCP 工具，AI Agent 在对话中透明调用。用户只需要告诉 AI 做什么，AI 自己会选择并调用正确的 Skill 工具。

> 这里的 "AI Agent" 既可以是宿主(Claude Code/Codex),也可以是 Vale Server 侧 spawn 起来的 CLI agent——无宿主的接入面(PWA/手机/OA)走后者。Skill 编写方式不变。详见 [multi-surface-design.md](multi-surface-design.md) §3.4/§3.5。

## 第一个 Skill：Hello World

### 1. 创建目录

```bash
mkdir my-first-skill
cd my-first-skill
```

### 2. 编写 skill.json

```json
{
  "name": "hello-knowledge",
  "version": "1.0.0",
  "type": "prompt",
  "displayName": "Hello Knowledge",
  "description": "A simple prompt skill that adds Markdown best practices to the AI's behavior",
  "author": { "name": "Your Name", "url": "https://github.com/you" },
  "license": "MIT",
  "price": "free",
  "engines": { "vale": ">=0.1.0" },
  "permissions": ["read:wiki"],
  "triggers": ["格式化", "format markdown", "美化笔记"],
  "tags": ["productivity", "writing"]
}
```

### 3. 编写 prompts/system.md

```markdown
# Markdown 写作规范

你在处理知识库笔记时，请遵循以下规则：

## 格式
- 使用 `##` 和 `###` 作为主要标题层级
- 代码块必须标注语言：\`\`\`python
- 引用用 `>` 并注明来源

## 链接
- 优先使用 `[[wikilink]]` 引用库内其他笔记
- 外部链接放在文末 "参考" 段落

## 标签
- 每个笔记至少包含 2 个 tags
- 标签用 kebab-case: `machine-learning`, `distributed-systems`
```

### 4. 安装测试

```bash
# 从本地目录安装
vale skill install ./my-first-skill --from path

# 验证安装
vale skill list

# 在 Claude Code 中测试
> 帮我格式化这篇笔记

# AI 会自动激活 hello-knowledge skill
# 并按 prompt 中的规则格式化输出
```

---

## Skill 类型与适用场景

### prompt 类型 — 最常用

为 AI 注入特定领域的知识和行为规则。不定义新工具，只影响 AI 的思考方式。

**适用场景**: 行业术语规范、写作风格、代码审查清单、法律检索策略、学术引用格式

**示例 skill.json**:
```json
{
  "type": "prompt",
  "permissions": ["read:wiki"],
  "triggers": ["法律检索", "案例查询", "legal research"],
  "config": {
    "jurisdiction": {
      "type": "select",
      "options": ["中国大陆", "香港", "美国"],
      "default": "中国大陆",
      "description": "法律管辖区域"
    }
  }
}
```

### ingest 类型 — 文件解析器

为 Vale 添加新的文件格式支持。注册解析器到 ParserRegistry。

**适用场景**: Notion 导出、飞书文档、Google Docs、RST、Org-mode、Jupyter Notebook

**示例 skill.json**:
```json
{
  "type": "ingest",
  "permissions": ["read:raw", "write:wiki", "ai:ingest"],
  "executionMode": "native"
}
```

**工具定义 (tools/index.ts)**:
```typescript
import type { ToolFactory } from "@vale/shared";

export const tools: ToolFactory[] = [
  (ctx) => ({
    name: "ingest_notion",
    description: "Parse a Notion-exported ZIP into wiki pages",
    inputSchema: {
      path: { type: "string", description: "Path to the .zip file" }
    },
    handler: async (input) => {
      // 解析 Notion ZIP，提取 Markdown，写入 wiki/
      return { content: [{ type: "text", text: "Ingested 42 pages from Notion" }] };
    }
  })
];
```

### lint 类型 — 质量检查规则

为知识库添加领域特定的质量检查。

**适用场景**: 学术引用格式检查、SEO 关键词检查、企业文档模板合规、法律文书格式

**示例**: 检查所有笔记是否包含特定 frontmatter 字段：

```typescript
// tools/index.ts
import type { NoteInfo, LintIssue } from "@vale/shared";

export function checkSeoFields(notes: NoteInfo[]): LintIssue[] {
  return notes
    .filter(n => !n.frontmatter.description || !n.frontmatter.keywords)
    .map(n => ({
      filePath: n.path,
      rule: "seo-fields",
      severity: "warning",
      message: "Missing SEO fields: description and/or keywords"
    }));
}
```

### agent 类型 🆕 — 主动洞察

周期性扫描知识库，主动发现问题并推送报告。

**适用场景**: 知识库周报、术语一致性检查、知识盲区发现、重复内容检测

**示例 skill.json**:
```json
{
  "type": "agent",
  "permissions": ["read:wiki", "ai:query"],
  "schedule": "0 9 * * 1",
  "triggers": ["周报", "知识库健康", "本周摘要"]
}
```

**关键字段**:
- `schedule`: cron 表达式（`0 9 * * 1` = 每周一早 9 点）
- 工具返回结构化报告，AI 据此生成自然语言摘要

### workflow 类型 🆕 — 多步骤工作流

定义可复用的多步骤知识处理流程。

**适用场景**: 文献综述工作流、新人入职知识继承、竞品分析流程

### connector 类型 🆕 — 外部同步

连接外部知识源，双向或单向同步。

**适用场景**: Notion 同步、飞书文档、Confluence、GitHub Issues

---

## Skill 打包与发布

### 目录结构规范

```
my-skill/
├── skill.json            # ✋ 必选
├── README.md             # ✋ 必选：使用说明
├── prompts/
│   └── system.md         # 可选：prompt/lint/agent 类型推荐包含
├── tools/
│   └── index.ts          # 可选：ingest/lint/agent/workflow/connector 推荐包含
├── src/
│   └── index.ts          # 可选：native 执行模式代码
├── config.json           # 可选：默认配置值
├── assets/
│   └── icon.svg          # 可选：图标
└── tests/
    └── *.test.ts         # 可选：自动化测试
```

### 本地测试

```bash
# 在开发目录中安装
vale skill install . --from path

# 测试：在 Claude Code 对话中触发 Skill
> 按照 hello-knowledge 的规范格式化这篇笔记

# 查看 Skill 是否被正确加载
vale skill list | grep hello-knowledge

# 临时禁用
vale skill disable hello-knowledge
vale skill enable hello-knowledge
```

### 发布到市场

```bash
# 打包
vale skill pack ./my-skill

# 发布（需要市场账号）
vale skill publish ./my-skill-1.0.0.vale-skill

# 更新
vale skill publish ./my-skill --version 1.1.0
```

---

## 权限清单

Skill 必须在其 `skill.json` 中声明所需权限：

| 权限 | 能力 |
|------|------|
| `read:wiki` | 读取 wiki/ 目录 |
| `read:raw` | 读取 raw/ 目录 |
| `read:zettel` | 读取 zettel/ 目录 |
| `write:wiki` | 写入 wiki/ 目录 |
| `write:raw` | 写入 raw/ 目录 |
| `ai:query` | 调用 AI 查询 |
| `ai:embedding` | 生成/使用向量 |
| `ai:ingest` | 执行 Ingest 管线 |
| `skill:execute` | 执行其他 Skill |
| `network` | 访问外部网络 |

**原则**: 只声明实际用到的权限。用户安装时会看到权限列表。

---

## 最佳实践

1. **单一职责**: 一个 Skill 只做一件事。不要在一个 Skill 里同时做 PDF 解析和 SEO 检查。
2. **写好 triggers**: `triggers` 数组帮助 AI 自动发现合适的 Skill。用中文/英文双语描述。
3. **prompt 要具体**: 不要在 system.md 里写"做好笔记"——写"标题用 `##`，代码块标注语言，外部链接放文末"。
4. **包含示例**: 在 system.md 中提供 2-3 个具体的输入→输出示例，AI 学习效果最好。
5. **声明依赖**: 如果 Skill 依赖其他 Skill，在 `dependencies` 字段中声明。
6. **做好错误处理**: `handler` 中的异常应返回 `isError: true` 的消息，而不是让异常向上传播。
