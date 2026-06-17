import type { ToolDefinition, ValeMcpContext } from "../tools/types.js";
import type { CallToolResult } from "@vale/shared";

/**
 * Middleware function — wraps a tool handler.
 * Each middleware can modify input, skip execution, or wrap the output.
 */
export type Middleware = (
  tool: ToolDefinition,
  input: Record<string, unknown>,
  ctx: ValeMcpContext,
  next: (input: Record<string, unknown>) => Promise<CallToolResult>,
) => Promise<CallToolResult>;

/**
 * Build a middleware chain from an ordered list of middleware.
 * Middleware execute in order: the first wraps the second, which wraps the third, etc.
 */
export function buildMiddlewareChain(middlewares: Middleware[]) {
  return (
    tool: ToolDefinition,
    input: Record<string, unknown>,
    ctx: ValeMcpContext,
  ): Promise<CallToolResult> => {
    // The inner-most function is the actual tool handler
    let handler = (finalInput: Record<string, unknown>) =>
      tool.handler(finalInput, ctx);

    // Wrap from right to left (last middleware is innermost)
    for (let i = middlewares.length - 1; i >= 0; i--) {
      const middleware = middlewares[i];
      const next = handler;
      handler = (finalInput: Record<string, unknown>) =>
        middleware(tool, finalInput, ctx, next);
    }

    return handler(input);
  };
}
