import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillManifest } from "@vale/shared";

/**
 * Build a minimally-valid skill manifest. Override any field via `overrides`.
 * The loader only validates `name`, `type`, and `version`, but we populate the
 * rest so the manifest matches the real shape skills ship with.
 */
export function makeManifest(
  overrides: Partial<SkillManifest> = {},
): SkillManifest {
  return {
    name: "example-skill",
    version: "1.0.0",
    type: "prompt",
    displayName: "Example Skill",
    description: "An example skill for testing.",
    author: { name: "Tester" },
    license: "MIT",
    price: "free",
    engines: { vale: "*" },
    permissions: [],
    ...overrides,
  };
}

/**
 * Write a skill directory under `parentDir`.
 * Creates `<parentDir>/<dirName>/skill.json` and, if `prompt` is provided,
 * `<parentDir>/<dirName>/prompts/system.md`.
 * Returns the absolute path to the skill directory.
 */
export async function writeSkill(
  parentDir: string,
  dirName: string,
  manifest: SkillManifest | string,
  prompt?: string,
): Promise<string> {
  const skillDir = join(parentDir, dirName);
  await mkdir(skillDir, { recursive: true });
  const manifestText =
    typeof manifest === "string" ? manifest : JSON.stringify(manifest, null, 2);
  await writeFile(join(skillDir, "skill.json"), manifestText, "utf-8");

  if (prompt !== undefined) {
    await mkdir(join(skillDir, "prompts"), { recursive: true });
    await writeFile(join(skillDir, "prompts", "system.md"), prompt, "utf-8");
  }

  return skillDir;
}
