import { Hono } from "hono";
import {
  searchHybrid,
  searchFts,
  searchSemantic,
  runQuery,
  saveAnswer,
  ingestFile,
  ingestDirectory,
  buildLinkIndex,
  buildGraph,
  countEntries,
  countEmbeddings,
  findOrphanedPages,
  findBrokenLinks,
  runLint,
  formatLintReport,
  resolveSafePath,
} from "@vale/core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AnswerEngine } from "@vale/agent";
import { requireAuth, requirePerm } from "../middleware/auth.js";

export function makeKnowledgeRoutes(workspacePath: string, answerEngine?: AnswerEngine) {
  const app = new Hono();

  // GET /api/health — PUBLIC (no auth): used by Docker/LB liveness probes.
  // Registered before requireAuth so the middleware does not apply to it.
  app.get("/health", async (ctx) => {
    try {
      const totalFiles = countEntries(workspacePath);
      const totalEmbeddings = countEmbeddings(workspacePath);
      const linkIndex = await buildLinkIndex(workspacePath);
      const orphans = findOrphanedPages(linkIndex);
      const broken = findBrokenLinks(linkIndex);
      let linkCount = 0;
      for (const links of linkIndex.outgoing.values()) linkCount += links.length;
      const healthScore = Math.max(
        0,
        100 - Math.min(broken.length * 5, 40) - Math.min(orphans.length * 3, 30),
      );
      return ctx.json({
        status: "ok",
        totalFiles,
        totalEmbeddings,
        nodeCount: linkIndex.outgoing.size,
        linkCount,
        brokenLinks: broken.length,
        orphans: orphans.length,
        healthScore,
      });
    } catch (e) {
      return ctx.json({ status: "error", error: (e as Error).message }, 500);
    }
  });

  // Everything below requires a valid Bearer token.
  app.use("*", requireAuth);

  // GET /api/search?q=&mode=fts|semantic|hybrid&limit=20
  app.get("/search", requirePerm("read"), async (ctx) => {
    const q = ctx.req.query("q");
    if (!q) return ctx.json({ error: "q is required" }, 400);
    const mode = ctx.req.query("mode") ?? "hybrid";
    const limit = parseInt(ctx.req.query("limit") ?? "20", 10);
    try {
      let results;
      if (mode === "fts") results = searchFts(workspacePath, q, limit);
      else if (mode === "semantic") results = await searchSemantic(workspacePath, q, undefined, undefined, undefined, limit);
      else results = await searchHybrid(workspacePath, q, { limit });
      return ctx.json({ results });
    } catch (e) {
      return ctx.json({ error: (e as Error).message }, 500);
    }
  });

  // POST /api/query  { question, save? }
  app.post("/query", requirePerm("read"), async (ctx) => {
    const { question, save } =
      await ctx.req.json<{ question: string; save?: boolean }>();
    if (!question) return ctx.json({ error: "question is required" }, 400);
    try {
      if (answerEngine) {
        const result = await answerEngine.answer(question, workspacePath);
        return ctx.json(result);
      }
      // Fallback: retrieval only
      const result = await runQuery(workspacePath, question);
      let answerPath: string | undefined;
      if (save) answerPath = await saveAnswer(workspacePath, question, result.context);
      return ctx.json({ ...result, answerPath, tier: "retrieval" });
    } catch (e) {
      return ctx.json({ error: (e as Error).message }, 500);
    }
  });

  // GET /api/notes/*path
  app.get("/notes/*", requirePerm("read"), async (ctx) => {
    const notePath = decodeURIComponent(ctx.req.path.replace(/^\/notes\//, ""));
    try {
      const safePath = resolveSafePath(workspacePath, notePath);
      const content = await readFile(safePath, "utf-8");
      return ctx.json({ path: notePath, content });
    } catch (e) {
      return ctx.json({ error: (e as Error).message }, 404);
    }
  });

  // PUT /api/notes/*path  { content }
  app.put("/notes/*", requirePerm("write"), async (ctx) => {
    const notePath = decodeURIComponent(ctx.req.path.replace(/^\/notes\//, ""));
    const body = await ctx.req.json<{ content?: string }>();
    if (!body.content) return ctx.json({ error: "content is required" }, 400);
    try {
      const safePath = resolveSafePath(workspacePath, notePath);
      await mkdir(dirname(safePath), { recursive: true });
      await writeFile(safePath, body.content, "utf-8");
      return ctx.json({ ok: true, path: notePath });
    } catch (e) {
      return ctx.json({ error: (e as Error).message }, 500);
    }
  });

  // POST /api/ingest  { path, recursive? }
  app.post("/ingest", requirePerm("write"), async (ctx) => {
    const { path: p, recursive = true } =
      await ctx.req.json<{ path: string; recursive?: boolean }>();
    if (!p) return ctx.json({ error: "path is required" }, 400);
    try {
      const safePath = resolveSafePath(workspacePath, p);
      const results = recursive
        ? await ingestDirectory(workspacePath, safePath)
        : [await ingestFile(workspacePath, safePath)];
      return ctx.json({ results });
    } catch (e) {
      return ctx.json({ error: (e as Error).message }, 500);
    }
  });

  // GET /api/graph
  app.get("/graph", requirePerm("read"), async (ctx) => {
    try {
      const linkIndex = await buildLinkIndex(workspacePath);
      const graph = buildGraph(linkIndex);
      return ctx.json(graph);
    } catch (e) {
      return ctx.json({ error: (e as Error).message }, 500);
    }
  });

  // GET /api/lint
  app.get("/lint", requirePerm("read"), async (ctx) => {
    try {
      const report = await runLint(workspacePath);
      return ctx.json({ summary: formatLintReport(report), issues: report });
    } catch (e) {
      return ctx.json({ error: (e as Error).message }, 500);
    }
  });

  return app;
}
