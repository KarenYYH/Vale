import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ValeMcpServer } from "../server.js";
import type { ValeMcpContext } from "../tools/types.js";
import { mountValeMcpServer } from "./mount.js";

export interface HttpTransportOptions {
  port: number;
  host?: string;
}

/**
 * Start Vale MCP server on HTTP + Streamable HTTP transport.
 * Accepts MCP sessions at POST /mcp.
 * Returns a shutdown function.
 */
export async function serveHttp(
  vale: ValeMcpServer,
  ctx: ValeMcpContext,
  opts: HttpTransportOptions,
): Promise<() => Promise<void>> {
  const { port, host = "127.0.0.1" } = opts;

  // One transport per session — map by session ID
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    // Only handle MCP endpoint
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }

    if (req.method === "POST") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        // New session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () =>
            `vale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          onsessioninitialized: (id) => {
            transports.set(id, transport!);
          },
        });

        transport.onclose = () => {
          const id = (transport as { sessionId?: string }).sessionId;
          if (id) transports.delete(id);
        };

        const server = mountValeMcpServer(vale, ctx);
        await server.connect(transport);
      }

      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        res.writeHead(404).end();
        return;
      }
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(405).end();
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, resolve);
  });

  return () =>
    new Promise<void>((resolve, reject) => {
      for (const t of transports.values()) t.close().catch(() => {});
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
}
