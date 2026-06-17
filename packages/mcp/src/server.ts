import type { ValeConfig, ValeConfigParsed, CallToolResult } from "@vale/shared";
import { makeAllTools } from "./tools/index.js";
import type { ToolDefinition } from "./tools/types.js";
import { buildMiddlewareChain } from "./middleware/chain.js";
import { workspaceGuard } from "./middleware/workspace-guard.js";
import { permissionsCheck } from "./middleware/permissions.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { toolLogger } from "./middleware/logging.js";
import { validateInput } from "./middleware/validation.js";

/**
 * Create a Vale MCP server with all tools and middleware.
 *
 * This returns a tool registry that can be mounted on any
 * MCP-compatible transport (stdio, HTTP+SSE).
 */
export interface ValeMcpServer {
  tools: ToolDefinition[];
  executeTool(
    toolName: string,
    input: Record<string, unknown>,
    ctx: ValeMcpContext,
  ): Promise<CallToolResult>;
}

export interface ValeMcpContext {
  workspacePath: string;
  config: ValeConfig | ValeConfigParsed;
}

export function createValeMcpServer(
  workspacePath: string,
  config: ValeConfig | ValeConfigParsed,
): ValeMcpServer {
  const ctx: ValeMcpContext = { workspacePath, config };
  const rawTools = makeAllTools(ctx);

  const chain = buildMiddlewareChain([
    toolLogger,
    workspaceGuard,
    validateInput,
    rateLimiter,
    permissionsCheck,
  ]);

  return {
    tools: rawTools,
    async executeTool(toolName, input, ctx) {
      const tool = rawTools.find((t) => t.name === toolName);
      if (!tool) {
        return {
          content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
          isError: true,
        };
      }
      return chain(tool, input as Record<string, unknown>, ctx);
    },
  };
}
