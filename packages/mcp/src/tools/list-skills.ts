import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";

export function makeListSkillsTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "list_skills",
    description:
      "List all installed skills in the workspace. Skills extend Vale's capabilities " +
      "with custom ingest parsers, query strategies, lint rules, and AI prompts.",
    inputSchema: {},
    async handler(_input, ctx) {
      try {
        // Attempt to load skills if the skills package is available
        // In the MVP, this returns a stub
        const skills = await loadSkills(ctx.workspacePath);

        if (skills.length === 0) {
          return ok(
            "No skills installed. Install skills via `vale skill install <name>` or browse https://skills.vale.sh.",
          );
        }

        const formatted = skills
          .map(
            (s) =>
              `- **${s.name}** (${s.type}) — ${s.description}${s.enabled ? " ✅" : " (disabled)"}`,
          )
          .join("\n");

        return ok(`Installed skills:\n\n${formatted}`, { skills });
      } catch (e) {
        return err(`List skills failed: ${(e as Error).message}`);
      }
    },
  };
}

/** Stub — will be replaced with actual @vale/skills integration */
async function loadSkills(_workspacePath: string): Promise<
  Array<{
    name: string;
    type: string;
    description: string;
    enabled: boolean;
  }>
> {
  // TODO: integrate with @vale/skills package
  return [];
}
