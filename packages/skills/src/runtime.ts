import type { InstalledSkill } from "@vale/shared";
import type { SkillExecutionContext, SkillExecutionResult } from "./types.js";

/** Default execution timeout (ms) */
const RUNTIME_TIMEOUT_MS = 30_000;

/**
 * Execute a skill.
 *
 * Currently prompt-only mode: returns the skill's prompt text as output.
 * Sandboxed execution (isolated-vm / worker_threads) is the next iteration.
 */
export async function executeSkill(
  skill: InstalledSkill,
  input: Record<string, unknown>,
  workspacePath: string,
): Promise<SkillExecutionResult> {
  const ctx: SkillExecutionContext = { workspacePath, skill, input };

  switch (skill.manifest.executionMode ?? "prompt-only") {
    case "prompt-only":
      return executePromptSkill(ctx);
    case "sandbox":
      return executeSandboxSkill(ctx);
    case "native":
      return executeNativeSkill(ctx);
    default:
      return {
        output: "",
        error: `Unknown execution mode: ${skill.manifest.executionMode}`,
      };
  }
}

/**
 * Prompt-only execution: returns the skill's prompt as output.
 * The AI uses built-in tools (Read, Write, Edit) under the skill's guidance.
 */
async function executePromptSkill(
  ctx: SkillExecutionContext,
): Promise<SkillExecutionResult> {
  const { skill } = ctx;

  if (!skill.promptContent) {
    return {
      output: `Skill "${skill.manifest.displayName}" has no prompt content.`,
    };
  }

  return {
    output: skill.promptContent,
    meta: {
      skillName: skill.manifest.name,
      skillType: skill.manifest.type,
      executionMode: "prompt-only",
    },
  };
}

/** Stub: sandboxed execution via isolated-vm */
async function executeSandboxSkill(
  _ctx: SkillExecutionContext,
): Promise<SkillExecutionResult> {
  return {
    output: "",
    error: "Sandbox execution not yet implemented. Use prompt-only mode.",
  };
}

/** Stub: native execution via worker_threads */
async function executeNativeSkill(
  _ctx: SkillExecutionContext,
): Promise<SkillExecutionResult> {
  return {
    output: "",
    error: "Native execution not yet implemented. Use prompt-only mode.",
  };
}
