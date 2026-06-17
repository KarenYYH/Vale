import { z } from "zod";
import { runLint, formatLintReport } from "@vale/core";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

const inputSchema = {
  rules: z.array(z.string()).optional().describe("Specific lint rules to run (default: all)"),
};

export function makeRunLintTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "run_lint",
    description:
      "Run quality checks on the knowledge base. Checks for: " +
      "broken wikilinks, orphaned pages, missing frontmatter, and missing tags.",
    inputSchema,
    async handler(input, ctx) {
      const { rules } = input as { rules?: string[] };
      try {
        const report = await runLint(ctx.workspacePath, rules);
        const formatted = formatLintReport(report);
        return ok(formatted, { report });
      } catch (e) {
        return err(`Lint failed: ${(e as Error).message}`);
      }
    },
  };
}
