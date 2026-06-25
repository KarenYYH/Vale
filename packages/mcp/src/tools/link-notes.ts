import { z } from "zod";
import { readFile, writeFile } from "fs/promises";
import { resolveRealSafePath } from "@vale/core";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

const inputSchema = {
  from: z.string().min(1).describe("Source file path (the note to add the link to)"),
  to: z.string().min(1).describe("Target page name to link to (e.g., 'My Note' for [[My Note]])"),
};

export function makeLinkNotesTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "link_notes",
    description:
      "Create a [[wikilink]] from one note to another. " +
      "Adds the link at the end of the source file.",
    inputSchema,
    async handler(input, ctx) {
      const { from, to } = input as { from: string; to: string };
      try {
        const sourcePath = await resolveRealSafePath(ctx.workspacePath, from);
        const content = await readFile(sourcePath, "utf-8");

        // Check if link already exists
        if (content.includes(`[[${to}]]`)) {
          return ok(`Link [[${to}]] already exists in ${from}.`);
        }

        const newContent = content.trimEnd() + `\n\n[[${to}]]\n`;
        await writeFile(sourcePath, newContent, "utf-8");
        return ok(`Added [[${to}]] to ${from}.`);
      } catch (e) {
        return err(`Link failed: ${(e as Error).message}`);
      }
    },
  };
}
