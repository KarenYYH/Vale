import { z } from "zod";
import {
  countEntries,
  countEmbeddings,
  buildLinkIndex,
  findOrphanedPages,
  findBrokenLinks,
} from "@vale/core";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

export function makeGetHealthTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "get_health",
    description:
      "Get a health overview of the knowledge base: file count, embedding count, " +
      "broken link count, orphan count, and overall health score.",
    inputSchema: {},
    async handler(_input, ctx) {
      try {
        const totalFiles = countEntries(ctx.workspacePath);
        const totalEmbeddings = countEmbeddings(ctx.workspacePath);
        const linkIndex = await buildLinkIndex(ctx.workspacePath);
        const orphans = findOrphanedPages(linkIndex);
        const broken = findBrokenLinks(linkIndex);

        const healthScore = calculateHealthScore(
          totalFiles,
          broken.length,
          orphans.length,
        );

        const report = [
          `# Workspace Health Report`,
          ``,
          `| Metric | Value |`,
          `|--------|-------|`,
          `| 📄 Total indexed files | ${totalFiles} |`,
          `| 🧠 Total embedding chunks | ${totalEmbeddings} |`,
          `| 🔗 Total links | ${linkIndex.outgoing.size} pages, ${countAllLinks(linkIndex)} links |`,
          `| 💔 Broken links | ${broken.length} |`,
          `| 👻 Orphaned pages | ${orphans.length} |`,
          `| 🏥 Health score | ${healthScore}/100 |`,
          ``,
          healthScore >= 80
            ? "✅ Knowledge base is healthy."
            : healthScore >= 50
              ? "⚠️ Knowledge base needs attention."
              : "🔴 Knowledge base has significant issues.",
        ].join("\n");

        return ok(report, {
          totalFiles,
          totalEmbeddings,
          nodeCount: linkIndex.outgoing.size,
          linkCount: countAllLinks(linkIndex),
          brokenLinks: broken.length,
          orphans: orphans.length,
          healthScore,
        });
      } catch (e) {
        return err(`Health check failed: ${(e as Error).message}`);
      }
    },
  };
}

function countAllLinks(linkIndex: Awaited<ReturnType<typeof buildLinkIndex>>): number {
  let count = 0;
  for (const links of linkIndex.outgoing.values()) {
    count += links.length;
  }
  return count;
}

function calculateHealthScore(
  totalFiles: number,
  brokenLinks: number,
  orphans: number,
): number {
  if (totalFiles === 0) return 100;
  const brokenPenalty = Math.min(brokenLinks * 5, 40);
  const orphanPenalty = Math.min(orphans * 3, 30);
  return Math.max(0, 100 - brokenPenalty - orphanPenalty);
}
