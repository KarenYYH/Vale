export { CLAUDE_MD_TEMPLATE } from "./claude-md.js";
export {
  WIKI_RULES_TEMPLATE,
  INGEST_PROTOCOL_TEMPLATE,
  QUERY_PROTOCOL_TEMPLATE,
  LINT_PROTOCOL_TEMPLATE,
} from "./schema.js";

export const WIKI_INDEX_TEMPLATE = `# Welcome to {WORKSPACE_NAME}

This is your knowledge base. Start by:

1. Adding notes to the **zettel/** directory — one concept per note
2. Writing curated knowledge in **wiki/concepts/**
3. Dropping raw materials in **raw/documents/** for auto-ingestion
4. Asking the AI assistant to help you search, connect, and analyze

## Quick Links

- [[log]] — Change log and activity history
`;

export const WIKI_LOG_TEMPLATE = `# Changelog

## {DATE}

- Workspace initialized.
`;

export const CONFIG_JSON_TEMPLATE = `{
  "created": "{DATE}",
  "schemaVersion": 1
}
`;
