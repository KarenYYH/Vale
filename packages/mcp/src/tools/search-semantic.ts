import { z } from "zod";
import { searchSemantic } from "@vale/core";
import { MAX_SEARCH_LIMIT } from "@vale/shared";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

const inputSchema = {
  query: z.string().min(1).describe("Natural language query for semantic search"),
  limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).default(10).describe("Maximum results"),
};

export function makeSearchSemanticTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "search_semantic",
    description:
      "Semantic search using local vector embeddings. " +
      "Best for conceptual queries where exact keywords may not match. " +
      "Uses all-MiniLM-L6-v2 model running locally.",
    inputSchema,
    async handler(input, ctx) {
      const { query, limit } = input as { query: string; limit: number };
      try {
        const results = await searchSemantic(
          ctx.workspacePath,
          query,
          undefined, undefined, undefined,
          limit,
        );
        const formatted = results
          .map((r) => `- **${r.filePath}** (score: ${r.score.toFixed(4)})\n  ${r.chunkText.slice(0, 200)}`)
          .join("\n");
        return ok(formatted || "No results found.", { results });
      } catch (e) {
        return err(`Semantic search failed: ${(e as Error).message}`);
      }
    },
  };
}
