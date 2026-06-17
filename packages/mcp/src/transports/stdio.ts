import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ValeMcpServer } from "../server.js";
import type { ValeMcpContext } from "../tools/types.js";
import { mountValeMcpServer } from "./mount.js";

/**
 * Start Vale MCP server on stdio transport.
 * The process stays alive until stdin closes.
 */
export async function serveStdio(
  vale: ValeMcpServer,
  ctx: ValeMcpContext,
): Promise<void> {
  const server = mountValeMcpServer(vale, ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep alive until transport closes
  await new Promise<void>((resolve) => {
    transport.onclose = resolve;
  });
}
