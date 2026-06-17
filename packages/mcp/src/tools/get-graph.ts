import { z } from "zod";
import { buildLinkIndex, buildGraph } from "@vale/core";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

export function makeGetGraphTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "get_graph",
    description:
      "Get the knowledge graph data — nodes (pages) and edges ([[wikilinks]]). " +
      "Returns JSON with node/edge arrays suitable for visualization.",
    inputSchema: {},
    async handler(_input, ctx) {
      try {
        const linkIndex = await buildLinkIndex(ctx.workspacePath);
        const graph = buildGraph(linkIndex);
        return ok(
          `Knowledge graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges.`,
          { graph },
        );
      } catch (e) {
        return err(`Graph failed: ${(e as Error).message}`);
      }
    },
  };
}
