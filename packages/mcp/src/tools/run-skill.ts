import { z } from "zod";
import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";
import { initSkills, findSkill, executeSkill } from "@vale/skills";

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
        await initSkills(ctx.workspacePath);
        const skill = findSkill(name);
        if (!skill) {
          return err(`Skill "${name}" not found. Run list_skills to see installed skills.`);
        }

        const result = await executeSkill(skill, skillInput ?? {}, ctx.workspacePath);
        if (result.error) {
          return err(`Skill "${name}" failed: ${result.error}`);
        }
        return ok(result.output, result.meta);
      } catch (e) {
        return err(`Skill execution failed: ${(e as Error).message}`);
      }
    },
  };
}
