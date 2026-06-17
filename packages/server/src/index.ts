import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { LocalAuthProvider } from "@vale/auth";
import { loadConfig } from "@vale/shared";
import { createValeMcpServer, serveHttp } from "@vale/mcp";
import { buildAnswerChain } from "@vale/agent";
import { createApp } from "./app.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ServerOptions {
  workspacePath: string;
  port?: number;
  host?: string;
  /** Absolute path to the built PWA dist directory (optional) */
  webDistPath?: string;
}

/**
 * Start the Vale combined server:
 *   - REST API  on  http://<host>:<port>/api/*
 *   - MCP HTTP  on  http://<host>:<mcpPort>/mcp  (port+1)
 *   - PWA       on  http://<host>:<port>/*         (if webDistPath provided)
 */
export async function startServer(opts: ServerOptions): Promise<() => Promise<void>> {
  const { workspacePath, port = 4567, host = "127.0.0.1", webDistPath } = opts;
  const mcpPort = port + 1;

  const config = await loadConfig(workspacePath);

  const jwtSecret =
    process.env.VALE_JWT_SECRET ?? config.auth.jwtSecret ?? "change-me-in-production";

  const auth = new LocalAuthProvider({
    jwtSecret,
    sessionTtl: config.auth.sessionTtl,
    workspacePath,
  });

  // MCP HTTP transport (used by both external clients and spawn-cli agent)
  const vale = createValeMcpServer(workspacePath, config);
  const mcpCtx = { workspacePath, config };
  const shutdownMcp = await serveHttp(vale, mcpCtx, { port: mcpPort, host });
  const mcpHttpUrl = `http://${host}:${mcpPort}/mcp`;

  // Agent answer-engine chain (auto-selects highest available tier)
  const apiKey = process.env.VALE_AGENT_KEY
    ?? process.env.ANTHROPIC_API_KEY
    ?? process.env.OPENAI_API_KEY;

  const answerEngine = await buildAnswerChain({
    workspacePath,
    config,
    apiKey,
    mcpHttpUrl,
  });

  console.error(`Vale agent engine: ${answerEngine.tier}`);

  const app = createApp({ workspacePath, config, auth, answerEngine });

  // Serve static PWA from dist if path provided
  if (webDistPath) {
    // Serve manifest and sw from public subpath
    app.use("/manifest.json", serveStatic({ root: webDistPath }));
    app.use("/sw.js", serveStatic({ root: webDistPath }));
    app.use("/assets/*", serveStatic({ root: webDistPath }));
    // SPA fallback: all non-API routes → index.html
    app.get("*", async (ctx) => {
      if (ctx.req.path.startsWith("/api/")) return ctx.notFound();
      try {
        const html = await readFile(join(webDistPath, "index.html"), "utf-8");
        return ctx.html(html);
      } catch {
        return ctx.notFound();
      }
    });
  }

  const httpServer = serve({ fetch: app.fetch, port, hostname: host }, () => {
    console.log(`Vale REST API  → http://${host}:${port}/api`);
    console.log(`Vale MCP HTTP → ${mcpHttpUrl}`);
    if (webDistPath) console.log(`Vale PWA       → http://${host}:${port}`);
  });

  return async () => {
    await shutdownMcp();
    httpServer.close();
  };
}

export { createApp } from "./app.js";
export type { AppOptions } from "./app.js";
