import { z } from "zod";
import { ingestFile, ingestDirectory } from "@vale/core";
import { stat } from "fs/promises";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

const inputSchema = {
  path: z.string().min(1).describe("File or directory path to ingest (relative to workspace)"),
  recursive: z.boolean().default(true).describe("If path is a directory, ingest recursively"),
};

export function makeRunIngestTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "run_ingest",
    description:
      "Ingest files into the knowledge base. Supports Markdown, HTML, and PDF. " +
      "The ingest pipeline: parse → write wiki page → index (FTS5) → embed (vectors).",
    inputSchema,
    async handler(input, ctx) {
      const { path: inPath, recursive: rec } = input as { path: string; recursive?: boolean };
      try {
        const { resolveSafePath } = await import("@vale/core");
        const fullPath = resolveSafePath(ctx.workspacePath, inPath);

        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          const results = rec !== false
            ? await ingestDirectory(ctx.workspacePath, fullPath)
            : [];
          const succeeded = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success).length;
          return ok(
            `Ingested ${succeeded} files from directory${failed > 0 ? `, ${failed} failed` : ""}.`,
            { results, succeeded, failed },
          );
        } else {
          const result = await ingestFile(ctx.workspacePath, fullPath);
          if (result.success) {
            return ok(`Ingested: ${result.wikiPath ?? result.filePath}`, { result });
          } else {
            return err(`Ingest failed: ${result.error}`);
          }
        }
      } catch (e) {
        return err(`Ingest failed: ${(e as Error).message}`);
      }
    },
  };
}
