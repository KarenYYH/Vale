import { z } from "zod";
import { searchHybrid } from "@vale/core";
import { MAX_SEARCH_LIMIT } from "@vale/shared";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

const inputSchema = {
  query: z.string().min(1).describe("Search query — supports both keywords and natural language"),
  limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).default(20).describe("Maximum results"),
};

export function makeSearchHybridTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "search_hybrid",
    description:
      "Hybrid search combining FTS5 full-text and vector semantic search via RRF (Reciprocal Rank Fusion). " +
      "This is the recommended default search method. Results appearing in both FTS and vector results get a ranking boost.",
    inputSchema,
    async handler(input, ctx) {
      const { query, limit } = input as { query: string; limit: number };
      try {
        const results = await searchHybrid(ctx.workspacePath, query, {
          limit,
        });
        const formatted = results
          .map((r) => `- **${r.filePath}** [${r.matchType}] (score: ${r.score.toFixed(4)})\n  ${r.content.slice(0, 200)}`)
          .join("\n");
        return ok(formatted || "No results found.", { results });
      } catch (e) {
        return err(`Hybrid search failed: ${(e as Error).message}`);
      }
    },
  };
}
