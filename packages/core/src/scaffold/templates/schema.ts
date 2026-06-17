export const WIKI_RULES_TEMPLATE = `# Wiki Rules

These rules govern how knowledge is organized and maintained in this workspace.

## Structure

- **zettel/** — One concept per note. Link freely with [[wikilink]].
- **wiki/concepts/** — Synthesized knowledge pages covering broader topics.
- **wiki/summaries/** — Condensed summaries of important materials.
- **wiki/answers/** — AI-generated answers to specific questions.
- **raw/** — Source materials. Do not edit directly — ingest to create wiki pages.

## Naming Conventions

- Use descriptive, lowercase, hyphenated filenames
- Wiki pages: \`topic-name.md\`
- Zettel: \`concept-name.md\`
- Include YAML frontmatter with: title, created, tags

## Linking

- Use \`[[wikilink]]\` syntax for all cross-references
- Prefer linking to zettel for atomic concepts
- Link to wiki pages for broader topics
`;

export const INGEST_PROTOCOL_TEMPLATE = `# Ingest Protocol

How raw documents are processed into the knowledge base.

## Supported Formats

- Markdown (.md) — Direct ingestion with frontmatter preservation
- Plain Text (.txt) — Treated as Markdown
- HTML (.html, .htm) — Stripped to plain text, titles extracted
- PDF (.pdf) — Text extraction, title from metadata or first line

## Pipeline

1. Parse — Extract title, body, frontmatter, compute checksum
2. Write — Create wiki page in \`wiki/concepts/{slug}.md\`
3. Index — Update FTS5 full-text search index
4. Embed — Generate and store vector embeddings for semantic search

## Change Detection

Files are only re-ingested if their SHA-256 checksum has changed
since the last ingestion.
`;

export const QUERY_PROTOCOL_TEMPLATE = `# Query Protocol

How questions are answered using the knowledge base.

## Search Modes

- **FTS** — Full-text keyword search via SQLite FTS5
- **Semantic** — Vector similarity search using local embedding model
- **Hybrid** — RRF (Reciprocal Rank Fusion) combining both

## Context Assembly

1. Collect matches from search
2. Group by file, pick best score per file
3. Prioritize by layer: zettel > wiki > raw
4. Cap at 5 files / 12,000 characters total
5. Format with layer headers for the AI

## Answer Persistence

Answers can be saved to \`wiki/answers/{slug}.md\` for future reference.
`;

export const LINT_PROTOCOL_TEMPLATE = `# Lint Protocol

Quality checks for the knowledge base.

## Built-in Rules

- **broken-links** — [[wikilinks]] pointing to non-existent pages (error)
- **orphans** — Pages with zero incoming links (warning)
- **frontmatter** — Missing YAML frontmatter or required fields (warning)
- **tags** — Notes without tags (info)

## Running Lint

CLI: \`vale lint\`
MCP: \`run_lint\` tool
AI:  "Check my knowledge base for issues"
`;
