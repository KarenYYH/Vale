import type { ToolDefinition, ValeMcpContext } from "./types.js";
import { ok, err } from "./types.js";
import { initSkills, getInstalledSkills } from "@vale/skills";

export function makeListSkillsTool(_ctx: ValeMcpContext): ToolDefinition {
  return {
    name: "list_skills",
    description:
      "List all installed skills in the workspace. Skills extend Vale's capabilities " +
      "with custom ingest parsers, query strategies, lint rules, and AI prompts.",
    inputSchema: {},
    async handler(_input, ctx) {
      try {
        // (Re)load skills from <workspace>/.vale/skills on each call so the
        // listing reflects the current on-disk state.
        await initSkills(ctx.workspacePath);
        const skills = getInstalledSkills();

        if (skills.length === 0) {
          return ok(
            "No skills installed. Install skills via `vale skill install <name>` or browse https://skills.vale.sh.",
          );
        }

        const formatted = skills
          .map((s) => {
            const m = s.manifest;
            return `- **${m.name}** (${m.type}) — ${m.description}${s.enabled ? " ✅" : " (disabled)"}`;
          })
          .join("\n");

        return ok(`Installed skills:\n\n${formatted}`, {
          skills: skills.map((s) => ({
            name: s.manifest.name,
            type: s.manifest.type,
            description: s.manifest.description,
            enabled: s.enabled,
          })),
        });
      } catch (e) {
        return err(`List skills failed: ${(e as Error).message}`);
      }
    },
  };
}
