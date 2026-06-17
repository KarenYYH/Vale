export const CLAUDE_MD_TEMPLATE = `# {WORKSPACE_NAME}

This is a Vale knowledge workspace using the four-layer architecture:

- **schema/** — Rules and protocols that govern this knowledge base
- **wiki/**   — Curated, structured knowledge pages
- **raw/**    — Raw imported documents and materials
- **zettel/** — Atomic, interlinked notes (Zettelkasten method)

## Usage

- Write notes in \`zettel/\` for atomic ideas, linking with \`[[wikilink]]\` syntax
- Organize curated knowledge in \`wiki/concepts/\`
- Drop raw materials in \`raw/documents/\` — Vale will auto-ingest them
- Ask the AI assistant to search, summarize, or analyze your knowledge
`;
