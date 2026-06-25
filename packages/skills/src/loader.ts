import { readFile, readdir, stat } from "fs/promises";
import { join, basename } from "path";
import type { SkillManifest, InstalledSkill, SkillType } from "@vale/shared";
import { SKILLS_DIR as skillsSubDir } from "@vale/shared";

/**
 * Load a skill from a directory path.
 * Reads skill.json and prompts/system.md.
 */
export async function loadSkillFromPath(
  skillPath: string,
): Promise<InstalledSkill | null> {
  try {
    const manifestRaw = await readFile(join(skillPath, "skill.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as SkillManifest;

    // Validate basic fields
    if (!manifest.name || !manifest.type || !manifest.version) {
      return null;
    }

    // Load prompt content
    let promptContent: string | null = null;
    try {
      promptContent = await readFile(
        join(skillPath, "prompts", "system.md"),
        "utf-8",
      );
    } catch {
      // Prompt is optional
    }

    const dirStat = await stat(skillPath);

    return {
      manifest,
      installPath: skillPath,
      installedAt: dirStat.birthtimeMs,
      promptContent,
      enabled: true,
    };
  } catch {
    return null;
  }
}

/**
 * Load all skills from both app built-in and workspace directories.
 *
 * Resolution order:
 *   1. App built-in skills (packaged with Vale)
 *   2. Workspace skills (.vale/skills/) — override built-in with same name
 */
export async function loadAllSkills(
  workspacePath: string,
  appSkillsPath?: string,
): Promise<InstalledSkill[]> {
  const skillMap = new Map<string, InstalledSkill>();

  // 1. Load app built-in skills
  if (appSkillsPath) {
    const builtin = await loadSkillsFromDir(appSkillsPath);
    for (const skill of builtin) {
      if (skill) skillMap.set(skill.manifest.name, skill);
    }
  }

  // 2. Load workspace skills (override built-in).
  // skillsSubDir (SKILLS_DIR) already includes the ".vale" prefix, so it is
  // joined directly onto the workspace path — joining VALE_DIR again would
  // produce ".vale/.vale/skills" and silently miss real skills.
  const workspaceSkillsDir = join(workspacePath, skillsSubDir);
  const workspace = await loadSkillsFromDir(workspaceSkillsDir);
  for (const skill of workspace) {
    if (skill) skillMap.set(skill.manifest.name, skill);
  }

  return [...skillMap.values()];
}

/** Load skills from a directory containing skill subdirectories */
async function loadSkillsFromDir(
  dirPath: string,
): Promise<(InstalledSkill | null)[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const skillDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

    return Promise.all(
      skillDirs.map((d) => loadSkillFromPath(join(dirPath, d.name))),
    );
  } catch {
    return [];
  }
}
