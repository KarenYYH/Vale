/**
 * @vale/mcp
 *
 * MCP server that exposes Vale's knowledge engine as tools for AI agents.
 * Compatible with Claude Code, Codex, Cursor, and any MCP-compatible client.
 */

export { createValeMcpServer } from "./server.js";
export type { ValeMcpServer, ValeMcpContext } from "./server.js";
export { makeAllTools } from "./tools/index.js";
export type { ToolDefinition } from "./tools/types.js";
export { serveStdio } from "./transports/stdio.js";
export { serveHttp } from "./transports/http.js";
export type { HttpTransportOptions } from "./transports/http.js";
