import type { SkillManifest, InstalledSkill, SkillType } from "@vale/shared";

export type { SkillManifest, InstalledSkill, SkillType };

/** Skill execution context */
export interface SkillExecutionContext {
  workspacePath: string;
  skill: InstalledSkill;
  input: Record<string, unknown>;
}

/** Skill execution result */
export interface SkillExecutionResult {
  output: string;
  meta?: Record<string, unknown>;
  error?: string;
}
