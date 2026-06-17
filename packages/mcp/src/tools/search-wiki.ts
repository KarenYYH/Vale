import { z } from "zod";
import { searchFts } from "@vale/core";
import { MAX_SEARCH_LIMIT } from "@vale/shared";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

const inputSchema = {
  query: z.string().min(1).describe("Search query for full-text search"),
  limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).default(20).describe("Maximum results"),
};

export function makeSearchWikiTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "search_wiki",
    description:
      "Full-text search across the knowledge base using FTS5. " +
      "Best for exact keyword matching, file names, and specific terminology. " +
      "For conceptual or semantic queries, prefer search_semantic or search_hybrid.",
    inputSchema,
    async handler(input, ctx) {
      const { query, limit } = input as { query: string; limit: number };
      try {
        const results = searchFts(ctx.workspacePath, query, limit);
        const formatted = results
          .map((r) => `- **${r.filePath}** (score: ${r.score})\n  ${r.content}`)
          .join("\n");
        return ok(formatted || "No results found.", { results });
      } catch (e) {
        return err(`Search failed: ${(e as Error).message}`);
      }
    },
  };
}
