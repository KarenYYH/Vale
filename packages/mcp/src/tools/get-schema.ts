import { readFile } from "fs/promises";
import { join } from "path";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

export function makeGetSchemaTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "get_schema",
    description:
      "Read the knowledge base schema rules (from .vale/schema/). " +
      "These define how the knowledge base is organized and governed.",
    inputSchema: {},
    async handler(_input, ctx) {
      try {
        const schemaDir = join(ctx.workspacePath, ".vale", "schema");
        const { readdir } = await import("fs/promises");
        const files = await readdir(schemaDir);
        const mdFiles = files.filter((f) => f.endsWith(".md"));

        const schemas: Record<string, string> = {};
        for (const file of mdFiles) {
          const content = await readFile(join(schemaDir, file), "utf-8");
          schemas[file] = content;
        }

        const formatted = Object.entries(schemas)
          .map(([name, content]) => `## ${name}\n\n${content}`)
          .join("\n\n---\n\n");

        return ok(formatted || "No schema files found.", { schemas });
      } catch (e) {
        return err(`Schema read failed: ${(e as Error).message}`);
      }
    },
  };
}
