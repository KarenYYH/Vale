import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { resolveRealSafePath } from "@vale/core";
import { serializeFrontmatter } from "@vale/shared";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

const inputSchema = {
  path: z.string().min(1).describe("File path relative to workspace (e.g., 'zettel/my-note.md')"),
  title: z.string().min(1).describe("Note title"),
  content: z.string().default("").describe("Markdown content (optional)"),
  tags: z.array(z.string()).default([]).describe("Tags for the note"),
  layer: z.enum(["zettel", "wiki", "raw"]).default("zettel").describe("Knowledge layer"),
};

export function makeCreateNoteTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "create_note",
    description:
      "Create a new Markdown note in the knowledge base. " +
      "Automatically adds YAML frontmatter with title, created date, and tags.",
    inputSchema,
    async handler(input, ctx) {
      const args = input as { path: string; title: string; content?: string; tags?: string[]; layer?: string };
      try {
        const targetPath = await resolveRealSafePath(ctx.workspacePath, args.path);
        const today = new Date().toISOString().split("T")[0];
        const tags = args.tags ?? [];
        const layer = args.layer ?? "zettel";

        // Serialize frontmatter via the canonical YAML serializer so titles/tags
        // containing quotes, newlines, or "---" cannot inject frontmatter (I3).
        const fullContent = serializeFrontmatter(
          { title: args.title, created: today, layer, ...(tags.length > 0 ? { tags } : {}) },
          args.content || `# ${args.title}\n`,
        );

        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, fullContent, "utf-8");

        return ok(`Created note: ${args.path}`, {
          path: args.path,
          title: args.title,
          layer,
        });
      } catch (e) {
        return err(`Create note failed: ${(e as Error).message}`);
      }
    },
  };
}
