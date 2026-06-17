# Vale

**AI-native knowledge management protocol layer.**

Vale is not another note-taking app. It's an MCP server that turns any directory into an AI-queryable knowledge base, plus a Skill marketplace for knowledge-management tools that run on Claude Code, Codex, Cursor, or any MCP-compatible agent.

## Architecture

```
┌─────────────────────────────────────┐
│  Layer 3: Vale Cloud (Enterprise)    │  Team sync · Governance · Analytics
├─────────────────────────────────────┤
│  Layer 2: Vale Skills Marketplace    │  Knowledge tools · Workflows · Agents
├─────────────────────────────────────┤
│  Layer 1: Vale MCP Server (OSS)      │  Four-layer engine · FTS5 · Vector · Lint
└─────────────────────────────────────┘
```

## Quick Start

```bash
# Install
npm install -g @vale/cli

# Create a knowledge base
vale init ~/my-wiki

# Add content
cp my-notes.md ~/my-wiki/raw/documents/
vale ingest ~/my-wiki/raw/

# Connect to Claude Code
# Add to ~/.claude/settings.json:
# { "mcpServers": { "vale": { "command": "vale", "args": ["serve", "--stdio", "--workspace", "~/my-wiki"] } } }
```

## Packages

| Package | Description |
|---------|-------------|
| `@vale/shared` | Types, constants, config schema, frontmatter parser |
| `@vale/core` | Knowledge engine: database, ingest, search, link, lint, embed |
| `@vale/mcp` | MCP server: 13 tools, middleware, stdio/HTTP transports |
| `@vale/cli` | CLI: init, serve, doctor, ingest, search, graph, lint, skill |
| `@vale/skills` | Skill SDK: loader, registry, runtime, marketplace client |
| `@vale/web` | Web dashboard: graph visualization, health reports (optional) |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

AGPL-3.0 OR Commercial License
