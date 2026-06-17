import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { makeSearchWikiTool } from "./search-wiki.js";
import { makeSearchSemanticTool } from "./search-semantic.js";
import { makeSearchHybridTool } from "./search-hybrid.js";
import { makeRunQueryTool } from "./run-query.js";
import { makeRunIngestTool } from "./run-ingest.js";
import { makeRunLintTool } from "./run-lint.js";
import { makeGetGraphTool } from "./get-graph.js";
import { makeGetSchemaTool } from "./get-schema.js";
import { makeGetHealthTool } from "./get-health.js";
import { makeLinkNotesTool } from "./link-notes.js";
import { makeCreateNoteTool } from "./create-note.js";
import { makeListSkillsTool } from "./list-skills.js";
import { makeRunSkillTool } from "./run-skill.js";

/** Create all 13 Vale MCP tools */
export function makeAllTools(ctx: ValeMcpContext): ToolDefinition[] {
  return [
    makeSearchWikiTool(ctx),
    makeSearchSemanticTool(ctx),
    makeSearchHybridTool(ctx),
    makeRunQueryTool(ctx),
    makeRunIngestTool(ctx),
    makeRunLintTool(ctx),
    makeGetGraphTool(ctx),
    makeGetSchemaTool(ctx),
    makeGetHealthTool(ctx),
    makeLinkNotesTool(ctx),
    makeCreateNoteTool(ctx),
    makeListSkillsTool(ctx),
    makeRunSkillTool(ctx),
  ];
}
