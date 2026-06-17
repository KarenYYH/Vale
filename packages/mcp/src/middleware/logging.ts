import type { Middleware } from "./chain.js";

/**
 * Middleware: log tool execution with timing.
 */
export const toolLogger: Middleware = async (tool, input, ctx, next) => {
  const start = Date.now();
  try {
    const result = await next(input);
    const duration = Date.now() - start;
    // Structured log (could send to pino, winston, etc.)
    if (process.env.VALE_LOG_LEVEL === "debug") {
      console.error(
        JSON.stringify({
          tool: tool.name,
          duration_ms: duration,
          workspace: ctx.workspacePath,
          isError: !!result.isError,
          timestamp: new Date().toISOString(),
        }),
      );
    }
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(
      JSON.stringify({
        tool: tool.name,
        duration_ms: duration,
        workspace: ctx.workspacePath,
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      }),
    );
    return {
      content: [{ type: "text" as const, text: `Tool error: ${(err as Error).message}` }],
      isError: true,
    };
  }
};
