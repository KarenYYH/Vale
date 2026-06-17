import { z } from "zod";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

const inputSchema = {
  name: z.string().min(1).describe("Name of the skill to execute"),
  input: z.record(z.unknown()).default({}).describe("Input parameters for the skill"),
};

export function makeRunSkillTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "run_skill",
    description:
      "Execute an installed skill. Skills of type 'prompt' return their system prompt " +
      "which the AI should follow. Other skill types execute their handler.",
    inputSchema,
    async handler(input, ctx) {
      const { name, input: skillInput } = input as { name: string; input?: Record<string, unknown> };
      try {
        // TODO: integrate with @vale/skills runtime
        const result = await executeSkill(ctx.workspacePath, name, skillInput ?? {});
        return ok(result.output, result.meta);
      } catch (e) {
        return err(`Skill execution failed: ${(e as Error).message}`);
      }
    },
  };
}

/** Stub — will be replaced with actual @vale/skills integration */
async function executeSkill(
  _workspacePath: string,
  name: string,
  _input: Record<string, unknown>,
): Promise<{ output: string; meta?: Record<string, unknown> }> {
  return {
    output: `Skill "${name}" not found or not yet implemented. Install skills via the marketplace.`,
  };
}
