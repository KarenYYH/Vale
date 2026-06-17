import type { InstalledSkill, SkillType } from "@vale/shared";
import { loadAllSkills } from "./loader.js";

/** In-memory registry of installed skills */
let skills: InstalledSkill[] = [];

/**
 * Initialize the skill registry by loading all skills.
 */
export async function initSkills(
  workspacePath: string,
  appSkillsPath?: string,
): Promise<void> {
  skills = await loadAllSkills(workspacePath, appSkillsPath);
}

/**
 * Get all installed skills, optionally filtered by type.
 */
export function getInstalledSkills(type?: SkillType): InstalledSkill[] {
  if (type) return skills.filter((s) => s.manifest.type === type);
  return [...skills];
}

/**
 * Find a specific skill by name.
 */
export function findSkill(name: string): InstalledSkill | undefined {
  return skills.find((s) => s.manifest.name === name);
}

/**
 * Get the formatted skill directory text for system prompt injection.
 */
export function getSkillDirectoryText(): string {
  const enabled = skills.filter((s) => s.enabled);
  if (enabled.length === 0) return "";

  return enabled
    .map(
      (s) =>
        `- **${s.manifest.name}** (${s.manifest.type}): ${s.manifest.description}` +
        (s.manifest.triggers?.length
          ? `\n  Triggers: ${s.manifest.triggers.join(", ")}`
          : ""),
    )
    .join("\n");
}

/**
 * Get concatenated prompt text from all enabled prompt-type skills.
 */
export function getSkillPromptText(): string {
  return skills
    .filter((s) => s.enabled && s.promptContent)
    .map((s) => `## Skill: ${s.manifest.displayName}\n\n${s.promptContent}`)
    .join("\n\n---\n\n");
}

/**
 * Get list of enabled triggers across all skills (for suggestion matching).
 */
export function getAllTriggers(): Array<{
  skillName: string;
  trigger: string;
}> {
  const triggers: Array<{ skillName: string; trigger: string }> = [];
  for (const s of skills) {
    if (!s.enabled || !s.manifest.triggers) continue;
    for (const t of s.manifest.triggers) {
      triggers.push({ skillName: s.manifest.name, trigger: t });
    }
  }
  return triggers;
}
